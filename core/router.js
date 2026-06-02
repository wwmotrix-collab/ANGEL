/**
 * core/router.js
 * WWMX Campaign — Roteamento dinâmico por perfil e módulos ativos
 */
(function (global) {
  'use strict';

  const MODULOS_VIEWS = {
    central:      { path: 'modulos/central.js', init: 'centralInit', destroy: 'centralDestroy' },

    mapa:         { path: 'campo/mapa.js',        init: 'mapaInit',        destroy: 'mapaDestroy' },
    meucampo:     { path: 'campo/meucampo.js',    init: 'meucampoInit',    destroy: 'meucampoDestroy' },
    percursos:    { path: 'campo/percursos.js',   init: 'percursosInit',   destroy: 'percursosDestroy' },
    meuinventario:{ path: 'campo/inventario.js',  init: 'inventarioInit',  destroy: 'inventarioDestroy' },
    minhasrotas:  { path: 'campo/rotas.js',       init: 'rotasInit',       destroy: 'rotasDestroy' },

    dash:         { path: 'coordenador/dash.js',       init: 'dashInit',         destroy: 'dashDestroy' },
    eleitoral:    { path: 'modulos/inteligencia-eleitoral.js', init: 'intelInit', destroy: 'intelDestroy' },
    crm:          { path: 'modulos/crm.js',            init: 'crmInit',          destroy: 'crmDestroy' },
    denuncias:    { path: 'modulos/denuncias.js',      init: 'denunciasInit',    destroy: 'denunciasDestroy' },
    militantes:   { path: 'coordenador/equipe.js',     init: 'equipeInit',       destroy: 'equipeDestroy' },
    estoque:      { path: 'coordenador/estoque.js',    init: 'estoqueInit',      destroy: 'estoqueDestroy' },
    rotas:        { path: 'coordenador/rotas.js',      init: 'rotasCoordInit',   destroy: 'rotasCoordDestroy' },

    admindash:    { path: 'candidato/dashboard.js',    init: 'candDashInit',     destroy: 'candDashDestroy' },
    adminmapa:    { path: 'candidato/mapa.js',         init: 'candMapaInit',     destroy: 'candMapaDestroy' },
    adminagentes: { path: 'candidato/agentes.js',      init: 'agentesInit',      destroy: 'agentesDestroy' },
    adminequipe:  { path: 'candidato/equipe.js',       init: 'candEquipeInit',   destroy: 'candEquipeDestroy' },
    logs:         { path: 'candidato/logs.js',         init: 'logsInit',         destroy: 'logsDestroy' },

    'master-campanhas': { path: 'master/campanhas.js', init: 'campanhasInit', destroy: 'campanhasDestroy' },
    'master-planos':    { path: 'master/planos.js',    init: 'planosInit',    destroy: 'planosDestroy' },
    'master-banco':     { path: 'master/banco-global.js', init: 'bancoInit', destroy: 'bancoDestroy' },
    'master-clientes':  { path: 'master/clientes.js', init: 'clientesInit',  destroy: 'clientesDestroy' },
  };

  let _viewAtual = null;
  let _campanhaId = null;
  let _modulosAtivos = [];
  let _nivelAtual = null;

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
      if (e.target.id === 'navSelect') {
        const novoModulo = e.target.value;
        if (novoModulo && _moduloPermitido(novoModulo)) {
          _carregarModulo(novoModulo);
          global.location.hash = novoModulo;
        }
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

    const permissoesPorNivel = {
      master:     ['central', ...Object.keys(MODULOS_VIEWS).filter(k => k.startsWith('master-'))],
      candidato:  ['central', ...Object.keys(MODULOS_VIEWS).filter(k => k.startsWith('admin') || k === 'logs' || k === 'eleitoral' || k === 'dash' || k === 'crm' || k === 'denuncias')],
      coord:      ['central','dash','mapa','eleitoral','crm','denuncias','militantes','estoque','rotas'],
      campo:      ['central','mapa','meucampo','percursos','meuinventario','minhasrotas','denuncias'],
    };
    const permitidos = permissoesPorNivel[_nivelAtual] || [];
    if (!permitidos.includes(moduloId)) return false;

    const modulosOpcionais = ['crm', 'denuncias', 'eleitoral'];
    const aliases = { eleitoral: ['eleitoral', 'inteligencia-eleitoral'] };
    if (modulosOpcionais.includes(moduloId)) {
      const aceitos = aliases[moduloId] || [moduloId];
      if (!_modulosAtivos.some(m => aceitos.includes(m))) return false;
    }

    return true;
  }

  function _montarNavSelect() {
    const sel = document.getElementById('navSelect');
    if (!sel) return;

    const ordemPorNivel = {
      master: ['central','master-campanhas','master-planos','master-banco','master-clientes'],
      candidato: ['central','admindash','adminmapa','adminagentes','adminequipe','eleitoral','crm','denuncias','dash','logs'],
      coord: ['central','dash','mapa','eleitoral','crm','denuncias','militantes','estoque','rotas'],
      campo: ['central','mapa','meucampo','percursos','meuinventario','minhasrotas','denuncias'],
    };
    const labels = WWMX.Config?.NAV_LABELS || {};
    const idsOrdenados = ordemPorNivel[_nivelAtual] || Object.keys(MODULOS_VIEWS);
    const opcoes = idsOrdenados
      .filter(id => _moduloPermitido(id))
      .map(id => ({ id, label: labels[id] || id }));

    sel.innerHTML = opcoes.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    if (opcoes.length) sel.value = opcoes[0].id;
  }

  function _obterPrimeiroModuloPermitido() {
    const sel = document.getElementById('navSelect');
    return sel?.value || Object.keys(MODULOS_VIEWS).find(id => _moduloPermitido(id)) || 'mapa';
  }

  async function _carregarModulo(moduleId) {
    if (!moduleId || !MODULOS_VIEWS[moduleId]) {
      console.warn(`[router] Módulo inválido: ${moduleId}`);
      return;
    }
    if (!_moduloPermitido(moduleId)) {
      console.warn(`[router] Módulo não permitido para este perfil/campanha: ${moduleId}`);
      const fallback = _obterPrimeiroModuloPermitido();
      if (fallback && fallback !== moduleId) return _carregarModulo(fallback);
      return;
    }

    if (_viewAtual && _viewAtual.destroyFn) {
      try { _viewAtual.destroyFn(); } catch (e) { console.warn(e); }
    }

    const config = MODULOS_VIEWS[moduleId];
    const container = document.getElementById('appView');
    if (!container) return console.error('[router] Container #appView não encontrado');

    container.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Carregando módulo...</div>';

    const scriptId = `script-${moduleId}`;
    if (!document.getElementById(scriptId)) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = config.path;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Falha ao carregar ${config.path}`));
        document.head.appendChild(script);
      });
    }

    await new Promise(r => setTimeout(r, 10));

    if (typeof global[config.init] === 'function') {
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
    } else {
      console.error(`[router] Função de inicialização ${config.init} não encontrada`);
      container.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>Módulo não implementado corretamente</div>`;
    }
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.Router = {
    init,
    carregarModulo: _carregarModulo,
    moduloPermitido: _moduloPermitido,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

}(window));
