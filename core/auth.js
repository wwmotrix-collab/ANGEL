/**
 * core/auth.js
 * ANGEL — autenticação, sessão e controle de acesso.
 *
 * Correção 2026-06-08:
 * - fallback demo só funciona em modo desenvolvimento.
 * - produção exige senhas configuradas em campanhas/{id}/config/main.
 */
(function(global){
  'use strict';

  const NIVEL = { MASTER:'master', CANDIDATO:'candidato', COORDENADOR:'coord', CAMPO:'campo' };
  const NIVEL_RANK = { campo:1, coord:2, candidato:3, master:4 };
  const SESSION_KEY = 'wwmx_session';

  let _session = null;
  let _nivelSelecionado = NIVEL.CAMPO;
  let _adminClicks = 0;

  const SENHAS_DEV = {
    campo: 'demo2026',
    coord: 'demo2026',
    candidato: 'admin2026',
    master: 'master2026',
  };

  function init(){
    bindLogin();
    tentarRestaurarSessao();
    observarAuthFirebase();
  }

  function isDevMode(){
    const host = global.location.hostname;
    const params = new URLSearchParams(global.location.search);
    let flag = false;
    try { flag = localStorage.getItem('wwmx_dev_mode') === '1'; } catch(_) {}
    return params.get('dev') === '1' ||
      flag ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '' ||
      global.location.protocol === 'file:';
  }

  function bindLogin(){
    const btns = {
      campo: document.getElementById('nb-campo'),
      coord: document.getElementById('nb-coord'),
      candidato: document.getElementById('nb-admin'),
      master: document.getElementById('nb-master'),
    };

    Object.entries(btns).forEach(([nivel, btn]) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        _nivelSelecionado = nivel;
        Object.values(btns).forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const logo = document.getElementById('loginLogoClick');
    if (logo) logo.addEventListener('click', () => {
      _adminClicks++;
      if (_adminClicks >= 3) {
        ['nb-admin','nb-master'].forEach(id => {
          const b = document.getElementById(id);
          if (b) b.style.display = 'flex';
        });
        mostrarErroLogin('Acessos avançados liberados', 'info');
      }
    });

    document.getElementById('btnEntrar')?.addEventListener('click', tentarLogin);
    document.getElementById('loginSenha')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') tentarLogin();
    });
  }

  async function tentarLogin(){
    const nome = (document.getElementById('loginNome')?.value || '').trim();
    const senha = document.getElementById('loginSenha')?.value || '';
    const nivel = _nivelSelecionado || NIVEL.CAMPO;

    limparErroLogin();
    setBtnLoading(true);

    try {
      if (!nome) { mostrarErroLogin('Digite seu nome.'); return; }
      if (!senha) { mostrarErroLogin('Digite a senha.'); return; }

      const campanhaId = obterCampanhaId();
      const senhaOk = await verificarSenhaCampanha(campanhaId, nivel, senha);
      if (!senhaOk) {
        mostrarErroLogin(isDevMode() ? 'Senha incorreta.' : 'Senha incorreta ou campanha sem senha configurada.');
        return;
      }

      const email = nomeParaEmail(nome, nivel, campanhaId);
      const fbUser = await autenticarOuCriarFirebase(email, senha);

      const session = {
        uid: fbUser.uid,
        nome,
        email,
        nivel,
        campanhaId,
        loginTs: Date.now(),
      };

      const nivelSalvo = await obterNivelSalvo(campanhaId, fbUser.uid);
      if (nivelSalvo && NIVEL_RANK[nivelSalvo] > NIVEL_RANK[session.nivel]) session.nivel = nivelSalvo;

      await ativarSessao(session);
    } catch(e) {
      console.error('[auth] tentarLogin:', e);
      mostrarErroLogin(e.message || 'Erro ao entrar. Tente novamente.');
    } finally {
      setBtnLoading(false);
    }
  }

  async function verificarSenhaCampanha(campanhaId, nivel, senhaDigitada){
    try {
      const config = await WWMX.carregarConfigCampanha(campanhaId);
      if (config?.senhas?.[nivel]) return config.senhas[nivel] === senhaDigitada;
    } catch(e) {
      console.warn('[auth] config senha indisponível:', e.message);
    }

    if (isDevMode()) return SENHAS_DEV[nivel] === senhaDigitada;
    return false;
  }

  function nomeParaEmail(nome, nivel, campanhaId){
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'.').replace(/[^a-z0-9.]/g,'').slice(0,20) || 'usuario';
    const camp = String(campanhaId || 'campanha').replace(/[^a-z0-9]/gi,'').slice(0,16).toLowerCase();
    return `wwmx.${slug}.${nivel}.${camp}@gmail.com`;
  }

  async function autenticarOuCriarFirebase(email, senha){
    const auth = firebase.auth();
    try {
      return (await auth.signInWithEmailAndPassword(email, senha)).user;
    } catch(err) {
      const primeiroAcesso = ['auth/user-not-found','auth/invalid-credential','auth/invalid-login-credentials'].includes(err.code);
      if (!primeiroAcesso) throw err;
      try {
        return (await auth.createUserWithEmailAndPassword(email, senha)).user;
      } catch(createErr) {
        if (createErr.code === 'auth/email-already-in-use') throw new Error('Senha incorreta para este usuário.');
        throw createErr;
      }
    }
  }

  async function obterNivelSalvo(campanhaId, uid){
    try {
      const snap = await WWMX.db.get(`campanhas/${campanhaId}/militantes/${uid}/nivel`);
      return snap.val() || null;
    } catch(_) { return null; }
  }

  async function ativarSessao(session){
    _session = session;
    global._session = session;

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        uid: session.uid,
        nome: session.nome,
        email: session.email,
        nivel: session.nivel,
        campanhaId: session.campanhaId,
        loginTs: session.loginTs,
      }));
    } catch(_) {}

    await registrarNoRTDB(session);

    WWMX.log(session.campanhaId, 'login', {
      nome: session.nome,
      nivel: session.nivel,
      device: navigator.userAgent.slice(0,80),
    }, session).catch(() => {});

    montarUILogada(session);
    global.dispatchEvent(new CustomEvent('wwmx:session-ready', { detail: session }));
  }

  async function registrarNoRTDB(session){
    try {
      const path = `campanhas/${session.campanhaId}/militantes/${session.uid}`;
      await WWMX.db.set(path, {
        uid: session.uid,
        nome: session.nome,
        nivel: session.nivel,
        ultimoAcesso: Date.now(),
      });
      WWMX.db.registrarPresenca(session.campanhaId, session.uid, {
        nome: session.nome,
        nivel: session.nivel,
      });
    } catch(e) {
      console.warn('[auth] registrarNoRTDB:', e.message);
    }
  }

  function tentarRestaurarSessao(){
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const salva = JSON.parse(raw);
      if (Date.now() - (salva.loginTs || 0) > 8*60*60*1000) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      firebase.auth().onAuthStateChanged(fbUser => {
        if (fbUser && fbUser.uid === salva.uid) ativarSessao({ ...salva, email: fbUser.email });
        else sessionStorage.removeItem(SESSION_KEY);
      });
    } catch(_) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function observarAuthFirebase(){
    firebase.auth().onAuthStateChanged(fbUser => {
      if (!fbUser && _session) encerrarSessao(false);
    });
  }

  function montarUILogada(session){
    const login = document.getElementById('loginScreen');
    const app = document.getElementById('app');
    if (login) login.style.display = 'none';
    if (app) app.classList.add('show');
    atualizarBadgeNivel(session.nivel);
    atualizarIdentidade(session);
  }

  function atualizarBadgeNivel(nivel){
    const badge = document.getElementById('nivelBadge');
    if (!badge) return;
    const map = {
      master: { label:'⚙️ Master', cls:'master' },
      candidato: { label:'👑 Candidato', cls:'coord' },
      coord: { label:'🎯 Coordenador', cls:'coord' },
      campo: { label:'⚔️ Campo', cls:'' },
    };
    const cfg = map[nivel] || map.campo;
    badge.textContent = cfg.label;
    badge.className = 'header-badge' + (cfg.cls ? ' ' + cfg.cls : '');
  }

  function atualizarIdentidade(session){
    WWMX.onReady(async () => {
      try {
        const cfg = await WWMX.carregarConfigCampanha(session.campanhaId);
        if (!cfg) return;
        const sub = document.querySelector('.login-sub');
        if (sub && cfg.subTitulo) sub.textContent = cfg.subTitulo;
      } catch(_) {}
    });
  }

  async function sair(){ await encerrarSessao(true); }

  async function encerrarSessao(registrarLog = true){
    if (!_session) { global.location.reload(); return; }
    try {
      if (registrarLog) {
        await WWMX.log(_session.campanhaId, 'logout', { nome:_session.nome, nivel:_session.nivel }, _session).catch(() => {});
      }
      await WWMX.db.removerPresenca(_session.campanhaId, _session.uid).catch(() => {});
      await firebase.auth().signOut().catch(() => {});
    } finally {
      _session = null;
      global._session = null;
      sessionStorage.removeItem(SESSION_KEY);
      global.location.reload();
    }
  }

  function temAcesso(nivelMinimo){
    if (!_session) return false;
    return (NIVEL_RANK[_session.nivel] || 0) >= (NIVEL_RANK[nivelMinimo] || 0);
  }

  function exigirNivel(nivelMinimo, mensagem){
    if (!temAcesso(nivelMinimo)) {
      const msg = mensagem || `Acesso restrito a ${nivelMinimo} ou superior.`;
      WWMX.UI?.showToast?.(`🔒 ${msg}`, 'error');
      throw new Error('[auth] acesso negado: ' + msg);
    }
  }

  function ehNivel(...niveis){ return niveis.includes(_session?.nivel); }
  function sessaoAtual(){ return _session ? { ..._session } : null; }

  function obterCampanhaId(){
    const url = new URLSearchParams(global.location.search).get('c');
    if (url) return url;
    try {
      const ls = localStorage.getItem('wwmx_campanha');
      if (ls) return ls;
    } catch(_) {}
    const host = global.location.hostname.split('.')[0];
    if (host && host !== 'localhost' && host !== '127') return host;
    return isDevMode() ? 'demo' : (global.WWMX?.Referencia?.id || 'angel-referencia-viamao');
  }

  function mostrarErroLogin(msg, tipo='error'){
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.color = tipo === 'info' ? 'var(--accent)' : 'var(--red)';
  }
  function limparErroLogin(){ const el = document.getElementById('loginError'); if (el) el.style.display = 'none'; }
  function setBtnLoading(loading){
    const btn = document.getElementById('btnEntrar');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Entrando…' : 'Entrar';
  }

  function instalarCompat(){
    global.fazerLogin = function(){
      _nivelSelecionado = global._nivelLogin || global.nivelSel || NIVEL.CAMPO;
      tentarLogin();
    };
    global.sair = sair;
    if (!global.G) global.G = {};
    try {
      Object.defineProperties(global.G, {
        nivel: { get: () => _session?.nivel || 'campo', set: v => { if (_session) _session.nivel = v; } },
        nome: { get: () => _session?.nome || '', set: v => { if (_session) _session.nome = v; } },
        uid: { get: () => _session?.uid || '', set: v => { if (_session) _session.uid = v; } },
      });
    } catch(_) {}
  }

  function autoInit(){
    if (global.WWMX?.onReady) WWMX.onReady(() => { instalarCompat(); init(); });
    else global.addEventListener('wwmx:firebase-ready', () => { instalarCompat(); init(); }, { once:true });
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.Auth = Object.assign(global.WWMX.Auth || {}, {
    sessaoAtual,
    getSession: sessaoAtual,
    getUid: () => _session?.uid,
    getNome: () => _session?.nome,
    getNivel: () => _session?.nivel,
    getCampanhaId: () => _session?.campanhaId,
    temAcesso,
    exigirNivel,
    ehNivel,
    NIVEL,
    sair,
    rankNivel: n => NIVEL_RANK[n] || 0,
    isDevMode,
  });
  global._session = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit, {once:true});
  else autoInit();

})(window);
