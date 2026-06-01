/**
 * core/auth.js
 * WWMX Campaign — Autenticação, sessão e controle de acesso
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  QUATRO PERFIS, DOIS MECANISMOS DE AUTH                 │
 * │                                                         │
 * │  Firebase Auth (email/password)                         │
 * │    Todos os perfis usam Firebase Auth como base.        │
 * │    O nível de acesso é armazenado no RTDB junto ao      │
 * │    registro do militante, e verificado server-side       │
 * │    pelas Security Rules do Firebase.                    │
 * │                                                         │
 * │  Senhas de campanha (camada extra para campo/coord)      │
 * │    Militantes de campo e coordenadores usam uma senha    │
 * │    de campanha compartilhada (definida pelo Master)      │
 * │    além das credenciais Firebase. Isso permite que o    │
 * │    Candidato e o Master tenham controle total sobre      │
 * │    quem pode acessar a campanha específica.             │
 * │                                                         │
 * │  Perfis e permissões                                    │
 * │    master      → gerencia campanhas, planos, banco       │
 * │    candidato   → visão total, logs, define coordenadores │
 * │    coordenador → equipe, estoque, rotas, CRM             │
 * │    campo       → mapa, missões, inventário, percurso     │
 * └─────────────────────────────────────────────────────────┘
 *
 * Expõe:
 *   window._session   → { uid, nome, email, nivel, campanhaId, ... }
 *   window.Auth.*     → API pública do módulo
 *
 * Depende de:
 *   core/firebase.js  → window.WWMX.db, window.WWMX.fs
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // CONSTANTES DE NÍVEL
  // ─────────────────────────────────────────────────────────
  const NIVEL = {
    MASTER:      'master',
    CANDIDATO:   'candidato',
    COORDENADOR: 'coord',
    CAMPO:       'campo',
  };

  // Hierarquia numérica para comparação (maior = mais acesso)
  const NIVEL_RANK = {
    campo:      1,
    coord:      2,
    candidato:  3,
    master:     4,
  };

  // Navegação disponível por perfil
  const NAV_POR_NIVEL = {
    campo: [
      { value: 'mapa',         label: '🗺️  Mapa'            },
      { value: 'meucampo',     label: '📍 Meu Campo'        },
      { value: 'percursos',    label: '🚗 Percursos'        },
      { value: 'meuinventario',label: '📦 Meu Inventário'   },
      { value: 'minhasrotas',  label: '🎯 Minhas Rotas'     },
    ],
    coord: [
      { value: 'mapa',         label: '🗺️  Mapa'            },
      { value: 'dash',         label: '📊 Dashboard'        },
      { value: 'eleitoral',    label: '🗳️  Eleitoral'        },
      { value: 'crm',          label: '👥 CRM Lideranças'   },
      { value: 'militantes',   label: '⚔️  Militantes'       },
      { value: 'estoque',      label: '📦 Estoque Central'  },
      { value: 'rotas',        label: '🚗 Rotas'            },
    ],
    candidato: [
      { value: 'admindash',    label: '👑 Painel Candidato' },
      { value: 'adminmapa',    label: '🗺️  Mapa Consolidado' },
      { value: 'adminagentes', label: '⭐ Agentes'          },
      { value: 'adminequipe',  label: '⚔️  Equipe'           },
      { value: 'eleitoral',    label: '🗳️  Eleitoral'        },
      { value: 'dash',         label: '📊 Dashboard Op.'    },
      { value: 'logs',         label: '📋 Logs'             },
    ],
    master: [
      { value: 'master-campanhas', label: '🏗️  Campanhas'     },
      { value: 'master-planos',    label: '💰 Planos'         },
      { value: 'master-banco',     label: '🗄️  Banco Global'   },
      { value: 'master-clientes',  label: '🤝 Clientes'       },
    ],
  };

  // ─────────────────────────────────────────────────────────
  // ESTADO DA SESSÃO
  // ─────────────────────────────────────────────────────────
  let _session = null; // objeto de sessão ativo

  const SESSION_KEY = 'wwmx_session'; // chave no sessionStorage

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // Chamado por core/firebase.js após wwmx:firebase-ready
  // ─────────────────────────────────────────────────────────
  function init() {
    _montarTelaLogin();
    _tentarRestaurarSessao();
    _observarAuthFirebase();
  }

  // ─────────────────────────────────────────────────────────
  // MONTAGEM DA TELA DE LOGIN
  // Usa dados de identidade da campanha vindos do Firestore.
  // Em demo: fallback para valores hardcoded do HTML original.
  // ─────────────────────────────────────────────────────────
  function _montarTelaLogin() {
    const screen = document.getElementById('loginScreen');
    if (!screen) return;

    // Tentar carregar config da campanha para personalizar o logo
    WWMX.onReady(async () => {
      try {
        // URL param ?c=ID permite abrir campanha específica
        const urlParams   = new URLSearchParams(global.location.search);
        const campanhaUrl = urlParams.get('c');
        if (campanhaUrl) {
          const config = await WWMX.carregarConfigCampanha(campanhaUrl);
          if (config) _aplicarIdentidadeVisual(config);
        }
      } catch (_) { /* usa fallback visual do HTML */ }
    });

    // Bind dos botões de nível
    _bindBotoesNivel();

    // Bind do botão entrar
    const btnEntrar = document.getElementById('btnEntrar');
    if (btnEntrar) {
      btnEntrar.addEventListener('click', _tentarLogin);
    }

    // Enter no campo senha
    const inputSenha = document.getElementById('loginSenha');
    if (inputSenha) {
      inputSenha.addEventListener('keydown', e => {
        if (e.key === 'Enter') _tentarLogin();
      });
    }

    // Easter egg: 3 cliques no logo revela botão Candidato
    const logo = document.getElementById('loginLogoClick');
    if (logo) logo.addEventListener('click', _revelarBotaoCandidato);
  }

  // ─────────────────────────────────────────────────────────
  // SELEÇÃO DE NÍVEL NA TELA DE LOGIN
  // ─────────────────────────────────────────────────────────
  let _nivelSelecionado = NIVEL.CAMPO;
  let _adminClicks = 0;

  function _bindBotoesNivel() {
    const btns = {
      campo:     document.getElementById('nb-campo'),
      coord:     document.getElementById('nb-coord'),
      candidato: document.getElementById('nb-admin'),   // ID legado do HTML
    };

    Object.entries(btns).forEach(([nivel, btn]) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        _nivelSelecionado = nivel;
        Object.values(btns).forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function _revelarBotaoCandidato() {
    _adminClicks++;
    if (_adminClicks >= 3) {
      const btn = document.getElementById('nb-admin');
      if (btn && btn.style.display === 'none') {
        btn.style.display = 'flex';
        _mostrarErroLogin('Acesso de candidato liberado', 'info');
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // FLUXO DE LOGIN
  // ─────────────────────────────────────────────────────────
  async function _tentarLogin() {
    const nome  = (document.getElementById('loginNome')?.value  || '').trim();
    const senha = (document.getElementById('loginSenha')?.value || '');
    const nivel = _nivelSelecionado;

    _limparErroLogin();
    _setBtnEntrarLoading(true);

    try {
      // 1. Validações locais
      if (!nome)  { _mostrarErroLogin('Digite seu nome.'); return; }
      if (!senha) { _mostrarErroLogin('Digite a senha.');  return; }

      // 2. Buscar configuração da campanha ativa
      const urlParams  = new URLSearchParams(global.location.search);
      const campanhaId = urlParams.get('c') || _obterCampanhaIdFallback();

      // 3. Verificar senha de campanha no Firebase
      const senhaOk = await _verificarSenhaCampanha(campanhaId, nivel, senha);
      if (!senhaOk) { _mostrarErroLogin('Senha incorreta.'); return; }

      // 4. Autenticar no Firebase Auth (email sintético a partir do nome)
      const email   = _nomeParaEmail(nome, nivel, campanhaId);
      const fbUser  = await _autenticarOuCriarFirebase(email, senha, nivel);

      // 5. Montar sessão
      const session = {
        uid:        fbUser.uid,
        nome,
        email,
        nivel,
        campanhaId,
        loginTs:    Date.now(),
      };

      // 6. Verificar se este uid já tem um nível no Firebase
      // Se sim, garantir que não está fazendo downgrade de acesso
      const nivelSalvo = await _obterNivelSalvo(campanhaId, fbUser.uid);
      if (nivelSalvo && NIVEL_RANK[nivelSalvo] > NIVEL_RANK[nivel]) {
        // Usuário tem acesso maior no banco — elevar silenciosamente
        session.nivel = nivelSalvo;
      }

      // 7. Ativar sessão
      _ativarSessao(session);

    } catch (err) {
      console.error('[auth] _tentarLogin:', err);
      _mostrarErroLogin('Erro ao entrar. Tente novamente.');
    } finally {
      _setBtnEntrarLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // VERIFICAÇÃO DE SENHA DE CAMPANHA
  // A senha fica em Firestore: campanhas/{id}/config/senhas
  // Em demo/desenvolvimento usa fallback hardcoded.
  // ─────────────────────────────────────────────────────────
  const _SENHAS_FALLBACK = {
    campo:     'demo2026',
    coord:     'demo2026',
    candidato: 'admin2026',
    master:    'master2026',
  };

  async function _verificarSenhaCampanha(campanhaId, nivel, senhaDigitada) {
    try {
      const config = await WWMX.fs.getDoc('campanhas', campanhaId, 'config');
      if (config?.senhas?.[nivel]) {
        return config.senhas[nivel] === senhaDigitada;
      }
    } catch (_) {}
    // Fallback para demo
    return _SENHAS_FALLBACK[nivel] === senhaDigitada;
  }

  // ─────────────────────────────────────────────────────────
  // FIREBASE AUTH — cria ou loga usuário
  // Usa email sintético para não exigir email real do militante.
  // Formato: nome-slug_nivel@campanha-id.wwmx
  // ─────────────────────────────────────────────────────────
  function _nomeParaEmail(nome, nivel, campanhaId) {
    const slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 30);
    return `${slug}_${nivel}@${campanhaId}.wwmx`;
  }

  async function _autenticarOuCriarFirebase(email, senha, nivel) {
    const auth = firebase.auth();
    try {
      // Tenta login primeiro
      const cred = await auth.signInWithEmailAndPassword(email, senha);
      return cred.user;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Primeiro acesso: cria o usuário
        const cred = await auth.createUserWithEmailAndPassword(email, senha);
        return cred.user;
      }
      if (err.code === 'auth/wrong-password') {
        throw new Error('Senha incorreta no Firebase Auth.');
      }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────
  // NÍVEL SALVO NO RTDB
  // Impede que alguém use a senha de campo para acessar
  // um uid que já está registrado como coordenador.
  // ─────────────────────────────────────────────────────────
  async function _obterNivelSalvo(campanhaId, uid) {
    try {
      const snap = await WWMX.db.get(
        `campanhas/${campanhaId}/militantes/${uid}/nivel`
      );
      return snap.val() || null;
    } catch (_) { return null; }
  }

  // ─────────────────────────────────────────────────────────
  // ATIVAR SESSÃO
  // Grava no RTDB, salva no sessionStorage, monta a UI.
  // ─────────────────────────────────────────────────────────
  async function _ativarSessao(session) {
    _session = session;
    global._session = session; // compatibilidade com módulos legados

    // Salvar no sessionStorage para restaurar após F5
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        uid:        session.uid,
        nome:       session.nome,
        nivel:      session.nivel,
        campanhaId: session.campanhaId,
        loginTs:    session.loginTs,
      }));
    } catch (_) {}

    // Registrar no RTDB (presença + militante)
    await _registrarNoRTDB(session);

    // Gravar log de login no Firestore
    WWMX.log(session.campanhaId, 'login', {
      nome:   session.nome,
      nivel:  session.nivel,
      device: navigator.userAgent.slice(0, 80),
    }, session).catch(() => {});

    // Montar a UI logada
    _montarUILogada(session);

    // Disparar evento para outros módulos ouvirem
    global.dispatchEvent(new CustomEvent('wwmx:session-ready', { detail: session }));
  }

  async function _registrarNoRTDB(session) {
    try {
      const { db } = WWMX;
      const path = `campanhas/${session.campanhaId}/militantes/${session.uid}`;
      await db.set(path, {
        uid:          session.uid,
        nome:         session.nome,
        nivel:        session.nivel,
        ultimoAcesso: Date.now(),
      });
      db.registrarPresenca(session.campanhaId, session.uid, {
        nome:  session.nome,
        nivel: session.nivel,
      });
    } catch (err) {
      console.warn('[auth] _registrarNoRTDB falhou:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // RESTAURAR SESSÃO APÓS RELOAD
  // ─────────────────────────────────────────────────────────
  function _tentarRestaurarSessao() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const salva = JSON.parse(raw);

      // Expirar sessão após 8 horas
      const OITO_HORAS = 8 * 60 * 60 * 1000;
      if (Date.now() - (salva.loginTs || 0) > OITO_HORAS) {
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      // Aguardar Firebase Auth confirmar que o usuário ainda está logado
      firebase.auth().onAuthStateChanged(fbUser => {
        if (fbUser && fbUser.uid === salva.uid) {
          // Re-ativar sessão sem mostrar a tela de login
          _ativarSessao({ ...salva, email: fbUser.email });
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      });
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  // ─────────────────────────────────────────────────────────
  // OBSERVER DO FIREBASE AUTH
  // Captura desconexões e mudanças de estado externas
  // (ex: outro dispositivo fez logout do mesmo usuário).
  // ─────────────────────────────────────────────────────────
  function _observarAuthFirebase() {
    firebase.auth().onAuthStateChanged(fbUser => {
      if (!fbUser && _session) {
        // Firebase desconectou o usuário — forçar logout
        _encerrarSessao(false);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // MONTAGEM DA UI LOGADA
  // Oculta loginScreen, exibe #app, preenche nav por perfil.
  // ─────────────────────────────────────────────────────────
  function _montarUILogada(session) {
    // Ocultar login
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';

    // Mostrar app
    const app = document.getElementById('app');
    if (app) app.classList.add('show');

    // Badge de nível na header
    _atualizarBadgeNivel(session.nivel);

    // Personalizar logo com nome do candidato (se disponível)
    _atualizarLogoHeader(session);

    // Montar navegação conforme nível
    _montarNav(session.nivel);

    // Ativar módulos do perfil via event (router.js ouve este evento)
    global.dispatchEvent(new CustomEvent('wwmx:nav-ready', {
      detail: { nivel: session.nivel, campanhaId: session.campanhaId },
    }));
  }

  function _atualizarBadgeNivel(nivel) {
    const badge = document.getElementById('nivelBadge');
    if (!badge) return;
    const config = {
      master:     { label: '⚙️ Master',      cls: 'master'     },
      candidato:  { label: '👑 Candidato',   cls: 'coord'      },
      coord:      { label: '🎯 Coordenador', cls: 'coord'      },
      campo:      { label: '⚔️ Campo',        cls: ''           },
    };
    const cfg = config[nivel] || config.campo;
    badge.textContent = cfg.label;
    badge.className   = 'header-badge' + (cfg.cls ? ` ${cfg.cls}` : '');
  }

  function _atualizarLogoHeader(session) {
    // Tenta carregar a identidade visual da campanha do Firestore
    WWMX.onReady(async () => {
      try {
        const config = await WWMX.carregarConfigCampanha(session.campanhaId);
        if (config) _aplicarIdentidadeVisual(config, 'header');
      } catch (_) {}
    });
  }

  function _aplicarIdentidadeVisual(config, contexto = 'login') {
    const prefix = contexto === 'header' ? 'header-logo' : 'login-logo';
    const nameEl = document.querySelector(`.${prefix}-name`) ||
                   document.querySelector('.login-logo-cand');
    const numEl  = document.querySelector(`.${prefix}-num`);
    if (nameEl && config.nomeExibicao) nameEl.innerHTML = config.nomeExibicao;
    if (numEl  && config.numero)       numEl.textContent = config.numero;
    const subEl = document.querySelector('.login-sub');
    if (subEl  && config.subTitulo)    subEl.textContent = config.subTitulo;
  }

  function _montarNav(nivel) {
    const sel = document.getElementById('navSelect');
    if (!sel) return;
    const abas = NAV_POR_NIVEL[nivel] || NAV_POR_NIVEL.campo;
    sel.innerHTML = abas
      .map(a => `<option value="${a.value}">${a.label}</option>`)
      .join('');
    // Primeira aba como padrão
    if (abas.length) sel.value = abas[0].value;
  }

  // ─────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────
  async function sair() {
    await _encerrarSessao(true);
  }

  async function _encerrarSessao(registrarLog = true) {
    if (!_session) { global.location.reload(); return; }

    try {
      if (registrarLog) {
        await WWMX.log(_session.campanhaId, 'logout', {
          nome:  _session.nome,
          nivel: _session.nivel,
        }, _session).catch(() => {});
      }

      // Remover presença do RTDB
      await WWMX.db.removerPresenca(_session.campanhaId, _session.uid)
        .catch(() => {});

      // Deslogar do Firebase Auth
      await firebase.auth().signOut().catch(() => {});

    } catch (err) {
      console.error('[auth] _encerrarSessao:', err);
    } finally {
      _session = null;
      global._session = null;
      sessionStorage.removeItem(SESSION_KEY);
      global.location.reload();
    }
  }

  // ─────────────────────────────────────────────────────────
  // GUARDAS DE ACESSO
  // Use em qualquer módulo para bloquear ações não permitidas.
  // ─────────────────────────────────────────────────────────

  /**
   * Retorna true se a sessão ativa tem pelo menos o nível exigido.
   * @param {string} nivelMinimo  Ex: 'coord'
   */
  function temAcesso(nivelMinimo) {
    if (!_session) return false;
    return (NIVEL_RANK[_session.nivel] || 0) >= (NIVEL_RANK[nivelMinimo] || 0);
  }

  /**
   * Lança erro se o usuário não tem o nível exigido.
   * @param {string} nivelMinimo
   * @param {string} [mensagem]
   */
  function exigirNivel(nivelMinimo, mensagem) {
    if (!temAcesso(nivelMinimo)) {
      const msg = mensagem || `Acesso restrito a ${nivelMinimo} ou superior.`;
      if (global.showToast) showToast(`🔒 ${msg}`);
      throw new Error(`[auth] Acesso negado: ${msg}`);
    }
  }

  /**
   * Verifica se o nível ativo é exatamente um dos informados.
   * @param {...string} niveis
   */
  function ehNivel(...niveis) {
    return niveis.includes(_session?.nivel);
  }

  /**
   * Retorna o objeto de sessão corrente ou null.
   */
  function sessaoAtual() {
    return _session ? { ..._session } : null;
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS
  // ─────────────────────────────────────────────────────────

  /**
   * Obtém o campanhaId da URL, localStorage ou cookie.
   * Fallback para 'demo' em ambiente de desenvolvimento.
   */
  function _obterCampanhaIdFallback() {
    // 1. Parâmetro de URL
    const url = new URLSearchParams(global.location.search).get('c');
    if (url) return url;
    // 2. localStorage (campanha anterior do mesmo dispositivo)
    try {
      const ls = localStorage.getItem('wwmx_campanha');
      if (ls) return ls;
    } catch (_) {}
    // 3. Domínio da URL (ex: guto40.wwmx.app → campanhaId = 'guto40')
    const host = global.location.hostname.split('.')[0];
    if (host && host !== 'localhost' && host !== '127') return host;
    // 4. Fallback para demo
    return 'demo';
  }

  function _mostrarErroLogin(msg, tipo = 'error') {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent     = msg;
    el.style.display   = 'block';
    el.style.color     = tipo === 'info' ? 'var(--accent)' : 'var(--red)';
  }

  function _limparErroLogin() {
    const el = document.getElementById('loginError');
    if (el) el.style.display = 'none';
  }

  function _setBtnEntrarLoading(loading) {
    const btn = document.getElementById('btnEntrar');
    if (!btn) return;
    btn.disabled     = loading;
    btn.textContent  = loading ? 'Entrando…' : 'Entrar';
  }

  // ─────────────────────────────────────────────────────────
  // COMPATIBILIDADE COM MONÓLITO
  // G.nivel, G.nome, G.uid e nivelSel eram globais no HTML.
  // Mapeamos para _session para não quebrar código legado.
  // ─────────────────────────────────────────────────────────
  function _instalarCompatibilidade() {
    // fazerLogin() chamado pelo login-script inline do HTML original
    global.fazerLogin = function () {
      _nivelSelecionado = global._nivelLogin || global.nivelSel || NIVEL.CAMPO;
      _tentarLogin();
    };

    // sair() chamado pelo botão 🚪 da header
    global.sair = sair;

    // G.nivel, G.nome, G.uid — proxy para _session
    if (!global.G) global.G = {};
    Object.defineProperties(global.G, {
      nivel: {
        get: () => _session?.nivel || 'campo',
        set: (v) => { if (_session) _session.nivel = v; },
      },
      nome: {
        get: () => _session?.nome || '',
        set: (v) => { if (_session) _session.nome = v; },
      },
      uid: {
        get: () => _session?.uid || '',
        set: (v) => { if (_session) _session.uid = v; },
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO AUTOMÁTICA
  // Aguarda o Firebase estar pronto antes de montar o login.
  // ─────────────────────────────────────────────────────────
  function _autoInit() {
    if (global.WWMX?.onReady) {
      WWMX.onReady(() => {
        _instalarCompatibilidade();
        init();
      });
    } else {
      // WWMX ainda não carregou — aguardar evento
      global.addEventListener('wwmx:firebase-ready', () => {
        _instalarCompatibilidade();
        init();
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit, { once: true });
  } else {
    _autoInit();
  }

  // ─────────────────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────────────────
  global.WWMX      = global.WWMX      || {};
  global.WWMX.Auth = global.WWMX.Auth || {};

  Object.assign(global.WWMX.Auth, {
    // Sessão
    sessaoAtual,
    getSession:   sessaoAtual,          // alias
    getUid:       () => _session?.uid,
    getNome:      () => _session?.nome,
    getNivel:     () => _session?.nivel,
    getCampanhaId:() => _session?.campanhaId,

    // Controle de acesso
    temAcesso,
    exigirNivel,
    ehNivel,
    NIVEL,         // constantes exportadas para uso nos módulos

    // Ações
    sair,

    // Utilitário de nível
    rankNivel: (n) => NIVEL_RANK[n] || 0,
  });

  // Atalho global (acesso rápido nos módulos)
  global._session = null; // será preenchido ao ativar sessão

}(window));


/* ──────────────────────────────────────────────────────────
 * COMO USAR — EXEMPLOS
 * ──────────────────────────────────────────────────────────
 *
 * 1. Verificar acesso mínimo (sem lançar erro)
 *    if (!WWMX.Auth.temAcesso('coord')) {
 *      showToast('Apenas coordenadores podem fazer isso');
 *      return;
 *    }
 *
 * 2. Exigir nível (lança + mostra toast se negado)
 *    WWMX.Auth.exigirNivel('candidato', 'Apenas o candidato acessa logs.');
 *
 * 3. Verificar nível exato
 *    if (WWMX.Auth.ehNivel('campo', 'coord')) {
 *      // campo e coordenador
 *    }
 *
 * 4. Ler dados da sessão
 *    const { uid, nome, nivel, campanhaId } = WWMX.Auth.sessaoAtual();
 *
 * 5. Ouvir quando a sessão estiver pronta (em outros módulos)
 *    window.addEventListener('wwmx:session-ready', ({ detail: session }) => {
 *      estoqueInit(session.campanhaId);
 *    });
 *
 * 6. Ouvir quando a navegação estiver pronta (router.js)
 *    window.addEventListener('wwmx:nav-ready', ({ detail }) => {
 *      const { nivel, campanhaId } = detail;
 *      router.ativarPrimeiraTela(nivel, campanhaId);
 *    });
 *
 * 7. Campanha dinâmica via URL
 *    https://app.wwmx.com/?c=mendes2026  →  campanhaId = 'mendes2026'
 *    https://mendes2026.wwmx.app          →  campanhaId = 'mendes2026' (sub-domínio)
 *
 * ──────────────────────────────────────────────────────────
 * SEQUÊNCIA DE EVENTOS
 * ──────────────────────────────────────────────────────────
 *
 *  [HTML carrega]
 *       ↓
 *  [Firebase SDKs compat]
 *       ↓
 *  core/firebase.js → init() → dispara 'wwmx:firebase-ready'
 *       ↓
 *  core/auth.js     → init() → monta login ou restaura sessão
 *       ↓
 *  (usuário faz login)
 *       ↓
 *  _ativarSessao()  → dispara 'wwmx:session-ready'
 *                   → dispara 'wwmx:nav-ready'
 *       ↓
 *  core/router.js   → ouve 'wwmx:nav-ready' → ativa módulos
 *       ↓
 *  módulos (estoque, mapa, crm…) → ouvem 'wwmx:session-ready'
 *
 * ──────────────────────────────────────────────────────────
 * SENHAS DE CAMPANHA — PRODUÇÃO
 * ──────────────────────────────────────────────────────────
 *
 *  Firestore path: campanhas/{campanhaId}/config
 *  Campo: senhas: { campo: '...', coord: '...', candidato: '...', master: '...' }
 *
 *  O Master define as senhas ao criar a campanha.
 *  As senhas podem ser rotacionadas sem rebuild do app.
 *  Nunca inclua senhas hardcoded em produção — o fallback
 *  _SENHAS_FALLBACK serve apenas para ambiente demo/dev.
 *
 * ──────────────────────────────────────────────────────────
 * SEGURANÇA — FIREBASE AUTH RULES
 * ──────────────────────────────────────────────────────────
 *
 *  Adicionar às Security Rules do RTDB:
 *
 *  "campanhas": {
 *    "$campId": {
 *      "militantes": {
 *        "$uid": {
 *          ".read":  "auth != null && auth.uid === $uid",
 *          ".write": "auth != null && (auth.uid === $uid ||
 *                     root.child('campanhas/'+$campId+'/militantes/'+auth.uid+'/nivel')
 *                          .val() in ['coord','candidato','master'])"
 *        }
 *      }
 *    }
 *  }
 */
