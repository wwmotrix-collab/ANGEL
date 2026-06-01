/**
 * coordenador/dash.js
 * WWMX Campaign — Dashboard do coordenador (resumo de pins, materiais, lideranças)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsubPins = null;
  let _unsubLiderancas = null;
  let _unsubPercursos = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsubPins) _unsubPins();
    if (_unsubLiderancas) _unsubLiderancas();
    if (_unsubPercursos) _unsubPercursos();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div class="dash-stats" id="dashStats"></div>
        <div class="section-title">Atividade por Tipo</div>
        <div id="dashTipos" style="margin-bottom:20px;"></div>
        <div class="section-title">Pontos Recentes</div>
        <div id="bannerList" class="banner-list"></div>
        <div id="dashExtra"></div>
        <div class="section-title">Denúncias Pendentes</div>
        <div id="denunciasPendentes"></div>
      </div>
    `;
  }

  function _assinar() {
    _unsubPins = WWMX.db.on(`campanhas/${_campanhaId}/pins`, (snap) => {
      const pins = Object.values(snap.val() || {});
      _renderizarStats(pins);
      _renderizarTipos(pins);
      _renderizarRecentes(pins);
    });
    _unsubLiderancas = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, (snap) => {
      const lids = Object.values(snap.val() || {});
      _renderizarVotosProjetados(lids);
    });
    _unsubPercursos = WWMX.db.on(`campanhas/${_campanhaId}/percursos`, (snap) => {
      const perc = Object.values(snap.val() || {});
      _renderizarKmTotal(perc);
    });
    // Denúncias
    WWMX.db.on(`campanhas/${_campanhaId}/denuncias`, (snap) => {
      const den = Object.values(snap.val() || {});
      _renderizarDenuncias(den.filter(d => d.status !== 'resolvida'));
    });
  }

  function _renderizarStats(pins) {
    const stats = document.getElementById('dashStats');
    if (!stats) return;
    const total = pins.length;
    const instalados = pins.filter(p => p.status === 'instalado').length;
    const retirados = pins.filter(p => p.status === 'retirado').length;
    stats.innerHTML = `
      <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Pontos</div></div>
      <div class="stat-card inst"><div class="stat-num green">${instalados}</div><div class="stat-label">Instalados</div></div>
      <div class="stat-card ret"><div class="stat-num red">${retirados}</div><div class="stat-label">Retirados</div></div>
    `;
  }

  function _renderizarTipos(pins) {
    const tipos = {};
    pins.forEach(p => {
      const t = p.tipo || 'outro';
      tipos[t] = (tipos[t] || 0) + (p.qtd || 1);
    });
    const html = Object.entries(tipos).map(([t, q]) => {
      const cfg = global.TIPO_CONFIG[t] || { icon: '📍', label: t, cor: '#888' };
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:20px;">${cfg.icon}</span>
          <div style="flex:1;">${cfg.label}</div>
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${cfg.cor};">${q}</div>
        </div>
      `;
    }).join('');
    document.getElementById('dashTipos').innerHTML = html || '<div>Nenhum material registrado</div>';
  }

  function _renderizarRecentes(pins) {
    const recentes = [...pins].sort((a,b) => b.ts - a.ts).slice(0,10);
    const html = recentes.map(p => {
      const cfg = global.TIPO_CONFIG[p.tipo] || { icon: '📍' };
      return `
        <div class="banner-item">
          <div style="font-size:20px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${p.nome}</div>
            <div class="banner-meta">${new Date(p.ts).toLocaleDateString()} · ${p.autor}</div>
          </div>
          <div class="banner-qty">${p.qtd || ''}</div>
        </div>
      `;
    }).join('');
    document.getElementById('bannerList').innerHTML = html || '<div class="empty">Nenhum ponto ainda</div>';
  }

  function _renderizarVotosProjetados(lids) {
    let total = 0;
    lids.forEach(l => {
      if (l.status === 'confirmado') total += (l.votos || 0);
      else if (l.status === 'provavel') total += (l.votos || 0) * 0.6;
      else if (l.status === 'indefinido') total += (l.votos || 0) * 0.2;
    });
    const extra = document.getElementById('dashExtra');
    if (extra) {
      extra.innerHTML = `
        <div class="section-title">Projeção de Votos</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--accent);">${Math.round(total).toLocaleString('pt-BR')}</div>
          <div style="font-size:12px;">votos projetados (${lids.length} lideranças)</div>
        </div>
      `;
    }
  }

  function _renderizarKmTotal(perc) {
    const totalKm = perc.reduce((a,p) => a + (p.km || 0), 0);
    const extra = document.getElementById('dashExtra');
    if (extra && totalKm > 0) {
      extra.innerHTML += `
        <div style="margin-top:10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
          <div style="font-size:12px;">🚗 Total km percorridos</div>
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--green);">${totalKm.toFixed(0)}</div>
        </div>
      `;
    }
  }

  function _renderizarDenuncias(denuncias) {
    const container = document.getElementById('denunciasPendentes');
    if (!container) return;
    if (!denuncias.length) {
      container.innerHTML = '<div class="empty">Nenhuma denúncia pendente</div>';
      return;
    }
    container.innerHTML = denuncias.map(d => `
      <div class="banner-item">
        <div style="font-size:20px;">🚨</div>
        <div class="banner-info">
          <div class="banner-name">${d.tipo}</div>
          <div class="banner-meta">${d.desc.substring(0, 60)}... · ${new Date(d.ts).toLocaleDateString()}</div>
        </div>
        <button onclick="window.dispatchEvent(new CustomEvent('wwmx:ver-denuncia', { detail: { id: '${d.id}' } }))" class="btn btn-ghost" style="padding:6px 12px;">Ver</button>
      </div>
    `).join('');
  }

  global.dashInit = init;
  global.dashDestroy = destroy;
})(window);