/**
 * motores/picoclaw/adapters/tse-loader.js
 * Stub seguro para coleta TSE/TRE.
 *
 * Nesta fase não acessa internet automaticamente. Define contrato de entrada/saída
 * para o PicoClaw ou operador plugar dataset oficial/CSV depois.
 */
'use strict';

function buildTseCollectionContract(ctx) {
  const c = ctx.campaign;
  return {
    fonte: 'TSE/TRE ou CSV oficial carregado manualmente',
    municipio: c.cidade,
    uf: c.uf,
    cargo: c.cargo,
    partido: c.partido,
    candidato: c.candidato,
    datasets: {
      locaisVotacao: {
        requiredColumns: ['SG_UF', 'NM_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'NM_LOCAL_VOTACAO', 'DS_ENDERECO'],
        optionalColumns: ['NM_BAIRRO', 'QT_ELEITORES', 'CD_MUNICIPIO', 'CD_LOCAL_VOTACAO']
      },
      resultadosHistoricos: {
        requiredColumns: ['ANO_ELEICAO', 'NM_URNA_CANDIDATO', 'SG_PARTIDO', 'DS_CARGO', 'NM_MUNICIPIO'],
        optionalColumns: ['QT_VOTOS_NOMINAIS', 'NR_ZONA', 'NR_SECAO', 'NM_LOCAL_VOTACAO']
      }
    },
    normalizationTarget: {
      localVotacao: ['id', 'uf', 'municipio', 'zona', 'secoes', 'local', 'endereco', 'bairro', 'eleitores', 'statusGeo'],
      resultado: ['ano', 'cargo', 'partido', 'candidato', 'municipio', 'zona', 'secao', 'votos']
    }
  };
}

module.exports = { buildTseCollectionContract };
