/**
 * core/router.js
 * WWMX Campaign — Roteamento dinâmico por perfil e módulos ativos
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Responsabilidades:                                     │
 * │  - Carregar o módulo correto (view) baseado no perfil   │
 * │    do usuário e nos módulos ativos da campanha.         │
 * │  - Ouvir mudanças de navegação (select ou hash)         │
 * │  - Gerenciar o container #appView                       │
 * │  - Destruir módulos antigos antes de carregar novo      │
 * └─────────────────────────────────────────────────────────┘
 *
 * Depende de:
 *   core/auth.js     → WWMX.Auth
 *   core/firebase.js → WWMX.db, WWMX.fs
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // CONFIGURAÇÃO
  // ─────────────────────────────────────────────────────────
  const MODULOS_VIEWS = {
    // Campo
    mapa:         { path: 'campo/mapa.js',        init: 'mapaInit',        destroy: 'mapaDestroy' },
    meucampo:     { path: 'campo/meucampo.js',    init: 'meucampoInit',    destroy: 'meucampoDestroy' },
    percursos:    { path: 'campo/percursos.js',   init: 'percursosInit',   destroy: 'percursosDestroy' },
    meuinventario:{ path: 'campo/inventario.js',  init: 'inventarioInit',  destroy: 'inventarioDestroy' },
    minhasrotas:  { path: 'campo/rotas.js',       init: 'rotasInit',       destroy: 'rotasDestroy' },

    // Coordenador
    dash:         { path: 'coordenador/dash.js',       init: 'dashInit',         destroy: 'dashDestroy' },
    eleitoral:    { path: 'modulos/inteligencia-eleitoral.js', init: 'intelInit', destroy: 'intelDestroy' },
    crm:          { path: 'modulos/crm.js',            init: 'crmInit',          destroy: 'crmDestroy' },
    militantes:   { path: 'coordenador/equipe.js',     init: 'equipeInit',       destroy: 'equipeDestroy' },
    estoque:      { path: 'coordenador/estoque.js',    init: 'estoqueInit',      destroy: 'estoqueDestroy' },
    rotas:        { path: 'coordenador/rotas.js',      init: 'rotasCoordInit',   destroy: 'rotasCoordDestroy' },

    // Candidato
    admindash:    { path: 'candidato/dashboard.js',    init: 'candDashInit',     destroy: 'candDashDestroy' },
    adminmapa:    { path: 'candidato/mapa.js',         init: 'candMapaInit',     destroy: 'candMapaDestroy' },
    adminagentes: { path: 'candidato/agentes.js',      init: 'agentesInit',      destroy: 'agentesDestroy' },
    adminequipe:  { path: 'candidato/equipe.js',       init: 'candEquipeInit',   destroy: 'candEquipeDestroy' },
    logs:         { path: 'candidato/logs.js',         init: 'logsInit',         destroy: 'logsDestroy' },

    // Master
    'master-campanhas': { path: 'master/campanhas.js', init: 'campanhasInit', destroy: 'campanhasDestroy' },
    'master-planos':    { path: 'master/planos.js',    init: 'planosInit',    destroy: 'planosDestroy' },
    'master-banco':     { path: 'master/banco-global.js', init: 'bancoInit', destroy: 'bancoDestroy' },
    'master-clientes':  { path: 'master/clientes.js', init: 'clientesInit',  destroy: 'clientesDestroy' },
  };

  // Estado interno
  let _viewAtual = null;        // { moduleId, destroyFn, container }
  let _campanhaId = null;
  let _modulosAtivos = [];      // módulos da campanha (ex: ['crm', 'agenda', ...])
  let _nivelAtual = null;

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO (ouvir eventos e montar navegação)
  // ─────────────────────────────────────────────────────────
  function init() {
    // Aguardar a sessão estar pronta (via auth)
    global.addEventListener('wwmx:session-ready', (e) => {
      const session = e.detail;
      _campanhaId = session.campanhaId;
      _nivelAtual = session.nivel;

      // Carregar lista de módulos ativos da campanha (Firestore)
      _carregarModulosAtivos().then(() => {
        // Montar navegação (pode ser sobreposta ao que auth já fez)
        _montarNavSelect();

        // Carregar a primeira tela baseada no hash ou no valor do select
        const hash = global.location.hash.slice(1);
        const moduloInicial = hash || _obterPrimeiroModuloPermitido();
        _carregarModulo(moduloInicial);
      });
    });

    // Ouvir mudanças no <select> da navegação
    global.addEventListener('change', (e) => {
      if (e.target.id === 'navSelect') {
        const novoModulo = e.target.value;
        if (novoModulo && _moduloPermitido(novoModulo)) {
          _carregarModulo(novoModulo);
          global.location.hash = novoModulo; // opcional: atualizar URL
        }
      }
    });

    // Ouvir hashchange (para compatibilidade com links externos)
    global.addEventListener('hashchange', () => {
      const hash = global.location.hash.slice(1);
      if (hash && _moduloPermitido(hash)) {
        _carregarModulo(hash);
        const select = document.getElementById('navSelect');
        if (select) select.value = hash;
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // CARREGAR MÓDULOS ATIVOS DA CAMPANHA
  // ─────────────────────────────────────────────────────────
  async function _carregarModulosAtivos() {
    try {
      const config = await WWMX.carregarConfigCampanha(_campanhaId);
      _modulosAtivos = config?.modulosAtivos || [];
    } catch (err) {
      console.warn('[router] Não foi possível carregar módulos ativos:', err);
      _modulosAtivos = [];
    }
  }

  // ─────────────────────────────────────────────────────────
  // VERIFICAR SE MÓDULO É PERMITIDO PARA O PERFIL ATUAL
  // ─────────────────────────────────────────────────────────
  function _moduloPermitido(moduloId) {
    // Verificar se o módulo existe no mapeamento
    if (!MODULOS_VIEWS[moduloId]) return false;

    // Verificar permissão por nível (pode ser refinado)
    const permissoesPorNivel = {
      master:     Object.keys(MODULOS_VIEWS).filter(k => k.startsWith('master-')),
      candidato:  Object.keys(MODULOS_VIEWS).filter(k => k.startsWith('admin') || k === 'logs' || k === 'eleitoral' || k === 'dash'),
      coord:      ['dash','eleitoral','crm','militantes','estoque','rotas','mapa'],
      campo:      ['mapa','meucampo','percursos','meuinventario','minhasrotas'],
    };
    const permitidos = permissoesPorNivel[_nivelAtual] || [];
    if (!permitidos.includes(moduloId)) return false;

    // Se o módulo é de funcionalidade opcional (ex: CRM), verificar se está ativo na campanha
    const modulosOpcionais = ['crm', 'agenda', 'denuncias', 'estreleiro', 'pre-campanha'];
    if (modulosOpcionais.includes(moduloId) && !_modulosAtivos.includes(moduloId)) {
      return false;
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────
  // MONTAR NAVEGAÇÃO (select) — baseado em permissões
  // ─────────────────────────────────────────────────────────
  function _montarNavSelect() {
    const sel = document.getElementById('navSelect');
    if (!sel) return;

    // Construir lista de opções permitidas
    const opcoes = [];
    for (const [id, info] of Object.entries(MODULOS_VIEWS)) {
      if (_moduloPermitido(id)) {
        let label = '';
        if (id.startsWith('master-')) label = id.replace('master-', '').replace('-', ' ');
        else if (id.startsWith('admin')) label = id.replace('admin', '').replace(/([A-Z])/g, ' $1');
        else label = id.charAt(0).toUpperCase() + id.slice(1);
        opcoes.push({ id, label: label.trim() });
      }
    }

    sel.innerHTML = opcoes.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    if (opcoes.length) sel.value = opcoes[0].id;
  }

  function _obterPrimeiroModuloPermitido() {
    const sel = document.getElementById('navSelect');
    return sel?.value || Object.keys(MODULOS_VIEWS).find(id => _moduloPermitido(id)) || 'mapa';
  }

  // ─────────────────────────────────────────────────────────
  // CARREGAR MÓDULO (DINAMICAMENTE COM SCRIPT)
  // ─────────────────────────────────────────────────────────
  async function _carregarModulo(moduleId) {
    if (!moduleId || !MODULOS_VIEWS[moduleId]) {
      console.warn(`[router] Módulo inválido: ${moduleId}`);
      return;
    }

    // Destruir módulo anterior
    if (_viewAtual && _viewAtual.destroyFn) {
      try { _viewAtual.destroyFn(); } catch (e) { console.warn(e); }
    }

    const config = MODULOS_VIEWS[moduleId];
    const container = document.getElementById('appView');

    if (!container) {
      console.error('[router] Container #appView não encontrado');
      return;
    }

    // Limpar container (opcional, mas evita sobreposição)
    container.innerHTML = '';

    // Verificar se o script já foi carregado (para evitar duplicidade)
    const scriptId = `script-${moduleId}`;
    if (!document.getElementById(scriptId)) {
      // Carregar script dinamicamente
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = config.path;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Falha ao carregar ${config.path}`));
        document.head.appendChild(script);
      });
    }

    // Aguardar um ciclo para garantir que as funções do módulo estejam no window
    await new Promise(r => setTimeout(r, 10));

    // Chamar função de inicialização do módulo
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
        container.innerHTML = `<div class="empty">❌ Erro ao carregar módulo</div>`;
      }
    } else {
      console.error(`[router] Função de inicialização ${config.init} não encontrada`);
      container.innerHTML = `<div class="empty">⚠️ Módulo não implementado corretamente</div>`;
    }
  }

  // ─────────────────────────────────────────────────────────
  // EXPORTAÇÃO PÚBLICA
  // ─────────────────────────────────────────────────────────
  global.WWMX = global.WWMX || {};
  global.WWMX.Router = {
    init,
    carregarModulo: _carregarModulo,
    moduloPermitido: _moduloPermitido,
  };

  // Iniciar automaticamente quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

}(window));