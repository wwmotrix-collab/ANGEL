/**
 * candidato/equipe.js
 * WWMX Campaign — Equipe de campo (militantes com ranking detalhado)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsub) _unsub();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div class="section-title">Equipe de Campo</div>
        <div id="equipeList" class="banner-list"></div>
      </div>
    `;
  }

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/militantes`, async (snap) => {
      const mils = Object.values(snap.val() || {}).filter(m => m.nivel === 'campo');
      await _renderizarEquipe(mils);
    });
  }

  async function _renderizarEquipe(mils) {
    const comXP = await Promise.all(mils.map(async m => {
      const xp = await _calcularXP(m.uid);
      return { ...m, xp };
    }));
    comXP.sort((a, b) => b.xp - a.xp);
    const lista = document.getElementById('equipeList');
    if (!lista) return;
    if (!comXP.length) {
      lista.innerHTML = '<div class="empty">Nenhum militante cadastrado</div>';
      return;
    }
    lista.innerHTML = comXP.map((m, idx) => `
      <div class="banner-item">
        <div class="rank-badge" style="font-size:18px;width:30px;">${idx+1}</div>
        <div class="lider-avatar" style="width:44px;height:44px;background:${_corAvatar(m.nome)};color:#fff;display:flex;align-items:center;justify-content:center;">${_iniciais(m.nome)}</div>
        <div class="banner-info">
          <div class="banner-name">${m.nome}</div>
          <div class="banner-meta">XP: ${m.xp}</div>
        </div>
        <div class="banner-qty">${m.xp} pts</div>
      </div>
    `).join('');
  }

  async function _calcularXP(uid) {
    let xp = 0;
    const pinsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/pins`);
    const pins = Object.values(pinsSnap || {}).filter(p => p.autorUid === uid);
    pins.forEach(p => {
      if (global.TIPO_MATERIAL[p.tipo]) {
        if (p.tipo === 'windbanner') xp += 8 * (p.qtd || 1);
        else xp += 2;
      } else xp += 5;
    });
    const percSnap = await WWMX.db.val(`campanhas/${_campanhaId}/percursos`);
    const perc = Object.values(percSnap || {}).filter(p => p.autorUid === uid);
    perc.forEach(p => xp += 20 + Math.round(p.km || 0));
    const lidsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/crm_liderancas`);
    const lids = Object.values(lidsSnap || {}).filter(l => l.autorUid === uid);
    lids.forEach(l => {
      const base = (l.votos || 0) >= 500 ? 400 : (l.votos || 0) >= 151 ? 200 : (l.votos || 0) >= 51 ? 80 : (l.votos || 0) >= 16 ? 30 : (l.votos || 0) >= 6 ? 12 : 5;
      const mult = l.status === 'confirmado' ? 1 : l.status === 'provavel' ? 0.6 : 0.4;
      xp += Math.round(base * mult);
    });
    return xp;
  }

  function _corAvatar(nome) {
    const cores = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e'];
    let h = 0;
    for (let c of nome) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return cores[h % cores.length];
  }

  function _iniciais(nome) {
    return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  global.candEquipeInit = init;
  global.candEquipeDestroy = destroy;
})(window);