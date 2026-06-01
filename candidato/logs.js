/**
 * candidato/logs.js — WWMX Campaign
 * Relatório de auditoria de ações por usuário.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _todos = [];
  let _filtroAcao = 'todos';
  let _filtroNivel = 'todos';
  let _busca = '';

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
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <select id="logFiltroAcao" style="flex:1;min-width:140px;">
            <option value="todos">Todas as ações</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="repasse_material">Repasse de material</option>
            <option value="entrada_material">Entrada de material</option>
            <option value="pin_criado">Pin criado</option>
            <option value="denuncia_criada">Denúncia criada</option>
            <option value="percurso_salvo">Percurso salvo</option>
            <option value="lider_salvo">Liderança salva</option>
          </select>
          <select id="logFiltroNivel" style="flex:1;min-width:120px;">
            <option value="todos">Todos os níveis</option>
            <option value="campo">Campo</option>
            <option value="coord">Coordenador</option>
            <option value="candidato">Candidato</option>
            <option value="master">Master</option>
          </select>
        </div>
        <div class="search-wrap" style="margin-bottom:14px;">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="logBusca" placeholder="Buscar por nome ou ação...">
        </div>
        <div id="logsStats" style="margin-bottom:12px;"></div>
        <div class="section-title">Histórico de Ações</div>
        <div id="logsList"></div>
      </div>`;

    document.getElementById('logFiltroAcao').onchange  = (e) => { _filtroAcao = e.target.value; _renderizarLista(); };
    document.getElementById('logFiltroNivel').onchange = (e) => { _filtroNivel = e.target.value; _renderizarLista(); };
    document.getElementById('logBusca').oninput        = (e) => { _busca = e.target.value.toLowerCase(); _renderizarLista(); };
  }

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/logs`, (snap) => {
      _todos = WWMX.db.snapToValues(snap).sort((a, b) => (b.tsLocal || 0) - (a.tsLocal || 0));
      _renderizarStats();
      _renderizarLista();
    });
  }

  function _renderizarStats() {
    const el = document.getElementById('logsStats');
    if (!el) return;
    const hoje = Date.now() - 24 * 3600 * 1000;
    const hoje24 = _todos.filter(l => (l.tsLocal || 0) > hoje).length;
    const logins = _todos.filter(l => l.acao === 'login').length;
    const unicos = new Set(_todos.map(l => l.autor).filter(Boolean)).size;
    el.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${_todos.length}</div><div class="stat-label">Total de eventos</div></div>
        <div class="stat-card inst"><div class="stat-num green">${hoje24}</div><div class="stat-label">Últimas 24h</div></div>
        <div class="stat-card purple"><div class="stat-num purple">${unicos}</div><div class="stat-label">Usuários ativos</div></div>
        <div class="stat-card dan"><div class="stat-num yellow">${logins}</div><div class="stat-label">Logins</div></div>
      </div>`;
  }

  function _renderizarLista() {
    const el = document.getElementById('logsList');
    if (!el) return;

    let filtrados = [..._todos];
    if (_filtroAcao  !== 'todos') filtrados = filtrados.filter(l => l.acao === _filtroAcao);
    if (_filtroNivel !== 'todos') filtrados = filtrados.filter(l => l.nivel === _filtroNivel);
    if (_busca) filtrados = filtrados.filter(l =>
      (l.autorNome || '').toLowerCase().includes(_busca) ||
      (l.acao      || '').toLowerCase().includes(_busca)
    );

    if (!filtrados.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Nenhum evento encontrado</div>';
      return;
    }

    const iconAcao = {
      login:            '🔑', logout:          '🚪',
      repasse_material: '📦', entrada_material:'📥',
      pin_criado:       '📍', denuncia_criada: '🚨',
      percurso_salvo:   '🚗', lider_salvo:     '👤',
    };
    const corNivel = { campo:'var(--green)', coord:'var(--blue)', candidato:'var(--purple)', master:'var(--red)' };

    el.innerHTML = filtrados.slice(0, 200).map(l => {
      const icon = iconAcao[l.acao] || '📋';
      const cor  = corNivel[l.nivel] || 'var(--muted)';
      const ts   = l.tsLocal ? formatDate(l.tsLocal) : '—';
      const extras = _extrasDaAcao(l);
      return `
        <div class="banner-item" style="margin-bottom:6px;">
          <div style="font-size:22px;width:32px;text-align:center;">${icon}</div>
          <div class="banner-info">
            <div class="banner-name">${l.acao || '—'}</div>
            <div class="banner-meta">
              <span style="color:${cor};font-weight:600;">${l.autorNome || '—'}</span>
              · <span style="color:var(--muted);">${l.nivel || '—'}</span>
              · ${ts}
            </div>
            ${extras ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${extras}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    if (filtrados.length > 200) {
      el.innerHTML += `<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px;">
        Mostrando 200 de ${filtrados.length} eventos. Use os filtros para refinar.
      </div>`;
    }
  }

  function _extrasDaAcao(l) {
    if (l.acao === 'repasse_material' && l.itens) {
      const resumo = Object.entries(l.itens).map(([id, q]) => `${q}× ${id}`).join(', ');
      return `Para: ${l.paraNome || '—'} · ${resumo}`;
    }
    if (l.acao === 'entrada_material') return `Material: ${l.label || l.itemId || '—'} · +${l.qtd || 0} un.`;
    if (l.acao === 'login')  return `Dispositivo: ${(l.device || '').slice(0, 60)}`;
    return '';
  }

  global.logsInit    = init;
  global.logsDestroy = destroy;
}(window));
