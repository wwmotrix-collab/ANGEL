/**
 * motores/coordenadas.js
 * WWMX Campaign — Cloud Function para geocodificação de locais de votação
 * 
 * Esta função é executada no backend (Firebase Functions) e não no frontend.
 * O código abaixo é apenas um stub para referência.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

exports.geocodeLocais = functions.firestore
  .document('campanhas/{campanhaId}/config')
  .onCreate(async (snap, context) => {
    const campanhaId = context.params.campanhaId;
    const municipio = snap.data().municipio || 'Viamão';
    const uf = 'RS';

    // Buscar locais do TSE (via API)
    const tseResponse = await axios.get(`https://resultados.tse.jus.br/...`); // exemplo
    const locais = tseResponse.data;

    for (const local of locais) {
      // Geocodificar via Google Maps
      const geo = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(local.endereco + ',' + municipio + ',' + uf)}&key=SUA_CHAVE`);
      const { lat, lng } = geo.data.results[0].geometry.location;
      await admin.firestore().collection(`campanhas/${campanhaId}/locais_votacao`).doc(local.id).set({
        ...local,
        lat,
        lng,
      });
    }
    return null;
  });