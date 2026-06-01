/**
 * core/xp.js — WWMX Campaign
 * Cálculo de XP centralizado — uma rodada de leituras para todos os militantes.
 */
(function (global) {
  'use strict';

  const XP_MAT = {
    windbanner:   (q) => 8 * q,
    adesivo_car:  (q) => 5 * q,
    adesivo_res:  (q) => 4 * q,
    camiseta:     (q) => Math.floor(q / 10) * 3,
    bone:         (q) => Math.floor(q / 5)  * 2,
    bandeira_mao: (q) => Math.floor(q / 20) * 2,
    colinha:      (q) => Math.floor(q / 100) * 3,
    panfleto:     (q) => Math.floor(q / 100) * 3,
    kit_completo: (q) => 10 * q,
  };

  function _xpLider(votos, status) {
    const base = votos >= 500 ? 400 : votos >= 151 ? 200 : votos >= 51 ? 80
               : votos >= 16  ? 30  : votos >= 6   ? 12  : 5;
    const mult = status === 'confirmado' ? 1.0 : status === 'provavel' ? 0.6 : 0.4;
    return Math.round(base * mult);
  }

  function _agrupar(items, keyFn) {
    return items.reduce((map, item) => {
      const k = keyFn(item);
      if (k) { if (!map[k]) map[k] = []; map[k].push(item); }
      return map;
    }, {});
  }

  async function ranking(campanhaId) {
    const { db } = global.WWMX;
    const [milSnap, pinsSnap, percSnap, lidsSnap] = await Promise.all([
      db.get(`campanhas/${campanhaId}/militantes`),
      db.get(`campanhas/${campanhaId}/pins`),
      db.get(`campanhas/${campanhaId}/percursos`),
      db.get(`campanhas/${campanhaId}/crm_liderancas`),
    ]);

    const militantes = db.snapToValues(milSnap).filter(m => m.nivel === 'campo');
    const pins       = db.snapToValues(pinsSnap);
    const percursos  = db.snapToValues(percSnap);
    const liderancas = db.snapToValues(lidsSnap);

    const pinsMap = _agrupar(pins,       p => p.autorUid);
    const percMap = _agrupar(percursos,  p => p.autorUid);
    const lidsMap = _agrupar(liderancas, l => l.autorUid);

    const resultado = militantes.map(m => {
      let xp = 0;
      (pinsMap[m.uid] || []).forEach(p => {
        const fn = XP_MAT[p.tipo];
        xp += fn ? fn(p.qtd || 1) : (global.TIPO_MATERIAL?.[p.tipo] ? 2 : 5);
      });
      (percMap[m.uid] || []).forEach(p => { xp += 20 + Math.round(p.km || 0); });
      (lidsMap[m.uid] || []).forEach(l => { xp += _xpLider(l.votos || 0, l.status); });
      const rank = global.getGuildaRank ? global.getGuildaRank(xp) : { titulo:'Viajante', icone:'🧳', cor:'#7d8590' };
      return { uid: m.uid, nome: m.nome, xp, rank };
    });

    return resultado.sort((a, b) => b.xp - a.xp);
  }

  async function calcular(uid, campanhaId) {
    const lista = await ranking(campanhaId);
    const entry = lista.find(m => m.uid === uid);
    return entry ? entry.xp : 0;
  }

  async function posicao(uid, campanhaId) {
    const lista = await ranking(campanhaId);
    const idx = lista.findIndex(m => m.uid === uid);
    return idx >= 0 ? idx + 1 : 0;
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.XP = { ranking, calcular, posicao };

}(window));
