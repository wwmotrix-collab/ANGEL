/**
 * coordenador/equipe.js
 * WWMX Campaign — Gestão de militantes (ranking, XP, presença)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsubMilitantes = null;
  let _unsubPresenca = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsubMilitantes) _unsubMilitantes();
    if (_unsubPresenca) _unsubPresenca();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div id="militantesStats" style="margin-bottom:16px;"></div>
        <div class="section-title">Ranking de Militantes</div>
        <div id="rankingList" class="banner-list"></div>
        <div class="section-title">Presença Agora</div>
        <div id="presencaList" class="banner-list"></div>
      </div>
    `;
  }

  function _assinar() {
    _unsubMilitantes = WWMX.db.on(`campanhas/${_campanhaId}/militantes`, (snap) => {
      const mils = Object.values(snap.val() || {}).filter(m => m.nivel === 'campo');
      _calcularRanking(mils);
    });
    _unsubPresenca = WWMX.db.on(`campanhas/${_campanhaId}/presenca`, (snap) => {
      const pres = Object.values(snap.val() || {});
      _renderizarPresenca(pres);
    });
  }

  async function _calcularRanking(mils) {
    // Calcular XP de cada militante
    const comXP = await Promise.all(mils.map(async m => {
      const xp = await _calcularXP(m.uid);
      return { ...m, xp };
    }));
    comXP.sort((a, b) => b.xp - a.xp);
    _renderizarRanking(comXP);
    _renderizarStats(comXP);
  }

  async function _calcularXP(uid) {
    let xp = 0;
    // Pins
    const pinsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/pins`);
    const pins = Object.values(pinsSnap || {}).filter(p => p.autorUid === uid);
    pins.forEach(p => {
      if (global.TIPO_MATERIAL[p.tipo]) {
        if (p.tipo === 'windbanner') xp += 8 * (p.qtd || 1);
        else if (p.tipo === 'adesivo_car') xp += 5 * (p.qtd || 1);
        else xp += Math.floor((p.qtd || 1) / 100) * 3;
      } else {
        xp += 5; // evento
      }
    });
    // Percursos
    const percSnap = await WWMX.db.val(`campanhas/${_campanhaId}/percursos`);
    const perc = Object.values(percSnap || {}).filter(p => p.autorUid === uid);
    perc.forEach(p => {
      xp += 20 + Math.round(p.km || 0);
    });
    // Lideranças
    const lidsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/crm_liderancas`);
    const lids = Object.values(lidsSnap || {}).filter(l => l.autorUid === uid);
    lids.forEach(l => {
      const votos = l.votos || 0;
      let base = 5;
      if (votos >= 500) base = 400;
      else if (votos >= 151) base = 200;
      else if (votos >= 51) base = 80;
      else if (votos >= 16) base = 30;
      else if (votos >= 6) base = 12;
      const mult = l.status === 'confirmado' ? 1 : l.status === 'provavel' ? 0.6 : 0.4;
      xp += Math.round(base * mult);
    });
    return xp;
  }

  function _renderizarRanking(comXP) {
    const lista = document.getElementById('rankingList');
    if (!lista) return;
    if (!comXP.length) {
      lista.innerHTML = '<div class="empty">Nenhum militante cadastrado</div>';
      return;
    }
    lista.innerHTML = comXP.map((m, idx) => `
      <div class="banner-item">
        <div class="rank-badge" style="font-size:20px;font-weight:800;width:32px;">${idx+1}</div>
        <div class="lider-avatar" style="width:40px;height:40px;border-radius:50%;background:${_corAvatar(m.nome)};color:#fff;display:flex;align-items:center;justify-content:center;">${_iniciais(m.nome)}</div>
        <div class="banner-info">
          <div class="banner-name">${m.nome}</div>
          <div class="banner-meta">XP: ${m.xp}</div>
        </div>
        <div class="banner-qty" style="color:var(--accent);">${m.xp} pts</div>
      </div>
    `).join('');
  }

  function _renderizarStats(comXP) {
    const stats = document.getElementById('militantesStats');
    if (!stats) return;
    const total = comXP.length;
    const totalXP = comXP.reduce((a, m) => a + m.xp, 0);
    stats.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Militantes</div></div>
        <div class="stat-card inst"><div class="stat-num green">${totalXP}</div><div class="stat-label">XP total</div></div>
      </div>
    `;
  }

  function _renderizarPresenca(presenca) {
    const lista = document.getElementById('presencaList');
    if (!lista) return;
    const online = presenca.filter(p => p.online === true);
    if (!online.length) {
      lista.innerHTML = '<div class="empty">Ninguém online agora</div>';
      return;
    }
    lista.innerHTML = online.map(p => `
      <div class="banner-item">
        <div class="banner-dot" style="background:#22c55e;"></div>
        <div class="banner-info">
          <div class="banner-name">${p.nome}</div>
          <div class="banner-meta">${p.nivel} · ${new Date(p.ts).toLocaleTimeString()}</div>
        </div>
      </div>
    `).join('');
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

  global.equipeInit = init;
  global.equipeDestroy = destroy;
})(window);