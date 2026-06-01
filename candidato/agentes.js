/**
 * candidato/agentes.js — WWMX Campaign
 * Visão de lideranças/agentes pelo candidato com ranking por estrelas.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _todos = [];
  let _filtro = 'todos';
  let _busca  = '';

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsub) _unsub();
  }

  function _renderizar() {
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view">
        <div id="agentesStats" style="margin-bottom:16px;"></div>
        <div style="display:flex;gap:8px;margin-bottom:10px;overflow-x:auto;padding-bottom:4px;">
          <button class="chip" data-f="todos">Todos</button>
          <button class="chip" data-f="confirmado">✅ Confirmados</button>
          <button class="chip" data-f="provavel">🟡 Prováveis</button>
          <button class="chip" data-f="indefinido">⬜ Indefinidos</button>
          <button class="chip" data-f="contra">🔴 Contra</button>
        </div>
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="agentesBusca" placeholder="Buscar agente ou bairro...">
        </div>
        <div class="section-title">Lideranças · ranking por votos declarados</div>
        <div id="agentesList" class="banner-list"></div>
      </div>`;

    document.querySelectorAll('[data-f]').forEach(btn => {
      btn.onclick = () => { _filtro = btn.dataset.f; _renderizarLista(); };
    });
    document.getElementById('agentesBusca').oninput = (e) => {
      _busca = e.target.value.toLowerCase(); _renderizarLista();
    };
  }

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, (snap) => {
      _todos = WWMX.db.snapToValues(snap).sort((a, b) => (b.votos || 0) - (a.votos || 0));
      _renderizarStats();
      _renderizarLista();
    });
  }

  function _renderizarStats() {
    const el = document.getElementById('agentesStats');
    if (!el) return;
    const conf  = _todos.filter(l => l.status === 'confirmado');
    const prov  = _todos.filter(l => l.status === 'provavel');
    const vConf = conf.reduce((a, l) => a + (l.votos || 0), 0);
    const vProv = Math.round(prov.reduce((a, l) => a + (l.votos || 0), 0) * 0.6);
    const vProj = vConf + vProv;
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Projeção de votos via lideranças</div>
        <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:var(--accent);">${vProj.toLocaleString('pt-BR')}</div>
        <div style="font-size:12px;color:var(--muted);">${_todos.length} agentes · ${conf.length} confirmados</div>
      </div>
      <div class="dash-stats">
        <div class="stat-card inst"><div class="stat-num green">${vConf.toLocaleString('pt-BR')}</div><div class="stat-label">Votos confirmados</div></div>
        <div class="stat-card dan"><div class="stat-num yellow">${vProv.toLocaleString('pt-BR')}</div><div class="stat-label">Votos prováveis (60%)</div></div>
      </div>`;
  }

  function _estrelas(votos) {
    const n = votos >= 500 ? 6 : votos >= 151 ? 5 : votos >= 51 ? 4 : votos >= 16 ? 3 : votos >= 6 ? 2 : 1;
    const titulos = ['','Agente Comum','Agente Conectado','Agente Influente','Agente Estratégico','Agente Lendário','Agente Supremo'];
    const cor = n === 6 ? '#f59e0b' : '#94a3b8';
    return `<span style="color:${cor};font-size:11px;">${'★'.repeat(Math.min(n,5))}</span> <span style="font-size:10px;color:var(--muted);">${titulos[n]||''}</span>`;
  }

  function _renderizarLista() {
    const el = document.getElementById('agentesList');
    if (!el) return;
    let lista = [..._todos];
    if (_filtro !== 'todos') lista = lista.filter(l => l.status === _filtro);
    if (_busca) lista = lista.filter(l =>
      (l.nome || '').toLowerCase().includes(_busca) ||
      (l.bairro || '').toLowerCase().includes(_busca)
    );
    if (!lista.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div>Nenhum agente encontrado</div>';
      return;
    }
    const corStatus = { confirmado:'var(--green)', provavel:'var(--yellow)', indefinido:'var(--muted)', contra:'var(--red)' };
    const lblStatus = { confirmado:'✅ Confirmado', provavel:'🟡 Provável', indefinido:'⬜ Indefinido', contra:'🔴 Contra' };
    const cores = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#22c55e','#06b6d4','#f59e0b'];
    const cor  = (nome) => { let h=0; for(let c of (nome||'?')) h=(h*31+c.charCodeAt(0))&0xffff; return cores[h%cores.length]; };
    const ini  = (nome) => (nome||'?').trim().split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();

    el.innerHTML = lista.map(l => `
      <div class="lider-card">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="lider-avatar" style="width:44px;height:44px;font-size:16px;background:${cor(l.nome)};color:#fff;">${ini(l.nome)}</div>
          <div class="banner-info">
            <div style="margin-bottom:2px;">${_estrelas(l.votos||0)}</div>
            <div class="banner-name">${l.nome}</div>
            <div class="banner-meta">📍 ${l.bairro||'—'} · ${l.autorNome ? '👤 '+l.autorNome : ''}</div>
            <span class="status-badge s-${l.status}">${lblStatus[l.status]||l.status}</span>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:${corStatus[l.status]||'var(--muted)'};">${(l.votos||0).toLocaleString('pt-BR')}</div>
            <div style="font-size:10px;color:var(--muted);">votos decl.</div>
          </div>
        </div>
        ${l.obs ? `<div style="margin-top:8px;font-size:12px;color:var(--muted);border-top:1px solid var(--border);padding-top:6px;">${l.obs}</div>` : ''}
      </div>`).join('');
  }

  global.agentesInit    = init;
  global.agentesDestroy = destroy;
}(window));
