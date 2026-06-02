/**
 * core/router.js
 * WWMX Campaign — Roteamento dinâmico por perfil e módulos ativos.
 * Cria wrappers compatíveis com módulos migrados do HTML monólito.
 */
(function (global) {
  'use strict';

  const MODULOS_VIEWS = {
    central:      { path: 'modulos/central.js', init: 'centralInit', destroy: 'centralDestroy', viewId: 'centralView' },
    mapa:         { path: 'campo/mapa.js', init: 'mapaInit', destroy: 'mapaDestroy', viewId: 'mapaView' },
    meucampo:     { path: 'campo/meucampo.js', init: 'meucampoInit', destroy: 'meucampoDestroy', viewId: 'meucampoView' },
    percursos:    { path: 'campo/percursos.js', init: 'percursosInit', destroy: 'percursosDestroy', viewId: 'percursosView' },
    meuinventario:{ path: 'campo/inventario.js', init: 'inventarioInit', destroy: 'inventarioDestroy', viewId: 'meuinventarioView' },
    minhasrotas:  { path: 'campo/rotas.js', init: 'rotasInit', destroy: 'rotasDestroy', viewId: 'minhasrotasView' },

    dash:         { path: 'coordenador/dash.js', init: 'dashInit', destroy: 'dashDestroy', viewId: 'dashView' },
    eleitoral:    { path: 'modulos/inteligencia-eleitoral.js', init: 'intelInit', destroy: 'intelDestroy', viewId: 'eleitoralView' },
    crm:          { path: 'modulos/crm.js', init: 'crmInit', destroy: 'crmDestroy', viewId: 'crmView' },
    denuncias:    { path: 'modulos/denuncias.js', init: 'denunciasInit', destroy: 'denunciasDestroy', viewId: 'denunciasView' },
    militantes:   { path: 'coordenador/equipe.js', init: 'equipeInit', destroy: 'equipeDestroy', viewId: 'militantesView' },
    estoque:      { path: 'coordenador/estoque.js', init: 'estoqueInit', destroy: 'estoqueDestroy', viewId: 'estoqueView' },
    rotas:        { path: 'coordenador/rotas.js', init: 'rotasCoordInit', destroy: 'rotasCoordDestroy', viewId: 'rotasView' },

    admindash:    { path: 'candidato/dashboard.js', init: 'candDashInit', destroy: 'candDashDestroy', viewId: 'admindashView' },
    adminmapa:    { path: 'candidato/mapa.js', init: 'candMapaInit', destroy: 'candMapaDestroy', viewId: 'adminmapaView' },
    adminagentes: { path: 'candidato/agentes.js', init: 'agentesInit', destroy: 'agentesDestroy', viewId: 'adminagentesView' },
    adminequipe:  { path: 'candidato/equipe.js', init: 'candEquipeInit', destroy: 'candEquipeDestroy', viewId: 'adminequipeView' },
    logs:         { path: 'candidato/logs.js', init: 'logsInit', destroy: 'logsDestroy', viewId: 'logsView' },

    'master-campanhas': { path: 'master/campanhas.js', init: 'campanhasInit', destroy: 'campanhasDestroy', viewId: 'masterCampanhasView' },
    'master-planos':    { path: 'master/planos.js', init: 'planosInit', destroy: 'planosDestroy', viewId: 'masterPlanosView' },
    'master-banco':     { path: 'master/banco-global.js', init: 'bancoInit', destroy: 'bancoDestroy', viewId: 'masterBancoView' },
    'master-clientes':  { path: 'master/clientes.js', init: 'clientesInit', destroy: 'clientesDestroy', viewId: 'masterClientesView' },
  };

  let _viewAtual = null;
  let _campanhaId = null;
  let _modulosAtivos = [];
  let _nivelAtual = null;

  const ORDEM = {
    master: ['central','master-campanhas','master-planos','master-banco','master-clientes'],
    candidato: ['central','admindash','adminmapa','adminagentes','adminequipe','dash','eleitoral','crm','denuncias','logs'],
    coord: ['central','dash','mapa','eleitoral','crm','denuncias','militantes','estoque','rotas'],
    campo: ['central','mapa','meucampo','percursos','meuinventario','minhasrotas','denuncias'],
  };

  const PERMISSOES = {
    master: ORDEM.master,
    candidato: ORDEM.candidato,
    coord: ORDEM.coord,
    campo: ORDEM.campo,
  };

  const OPCIONAIS = {
    crm: ['crm'],
    denuncias: ['denuncias'],
    eleitoral: ['eleitoral', 'inteligencia-eleitoral'],
  };

  function init() {
    global.addEventListener('wwmx:session-ready', (e) => {
      const session = e.detail;
      _campanhaId = session.campanhaId;
      _nivelAtual = session.nivel;
      _carregarModulosAtivos().then(() => {
        _montarNavSelect();
        const hash = global.location.hash.slice(1);
        const moduloInicial = hash || _obterPrimeiroModuloPermitido();
        _carregarModulo(moduloInicial);
      });
    });

    global.addEventListener('change', (e) => {
      if (e.target.id !== 'navSelect') return;
      const novoModulo = e.target.value;
      if (novoModulo && _moduloPermitido(novoModulo)) {
        _carregarModulo(novoModulo);
        global.location.hash = novoModulo;
      }
    });

    global.addEventListener('hashchange', () => {
      const hash = global.location.hash.slice(1);
      if (hash && _moduloPermitido(hash)) {
        _carregarModulo(hash);
        const select = document.getElementById('navSelect');
        if (select) select.value = hash;
      }
    });
  }

  async function _carregarModulosAtivos() {
    try {
      const config = await WWMX.carregarConfigCampanha(_campanhaId);
      _modulosAtivos = config?.modulosAtivos || [];
    } catch (err) {
      console.warn('[router] Não foi possível carregar módulos ativos:', err);
      _modulosAtivos = [];
    }
  }

  function _moduloPermitido(moduloId) {
    if (!MODULOS_VIEWS[moduloId]) return false;
    const permitidos = PERMISSOES[_nivelAtual] || [];
    if (!permitidos.includes(moduloId)) return false;
    const aliases = OPCIONAIS[moduloId];
    if (aliases && !_modulosAtivos.some(m => aliases.includes(m))) return false;
    return true;
  }

  function _montarNavSelect() {
    const sel = document.getElementById('navSelect');
    if (!sel) return;
    const labels = WWMX.Config?.NAV_LABELS || {};
    const ids = (ORDEM[_nivelAtual] || Object.keys(MODULOS_VIEWS)).filter(_moduloPermitido);
    sel.innerHTML = ids.map(id => `<option value="${id}">${labels[id] || id}</option>`).join('');
    if (ids.length) sel.value = ids[0];
  }

  function _obterPrimeiroModuloPermitido() {
    const sel = document.getElementById('navSelect');
    return sel?.value || Object.keys(MODULOS_VIEWS).find(_moduloPermitido) || 'mapa';
  }

  function _prepararContainer(moduleId, config) {
    const container = document.getElementById('appView');
    if (!container) return null;
    container.innerHTML = `<div class="view active" id="${config.viewId}" style="display:flex;flex-direction:column;min-height:100%;"></div>`;
    return container;
  }

  async function _carregarModulo(moduleId) {
    if (!moduleId || !MODULOS_VIEWS[moduleId]) return;
    if (!_moduloPermitido(moduleId)) {
      const fallback = _obterPrimeiroModuloPermitido();
      if (fallback && fallback !== moduleId) return _carregarModulo(fallback);
      return;
    }

    if (_viewAtual?.destroyFn) {
      try { _viewAtual.destroyFn(); } catch (e) { console.warn(e); }
    }

    const config = MODULOS_VIEWS[moduleId];
    const container = _prepararContainer(moduleId, config);
    if (!container) return;

    const scriptId = `script-${moduleId}`;
    if (!document.getElementById(scriptId)) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = config.path;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`Falha ao carregar ${config.path}`));
          document.head.appendChild(script);
        });
      } catch (err) {
        container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>${err.message}</div>`;
        return;
      }
    }

    await new Promise(r => setTimeout(r, 10));
    if (typeof global[config.init] !== 'function') {
      container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>Módulo não implementado corretamente: ${config.init}</div>`;
      return;
    }

    try {
      global[config.init](_campanhaId);
      _viewAtual = {
        moduleId,
        destroyFn: typeof global[config.destroy] === 'function' ? global[config.destroy] : null,
        container,
      };
    } catch (err) {
      console.error(`[router] Erro ao iniciar ${moduleId}:`, err);
      container.innerHTML = `<div class="empty"><div class="empty-icon">❌</div>Erro ao carregar módulo.<br><small>${err.message || ''}</small></div>`;
    }
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.Router = { init, carregarModulo: _carregarModulo, moduloPermitido: _moduloPermitido };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}(window));
