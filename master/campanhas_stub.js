/**
 * master/campanhas.js
 * WWMX Campaign — Criação e gestão de campanhas
 */

(function (global) {
  'use strict';

  let _campanhaId = null; // não usado, pois master gerencia todas

  function init() {
    _renderizar();
    _assinar();
  }

  function destroy() {}

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <h2>🏗️ Campanhas</h2>
        <button id="btnNovaCampanha" class="btn btn-primary">+ Nova Campanha</button>
        <div id="listaCampanhas" class="banner-list" style="margin-top:16px;"></div>
      </div>
    `;
    document.getElementById('btnNovaCampanha').onclick = () => WWMX.UI.showToast('Funcionalidade em desenvolvimento', 'info');
  }

  function _assinar() {
    WWMX.fs.getCol('campanhas').then(campanhas => {
      const container = document.getElementById('listaCampanhas');
      if (container) {
        container.innerHTML = campanhas.map(c => `
          <div class="banner-item">
            <div>${c.nome || c.id}</div>
            <div class="banner-meta">Status: ${c.status || 'ativa'}</div>
          </div>
        `).join('');
      }
    });
  }

  global.campanhasInit = init;
  global.campanhasDestroy = destroy;
})(window);