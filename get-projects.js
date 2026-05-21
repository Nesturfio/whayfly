const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const FH2_TOKEN = 'PEGA_AQUI_EL_TOKEN_REAL';

async function obtenerProjects() {

  try {

    const res = await axios.get(
      'https://es-flight-api-cn.djigate.com/openapi/v0.1/project/list',
      {
        headers: {
          'X-User-Token': FH2_TOKEN,
          'X-Request-Id': uuidv4(),
          'X-Language': 'en',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      JSON.stringify(res.data, null, 2)
    );

  } catch(e) {

    console.log('STATUS:', e.response?.status);

    console.log(
      JSON.stringify(e.response?.data, null, 2)
    );

  }

}

obtenerProjects();