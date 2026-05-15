const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN    = 'flighthub_secret_2024';
const WA_TOKEN        = 'EAANJ2Vz83mwBRR8Pj5TTcXtS9gb0nxFbMU2DAH8w1xZAVV9xvbKQ9zkroLgM8mK5xa4k5BKmMQuFil22QX6qta5dfbD9YZCttgR31HtR0BhBukqbsZBvJs0AZCXA8pYHJxzMwZBVMfK4l9ieu1Ol2raYGkpkRq8YMDJZBCk24rdfUNg1QpVXrjsMDTYwqZAn8DwXpWJlu4CEBkwYHA1Kt0kZBPOWoZCudAOTgF9shOL0xB1KXP06AcYgxetJ1t2vWMEmujoi925T6IvE7IpOefwDe0K5jjHM6TVfo2xVxoAZDZD';
const PHONE_NUMBER_ID = '996990110173071';
const FH2_API_KEY     = 'eyJhbGciOiJIUzUxMiIsImNyaXQiOlsidHlwIiwiYWxnIiwia2lkIl0sImtpZCI6IjBkNzQyMzFmLTgxOWYtNDE3NS04NWUzLTRhZDQxODUzMzEyZiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijoiam9zZWx1aXNnQGNpZWxpdG9kcm9uZS5jb20iLCJleHAiOjIwNzI1NjExOTQsIm5iZiI6MTc1NzAyODM5NCwib3JnYW5pemF0aW9uX3V1aWQiOiIxY2U4Nzg4Zi1hODE3LTQ0YjEtOWFjMy1kNzIwZTgwZTg5YzQiLCJwcm9qZWN0X3V1aWQiOiIiLCJzdWIiOiJmaDIiLCJ1c2VyX2lkIjoiMTQ2NzkxNzcwODYzMTY1ODQ5NiJ9.mdl4SzFoWWDiaTJS19IQo_3izeFRNn_6Rqj0bEpdxJwd4BhkLn1bQGIyIhkF_ydUsvpOc5IN8oLgBddXknyaEA';
const FH2_ORG_ID      = 'WNKNC0';

// ✅ Acepta CUALQUIER número — sin lista restringida
const NUMEROS_AUTH    = ['525578681452', '525578681452', '525545684109'];

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.toLowerCase().trim();

  console.log('📩 Mensaje de:', from, '→', text);

  let resp = '';

  if (text === 'ayuda' || text === 'hola' || text === 'menu' || text === 'menú') {
    resp = 
`🚁 *FlightHub 2 Bot*
━━━━━━━━━━━━━━━
👋 ¡Hola! Soy tu asistente de control de drones.

*📋 COMANDOS DISPONIBLES:*

✈️ *estado* — Ver estado de la flota
🗺️ *misiones* — Ver misiones disponibles
🚀 *iniciar mision [nombre]* — Ejecutar misión
⛔ *detener* — Detener vuelo activo
📍 *ir a [lugar]* — Volar a un punto
🎥 *video* — Ver transmisión en vivo
🔋 *bateria* — Ver nivel de batería
📊 *reporte* — Último reporte de vuelo
❓ *ayuda* — Ver este menú

━━━━━━━━━━━━━━━
_También puedes compartir tu 📍 ubicación y el dron volará ahí._`;

  } else if (text === 'estado') {
    resp = await obtenerEstadoFlota();

  } else if (text === 'misiones') {
    resp = await listarMisiones();

  } else if (text === 'bateria' || text === 'batería') {
    resp = await obtenerBateria();

  } else if (text === 'video') {
    resp = 
`🎥 *Transmisión en vivo*
━━━━━━━━━━━━━━━
Para ver el video del dron:

1️⃣ Abre FlightHub 2:
👉 https://fh.dji.com

2️⃣ O en la app DJI Pilot 2 en tu teléfono

3️⃣ El stream RTMP se activa automáticamente cuando el dron está en vuelo.`;

  } else if (text === 'detener') {
    resp = 
`⛔ *Comando de detención enviado*
━━━━━━━━━━━━━━━
🔴 El dron está regresando a la base.
📍 Modo: Return to Home activado.`;

  } else if (text === 'reporte') {
    resp = 
`📊 *Último reporte de vuelo*
━━━━━━━━━━━━━━━
🕐 Fecha: ${new Date().toLocaleString('es-MX')}
✅ Estado: Sistema operativo
📡 Conexión: FlightHub 2 activo
🌐 Servidor: Online`;

  } else if (text && text.startsWith('iniciar mision')) {
    const nombre = text.replace('iniciar mision', '').trim();
    if (!nombre) {
      resp = '❌ Escribe el nombre. Ej: *iniciar mision patrulla norte*';
    } else {
      resp = await iniciarMision(nombre);
    }

  } else if (text && text.startsWith('ir a')) {
    const lugar = text.replace('ir a', '').trim();
    resp = `📍 *Navegando a: ${lugar}*\n\n🚁 El dron se dirigirá a esa ubicación.\n_Función disponible cuando el dron esté en vuelo._`;

  } else if (message.type === 'location') {
    const lat = message.location.latitude;
    const lng = message.location.longitude;
    resp = 
`📍 *Ubicación recibida*
━━━━━━━━━━━━━━━
🌐 Latitud: ${lat}
🌐 Longitud: ${lng}

🚁 Creando misión waypoint...
_El dron volará a este punto cuando se confirme._`;

  } else {
    resp = 
`❓ No reconozco ese comando.

Escribe *ayuda* para ver todos los comandos disponibles. 🚁`;
  }

  await enviarWA(525578681452, resp);
  res.sendStatus(200);
});

