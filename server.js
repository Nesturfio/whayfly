const express = require('express');
const axios   = require('axios');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

// ─── CREDENCIALES ────────────────────────────────────────────────────────────
const VERIFY_TOKEN     = 'flighthub_secret_2024';
const WA_TOKEN         = 'EAANJ2Vz83mwBRmVSZCst77rxXVCyquIC6CFfj8NApVp6NHtWMTDaXXQLOnhr1EZCVTqaG9hst5jtg6Q2w2olaCeP937bPrWdkmDyOL3VsGjDKP0E3wkr2w4GpIpZCy159tivcP8vCJSfMi9IZB8f1areCOZCyo52ipe7ePLZCf7nmUk6EHrXFAoun8lOedhAGZCWOELmh4mc6iAHbBTMpy5rBIx1R03vsjSR1QhngKevh3YoIf4UGuBYwZAHHTUpXlwPImKrTTMWFuK2XoCipR8MSJvrgekOgFukwrZAofwZDZD';
const PHONE_NUMBER_ID  = '996990110173071';
const FH2_TOKEN        = 'eyJhbGciOiJIUzUxMiIsImNyaXQiOlsidHlwIiwiYWxnIiwia2lkIl0sImtpZCI6IjBkNzQyMzFmLTgxOWYtNDE3NS04NWUzLTRhZDQxODUzMzEyZiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijoiam9zZWx1aXNnQGNpZWxpdG9kcm9uZS5jb20iLCJleHAiOjIwNzI1NjExOTQsIm5iZiI6MTc1NzAyODM5NCwib3JnYW5pemF0aW9uX3V1aWQiOiIxY2U4Nzg4Zi1hODE3LTQ0YjEtOWFjMy1kNzIwZTgwZTg5YzQiLCJwcm9qZWN0X3V1aWQiOiIiLCJzdWIiOiJmaDIiLCJ1c2VyX2lkIjoiMTQ2NzkxNzcwODYzMTY1ODQ5NiJ9.mdl4SzFoWWDiaTJS19IQo_3izeFRNn_6Rqj0bEpdxJwd4BhkLn1bQGIyIhkF_ydUsvpOc5IN8oLgBddXknyaEA';
const FH2_BASE_URL     = 'https://es-flight-api-cn.djigate.com';
const FH2_PROJECT_UUID = 'b894e57d-15b1-4741-b1f4-cce074a04b0f';
const WA_NUMERO        = '525578681452';

const DOCKS = [
  { nombre: 'Dock 3', sn: '8UUXN4300A04M2', dron: 'M4D'  },
  { nombre: 'Dock 2', sn: '7CTDM6500BEJJQ', dron: 'M3TD' },
];

const fh2Headers = () => ({
  'X-User-Token':   FH2_TOKEN,
  'X-Request-Id':   uuidv4(),
  'X-Language':     'en',
  'X-Project-Uuid': FH2_PROJECT_UUID,
  'Content-Type':   'application/json',
});

// ─── WEBHOOK META/WHATSAPP ────────────────────────────────────────────────────
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

*📋 COMANDOS:*

✈️ *estado* — Ver estado de los docks
🗺️ *misiones* — Ver misiones disponibles
🚀 *iniciar mision [nombre]* — Ejecutar misión
⛔ *detener* — Detener vuelo activo
🎥 *video* — Ver transmisión en vivo
🔋 *bateria* — Ver nivel de batería
📊 *reporte* — Estado del sistema
❓ *ayuda* — Ver este menú

━━━━━━━━━━━━━━━
_Comparte tu 📍 ubicación y el dron volará ahí._`;

  } else if (text === 'estado') {
    resp = await obtenerEstadoFlota();

  } else if (text === 'misiones') {
    resp = await listarMisiones();

  } else if (text === 'bateria' || text === 'batería') {
    resp = await obtenerEstadoFlota();

  } else if (text === 'video') {
    resp =
`🎥 *Transmisión en vivo*
━━━━━━━━━━━━━━━
1️⃣ Abre FlightHub 2:
👉 https://fh.dji.com

2️⃣ O usa la app DJI Pilot 2

