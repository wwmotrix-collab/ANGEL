/**
 * campo/inventario.js
 * WWMX Campaign — Inventário pessoal do militante
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsubInventario = null;
  let _unsubEstoque = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsubInventario) _unsubInventario();
    if (_unsubEstoque) _unsubEstoque();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div id="inventarioResumo" style="margin-bottom:16px;"></div>
        <div class="section-title">📦 Meu Estoque</div>
        <div id="inventarioLista" class="banner-list"></div>
        <div class="section-title" style="margin-top:20px;">📤 Histórico de Distribuições</div>
        <div id="historicoDistribuicoes" class="banner-list"></div>
      </div>
    `;
  }

  function _assinar() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;

    _unsubInventario = WWMX.db.on(`campanhas/${_campanhaId}/inventarios/${session.uid}`, (snap) => {
      const inv = snap.val() || {};
      _renderizarInventario(inv);
    });

    _unsubEstoque = WWMX.db.on(`campanhas/${_campanhaId}/estoque_central`, (snap) => {
      const est = snap.val() || {};
      global._estoqueCentralCache = est;
      // Não precisa re-renderizar toda hora, apenas para mostrar labels
    });

    // Histórico de distribuições (push)
    WWMX.db.on(`campanhas/${_campanhaId}/distribuicoes`, (snap) => {
      const todas = snap.val() || {};
      const minhas = Object.values(todas).filter(d => d.paraUid === session.uid);
      _renderizarHistorico(minhas);
    });
  }

  function _renderizarInventario(inventario) {
    const totalItens = Object.values(inventario).reduce((a, b) => a + (b || 0), 0);
    const resumo = document.getElementById('inventarioResumo');
    if (resumo) {
      resumo.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Meu estoque</div>
          <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:var(--green);">${totalItens}</div>
          <div style="font-size:12px;">itens disponíveis</div>
        </div>
      `;
    }

    const lista = document.getElementById('inventarioLista');
    if (!lista) return;
    const itens = Object.entries(inventario).filter(([, q]) => q > 0);
    if (!itens.length) {
      lista.innerHTML = '<div class="empty">Nenhum material recebido ainda</div>';
      return;
    }
    lista.innerHTML = itens.map(([id, qtd]) => {
      const item = global._estoqueCentralCache?.[id] || {};
      const cfg = global.TIPO_MATERIAL[item.tipo] || { icon: '📦', label: id };
      return `
        <div class="banner-item" style="cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('wwmx:usar-material', { detail: { itemId: '${id}', qtd: ${qtd} } }))">
          <div style="font-size:28px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${item.label || cfg.label}</div>
            <div class="banner-meta">${qtd} unidades</div>
          </div>
          <div class="banner-qty" style="color:var(--accent);">📤</div>
        </div>
      `;
    }).join('');
  }

  function _renderizarHistorico(distribuicoes) {
    const lista = document.getElementById('historicoDistribuicoes');
    if (!lista) return;
    if (!distribuicoes.length) {
      lista.innerHTML = '<div class="empty">Nenhuma distribuição registrada</div>';
      return;
    }
    lista.innerHTML = distribuicoes.sort((a,b) => b.ts - a.ts).slice(0,20).map(d => {
      const item = global._estoqueCentralCache?.[d.itemId] || {};
      const cfg = global.TIPO_MATERIAL[item.tipo] || { icon: '📦' };
      return `
        <div class="banner-item">
          <div style="font-size:24px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${d.qtd} × ${item.label || d.itemId}</div>
            <div class="banner-meta">${new Date(d.ts).toLocaleDateString()} · ${d.obs || ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  global.inventarioInit = init;
  global.inventarioDestroy = destroy;
})(window);