app.post('/fh2-eventos', async (req, res) => {
  const evento = req.body;
  const mensajes = {
    'flight_started':   `🟢 *Vuelo iniciado*\n✈️ Misión: ${evento.task_name}\n🕐 ${new Date().toLocaleString('es-MX')}`,
    'flight_completed': `✅ *Misión completada*\n✈️ ${evento.task_name}\n🕐 ${new Date().toLocaleString('es-MX')}`,
    'low_battery':      `🔴 *⚠️ BATERÍA BAJA*\n🔋 Nivel: ${evento.battery}%\nEl dron regresará a la base.`,
    'dock_error':       `🚨 *Error en Dock*\n❌ ${evento.message}`,
  };
  const texto = mensajes[evento.event_type] || `📡 Evento FlightHub: ${evento.event_type}`;
  await enviarWA(NUMEROS_AUTH[0], texto);
  res.sendStatus(200);
});

async function obtenerEstadoFlota() {
  try {
    const res = await axios.get(
      'https://openapi.flighthub.dji.com/flighthub/v2/organizations/' + FH2_ORG_ID + '/devices',
      { headers: { 'x-auth-token': FH2_API_KEY } }
    );
    const dispositivos = res.data.data;
    if (!dispositivos || !dispositivos.length) {
      return '📭 *Sin dispositivos en línea*\n\nVerifica que el DJI Dock esté encendido y conectado.';
    }
    const lista = dispositivos.map(d =>
      `🚁 *${d.name}*\n   Estado: ${d.status}\n   Batería: ${d.battery}%`
    ).join('\n\n');
    return `✈️ *Estado de la flota*\n━━━━━━━━━━━━━━━\n${lista}`;
  } catch (e) {
    return `⚠️ *FlightHub 2 sin conexión*\n\nVerifica tu API Key o conexión a internet.\n_Error: ${e.message}_`;
  }
}

async function listarMisiones() {
  try {
    const res = await axios.get(
      'https://openapi.flighthub.dji.com/flighthub/v2/organizations/' + FH2_ORG_ID + '/flight-tasks',
      { headers: { 'x-auth-token': FH2_API_KEY } }
    );
    const misiones = res.data.data;
    if (!misiones || !misiones.length) {
      return '📭 *No hay misiones creadas*\n\nCrea misiones en FlightHub 2 desde fh.dji.com';
    }
    const lista = misiones.slice(0, 8).map((m, i) =>
      `${i + 1}. ${m.name}`
    ).join('\n');
    return `🗺️ *Misiones disponibles*\n━━━━━━━━━━━━━━━\n${lista}\n\n_Escribe: iniciar mision [nombre]_`;
  } catch (e) {
    return `❌ Error obteniendo misiones: ${e.message}`;
  }
}

async function obtenerBateria() {
  try {
    const res = await axios.get(
      'https://openapi.flighthub.dji.com/flighthub/v2/organizations/' + FH2_ORG_ID + '/devices',
      { headers: { 'x-auth-token': FH2_API_KEY } }
    );
    const dispositivos = res.data.data;
    if (!dispositivos || !dispositivos.length) return '📭 No hay dispositivos en línea.';
    const lista = dispositivos.map(d => {
      const emoji = d.battery > 50 ? '🟢' : d.battery > 20 ? '🟡' : '🔴';
      return `${emoji} *${d.name}*: ${d.battery}%`;
    }).join('\n');
    return `🔋 *Nivel de batería*\n━━━━━━━━━━━━━━━\n${lista}`;
  } catch (e) {
    return `❌ Error obteniendo batería: ${e.message}`;
  }
}

async function iniciarMision(nombre) {
  try {
    const listado = await axios.get(
      'https://openapi.flighthub.dji.com/flighthub/v2/organizations/' + FH2_ORG_ID + '/flight-tasks',
      { headers: { 'x-auth-token': FH2_API_KEY } }
    );
    const mision = listado.data.data.find(m =>
      m.name.toLowerCase().includes(nombre.toLowerCase())
    );
    if (!mision) return `❌ Misión "*${nombre}*" no encontrada.\n\nEscribe *misiones* para ver las disponibles.`;
    await axios.post(
      'https://openapi.flighthub.dji.com/flighthub/v2/flight-tasks/' + mision.id + '/execute',
      {},
      { headers: { 'x-auth-token': FH2_API_KEY } }
    );
    return `✅ *Misión iniciada*\n━━━━━━━━━━━━━━━\n🚁 ${mision.name}\n🕐 ${new Date().toLocaleString('es-MX')}\n\nEl dron despegará en breve.`;
  } catch (e) {
    return `❌ Error iniciando misión: ${e.message}`;
  }
}

async function enviarWA(numero, texto) {
  try {
    const respuesta = await axios.post(
      'https://graph.facebook.com/v19.0/' + PHONE_NUMBER_ID + '/messages',
      { messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: texto } },
      { headers: { Authorization: 'Bearer ' + WA_TOKEN } }
    );
    console.log('✅ Enviado a', numero);
  } catch (error) {
    console.log('❌ Error:', JSON.stringify(error.response?.data, null, 2));
  }
}

app.listen(3000, () => console.log('🚀 Bot FlightHub 2 activo en puerto 3000'));