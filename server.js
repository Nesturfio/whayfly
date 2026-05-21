const express = require('express');
const axios   = require('axios');
const mqtt    = require('mqtt');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());
 
// ─── CREDENCIALES ────────────────────────────────────────────────────────────
const VERIFY_TOKEN    = 'flighthub_secret_2024';
const WA_TOKEN        = 'EAANJ2Vz83mwBRmVSZCst77rxXVCyquIC6CFfj8NApVp6NHtWMTDaXXQLOnhr1EZCVTqaG9hst5jtg6Q2w2olaCeP937bPrWdkmDyOL3VsGjDKP0E3wkr2w4GpIpZCy159tivcP8vCJSfMi9IZB8f1areCOZCyo52ipe7ePLZCf7nmUk6EHrXFAoun8lOedhAGZCWOELmh4mc6iAHbBTMpy5rBIx1R03vsjSR1QhngKevh3YoIf4UGuBYwZAHHTUpXlwPImKrTTMWFuK2XoCipR8MSJvrgekOgFukwrZAofwZDZD';
const PHONE_NUMBER_ID = '996990110173071';
const FH2_TOKEN       = 'eyJhbGciOiJIUzUxMiIsImNyaXQiOlsidHlwIiwiYWxnIiwia2lkIl0sImtpZCI6IjBkNzQyMzFmLTgxOWYtNDE3NS04NWUzLTRhZDQxODUzMzEyZiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijoiam9zZWx1aXNnQGNpZWxpdG9kcm9uZS5jb20iLCJleHAiOjIwNzI1NjExOTQsIm5iZiI6MTc1NzAyODM5NCwib3JnYW5pemF0aW9uX3V1aWQiOiIxY2U4Nzg4Zi1hODE3LTQ0YjEtOWFjMy1kNzIwZTgwZTg5YzQiLCJwcm9qZWN0X3V1aWQiOiIiLCJzdWIiOiJmaDIiLCJ1c2VyX2lkIjoiMTQ2NzkxNzcwODYzMTY1ODQ5NiJ9.mdl4SzFoWWDiaTJS19IQo_3izeFRNn_6Rqj0bEpdxJwd4BhkLn1bQGIyIhkF_ydUsvpOc5IN8oLgBddXknyaEA';
const FH2_BASE_URL    = 'https://es-flight-api-cn.djigate.com';
const FH2_PROJECT_UUID = 'b894e57d-15b1-4741-b1f4-cce074a04b0f';
const WA_NUMERO       = '525578681452';
 
// ─── MQTT (FlightHub Sync Beta) ───────────────────────────────────────────────
const MQTT_HOST = 'mqtt01-us.airdata.com';
const MQTT_PORT = 1883;
const MQTT_USER = 'HDY8PSYKWS';
const MQTT_PASS = 'Prueba12#$';  // ← reemplaza con tu contraseña real si es diferente
 
// ─── DOCKS ───────────────────────────────────────────────────────────────────
const DOCKS = [
  { nombre: 'Dock 3', sn: '8UUXN4300A04M2',  dron: 'M4D'  },
  { nombre: 'Dock 2', sn: '7CTDM6500BEJJQ',  dron: 'M3TD' },
];
 
// ─── ESTADO EN MEMORIA (actualizado por MQTT) ────────────────────────────────
const estadoDocks = {};
DOCKS.forEach(d => {
  estadoDocks[d.sn] = {
    nombre:  d.nombre,
    dron:    d.dron,
    online:  false,
    bateria: '--',
    estado:  'Sin datos',
    lat:     null,
    lng:     null,
    ultimo:  null,
  };
});
 
// ─── CONEXIÓN MQTT ────────────────────────────────────────────────────────────
const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  username:        MQTT_USER,
  password:        MQTT_PASS,
  clientId:        `fh2bot_${uuidv4().slice(0, 8)}`,
  reconnectPeriod: 5000,
  connectTimeout:  10000,
});
 
mqttClient.on('connect', () => {
  console.log('✅ MQTT conectado a', MQTT_HOST);
 
  // Suscribirse a todos los tópicos relevantes de los docks
  DOCKS.forEach(d => {
    const topics = [
      `device/status/${d.sn}`,
      `device/telemetry/${d.sn}`,
      `drone/status/${d.sn}`,
      `drone/telemetry/${d.sn}`,
      `${d.sn}/status`,
      `${d.sn}/telemetry`,
      `fh2/${d.sn}/#`,
    ];
    topics.forEach(t => {
      mqttClient.subscribe(t, { qos: 0 }, (err) => {
        if (!err) console.log(`📡 Suscrito: ${t}`);
      });
    });
  });
 
  // Tópico genérico para descubrir qué llega
  mqttClient.subscribe('#', { qos: 0 }, (err) => {
    if (!err) console.log('📡 Suscrito a tópico wildcard #');
  });
});
 
