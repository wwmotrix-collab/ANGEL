/**
 * core/router.js
 * ANGEL — roteador oficial único.
 *
 * Substitui core/router-ops.js.
 * - Usa inteligencia-eleitoral-firebase.js como módulo eleitoral oficial.
 * - Valida permissão por perfil.
 * - Carrega módulos dinamicamente com cache bust.
 * - Mostra erro amigável quando arquivo/init estiver faltando.
 */
(function(global){
  'use strict';

  const BUILD_TAG = '20260608-router-unificado';

  const VIEWS = {
    central:       { path:'modulos/central.js', init:'centralInit', destroy:'centralDestroy', viewId:'centralView' },

    mapa:          { path:'campo/mapa.js', init:'mapaInit', destroy:'mapaDestroy', viewId:'mapaView' },
    meucampo:      { path:'campo/meucampo.js', init:'meucampoInit', destroy:'meucampoDestroy', viewId:'meucampoView' },
    percursos:     { path:'campo/percursos.js', init:'percursosInit', destroy:'percursosDestroy', viewId:'percursosView' },
    meuinventario: { path:'campo/inventario.js', init:'inventarioInit', destroy:'inventarioDestroy', viewId:'meuinventarioView' },
    minhasrotas:   { path:'campo/rotas.js', init:'rotasInit', destroy:'rotasDestroy', viewId:'minhasrotasView' },

    dash:          { path:'coordenador/dash.js', init:'dashInit', destroy:'dashDestroy', viewId:'dashView' },
    mapaCoord:     { path:'candidato/mapa.js', init:'candMapaInit', destroy:'candMapaDestroy', viewId:'mapaCoordView' },
    eleitoral:     { path:'modulos/inteligencia-eleitoral-firebase.js', init:'intelInit', destroy:'intelDestroy', viewId:'eleitoralView' },
    crm:           { path:'modulos/crm.js', init:'crmInit', destroy:'crmDestroy', viewId:'crmView' },
    denuncias:     { path:'modulos/denuncias.js', init:'denunciasInit', destroy:'denunciasDestroy', viewId:'denunciasView' },
    militantes:    { path:'coordenador/equipe.js', init:'equipeInit', destroy:'equipeDestroy', viewId:'militantesView' },
    estoque:       { path:'coordenador/estoque.js', init:'estoqueInit', destroy:'estoqueDestroy', viewId:'estoqueView' },
    rotas:         { path:'coordenador/rotas.js', init:'rotasCoordInit', destroy:'rotasCoordDestroy', viewId:'rotasView' },

    admindash:     { path:'candidato/dashboard.js', init:'candDashInit', destroy:'candDashDestroy', viewId:'admindashView' },
    adminmapa:     { path:'candidato/mapa.js', init:'candMapaInit', destroy:'candMapaDestroy', viewId:'adminmapaView' },
    adminagentes:  { path:'candidato/agentes.js', init:'agentesInit', destroy:'agentesDestroy', viewId:'adminagentesView' },
    adminequipe:   { path:'candidato/equipe.js', init:'candEquipeInit', destroy:'candEquipeDestroy', viewId:'adminequipeView' },
    logs:          { path:'candidato/logs.js', init:'logsInit', destroy:'logsDestroy', viewId:'logsView' },

    'master-gerador':   { path:'master/gerador-picoclaw.js', init:'geradorPicoclawInit', destroy:'geradorPicoclawDestroy', viewId:'masterGeradorView' },
    'master-geocoding': { path:'master/geocoding-eleitoral.js', init:'geocodingEleitoralInit', destroy:'geocodingEleitoralDestroy', viewId:'masterGeocodingView' },
    'master-campanhas': { path:'master/campanhas.js', init:'campanhasInit', destroy:'campanhasDestroy', viewId:'masterCampanhasView' },
    'master-planos':    { path:'master/planos.js', init:'planosInit', destroy:'planosDestroy', viewId:'masterPlanosView' },
    'master-banco':     { path:'master/banco-global.js', init:'bancoInit', destroy:'bancoDestroy', viewId:'masterBancoView' },
    'master-clientes':  { path:'master/clientes.js', init:'clientesInit', destroy:'clientesDestroy', viewId:'masterClientesView' },
  };

  const ORDEM = {
    master:    ['central','master-gerador','master-geocoding','master-campanhas','master-planos','master-clientes','master-banco'],
    candidato: ['central','admindash','adminmapa','adminagentes','adminequipe','dash','eleitoral','crm','denuncias','logs'],
    coord:     ['central','dash','mapa','eleitoral','crm','denuncias','militantes','estoque','rotas'],
    campo:     ['central','mapa','meucampo','percursos','meuinventario','minhasrotas','denuncias'],
  };

  const MODULOS_OPCIONAIS = {
    crm: ['crm'],
    denuncias: ['denuncias'],
    eleitoral: ['eleitoral','inteligencia-eleitoral'],
    estoque: ['estoque'],
    rotas: ['rotas'],
  };

  let viewAtual = null;
  let campanhaId = null;
  let modulosAtivos = [];
  let nivelAtual = null;

  function init(){
    global.addEventListener('wwmx:session-ready', e => {
      campanhaId = e.detail.campanhaId;
      nivelAtual = e.detail.nivel;
      carregarModulosAtivos().then(() => {
        montarNav();
        abrir(global.location.hash.slice(1) || primeiro());
      });
    });

    global.addEventListener('change', e => {
      if (e.target.id === 'navSelect' && permitido(e.target.value)) {
        abrir(e.target.value);
        global.location.hash = e.target.value;
      }
    });

    global.addEventListener('hashchange', () => {
      const h = global.location.hash.slice(1);
      if (h && permitido(h)) {
        abrir(h);
        const s = document.getElementById('navSelect');
        if (s) s.value = h;
      }
    });
  }

  async function carregarModulosAtivos(){
    try {
      const cfg = await WWMX.carregarConfigCampanha(campanhaId);
      modulosAtivos = cfg?.modulosAtivos || [];
    } catch (e) {
      console.warn('[router] não foi possível carregar módulos ativos:', e);
      modulosAtivos = [];
    }
  }

  function moduloEstaAtivo(id){
    const aliases = MODULOS_OPCIONAIS[id];
    if (!aliases) return true;
    if (!modulosAtivos.length) return false;
    return modulosAtivos.some(m => aliases.includes(m));
  }

  function permitido(id){
    if (!VIEWS[id]) return false;
    const ordem = ORDEM[nivelAtual] || ORDEM.campo;
    if (!ordem.includes(id)) return false;
    return moduloEstaAtivo(id);
  }

  function montarNav(){
    const s = document.getElementById('navSelect');
    if (!s) return;
    const labels = WWMX.Config?.NAV_LABELS || {};
    const ids = (ORDEM[nivelAtual] || ORDEM.campo).filter(permitido);
    s.innerHTML = ids.map(id => `<option value="${id}">${labels[id] || id}</option>`).join('');
    if (ids.length) s.value = ids[0];
  }

  function primeiro(){
    const s = document.getElementById('navSelect');
    return s?.value || Object.keys(VIEWS).find(permitido) || 'central';
  }

  function src(path, reload=false){
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(BUILD_TAG)}${reload ? '&r='+Date.now() : ''}`;
  }

  async function carregarScript(id, cfg, reload=false){
    const sid = 'script-' + id;
    const old = document.getElementById(sid);
    if (old && !reload) return;
    if (old) old.remove();

    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = sid;
      s.src = src(cfg.path, reload);
      s.onload = resolve;
      s.onerror = () => reject(new Error('Arquivo do módulo não encontrado: ' + cfg.path));
      document.head.appendChild(s);
    });
  }

  async function abrir(id){
    if (!id || !VIEWS[id]) return;
    if (!permitido(id)) {
      const f = primeiro();
      if (f && f !== id) return abrir(f);
      return;
    }

    if (viewAtual?.destroyFn) {
      try { viewAtual.destroyFn(); } catch(e) { console.warn('[router destroy]', e); }
    }

    const cfg = VIEWS[id];
    const cont = document.getElementById('appView');
    if (!cont) return;

    cont.innerHTML = `<div class="view active" id="${cfg.viewId}" style="display:flex;flex-direction:column;min-height:100%;"></div>`;

    try {
      await carregarScript(id, cfg, false);
      await new Promise(r => setTimeout(r, 15));
      if (typeof global[cfg.init] !== 'function') {
        await carregarScript(id, cfg, true);
        await new Promise(r => setTimeout(r, 30));
      }
    } catch(e) {
      console.error('[router script]', e);
      cont.innerHTML = erroModulo('⚠️', 'Falha ao carregar módulo', e.message);
      return;
    }

    if (typeof global[cfg.init] !== 'function') {
      const msg = `Módulo carregou, mas não expôs ${cfg.init}().`;
      console.error('[router init missing]', id, cfg);
      cont.innerHTML = erroModulo('⚠️', 'Módulo não implementado corretamente', msg);
      return;
    }

    try {
      global[cfg.init](campanhaId);
      viewAtual = {
        moduleId: id,
        destroyFn: typeof global[cfg.destroy] === 'function' ? global[cfg.destroy] : null,
        container: cont
      };
    } catch(e) {
      console.error('[router init]', e);
      cont.innerHTML = erroModulo('❌', 'Erro ao iniciar módulo', e.message || String(e));
    }
  }

  function erroModulo(icon, titulo, detalhe){
    return `<div class="empty"><div class="empty-icon">${icon}</div><b>${titulo}</b><br><small>${esc(detalhe || '')}</small></div>`;
  }

  function validarManifesto(){
    return Object.entries(VIEWS).map(([id,cfg]) => ({
      id,
      path: cfg.path,
      init: cfg.init,
      destroy: cfg.destroy,
      perfis: Object.entries(ORDEM).filter(([,ids]) => ids.includes(id)).map(([p]) => p),
      opcional: !!MODULOS_OPCIONAIS[id],
    }));
  }

  function esc(v){
    return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.Router = {
    init,
    carregarModulo: abrir,
    moduloPermitido: permitido,
    validarManifesto,
    getManifesto: validarManifesto,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

})(window);