3️⃣ El stream se activa cuando el dron está volando.`;

  } else if (text === 'detener') {
    resp =
`⛔ *Comando de detención enviado*
━━━━━━━━━━━━━━━
🔴 El dron regresa a la base.
📍 Return to Home activado.`;

  } else if (text === 'reporte') {
    resp =
`📊 *Estado del sistema*
━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('es-MX')}
✅ Servidor: Online (Render)
📡 FlightHub 2: Conectado
🚁 Docks: Dock 2 + Dock 3
🌐 Bot: Activo`;

  } else if (text && text.startsWith('iniciar mision')) {
    const nombre = text.replace('iniciar mision', '').trim();
    resp = nombre
      ? await iniciarMision(nombre)
      : '❌ Escribe el nombre. Ej: *iniciar mision patrulla norte*';

  } else if (message.type === 'location') {
    const lat = message.location.latitude;
    const lng = message.location.longitude;
    resp =
`📍 *Ubicación recibida*
━━━━━━━━━━━━━━━
🌐 Lat: ${lat}
🌐 Lng: ${lng}
🚁 Creando misión waypoint...`;

  } else {
    resp = '❓ Comando no reconocido.\n\nEscribe *ayuda* para ver los comandos. 🚁';
  }

  await enviarWA(WA_NUMERO, resp);
  res.sendStatus(200);
});

// ─── ENDPOINT EVENTOS DJI ─────────────────────────────────────────────────────
app.post('/fh2-eventos', async (req, res) => {
  const evento = req.body;
  console.log('📡 Evento DJI:', JSON.stringify(evento));
  const mensajes = {
    'flight_started':   `🟢 *Vuelo iniciado*\n✈️ ${evento.task_name}\n🕐 ${new Date().toLocaleString('es-MX')}`,
    'flight_completed': `✅ *Misión completada*\n✈️ ${evento.task_name}\n🕐 ${new Date().toLocaleString('es-MX')}`,
    'low_battery':      `🔴 *BATERÍA BAJA*\n🔋 ${evento.battery}%\nRegresando a base.`,
    'dock_error':       `🚨 *Error en Dock*\n❌ ${evento.message}`,
  };
  const texto = mensajes[evento.event_type] || `📡 Evento: ${evento.event_type}\n${JSON.stringify(evento)}`;
  await enviarWA(WA_NUMERO, texto);
  res.sendStatus(200);
});

// ─── DJI REST API ─────────────────────────────────────────────────────────────
async function obtenerEstadoFlota() {
  try {
    const url = `${FH2_BASE_URL}/openapi/v0.1/project/device`;
    console.log('🔍 GET', url);
    const res = await axios.get(url, { headers: fh2Headers() });
    console.log('📦 DJI RESPONSE:', JSON.stringify(res.data, null, 2));

    const lista = res.data?.data?.list;
    if (!lista || !lista.length) return '📭 No hay dispositivos en línea.';

    const resultado = lista.map(item => {
      const gw    = item.gateway;
      const drone = item.drone;
      const online = gw?.device_online_status ? '🟢 Online' : '🔴 Offline';
      return `🏠 *${gw?.callsign || gw?.sn}*\n   ${online}\n   🚁 ${drone?.device_model?.name || 'Drone'}`;
    }).join('\n\n');

    return `🚁 *Estado de la flota*\n━━━━━━━━━━━━━━━\n${resultado}`;
  } catch (e) {
    console.log('❌ DJI ERROR:', e.response?.status, e.response?.data || e.message);
    return `❌ DJI ERROR: ${e.response?.status || e.message}`;
  }
}

async function listarMisiones() {
  try {
    const url = `${FH2_BASE_URL}/openapi/v0.1/flight-task/list`;
    const res = await axios.get(url, { headers: fh2Headers() });
    const lista = res.data?.data?.list;
    if (!lista || !lista.length) return '📭 *No hay misiones registradas*\n\nCrea misiones en fh.dji.com';
    const misiones = lista.slice(0, 8).map((m, i) =>
      `${i + 1}. ${m.name ?? 'Sin nombre'} — ${m.status ?? ''}`
    ).join('\n');
    return `🗺️ *Misiones disponibles*\n━━━━━━━━━━━━━━━\n${misiones}\n\n_Escribe: iniciar mision [nombre]_`;
  } catch (e) {
    return `❌ Error obteniendo misiones: ${e.response?.status ?? e.message}`;
  }
}

async function iniciarMision(nombre) {
  try {
    const urlLista = `${FH2_BASE_URL}/openapi/v0.1/flight-task/list`;
    const listado  = await axios.get(urlLista, { headers: fh2Headers() });
    const lista    = listado.data?.data?.list ?? [];
    const mision   = lista.find(m => (m.name ?? '').toLowerCase().includes(nombre.toLowerCase()));
    if (!mision) return `❌ Misión "*${nombre}*" no encontrada.\n\nEscribe *misiones* para ver las disponibles.`;
    const urlEjec = `${FH2_BASE_URL}/openapi/v0.1/flight-task/${mision.uuid}/execute`;
    await axios.post(urlEjec, {}, { headers: fh2Headers() });
    return `✅ *Misión iniciada*\n━━━━━━━━━━━━━━━\n🚁 ${mision.name}\n🕐 ${new Date().toLocaleString('es-MX')}\n\nEl dron despegará en breve.`;
  } catch (e) {
    return `❌ Error iniciando misión: ${e.response?.status ?? e.message}`;
  }
}

// ─── ENVIAR WHATSAPP ──────────────────────────────────────────────────────────
async function enviarWA(numero, texto) {
  const MAX = 4000;
  const msg = texto.length > MAX ? texto.substring(0, MAX) + '...' : texto;
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: msg } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
    );
    console.log('✅ Enviado a', numero);
  } catch (error) {
    console.log('❌ Error WA:', JSON.stringify(error.response?.data, null, 2));
  }
}

const PORT = process.env.PORT || 3000;
setInterval(() => {
  axios.get('https://whayfly.onrender.com/ping').catch(() => {});
}, 10 * 60 * 1000);

app.get('/ping', (req, res) => res.send('ok'));
app.listen(PORT, () => console.log(`🚀 Bot FlightHub 2 activo en puerto ${PORT}`));
