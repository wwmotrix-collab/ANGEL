/**
 * core/firebase.js
 * WWMX Campaign — Camada de acesso ao Firebase
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  DOIS BANCOS, RESPONSABILIDADES SEPARADAS               │
 * │                                                         │
 * │  Firestore (permanente)                                 │
 * │    campanhas/{id}/estoque_central                       │
 * │    campanhas/{id}/modulos                               │
 * │    campanhas/{id}/config                                │
 * │    campanhas/{id}/logs                                  │
 * │    locais_votacao/{municipio}                           │
 * │    master/campanhas                                     │
 * │    master/planos                                        │
 * │                                                         │
 * │  Realtime Database (ao vivo / offline-first)            │
 * │    campanhas/{id}/pins                                  │
 * │    campanhas/{id}/militantes                            │
 * │    campanhas/{id}/inventarios/{uid}                     │
 * │    campanhas/{id}/distribuicoes                         │
 * │    campanhas/{id}/percursos                             │
 * │    campanhas/{id}/rotas                                 │
 * │    campanhas/{id}/crm_liderancas                        │
 * │    campanhas/{id}/denuncias                             │
 * │    campanhas/{id}/presenca/{uid}                        │
 * └─────────────────────────────────────────────────────────┘
 *
 * Uso:
 *   // Realtime Database
 *   import { rtdb }    from 'core/firebase.js'
 *   import { firestore } from 'core/firebase.js'
 *
 *   // Ou via window (sem bundler):
 *   window.WWMX.db        → RTDB wrapper
 *   window.WWMX.fs        → Firestore wrapper
 *   window.WWMX.onStatus  → listener de conexão
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // CONFIGURAÇÃO
  // Produção: mover para variável de ambiente ou Firebase
  // Remote Config. Nunca commitar chaves em repositório público.
  // ─────────────────────────────────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyAnK4l4w24ouHvqKnI7EWZ-nwQPGLrCc7w',
    authDomain:        'angel-edd10.firebaseapp.com',
    databaseURL:       'https://angel-edd10-default-rtdb.firebaseio.com',
    projectId:         'angel-edd10',
    storageBucket:     'angel-edd10.firebasestorage.app',
    messagingSenderId: '468748352830',
    appId:             '1:468748352830:web:75e9dd534710a85401406f',
  };

  // ─────────────────────────────────────────────────────────
  // ESTADO INTERNO
  // ─────────────────────────────────────────────────────────
  let _app       = null;   // FirebaseApp
  let _rtdb      = null;   // Realtime Database instance
  let _fs        = null;   // Firestore instance
  let _auth      = null;   // Auth instance
  let _ready     = false;
  let _status    = 'desconectado'; // 'online' | 'offline' | 'desconectado'

  const _statusCallbacks  = [];   // (status: string) => void
  const _readyCallbacks   = [];   // () => void
  const _pendingOps       = [];   // operações enfileiradas antes do init

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // Chamado uma única vez pelo core/auth.js ou diretamente
  // pelo index.html antes de qualquer outro módulo.
  // ─────────────────────────────────────────────────────────

  /**
   * Inicializa o Firebase. Idempotente — chamadas repetidas são ignoradas.
   * @returns {Promise<void>}
   */
  async function init() {
    if (_ready) return;

    // Evita dupla inicialização em hot-reload
    if (firebase.apps.length) {
      _app = firebase.apps[0];
    } else {
      _app = firebase.initializeApp(FIREBASE_CONFIG);
    }

    _rtdb = firebase.database(_app);
    _fs   = firebase.firestore(_app);
    _auth = firebase.auth(_app);

    // Persistência offline do Firestore (cache local)
    try {
      await _fs.enablePersistence({ synchronizeTabs: true });
    } catch (err) {
      // code 'failed-precondition' → múltiplas abas abertas (ignorar)
      // code 'unimplemented'       → browser não suporta (ignorar)
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('[firebase] Persistência offline não ativada:', err.code);
      }
    }

    // Persistência offline do RTDB
    try {
      _rtdb.goOnline();
      firebase.database.enableLogging(false);
    } catch (_) {}

    _iniciarListenerConexao();
    _ready = true;

    // Processar callbacks pendentes
    _readyCallbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
    _readyCallbacks.length = 0;

    // Processar operações enfileiradas
    _pendingOps.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    _pendingOps.length = 0;

    global.dispatchEvent(new CustomEvent('wwmx:firebase-ready'));
  }

  // ─────────────────────────────────────────────────────────
  // LISTENER DE CONEXÃO
  // Atualiza o indicador visual na header e notifica módulos
  // que dependem de saber se estão online ou offline.
  // ─────────────────────────────────────────────────────────
  function _iniciarListenerConexao() {
    _rtdb.ref('.info/connected').on('value', snap => {
      const online = snap.val() === true;
      _status = online ? 'online' : 'offline';
      _atualizarIndicadorUI(online);
      _statusCallbacks.forEach(cb => { try { cb(_status); } catch (e) {} });
    });
  }

  function _atualizarIndicadorUI(online) {
    const dot = document.getElementById('fbDot');
    const txt = document.getElementById('fbTxt');
    if (dot) dot.style.background = online ? '#22c55e' : '#ef4444';
    if (txt) txt.textContent       = online ? 'online'  : 'offline';
  }

  // ─────────────────────────────────────────────────────────
  // GUARDS DE INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────

  /**
   * Executa cb quando o Firebase estiver pronto.
   * Se já está pronto, executa imediatamente (síncrono-like).
   */
  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }

  /**
   * Registra callback para mudanças de status de conexão.
   * @param {(status: 'online'|'offline') => void} cb
   * @returns {() => void} função para cancelar
   */
  function onStatus(cb) {
    _statusCallbacks.push(cb);
    if (_ready) cb(_status); // dispara imediatamente com o estado atual
    return () => {
      const i = _statusCallbacks.indexOf(cb);
      if (i !== -1) _statusCallbacks.splice(i, 1);
    };
  }

  function _assertReady(op) {
    if (!_ready) throw new Error(`[firebase] ${op} chamado antes de init()`);
  }

  // ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  //  REALTIME DATABASE — wrapper `db`
  //  Substitui o window._fb do monólito original,
  //  adicionando: campanhaId, tipagem, retry, logs de erro.
  // ══════════════════════════════════════════════════════════
  // ─────────────────────────────────────────────────────────

  const db = {

    // ── Referência ──────────────────────────────────────────

    /**
     * Retorna uma DatabaseReference.
     * @param {string} path  Ex: 'campanhas/abc123/pins'
     */
    ref(path) {
      _assertReady('db.ref');
      return _rtdb.ref(path);
    },

    /**
     * Atalho: ref dentro da campanha atual.
     * @param {string} campanhaId
     * @param {string} subpath  Ex: 'pins', 'militantes/uid123'
     */
    campRef(campanhaId, subpath) {
      return this.ref(`campanhas/${campanhaId}/${subpath}`);
    },

    // ── Leitura ─────────────────────────────────────────────

    /**
     * Leitura única (Promise).
     * @param {string|DatabaseReference} pathOrRef
     * @returns {Promise<DataSnapshot>}
     */
    async get(pathOrRef) {
      _assertReady('db.get');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.get();
    },

    /**
     * Leitura única e retorna o valor (.val()) diretamente.
     * @param {string|DatabaseReference} pathOrRef
     * @returns {Promise<any>}
     */
    async val(pathOrRef) {
      const snap = await this.get(pathOrRef);
      return snap.val();
    },

    // ── Escrita ─────────────────────────────────────────────

    /**
     * Sobrescreve o nó inteiro.
     */
    async set(pathOrRef, value) {
      _assertReady('db.set');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.set(value);
    },

    /**
     * Atualização parcial (merge raso — apenas os campos informados).
     */
    async update(pathOrRef, value) {
      _assertReady('db.update');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.update(value);
    },

    /**
     * Adiciona item em lista com chave gerada pelo Firebase (push key).
     * @returns {Promise<DatabaseReference>} ref do novo item
     */
    async push(pathOrRef, value) {
      _assertReady('db.push');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.push(value);
    },

    /**
     * Remove o nó.
     */
    async remove(pathOrRef) {
      _assertReady('db.remove');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.remove();
    },

    /**
     * Transação atômica — lê + modifica + escreve sem conflito.
     * Ideal para incrementar contadores (XP, estoque).
     * @param {string|DatabaseReference} pathOrRef
     * @param {(currentValue: any) => any} updateFn
     */
    async transaction(pathOrRef, updateFn) {
      _assertReady('db.transaction');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      return r.transaction(updateFn);
    },

    // ── Listeners em tempo real ──────────────────────────────

    /**
     * Assina mudanças em tempo real em `pathOrRef`.
     * @param {string|DatabaseReference} pathOrRef
     * @param {(snap: DataSnapshot) => void} cb
     * @returns {() => void} função de cancelamento (unsubscribe)
     */
    on(pathOrRef, cb) {
      _assertReady('db.on');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      r.on('value', snap => { try { cb(snap); } catch (e) { console.error('[db.on cb]', e); } });
      return () => r.off('value');
    },

    /**
     * Assina apenas a primeira mudança (equivale a get + listener).
     * Cancela automaticamente após o primeiro disparo.
     */
    once(pathOrRef, cb) {
      _assertReady('db.once');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      r.once('value', snap => { try { cb(snap); } catch (e) { console.error('[db.once cb]', e); } });
    },

    /**
     * Assina adições de filhos (ideal para listas como pins, chat).
     * @returns {() => void} unsubscribe
     */
    onChildAdded(pathOrRef, cb) {
      _assertReady('db.onChildAdded');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      r.on('child_added', snap => { try { cb(snap); } catch (e) { console.error(e); } });
      return () => r.off('child_added');
    },

    /**
     * Assina remoções de filhos.
     * @returns {() => void} unsubscribe
     */
    onChildRemoved(pathOrRef, cb) {
      _assertReady('db.onChildRemoved');
      const r = typeof pathOrRef === 'string' ? this.ref(pathOrRef) : pathOrRef;
      r.on('child_removed', snap => { try { cb(snap); } catch (e) { console.error(e); } });
      return () => r.off('child_removed');
    },

    // ── Presença online ──────────────────────────────────────

    /**
     * Registra presença do militante e remove ao desconectar.
     * @param {string} campanhaId
     * @param {string} uid
     * @param {object} dados  Ex: { nome, nivel, lat, lng }
     */
    registrarPresenca(campanhaId, uid, dados) {
      _assertReady('db.registrarPresenca');
      const r = this.ref(`campanhas/${campanhaId}/presenca/${uid}`);
      r.onDisconnect().remove();
      r.set({ ...dados, online: true, ts: Date.now() });
    },

    /**
     * Remove presença manualmente (logout explícito).
     */
    async removerPresenca(campanhaId, uid) {
      return this.remove(`campanhas/${campanhaId}/presenca/${uid}`);
    },

    // ── Helpers de conversão ─────────────────────────────────

    /**
     * Converte snap.val() de objeto Firebase em array,
     * preservando a chave push como campo `_key`.
     * @param {DataSnapshot} snap
     * @returns {Array}
     */
    snapToArray(snap) {
      const val = snap.val();
      if (!val) return [];
      return Object.entries(val).map(([k, v]) =>
        typeof v === 'object' ? { _key: k, ...v } : { _key: k, value: v }
      );
    },

    /**
     * Converte snap.val() em array simples (sem _key).
     */
    snapToValues(snap) {
      const val = snap.val();
      if (!val) return [];
      return Object.values(val);
    },

    // ── Gerador de ID compatível com push key ────────────────

    /**
     * Gera uma push key sem gravar no banco.
     * Útil para criar IDs locais antes de salvar.
     */
    newKey(path = 'tmp') {
      _assertReady('db.newKey');
      return _rtdb.ref(path).push().key;
    },
  };

  // ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  //  FIRESTORE — wrapper `fs`
  //  Para dados permanentes: configuração de campanha,
  //  locais de votação, histórico eleitoral, planos, logs.
  // ══════════════════════════════════════════════════════════
  // ─────────────────────────────────────────────────────────

  const fs = {

    // ── Referências ──────────────────────────────────────────

    /**
     * Retorna CollectionReference.
     * @param {...string} segments  Ex: 'campanhas', campanhaId, 'estoque_central'
     */
    col(...segments) {
      _assertReady('fs.col');
      return _fs.collection(segments.join('/'));
    },

    /**
     * Retorna DocumentReference.
     */
    doc(...segments) {
      _assertReady('fs.doc');
      return _fs.doc(segments.join('/'));
    },

    // ── Leitura ─────────────────────────────────────────────

    /**
     * Lê um documento.
     * @returns {Promise<{ id, ...data } | null>}
     */
    async getDoc(...segments) {
      _assertReady('fs.getDoc');
      const ref  = this.doc(...segments);
      const snap = await ref.get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    },

    /**
     * Lê toda uma coleção como array.
     * @returns {Promise<Array<{ id, ...data }>>}
     */
    async getCol(...segments) {
      _assertReady('fs.getCol');
      const snap = await this.col(...segments).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /**
     * Query com filtros encadeados.
     * @param {string} colPath
     * @param {Array<[field, op, value]>} where  Ex: [['nivel', '==', 'campo']]
     * @param {{ orderBy?: string, limit?: number }} opts
     * @returns {Promise<Array>}
     */
    async query(colPath, where = [], opts = {}) {
      _assertReady('fs.query');
      let q = _fs.collection(colPath);
      where.forEach(([f, op, v]) => { q = q.where(f, op, v); });
      if (opts.orderBy) q = q.orderBy(opts.orderBy, opts.dir || 'asc');
      if (opts.limit)   q = q.limit(opts.limit);
      const snap = await q.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // ── Escrita ─────────────────────────────────────────────

    /**
     * Cria ou sobrescreve documento.
     */
    async setDoc(data, ...segments) {
      _assertReady('fs.setDoc');
      return this.doc(...segments).set(data);
    },

    /**
     * Atualização parcial (merge).
     */
    async updateDoc(data, ...segments) {
      _assertReady('fs.updateDoc');
      return this.doc(...segments).update(data);
    },

    /**
     * Cria documento com ID gerado automaticamente.
     * @returns {Promise<DocumentReference>}
     */
    async addDoc(colPath, data) {
      _assertReady('fs.addDoc');
      return _fs.collection(colPath).add(data);
    },

    /**
     * Remove documento.
     */
    async deleteDoc(...segments) {
      _assertReady('fs.deleteDoc');
      return this.doc(...segments).delete();
    },

    /**
     * Batch: executa múltiplas escritas de forma atômica.
     * @param {(batch: WriteBatch) => void} builderFn
     * @example
     *   await fs.batch(b => {
     *     b.set(fs.doc('campanhas', id, 'config'), config);
     *     b.update(fs.doc('master', 'campanhas', id), { status: 'ativo' });
     *   });
     */
    async batch(builderFn) {
      _assertReady('fs.batch');
      const batch = _fs.batch();
      builderFn(batch);
      return batch.commit();
    },

    // ── Listeners em tempo real ──────────────────────────────

    /**
     * Assina mudanças em um documento Firestore.
     * @returns {() => void} unsubscribe
     */
    onDoc(cb, ...segments) {
      _assertReady('fs.onDoc');
      return this.doc(...segments).onSnapshot(
        snap => { try { cb(snap.exists ? { id: snap.id, ...snap.data() } : null); } catch (e) { console.error(e); } },
        err  => console.error('[fs.onDoc]', err)
      );
    },

    /**
     * Assina mudanças em uma coleção Firestore.
     * @returns {() => void} unsubscribe
     */
    onCol(colPath, cb) {
      _assertReady('fs.onCol');
      return _fs.collection(colPath).onSnapshot(
        snap => {
          try {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            cb(items, snap);
          } catch (e) { console.error(e); }
        },
        err => console.error('[fs.onCol]', err)
      );
    },

    // ── Timestamp ────────────────────────────────────────────

    /** Retorna um Firestore server timestamp (não usa clock local). */
    serverTimestamp() {
      return firebase.firestore.FieldValue.serverTimestamp();
    },

    /** Incremento atômico de campo numérico. */
    increment(n = 1) {
      return firebase.firestore.FieldValue.increment(n);
    },

    /** Remove campo de documento. */
    deleteField() {
      return firebase.firestore.FieldValue.delete();
    },
  };

  // ─────────────────────────────────────────────────────────
  // HELPERS DE ALTO NÍVEL
  // Operações compostas que combinam RTDB + Firestore
  // ─────────────────────────────────────────────────────────

  /**
   * Registra log de auditoria no Firestore.
   * Usado por todos os módulos — não bloqueia em caso de falha.
   *
   * @param {string} campanhaId
   * @param {string} acao        Ex: 'repasse_material', 'login', 'entrada_material'
   * @param {object} dados       Dados livres para o log
   * @param {object} session     { uid, nome, nivel }
   */
  async function log(campanhaId, acao, dados = {}, session = {}) {
    try {
      await fs.addDoc(`campanhas/${campanhaId}/logs`, {
        acao,
        autor:     session.uid   || null,
        autorNome: session.nome  || null,
        nivel:     session.nivel || null,
        ts:        fs.serverTimestamp(),
        tsLocal:   Date.now(),
        ...dados,
      });
    } catch (err) {
      // Log não deve interromper o fluxo principal
      console.warn('[firebase.log] falhou silenciosamente:', err.message);
    }
  }

  /**
   * Carrega configuração da campanha do Firestore e
   * retorna objeto com módulos ativos, identidade visual etc.
   *
   * @param {string} campanhaId
   * @returns {Promise<object|null>}
   */
  async function carregarConfigCampanha(campanhaId) {
    // Tenta subcoleção config/main (padrão do seed e master/campanhas.js)
    try {
      const doc = await fs.getDoc('campanhas', campanhaId, 'config', 'main');
      if (doc) return doc;
    } catch (_) {}
    // Fallback: documento direto campanhas/{id}/config (estrutura legada)
    try {
      return await fs.getDoc('campanhas', campanhaId, 'config');
    } catch (_) {}
    return null;
  }

  /**
   * Registra presença do militante no RTDB e
   * atualiza último acesso no Firestore de forma assíncrona.
   *
   * @param {string} campanhaId
   * @param {object} session  { uid, nome, nivel }
   */
  function registrarAcesso(campanhaId, session) {
    // RTDB: presença em tempo real
    db.registrarPresenca(campanhaId, session.uid, {
      nome:  session.nome,
      nivel: session.nivel,
    });
    // Firestore: último acesso (não crítico)
    fs.updateDoc(
      { ultimoAcesso: fs.serverTimestamp() },
      'campanhas', campanhaId, 'militantes', session.uid
    ).catch(() => {}); // ignora se ainda não existe
  }

  // ─────────────────────────────────────────────────────────
  // COMPATIBILIDADE COM MONÓLITO (window._fb)
  // Mantém o contrato do HTML original para não quebrar
  // código legado durante a migração gradual.
  // ─────────────────────────────────────────────────────────
  function _instalarCompatibilidade() {
    global._fb = {
      db:       _rtdb,
      ref:      (_, path) => _rtdb.ref(path),
      set:      (r, v)    => r.set(v),
      get:      (r)       => r.get(),
      onValue:  (r, cb)   => r.on('value', snap => cb(snap)),
      push:     (r, v)    => r.push(v),
      remove:   (r)       => r.remove(),
      update:   (r, v)    => r.update(v),
    };

    // fbReady() — padrão do monólito
    global.fbReady = function (cb) {
      if (global._fb) cb(global._fb);
      else global.addEventListener('wwmx:firebase-ready', () => cb(global._fb), { once: true });
    };
  }

  // ─────────────────────────────────────────────────────────
  // NAMESPACE PÚBLICO
  // ─────────────────────────────────────────────────────────
  global.WWMX = global.WWMX || {};

  Object.assign(global.WWMX, {
    // Inicialização
    firebaseInit: init,

    // Wrappers de banco
    db,
    fs,

    // Status de conexão
    onStatus,
    getStatus: () => _status,
    isOnline:  () => _status === 'online',

    // Ciclo de vida
    onReady,

    // Helpers compostos
    log,
    carregarConfigCampanha,
    registrarAcesso,
  });

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO AUTOMÁTICA
  // Dispara quando os SDKs do Firebase já estão carregados.
  // ─────────────────────────────────────────────────────────
  function _autoInit() {
    init()
      .then(_instalarCompatibilidade)
      .catch(err => {
        console.error('[firebase] Falha na inicialização:', err);
        // Mostra estado de erro no indicador visual
        const dot = document.getElementById('fbDot');
        const txt = document.getElementById('fbTxt');
        if (dot) dot.style.background = '#ef4444';
        if (txt) txt.textContent = 'erro';
      });
  }

  // SDKs do Firebase carregam de forma síncrona via <script> compat.
  // Se o documento já está pronto, inicia imediatamente.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit, { once: true });
  } else {
    _autoInit();
  }

}(window));


