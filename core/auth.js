/**
 * core/auth.js
 * WWMX Campaign — Autenticação, sessão e controle de acesso
 * Hotfix: vincula Campo/Coordenador/Candidato/Master e cria botão Master se faltar no HTML.
 */
(function (global) {
  'use strict';

  const NIVEL = { MASTER:'master', CANDIDATO:'candidato', COORDENADOR:'coord', CAMPO:'campo' };
  const NIVEL_RANK = { campo:1, coord:2, candidato:3, master:4 };
  const SESSION_KEY = 'wwmx_session';
  const SENHAS_FALLBACK = { campo:'demo2026', coord:'demo2026', candidato:'admin2026', master:'master2026' };

  const NAV_POR_NIVEL = {
    campo: [
      { value:'mapa', label:'🗺️  Mapa' }, { value:'meucampo', label:'📍 Meu Campo' },
      { value:'percursos', label:'🚗 Percursos' }, { value:'meuinventario', label:'📦 Meu Inventário' },
      { value:'minhasrotas', label:'🎯 Minhas Rotas' }
    ],
    coord: [
      { value:'central', label:'✨ Visão Geral' }, { value:'dash', label:'📊 Dashboard' }, { value:'mapa', label:'🗺️  Mapa' },
      { value:'eleitoral', label:'🗳️  Eleitoral' }, { value:'crm', label:'👥 CRM Lideranças' },
      { value:'militantes', label:'⚔️  Gestão de Equipe' }, { value:'estoque', label:'📦 Estoque Central' }, { value:'rotas', label:'🚗 Planejamento de Rotas' }
    ],
    candidato: [
      { value:'central', label:'✨ Visão Geral' }, { value:'admindash', label:'👑 Painel Candidato' },
      { value:'adminmapa', label:'🗺️  Mapa Consolidado' }, { value:'adminagentes', label:'⭐ Agentes' },
      { value:'adminequipe', label:'⚔️  Equipe' }, { value:'eleitoral', label:'🗳️  Eleitoral' },
      { value:'dash', label:'📊 Dashboard Op.' }, { value:'logs', label:'📋 Logs' }
    ],
    master: [
      { value:'central', label:'✨ Visão Geral' }, { value:'master-campanhas', label:'🏗️  Campanhas' },
      { value:'master-planos', label:'💰 Planos' }, { value:'master-banco', label:'🗄️  Banco Global' },
      { value:'master-clientes', label:'🤝 Clientes' }
    ]
  };

  let _session = null;
  let _nivelSelecionado = NIVEL.CAMPO;
  let _adminClicks = 0;
  let _authObserverInstalado = false;

  function init() {
    _montarTelaLogin();
    _tentarRestaurarSessao();
    _observarAuthFirebase();
  }

  function _montarTelaLogin() {
    _garantirBotaoMaster();
    _bindBotoesNivel();

    WWMX.onReady?.(async () => {
      try {
        const campanhaUrl = new URLSearchParams(global.location.search).get('c');
        if (campanhaUrl) {
          const config = await WWMX.carregarConfigCampanha(campanhaUrl);
          if (config) _aplicarIdentidadeVisual(config);
        }
      } catch (_) {}
    });

    const btnEntrar = document.getElementById('btnEntrar');
    if (btnEntrar && !btnEntrar.dataset.wwmxBound) {
      btnEntrar.dataset.wwmxBound = '1';
      btnEntrar.addEventListener('click', _tentarLogin);
    }

    const inputSenha = document.getElementById('loginSenha');
    if (inputSenha && !inputSenha.dataset.wwmxBound) {
      inputSenha.dataset.wwmxBound = '1';
      inputSenha.addEventListener('keydown', e => { if (e.key === 'Enter') _tentarLogin(); });
    }

    const logo = document.getElementById('loginLogoClick');
    if (logo && !logo.dataset.wwmxBound) {
      logo.dataset.wwmxBound = '1';
      logo.addEventListener('click', _revelarAcessosAvancados);
    }
  }

  function _garantirBotaoMaster() {
    if (document.getElementById('nb-master')) return;
    const wrap = document.querySelector('.nivel-btns');
    if (!wrap) return;
    const btn = document.createElement('button');
    btn.className = 'nivel-btn';
    btn.id = 'nb-master';
    btn.style.display = 'none';
    btn.innerHTML = '<span class="nb-icon">⚙️</span><span class="nb-label">Master</span>';
    wrap.appendChild(btn);
  }

  function _bindBotoesNivel() {
    const btns = {
      campo: document.getElementById('nb-campo'),
      coord: document.getElementById('nb-coord'),
      candidato: document.getElementById('nb-admin'),
      master: document.getElementById('nb-master'),
    };
    Object.entries(btns).forEach(([nivel, btn]) => {
      if (!btn || btn.dataset.wwmxBound) return;
      btn.dataset.wwmxBound = '1';
      btn.addEventListener('click', () => {
        _nivelSelecionado = nivel;
        Object.values(btns).forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
        _limparErroLogin();
      });
    });
  }

  function _revelarAcessosAvancados() {
    _adminClicks++;
    const candidato = document.getElementById('nb-admin');
    const master = document.getElementById('nb-master');
    if (_adminClicks >= 3) {
      if (candidato) candidato.style.display = 'flex';
      if (master) master.style.display = 'flex';
      _mostrarErroLogin('Acessos de candidato e master liberados', 'info');
    }
  }

  async function _tentarLogin() {
    const nome = (document.getElementById('loginNome')?.value || '').trim();
    const senha = (document.getElementById('loginSenha')?.value || '').trim();
    const nivel = _nivelSelecionado;
    _limparErroLogin();
    _setBtnEntrarLoading(true);
    try {
      if (!nome) throw new Error('Digite seu nome.');
      if (!senha) throw new Error('Digite a senha.');
      const campanhaId = _obterCampanhaIdFallback();
      const senhaOk = await _verificarSenhaCampanha(campanhaId, nivel, senha);
      if (!senhaOk) throw new Error('Senha incorreta para este perfil.');
      const email = _nomeParaEmail(nome, nivel, campanhaId);
      const fbUser = await _autenticarOuCriarFirebase(email, senha);
      const session = { uid: fbUser.uid, nome, email, nivel, campanhaId, loginTs: Date.now() };
      const nivelSalvo = await _obterNivelSalvo(campanhaId, fbUser.uid);
      if (nivelSalvo && NIVEL_RANK[nivelSalvo] > NIVEL_RANK[nivel]) session.nivel = nivelSalvo;
      await _ativarSessao(session);
    } catch (err) {
      console.error('[auth] login:', err);
      _mostrarErroLogin(err.message || 'Erro ao entrar.');
    } finally {
      _setBtnEntrarLoading(false);
    }
  }

  async function _verificarSenhaCampanha(campanhaId, nivel, senhaDigitada) {
    try {
      const config = await WWMX.carregarConfigCampanha(campanhaId);
      const senhaConfig = config?.senhas?.[nivel] || config?.senha?.[nivel] || config?.[`senha_${nivel}`];
      if (senhaConfig) return String(senhaConfig) === String(senhaDigitada);
    } catch (err) {
      console.warn('[auth] senha remota indisponível:', err.message);
    }
    return SENHAS_FALLBACK[nivel] === senhaDigitada;
  }

  function _nomeParaEmail(nome, nivel, campanhaId) {
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'.').replace(/[^a-z0-9.]/g,'').replace(/\.+/g,'.').replace(/^\.|\.$/g,'').slice(0,24) || 'usuario';
    const camp = String(campanhaId || 'demo').replace(/[^a-z0-9]/gi,'').slice(0,16).toLowerCase() || 'demo';
    return `wwmx.${slug}.${nivel}.${camp}@gmail.com`;
  }

  async function _autenticarOuCriarFirebase(email, senha) {
    const auth = firebase.auth();
    try {
      const cred = await auth.signInWithEmailAndPassword(email, senha);
      return cred.user;
    } catch (err) {
      const podeCriar = ['auth/user-not-found','auth/invalid-credential','auth/invalid-login-credentials'].includes(err.code);
      if (!podeCriar) {
        if (err.code === 'auth/operation-not-allowed') throw new Error('Ative Email/Password no Firebase Auth.');
        if (err.code === 'auth/wrong-password') throw new Error('Senha incorreta no Firebase Auth.');
        throw err;
      }
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, senha);
        return cred.user;
      } catch (createErr) {
        if (createErr.code === 'auth/weak-password') throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        throw createErr;
      }
    }
  }

  async function _obterNivelSalvo(campanhaId, uid) {
    try {
      const snap = await WWMX.db.get(`campanhas/${campanhaId}/militantes/${uid}/nivel`);
      return snap.val() || null;
    } catch (_) { return null; }
  }

  async function _ativarSessao(session) {
    _session = session;
    global._session = session;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ uid:session.uid, nome:session.nome, nivel:session.nivel, campanhaId:session.campanhaId, loginTs:session.loginTs }));
      localStorage.setItem('wwmx_campanha', session.campanhaId);
    } catch (_) {}
    await _registrarNoRTDB(session);
    WWMX.log?.(session.campanhaId, 'login', { nome:session.nome, nivel:session.nivel, device:navigator.userAgent.slice(0,80) }, session).catch(() => {});
    _montarUILogada(session);
    global.dispatchEvent(new CustomEvent('wwmx:session-ready', { detail: session }));
  }

  async function _registrarNoRTDB(session) {
    try {
      const path = `campanhas/${session.campanhaId}/militantes/${session.uid}`;
      await WWMX.db.set(path, { uid:session.uid, nome:session.nome, nivel:session.nivel, ultimoAcesso:Date.now() });
      WWMX.db.registrarPresenca?.(session.campanhaId, session.uid, { nome:session.nome, nivel:session.nivel });
    } catch (err) { console.warn('[auth] registrar falhou:', err.message); }
  }

  function _tentarRestaurarSessao() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const salva = JSON.parse(raw);
      if (Date.now() - (salva.loginTs || 0) > 8 * 60 * 60 * 1000) { sessionStorage.removeItem(SESSION_KEY); return; }
      firebase.auth().onAuthStateChanged(fbUser => {
        if (fbUser && fbUser.uid === salva.uid && !_session) _ativarSessao({ ...salva, email: fbUser.email });
        else if (!fbUser) sessionStorage.removeItem(SESSION_KEY);
      });
    } catch (_) { sessionStorage.removeItem(SESSION_KEY); }
  }

  function _observarAuthFirebase() {
    if (_authObserverInstalado) return;
    _authObserverInstalado = true;
    firebase.auth().onAuthStateChanged(fbUser => { if (!fbUser && _session) _encerrarSessao(false); });
  }

  function _montarUILogada(session) {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    const app = document.getElementById('app');
    if (app) app.classList.add('show');
    _atualizarBadgeNivel(session.nivel);
    _atualizarLogoHeader(session);
    _montarNav(session.nivel);
    global.dispatchEvent(new CustomEvent('wwmx:nav-ready', { detail: { nivel: session.nivel, campanhaId: session.campanhaId } }));
  }

  function _atualizarBadgeNivel(nivel) {
    const badge = document.getElementById('nivelBadge');
    if (!badge) return;
    const cfg = { master:'⚙️ Master', candidato:'👑 Candidato', coord:'🎯 Coordenador', campo:'⚔️ Campo' };
    badge.textContent = cfg[nivel] || cfg.campo;
    badge.className = 'header-badge' + (nivel === 'coord' || nivel === 'candidato' || nivel === 'master' ? ' coord' : '');
  }

  function _atualizarLogoHeader(session) {
    WWMX.onReady?.(async () => {
      try {
        const config = await WWMX.carregarConfigCampanha(session.campanhaId);
        if (config) _aplicarIdentidadeVisual(config, 'header');
      } catch (_) {}
    });
  }

  function _aplicarIdentidadeVisual(config, contexto = 'login') {
    const prefix = contexto === 'header' ? 'header-logo' : 'login-logo';
    const nameEl = document.querySelector(`.${prefix}-name`) || document.querySelector('.login-logo-cand');
    const numEl = document.querySelector(`.${prefix}-num`);
    if (nameEl && config.nomeExibicao) nameEl.innerHTML = config.nomeExibicao;
    if (numEl && config.numero) numEl.textContent = config.numero;
    const subEl = document.querySelector('.login-sub');
    if (subEl && config.subTitulo) subEl.textContent = config.subTitulo;
  }

  function _montarNav(nivel) {
    const sel = document.getElementById('navSelect');
    if (!sel) return;
    const abas = NAV_POR_NIVEL[nivel] || NAV_POR_NIVEL.campo;
    sel.innerHTML = abas.map(a => `<option value="${a.value}">${a.label}</option>`).join('');
    if (abas.length) sel.value = abas[0].value;
  }

  async function sair() { await _encerrarSessao(true); }
  async function _encerrarSessao(registrarLog = true) {
    try {
      if (registrarLog && _session) await WWMX.log?.(_session.campanhaId, 'logout', { nome:_session.nome, nivel:_session.nivel }, _session).catch(() => {});
      if (_session) await WWMX.db.removerPresenca?.(_session.campanhaId, _session.uid).catch(() => {});
      await firebase.auth().signOut().catch(() => {});
    } finally {
      _session = null; global._session = null; sessionStorage.removeItem(SESSION_KEY); global.location.reload();
    }
  }

  function temAcesso(nivelMinimo) { return !!_session && (NIVEL_RANK[_session.nivel] || 0) >= (NIVEL_RANK[nivelMinimo] || 0); }
  function exigirNivel(nivelMinimo, mensagem) { if (!temAcesso(nivelMinimo)) throw new Error(mensagem || `Acesso restrito a ${nivelMinimo}.`); }
  function ehNivel(...niveis) { return niveis.includes(_session?.nivel); }
  function sessaoAtual() { return _session ? { ..._session } : null; }

  function _obterCampanhaIdFallback() {
    const url = new URLSearchParams(global.location.search).get('c');
    if (url) return url;
    try { const ls = localStorage.getItem('wwmx_campanha'); if (ls) return ls; } catch (_) {}
    return 'demo';
  }
  function _mostrarErroLogin(msg, tipo = 'error') { const el = document.getElementById('loginError'); if (!el) return; el.textContent = msg; el.style.display = 'block'; el.style.color = tipo === 'info' ? 'var(--accent)' : 'var(--red)'; }
  function _limparErroLogin() { const el = document.getElementById('loginError'); if (el) el.style.display = 'none'; }
  function _setBtnEntrarLoading(loading) { const btn = document.getElementById('btnEntrar'); if (!btn) return; btn.disabled = loading; btn.textContent = loading ? 'Entrando…' : 'Entrar'; }

  function _instalarCompatibilidade() {
    global.fazerLogin = function () { _nivelSelecionado = global._nivelLogin || global.nivelSel || _nivelSelecionado || NIVEL.CAMPO; _tentarLogin(); };
    global.sair = sair;
    if (!global.G) global.G = {};
    Object.defineProperties(global.G, {
      nivel:{ get:() => _session?.nivel || 'campo', set:v => { if (_session) _session.nivel = v; } },
      nome:{ get:() => _session?.nome || '', set:v => { if (_session) _session.nome = v; } },
      uid:{ get:() => _session?.uid || '', set:v => { if (_session) _session.uid = v; } },
    });
  }

  function _autoInit() {
    const start = () => { _instalarCompatibilidade(); init(); };
    if (global.WWMX?.onReady) WWMX.onReady(start);
    else global.addEventListener('wwmx:firebase-ready', start, { once:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _autoInit, { once:true });
  else _autoInit();

  global.WWMX = global.WWMX || {};
  global.WWMX.Auth = global.WWMX.Auth || {};
  Object.assign(global.WWMX.Auth, {
    sessaoAtual, getSession:sessaoAtual, getUid:() => _session?.uid, getNome:() => _session?.nome,
    getNivel:() => _session?.nivel, getCampanhaId:() => _session?.campanhaId, temAcesso, exigirNivel, ehNivel, NIVEL, sair,
    rankNivel:n => NIVEL_RANK[n] || 0,
  });
  global._session = null;
}(window));
