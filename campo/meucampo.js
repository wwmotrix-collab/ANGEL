/**
 * campo/meucampo.js
 * WWMX Campaign — Visão consolidada das próprias atividades
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
    _assinarDados();
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
        <div id="meucampoStats" style="margin-bottom:16px;"></div>
        <div class="section-title">Meus Materiais</div>
        <div id="meusMateriais" class="banner-list"></div>
        <div class="section-title">Meus Eventos</div>
        <div id="meusEventos" class="banner-list"></div>
        <div class="section-title">Minhas Lideranças</div>
        <div id="minhasLiderancas" class="banner-list"></div>
        <div class="section-title">Meus Percursos</div>
        <div id="meusPercursos" class="banner-list"></div>
      </div>
    `;
  }

  function _assinarDados() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;

    _unsubPins = WWMX.db.on(`campanhas/${_campanhaId}/pins`, (snap) => {
      const todos = snap.val() || {};
      const meus = Object.values(todos).filter(p => p.autorUid === session.uid);
      _renderizarMateriais(meus);
      _renderizarEventos(meus);
    });

    _unsubLiderancas = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, (snap) => {
      const todos = snap.val() || {};
      const minhas = Object.values(todos).filter(l => l.autorUid === session.uid);
      _renderizarLiderancas(minhas);
    });

    _unsubPercursos = WWMX.db.on(`campanhas/${_campanhaId}/percursos`, (snap) => {
      const todos = snap.val() || {};
      const meus = Object.values(todos).filter(p => p.autorUid === session.uid);
      _renderizarPercursos(meus);
    });
  }

  function _renderizarMateriais(pins) {
    const materiais = pins.filter(p => global.TIPO_MATERIAL[p.tipo]);
    const lista = document.getElementById('meusMateriais');
    if (!lista) return;
    if (!materiais.length) {
      lista.innerHTML = '<div class="empty">Nenhum material registrado</div>';
      return;
    }
    lista.innerHTML = materiais.map(p => {
      const cfg = global.TIPO_MATERIAL[p.tipo] || { icon: '📦' };
      return `
        <div class="banner-item">
          <div style="font-size:24px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${p.nome}</div>
            <div class="banner-meta">${p.qtd} un. · ${new Date(p.ts).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderizarEventos(pins) {
    const eventos = pins.filter(p => global.TIPO_EVENTO[p.tipo]);
    const lista = document.getElementById('meusEventos');
    if (!lista) return;
    if (!eventos.length) {
      lista.innerHTML = '<div class="empty">Nenhum evento registrado</div>';
      return;
    }
    lista.innerHTML = eventos.map(p => {
      const cfg = global.TIPO_EVENTO[p.tipo] || { icon: '🎯' };
      return `
        <div class="banner-item">
          <div style="font-size:24px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${p.nome}</div>
            <div class="banner-meta">${p.pessoas || 0} pessoas · ${new Date(p.ts).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderizarLiderancas(liderancas) {
    const lista = document.getElementById('minhasLiderancas');
    if (!lista) return;
    if (!liderancas.length) {
      lista.innerHTML = '<div class="empty">Nenhuma liderança cadastrada</div>';
      return;
    }
    lista.innerHTML = liderancas.map(l => `
      <div class="banner-item">
        <div class="lider-avatar" style="width:40px;height:40px;border-radius:50%;background:${_corAvatar(l.nome)};color:#fff;display:flex;align-items:center;justify-content:center;">${_iniciais(l.nome)}</div>
        <div class="banner-info">
          <div class="banner-name">${l.nome}</div>
          <div class="banner-meta">${l.votos || 0} votos · ${l.bairro || ''}</div>
        </div>
      </div>
    `).join('');
  }

  function _renderizarPercursos(percursos) {
    const lista = document.getElementById('meusPercursos');
    if (!lista) return;
    if (!percursos.length) {
      lista.innerHTML = '<div class="empty">Nenhum percurso registrado</div>';
      return;
    }
    lista.innerHTML = percursos.map(p => `
      <div class="banner-item">
        <div style="font-size:24px;">${p.tipo === 'carrosom' ? '📢' : '🚶'}</div>
        <div class="banner-info">
          <div class="banner-name">${p.veiculo || p.tipo}</div>
          <div class="banner-meta">${p.km.toFixed(1)} km · ${new Date(p.dataTs).toLocaleDateString()}</div>
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

  global.meucampoInit = init;
  global.meucampoDestroy = destroy;
})(window);