/* ──────────────────────────────────────────────────────────
 * COMO USAR — EXEMPLOS
 * ──────────────────────────────────────────────────────────
 *
 * 1. RTDB — escrita única
 *    await WWMX.db.set(`campanhas/${id}/pins/${pinId}`, pinData);
 *
 * 2. RTDB — leitura única com conversão
 *    const snap = await WWMX.db.get(`campanhas/${id}/militantes`);
 *    const lista = WWMX.db.snapToValues(snap);
 *
 * 3. RTDB — listener em tempo real
 *    const off = WWMX.db.on(`campanhas/${id}/pins`, snap => {
 *      const pins = WWMX.db.snapToValues(snap);
 *      renderPins(pins);
 *    });
 *    // Para cancelar: off();
 *
 * 4. RTDB — transação atômica (XP, estoque)
 *    await WWMX.db.transaction(
 *      `campanhas/${id}/estoque_central/${itemId}/qtdDisp`,
 *      atual => (atual || 0) - qtdRepasse
 *    );
 *
 * 5. RTDB — presença online
 *    WWMX.db.registrarPresenca(campanhaId, uid, { nome, nivel });
 *
 * 6. Firestore — ler documento
 *    const config = await WWMX.fs.getDoc('campanhas', id, 'config');
 *
 * 7. Firestore — query filtrada
 *    const locais = await WWMX.fs.query(
 *      `locais_votacao/${municipio}/locais`,
 *      [['zona', '==', 59]],
 *      { orderBy: 'el', dir: 'desc', limit: 20 }
 *    );
 *
 * 8. Firestore — batch atômico
 *    await WWMX.fs.batch(b => {
 *      b.set(WWMX.fs.doc('campanhas', id, 'config'), configData);
 *      b.update(WWMX.fs.doc('master', 'campanhas', id), { status: 'ativo' });
 *    });
 *
 * 9. Log de auditoria
 *    await WWMX.log(campanhaId, 'repasse_material',
 *      { itemId, qtd, para: militanteUid },
 *      window._session
 *    );
 *
 * 10. Status de conexão
 *    const off = WWMX.onStatus(status => {
 *      console.log('Firebase:', status); // 'online' | 'offline'
 *    });
 *
 * ──────────────────────────────────────────────────────────
 * ORDEM DOS <script> NO HTML
 * ──────────────────────────────────────────────────────────
 *
 *   <!-- Firebase SDKs (compat v9) -->
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
 *
 *   <!-- WWMX core -->
 *   <script src="core/firebase.js"></script>    ← este arquivo
 *   <script src="core/auth.js"></script>
 *   <script src="core/router.js"></script>
 *
 *   <!-- Módulos de perfil -->
 *   <script src="coordenador/estoque.js"></script>
 *   ...
 *
 * ──────────────────────────────────────────────────────────
 * SEGURANÇA — PRÓXIMOS PASSOS
 * ──────────────────────────────────────────────────────────
 *
 *  1. Mover a config do Firebase para variável de ambiente
 *     (processo de build) — nunca commitar em repo público.
 *
 *  2. Configurar Firebase Security Rules no console:
 *
 *     RTDB:
 *       "campanhas": {
 *         "$campId": {
 *           ".read":  "auth != null && root.child('campanhas/'+$campId+'/militantes/'+auth.uid).exists()",
 *           ".write": "auth != null && root.child('campanhas/'+$campId+'/militantes/'+auth.uid+'/nivel').val() !== 'campo'"
 *         }
 *       }
 *
 *     Firestore:
 *       match /campanhas/{campId}/{document=**} {
 *         allow read:  if request.auth != null && exists(/campanhas/$(campId)/militantes/$(request.auth.uid));
 *         allow write: if request.auth != null
 *                      && get(/campanhas/$(campId)/militantes/$(request.auth.uid)).data.nivel in ['coord','candidato','master'];
 *       }
 *
 *  3. Separar o projectId de staging vs produção usando
 *     FIREBASE_CONFIG diferente por ambiente.
 */