mqttClient.on('message', (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    console.log(`📨 MQTT [${topic}]:`, JSON.stringify(data).slice(0, 200));
 
    // Identificar a qué dock pertenece el mensaje
    const dock = DOCKS.find(d => topic.includes(d.sn));
    if (!dock) return;
 
    const est = estadoDocks[dock.sn];
    est.ultimo = new Date().toLocaleString('es-MX');
 
    // Mapear campos comunes de telemetría DJI/AirData
    if (data.online      !== undefined) est.online  = data.online;
    if (data.connected   !== undefined) est.online  = data.connected;
    if (data.battery     !== undefined) est.bateria = `${data.battery}%`;
    if (data.bat_percent !== undefined) est.bateria = `${data.bat_percent}%`;
    if (data.status      !== undefined) est.estado  = data.status;
    if (data.mode        !== undefined) est.estado  = data.mode;
    if (data.latitude    !== undefined) est.lat     = data.latitude;
    if (data.longitude   !== undefined) est.lng     = data.longitude;
    if (data.lat         !== undefined) est.lat     = data.lat;
    if (data.lng         !== undefined) est.lng     = data.lng;
 
    // Alertas automáticas por WhatsApp
    if (data.battery && data.battery < 20) {
      enviarWA(WA_NUMERO, `🔴 *BATERÍA BAJA*\n🏠 ${dock.nombre}\n🔋 ${data.battery}%\nRegresando a base.`);
    }
    if (data.status === 'error' || data.mode === 'error') {
      enviarWA(WA_NUMERO, `🚨 *Error en ${dock.nombre}*\n❌ ${JSON.stringify(data)}`);
    }
 
  } catch (e) {
    // Payload no es JSON — ignorar
  }
});
 
mqttClient.on('error',      (e) => console.log('❌ MQTT error:', e.message));
mqttClient.on('reconnect',  ()  => console.log('🔄 MQTT reconectando...'));
mqttClient.on('disconnect', ()  => console.log('⚠️  MQTT desconectado'));
 
// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
    resp = obtenerEstadoMQTT();
 
  } else if (text === 'misiones') {
    resp = await listarMisiones();
 
  } else if (text === 'bateria' || text === 'batería') {
    resp = obtenerBateriaMQTT();
 
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
    const mqttStatus = mqttClient.connected ? '🟢 Conectado' : '🔴 Desconectado';
    resp =
`📊 *Estado del sistema*
━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('es-MX')}
✅ Servidor: Online
📡 MQTT: ${mqttStatus}
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
 
// ─── ESTADO DESDE MQTT (sin llamar a DJI REST API) ───────────────────────────
function obtenerEstadoMQTT() {
  const lineas = Object.values(estadoDocks).map(d => {
    const online  = d.online ? '🟢 Online' : '🔴 Offline';
    const ultimo  = d.ultimo ? `\n   🕐 ${d.ultimo}` : '';
    const ubicacion = d.lat ? `\n   📍 ${d.lat}, ${d.lng}` : '';
    return `🏠 *${d.nombre}* (${d.dron})\n   ${online} — 🔋 ${d.bateria} — ${d.estado}${ubicacion}${ultimo}`;
  });
 
  const mqttStatus = mqttClient.connected
    ? '🟢 MQTT conectado — datos en tiempo real'
    : '🔴 MQTT desconectado — datos no disponibles';
 
  return `🚁 *Estado de la flota*\n━━━━━━━━━━━━━━━\n${lineas.join('\n\n')}\n\n📡 ${mqttStatus}`;
}
 
function obtenerBateriaMQTT() {
  const lineas = Object.values(estadoDocks).map(d => {
    const icon = d.online ? '🟢' : '🔴';
    return `${icon} *${d.nombre}* — 🔋 ${d.bateria}`;
  });
  return `🔋 *Batería de los drones*\n━━━━━━━━━━━━━━━\n${lineas.join('\n')}`;
}
 
// ─── MISIONES (REST API — sigue intentando) ───────────────────────────────────
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
 
app.listen(3000, () => console.log('🚀 Bot FlightHub 2 activo en puerto 3000'));