/**
 * campo/rotas.js
 * WWMX Campaign — Missões (rotas atribuídas) para militante
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
        <div class="section-title">🚗 Minhas Missões</div>
        <div id="minhasRotasList" class="banner-list"></div>
      </div>
    `;
  }

  function _assinar() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/rotas`, (snap) => {
      const todas = snap.val() || {};
      const minhas = Object.values(todas).filter(r => r.motoristaUid === session.uid);
      _renderizarLista(minhas);
    });
  }

  function _renderizarLista(rotas) {
    const lista = document.getElementById('minhasRotasList');
    if (!lista) return;
    if (!rotas.length) {
      lista.innerHTML = '<div class="empty">Nenhuma missão atribuída</div>';
      return;
    }
    lista.innerHTML = rotas.map(r => `
      <div class="banner-item" onclick="window.dispatchEvent(new CustomEvent('wwmx:iniciar-missao', { detail: { rotaId: '${r.id}' } }))">
        <div style="font-size:28px;">${r.tipo === 'carrosom' ? '📢' : '🚶'}</div>
        <div class="banner-info">
          <div class="banner-name">${r.nome}</div>
          <div class="banner-meta">${r.km?.toFixed(1) || 0} km · status: ${r.status}</div>
        </div>
        <div class="banner-qty" style="color:var(--accent);">▶️</div>
      </div>
    `).join('');
  }

  global.rotasInit = init;
  global.rotasDestroy = destroy;
})(window);