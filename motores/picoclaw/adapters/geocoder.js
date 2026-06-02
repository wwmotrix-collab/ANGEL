/**
 * motores/picoclaw/adapters/geocoder.js
 * Contrato de geocoding para transformar endereço oficial em coordenadas.
 *
 * Não chama provedores externos nesta fase. Gera plano/cache/revisão.
 */
'use strict';

function buildGeocodingContract(ctx) {
  const c = ctx.campaign;
  return {
    providerPreferido: 'google_or_mapbox',
    fallback: 'nominatim_or_manual',
    addressTemplate: '{endereco}, {bairro}, {municipio}, {uf}, Brasil',
    minConfidence: 0.75,
    cachePath: `campanhas/${c.campanhaId}/geo_cache`,
    reviewPath: `campanhas/${c.campanhaId}/revisao_geo`,
    output: {
      lat: 'number',
      lng: 'number',
      geoProvider: 'string',
      geoConfidence: 'number',
      geoStatus: 'validado|revisao|falhou',
      normalizedAddress: 'string'
    },
    fallbackRules: [
      'se confidence < minConfidence, enviar para revisão manual',
      'se endereço ambíguo, manter local sem pin operacional até revisão',
      'se geocoder falhar, permitir coordenada manual por coordenador/master'
    ]
  };
}

module.exports = { buildGeocodingContract };
