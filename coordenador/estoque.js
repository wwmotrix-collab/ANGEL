/**
 * coordenador/estoque.js
 * WWMX Campaign — Módulo de Estoque Central
 *
 * Responsabilidades:
 *  - Renderizar resumo e lista de materiais do estoque central
 *  - Adicionar entradas de material (modal + seleção de tipo)
 *  - Repassar materiais para militantes de campo
 *  - Monitorar alertas de estoque zero em tempo real
 *  - Exibir inventários individuais dos militantes
 *
 * Dependências externas:
 *  - window._fb       → wrapper Firebase (core/firebase.js)
 *  - window._session  → { uid, nome, nivel, campanhaId } (core/auth.js)
 *  - window.showToast → feedback visual (core/ui.js)
 *  - TIPO_MATERIAL    → catálogo de tipos de material (core/config.js)
 *
 * Firebase paths utilizados:
 *  Firestore  : campanhas/{campanhaId}/estoque_central/{itemId}
 *  RTDB live  : campanhas/{campanhaId}/inventarios/{militanteUid}/{itemId}
 *  RTDB live  : campanhas/{campanhaId}/distribuicoes/{pushId}
 *  RTDB live  : campanhas/{campanhaId}/militantes/{uid}
 */

// ─────────────────────────────────────────────
// CATÁLOGO DE TIPOS DE MATERIAL
// (em produção, importar de core/config.js)
// ─────────────────────────────────────────────
const TIPO_MATERIAL = {
  colinha:      { icon: '📋', label: 'Colinha',             cor: '#3b82f6', campos: ['tamanho'] },
  panfleto:     { icon: '📄', label: 'Panfleto',            cor: '#0ea5e9', campos: ['tamanho'] },
  windbanner:   { icon: '🪧', label: 'Windbanner/Banner',   cor: '#6366f1', campos: ['tamanho'] },
  adesivo_car:  { icon: '🚗', label: 'Adesivo de Carro',    cor: '#f59e0b', campos: ['tamanho'] },
  adesivo_res:  { icon: '🏠', label: 'Adesivo Residencial', cor: '#ec4899', campos: ['tamanho'] },
  camiseta:     { icon: '👕', label: 'Camiseta',            cor: '#22c55e', campos: ['tamanho'] },
  bone:         { icon: '🧢', label: 'Boné',                cor: '#8b5cf6', campos: []          },
  bandeira_mao: { icon: '🏳️', label: 'Bandeira de Mão',     cor: '#f97316', campos: []          },
  kit_completo: { icon: '📦', label: 'Kit Completo',        cor: '#0891b2', campos: [], vinculaLider: true },
};

// ─────────────────────────────────────────────
// ESTADO LOCAL DO MÓDULO
// ─────────────────────────────────────────────
const _est = {
  campanhaId:    null,
  estoqueCentral: {},   // { [itemId]: { tipo, label, tamanho, qtdTotal, qtdDist, qtdDisp } }
  militantes:    [],    // [{ uid, nome }]
  inventarios:   {},    // { [militanteUid]: { [itemId]: qtd } }
  alertasZero:   new Set(),

  // modal novo material
  novoMatTipoSel: null,
  novoMatEditId:  null,

  // modal repasse
  repasseUid:  null,
  repasseNome: null,

  // listeners RTDB ativos (para cleanup)
  _unsubEstoque:    null,
  _unsubInventarios: null,
  _unsubMilitantes:  null,
};

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────

/**
 * Ponto de entrada — chame ao montar a view de estoque.
 * @param {string} campanhaId
 */
function estoqueInit(campanhaId) {
  _est.campanhaId = campanhaId;
  _renderEsqueleto();
  _assinarEstoqueCentral();
  _assinarMilitantes();
}

/**
 * Destrói listeners quando a view é desmontada.
 */
function estoqueDestroy() {
  if (_est._unsubEstoque)     _est._unsubEstoque();
  if (_est._unsubInventarios) _est._unsubInventarios();
  if (_est._unsubMilitantes)  _est._unsubMilitantes();
}

// ─────────────────────────────────────────────
// ESTRUTURA HTML DA VIEW
// ─────────────────────────────────────────────
function _renderEsqueleto() {
  const app = document.getElementById('estoqueView');
  if (!app) return;
  app.innerHTML = `
    <div class="dash-view">

      <!-- Resumo geral -->
      <div id="estoqueResumo" style="margin-bottom:16px;"></div>

      <!-- Alertas de estoque zero -->
      <div id="estoqueAlertas" style="margin-bottom:12px;"></div>

      <!-- Ação: novo material -->
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button onclick="abrirModalNovoMaterial()"
          style="flex:1;padding:11px;background:var(--accent);border:none;border-radius:8px;
                 color:#fff;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;font-size:13px;">
          + Novo Material
        </button>
        <button onclick="exportarEstoqueCSV()"
          style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);
                 border-radius:8px;color:var(--text);cursor:pointer;font-size:13px;">
          📥 CSV
        </button>
      </div>

      <!-- Lista de materiais -->
      <div class="section-title">Materiais em Estoque</div>
      <div id="estoqueMaterialList"></div>

      <!-- Inventários por militante -->
      <div class="section-title" style="margin-top:20px;">Militantes · Inventário e Repasse</div>
      <div id="estoqueMilitantesList"></div>

      <div style="height:90px;"></div>
    </div>

    <!-- MODAL: Novo / Editar Material -->
    <div class="modal-overlay" id="modalNovoMaterial" onclick="fecharModalNovoMaterial(event)">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="novoMaterialTitle">📦 Novo Material</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;" id="novoMatGrid"></div>
        <div class="field" id="novoMatTamanhoField" style="display:none;">
          <label>Tamanho / Versão <span style="font-size:10px;color:var(--muted);">(opcional)</span></label>
          <input type="text" id="novoMatTamanho" placeholder="Ex: A5, P/M/G, 100×70cm…">
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">Deixe vazio se não houver variação</div>
        </div>
        <div class="field">
          <label>Quantidade a adicionar</label>
          <input type="number" id="novoMatQtd" placeholder="0" min="1" inputmode="numeric">
        </div>
        <div style="display:flex;gap:10px;margin-top:4px;">
          <button class="btn btn-ghost" onclick="fecharModalNovoMaterial()"
            style="flex:0 0 auto;width:auto;padding:14px 20px;">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarNovoMaterial()" style="flex:1;">Salvar</button>
        </div>
      </div>
    </div>

    <!-- MODAL: Repasse para militante -->
    <div class="modal-overlay" id="modalRepasse" onclick="fecharModalRepasse(event)">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">📦 Repassar Material</div>
        <div id="repaseMilitanteInfo"
          style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:14px;"></div>
        <div id="repasseListaMateriais"></div>
        <div id="repasseErro" style="display:none;color:var(--red);font-size:12px;margin-top:8px;"></div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-ghost" onclick="fecharModalRepasse()"
            style="flex:0 0 auto;width:auto;padding:14px 20px;">Cancelar</button>
          <button class="btn btn-primary" onclick="confirmarRepasse()" style="flex:1;">Confirmar Repasse</button>
        </div>
      </div>
    </div>

    <!-- MODAL: Inventário detalhado do militante -->
    <div class="modal-overlay" id="modalInventario" onclick="fecharModalInventario(event)">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="inventarioMilitanteNome">Inventário</div>
        <div id="inventarioMilitanteCorpo"></div>
        <button class="btn btn-ghost" onclick="fecharModalInventario()"
          style="margin-top:14px;">Fechar</button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// LISTENERS FIREBASE (tempo real)
// ─────────────────────────────────────────────
function _assinarEstoqueCentral() {
  const { db, ref, onValue } = window._fb;
  const path = `campanhas/${_est.campanhaId}/estoque_central`;
  const r = ref(db, path);
  _est._unsubEstoque = () => r.off('value');
  r.on('value', snap => {
    _est.estoqueCentral = snap.val() || {};
    _renderResumo();
    _renderMateriais();
    _checarAlertasZero();
  });
}

function _assinarMilitantes() {
  const { db, ref, onValue } = window._fb;
  const pathMil = `campanhas/${_est.campanhaId}/militantes`;
  const rMil = ref(db, pathMil);
  _est._unsubMilitantes = () => rMil.off('value');
  rMil.on('value', snap => {
    const todos = snap.val() ? Object.values(snap.val()) : [];
    _est.militantes = todos.filter(m => m.nivel === 'campo');
    _renderMilitantes();
  });

  const pathInv = `campanhas/${_est.campanhaId}/inventarios`;
  const rInv = ref(db, pathInv);
  _est._unsubInventarios = () => rInv.off('value');
  rInv.on('value', snap => {
    _est.inventarios = snap.val() || {};
    _renderMilitantes();
  });
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO — RESUMO
// ─────────────────────────────────────────────
function _renderResumo() {
  const el = document.getElementById('estoqueResumo');
  if (!el) return;
  const itens = Object.values(_est.estoqueCentral);
  const totalGeral = itens.reduce((a, i) => a + (i.qtdTotal || 0), 0);
  const distGeral  = itens.reduce((a, i) => a + (i.qtdDist  || 0), 0);
  const dispGeral  = totalGeral - distGeral;
  const pctDist    = totalGeral > 0 ? Math.round(distGeral / totalGeral * 100) : 0;

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">
        Estoque Geral · ${itens.length} tipo${itens.length !== 1 ? 's' : ''}
      </div>
      <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:var(--accent);line-height:1;">
        ${totalGeral.toLocaleString('pt-BR')}
      </div>
      <div style="font-size:12px;color:var(--muted);margin:4px 0 12px;">unidades cadastradas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--green);">
            ${dispGeral.toLocaleString('pt-BR')}
          </div>
          <div style="font-size:10px;color:var(--muted);">Disponíveis</div>
        </div>
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--yellow);">
            ${distGeral.toLocaleString('pt-BR')}
          </div>
          <div style="font-size:10px;color:var(--muted);">Distribuídos (${pctDist}%)</div>
        </div>
      </div>
      <div style="margin-top:10px;background:var(--border);border-radius:4px;height:4px;overflow:hidden;">
        <div style="width:${pctDist}%;height:4px;background:var(--yellow);border-radius:4px;transition:width .5s;"></div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO — LISTA DE MATERIAIS
// ─────────────────────────────────────────────
function _renderMateriais() {
  const el = document.getElementById('estoqueMaterialList');
  if (!el) return;
  const itens = Object.entries(_est.estoqueCentral);

  if (!itens.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📦</div>Nenhum material cadastrado.<br>Clique em "+ Novo Material" para começar.</div>`;
    return;
  }

  // Ordenar: alertas (zero) primeiro, depois por label
  itens.sort(([, a], [, b]) => {
    const aZero = (a.qtdDisp || 0) === 0 ? 0 : 1;
    const bZero = (b.qtdDisp || 0) === 0 ? 0 : 1;
    if (aZero !== bZero) return aZero - bZero;
    return (a.label || '').localeCompare(b.label || '');
  });

  el.innerHTML = itens.map(([id, item]) => {
    const cfg  = TIPO_MATERIAL[item.tipo] || { icon: '📦', label: item.label || item.tipo };
    const pct  = item.qtdTotal > 0 ? Math.round((item.qtdDist || 0) / item.qtdTotal * 100) : 0;
    const disp = item.qtdDisp || 0;
    const zero = disp === 0;
    const corDisp = zero ? 'var(--red)' : disp < 10 ? 'var(--yellow)' : 'var(--green)';
    const alertaZero = zero
      ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;
                     background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);
                     font-size:11px;font-weight:700;color:var(--red);margin-top:6px;">
           ⚠️ ESTOQUE ZERO
         </div>` : '';

    return `
      <div style="background:var(--surface);border:1px solid ${zero ? 'rgba(239,68,68,0.4)' : 'var(--border)'};
                  border-radius:var(--radius);padding:14px;margin-bottom:8px;transition:border-color .2s;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:26px;">${cfg.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${item.label || cfg.label}</div>
            ${item.tamanho ? `<div style="font-size:11px;color:var(--muted);">Tamanho: ${item.tamanho}</div>` : ''}
            ${alertaZero}
          </div>
          <button onclick="abrirModalNovoMaterialEdit('${id}')"
            style="padding:6px 12px;background:var(--surface2);border:1px solid var(--border);
                   border-radius:8px;color:var(--text);cursor:pointer;font-size:12px;white-space:nowrap;">
            + Entrada
          </button>
        </div>

        <!-- Números -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
          <div style="background:var(--surface2);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--accent);">
              ${(item.qtdTotal || 0).toLocaleString('pt-BR')}
            </div>
            <div style="font-size:10px;color:var(--muted);">Total</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${corDisp};">
              ${disp.toLocaleString('pt-BR')}
            </div>
            <div style="font-size:10px;color:var(--muted);">Disponível</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px;">
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--yellow);">
              ${(item.qtdDist || 0).toLocaleString('pt-BR')}
            </div>
            <div style="font-size:10px;color:var(--muted);">Distribuído</div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div style="margin-top:8px;background:var(--border);border-radius:4px;height:4px;overflow:hidden;">
          <div style="width:${pct}%;height:4px;background:${pct > 80 ? 'var(--red)' : 'var(--yellow)'};
                       border-radius:4px;transition:width .5s;"></div>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px;text-align:right;">${pct}% distribuído</div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// ALERTAS DE ESTOQUE ZERO
// ─────────────────────────────────────────────
function _checarAlertasZero() {
  const el = document.getElementById('estoqueAlertas');
  if (!el) return;
  const zeros = Object.values(_est.estoqueCentral).filter(i => (i.qtdDisp || 0) === 0);
  if (!zeros.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);
                border-radius:10px;padding:12px 14px;">
      <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px;">
        ⚠️ ${zeros.length} material${zeros.length > 1 ? 'is' : ''} com estoque zero
      </div>
      ${zeros.map(i => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);
                    padding:5px 0;border-bottom:1px solid rgba(239,68,68,0.1);">
          <span>${TIPO_MATERIAL[i.tipo]?.icon || '📦'}</span>
          <span style="flex:1;">${i.label}</span>
          <button onclick="abrirModalNovoMaterial()"
            style="padding:3px 10px;background:var(--red);border:none;border-radius:6px;
                   color:#fff;cursor:pointer;font-size:11px;font-weight:700;">
            Repor
          </button>
        </div>`).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO — MILITANTES + INVENTÁRIOS
// ─────────────────────────────────────────────
function _renderMilitantes() {
  const el = document.getElementById('estoqueMilitantesList');
  if (!el) return;
  if (!_est.militantes.length) {
    el.innerHTML = `<div class="empty">Nenhum militante de campo cadastrado</div>`;
    return;
  }

  el.innerHTML = _est.militantes.map(m => {
    const inv    = _est.inventarios[m.uid] || {};
    const total  = Object.values(inv).reduce((a, v) => a + (v || 0), 0);
    const itens  = Object.entries(inv).filter(([, q]) => q > 0).length;
    const cor    = _corAvatar(m.nome);
    const ini    = _iniciais(m.nome);

    return `
      <div class="banner-item" style="cursor:pointer;margin-bottom:8px;"
           onclick="abrirModalRepasse('${m.uid}','${m.nome}')">
        <div class="lider-avatar"
          style="width:42px;height:42px;border-radius:50%;background:${cor};color:#fff;
                 display:flex;align-items:center;justify-content:center;font-size:15px;
                 font-weight:800;font-family:'Syne',sans-serif;flex-shrink:0;">
          ${ini}
        </div>
        <div class="banner-info">
          <div class="banner-name">${m.nome}</div>
          <div class="banner-meta">${total} itens em inventário · ${itens} tipo${itens !== 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
          <button onclick="event.stopPropagation();verInventarioMilitante('${m.uid}','${m.nome}')"
            style="padding:4px 10px;background:var(--surface2);border:1px solid var(--border);
                   border-radius:6px;color:var(--accent);cursor:pointer;font-size:11px;white-space:nowrap;">
            Ver inventário
          </button>
          <span style="font-size:10px;color:var(--muted);">Toque para repassar →</span>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// MODAL: NOVO / EDITAR MATERIAL
// ─────────────────────────────────────────────
function abrirModalNovoMaterial() {
  _abrirModalMaterial(null);
}

function abrirModalNovoMaterialEdit(itemId) {
  _abrirModalMaterial(itemId);
}

function _abrirModalMaterial(editId) {
  _est.novoMatTipoSel = null;
  _est.novoMatEditId  = editId || null;

  document.getElementById('novoMaterialTitle').textContent =
    editId ? '📦 Adicionar Entrada' : '📦 Novo Material';
  document.getElementById('novoMatQtd').value     = '';
  document.getElementById('novoMatTamanho').value = '';
  document.getElementById('novoMatTamanhoField').style.display = 'none';

  const grid = document.getElementById('novoMatGrid');
  grid.innerHTML = Object.entries(TIPO_MATERIAL).map(([k, v]) => `
    <div onclick="_selNovoMatTipo('${k}', this)" data-tipo="${k}"
      style="padding:12px 6px;border:2px solid var(--border);border-radius:10px;text-align:center;
             cursor:pointer;transition:all .15s;">
      <div style="font-size:26px;margin-bottom:4px;">${v.icon}</div>
      <div style="font-size:11px;font-weight:600;">${v.label}</div>
    </div>`).join('');

  // Se edição, pré-selecionar tipo
  if (editId && _est.estoqueCentral[editId]) {
    const item = _est.estoqueCentral[editId];
    _est.novoMatTipoSel = item.tipo;
    const el = grid.querySelector(`[data-tipo="${item.tipo}"]`);
    if (el) { el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-glow)'; }
    if (item.tamanho) {
      document.getElementById('novoMatTamanho').value = item.tamanho;
      document.getElementById('novoMatTamanhoField').style.display = 'block';
    }
  }

  document.getElementById('modalNovoMaterial').classList.add('show');
}

function _selNovoMatTipo(tipo, el) {
  _est.novoMatTipoSel = tipo;
  document.querySelectorAll('#novoMatGrid > div').forEach(d => {
    d.style.borderColor = d.dataset.tipo === tipo ? 'var(--accent)' : 'var(--border)';
    d.style.background  = d.dataset.tipo === tipo ? 'var(--accent-glow)' : '';
  });
  const campos = TIPO_MATERIAL[tipo]?.campos || [];
  document.getElementById('novoMatTamanhoField').style.display =
    campos.includes('tamanho') ? 'block' : 'none';
}

function fecharModalNovoMaterial(e) {
  if (e && e.target !== document.getElementById('modalNovoMaterial')) return;
  document.getElementById('modalNovoMaterial').classList.remove('show');
}

async function salvarNovoMaterial() {
  if (!_est.novoMatTipoSel) { showToast('Selecione o tipo de material'); return; }
  const qtd = parseInt(document.getElementById('novoMatQtd').value) || 0;
  if (qtd <= 0) { showToast('Informe uma quantidade maior que zero'); return; }

  const tamanho = document.getElementById('novoMatTamanho').value.trim();
  const cfg     = TIPO_MATERIAL[_est.novoMatTipoSel];
  const label   = cfg.label + (tamanho ? ` (${tamanho})` : '');
  const id      = _est.novoMatEditId ||
    (_est.novoMatTipoSel + (tamanho ? '_' + tamanho.toLowerCase().replace(/\s+/g, '') : ''));

  const { db, ref, get, set } = window._fb;
  const path = `campanhas/${_est.campanhaId}/estoque_central/${id}`;

  try {
    const snap   = await get(ref(db, path));
    const atual  = snap.val() || { tipo: _est.novoMatTipoSel, label, tamanho, qtdTotal: 0, qtdDist: 0 };
    atual.qtdTotal = (atual.qtdTotal || 0) + qtd;
    atual.qtdDisp  = atual.qtdTotal - (atual.qtdDist || 0);
    await set(ref(db, path), atual);

    showToast(`✅ ${label}: +${qtd} unidades adicionadas`);
    fecharModalNovoMaterial();
    _registrarLog('entrada_material', { itemId: id, label, qtd });
  } catch (err) {
    console.error('[estoque] salvarNovoMaterial:', err);
    showToast('❌ Erro ao salvar material');
  }
}

// ─────────────────────────────────────────────
// MODAL: REPASSE PARA MILITANTE
// ─────────────────────────────────────────────
function abrirModalRepasse(uid, nome) {
  _est.repasseUid  = uid;
  _est.repasseNome = nome;

  document.getElementById('repaseMilitanteInfo').innerHTML =
    `👤 <strong>${nome}</strong>`;
  document.getElementById('repasseErro').style.display = 'none';

  const itens = Object.entries(_est.estoqueCentral);
  document.getElementById('repasseListaMateriais').innerHTML = itens.length
    ? itens.map(([id, item]) => {
        const disp = item.qtdDisp || 0;
        const cfg  = TIPO_MATERIAL[item.tipo] || { icon: '📦' };
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                      padding:8px;background:var(--surface2);border-radius:8px;">
            <span style="font-size:20px;">${cfg.icon}</span>
            <div style="flex:1;font-size:13px;">
              ${item.label}
              <span style="color:${disp === 0 ? 'var(--red)' : 'var(--muted)'};">
                (${disp} disp.)
              </span>
            </div>
            <input type="number" id="rep_${id}" min="0" max="${disp}" value="0"
              ${disp === 0 ? 'disabled' : ''}
              style="width:70px;padding:6px;border-radius:6px;border:1px solid var(--border);
                     background:var(--bg);color:var(--text);text-align:center;font-size:14px;">
          </div>`;
      }).join('')
    : '<div class="empty">Nenhum material no estoque central</div>';

  document.getElementById('modalRepasse').classList.add('show');
}

function fecharModalRepasse(e) {
  if (e && e.target !== document.getElementById('modalRepasse')) return;
  document.getElementById('modalRepasse').classList.remove('show');
}

async function confirmarRepasse() {
  const erroEl = document.getElementById('repasseErro');
  erroEl.style.display = 'none';

  // Coletar quantidades
  const repasses = {};
  Object.keys(_est.estoqueCentral).forEach(id => {
    const inp = document.getElementById(`rep_${id}`);
    if (inp) {
      const v = parseInt(inp.value) || 0;
      if (v > 0) repasses[id] = v;
    }
  });

  if (!Object.keys(repasses).length) {
    showToast('Informe ao menos uma quantidade');
    return;
  }

  // Validar saldo
  for (const [id, qtd] of Object.entries(repasses)) {
    const disp = _est.estoqueCentral[id]?.qtdDisp || 0;
    if (qtd > disp) {
      erroEl.textContent = `Saldo insuficiente: ${_est.estoqueCentral[id]?.label || id} (disponível: ${disp})`;
      erroEl.style.display = 'block';
      return;
    }
  }

  const { db, ref, get, set, push } = window._fb;
  showToast('⏳ Processando repasse…');

  try {
    for (const [id, qtd] of Object.entries(repasses)) {
      const pathEstoque = `campanhas/${_est.campanhaId}/estoque_central/${id}`;
      const pathInv     = `campanhas/${_est.campanhaId}/inventarios/${_est.repasseUid}/${id}`;

      // 1. Deduzir do estoque central
      const eSnap  = await get(ref(db, pathEstoque));
      const eAtual = eSnap.val() || {};
      await set(ref(db, pathEstoque), {
        ...eAtual,
        qtdDist: (eAtual.qtdDist || 0) + qtd,
        qtdDisp: (eAtual.qtdDisp || 0) - qtd,
      });

      // 2. Creditar no inventário do militante
      const iSnap = await get(ref(db, pathInv));
      await set(ref(db, pathInv), (iSnap.val() || 0) + qtd);
    }

    // 3. Registrar log de repasse
    const pathLog = `campanhas/${_est.campanhaId}/distribuicoes`;
    await push(ref(db, pathLog), {
      tipo:        'repasse_coordenador',
      para:        _est.repasseUid,
      paraNome:    _est.repasseNome,
      de:          window._session?.uid,
      deNome:      window._session?.nome,
      itens:       repasses,
      ts:          Date.now(),
    });

    showToast(`✅ Repasse para ${_est.repasseNome} confirmado!`);
    fecharModalRepasse();
  } catch (err) {
    console.error('[estoque] confirmarRepasse:', err);
    showToast('❌ Erro no repasse. Tente novamente.');
  }
}

// ─────────────────────────────────────────────
// MODAL: VER INVENTÁRIO DO MILITANTE
// ─────────────────────────────────────────────
function verInventarioMilitante(uid, nome) {
  const inv   = _est.inventarios[uid] || {};
  const itens = Object.entries(inv).filter(([, q]) => q > 0);

  document.getElementById('inventarioMilitanteNome').textContent = `📦 ${nome}`;
  document.getElementById('inventarioMilitanteCorpo').innerHTML = itens.length
    ? itens.map(([id, qtd]) => {
        const item = _est.estoqueCentral[id];
        const cfg  = item ? (TIPO_MATERIAL[item.tipo] || { icon: '📦' }) : { icon: '📦' };
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;
                      background:var(--surface2);border-radius:8px;margin-bottom:8px;">
            <span style="font-size:22px;">${cfg.icon}</span>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${item?.label || id}</div>
              ${item?.tamanho ? `<div style="font-size:11px;color:var(--muted);">${item.tamanho}</div>` : ''}
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;
                        color:${qtd > 0 ? 'var(--green)' : 'var(--muted)'};">${qtd}</div>
          </div>`;
      }).join('')
    : `<div class="empty" style="padding:24px 0;">Militante sem materiais em inventário</div>`;

  document.getElementById('modalInventario').classList.add('show');
}

function fecharModalInventario(e) {
  if (e && e.target !== document.getElementById('modalInventario')) return;
  document.getElementById('modalInventario').classList.remove('show');
}

// ─────────────────────────────────────────────
// EXPORTAR CSV
// ─────────────────────────────────────────────
function exportarEstoqueCSV() {
  const header = ['Tipo', 'Label', 'Tamanho', 'Total', 'Distribuído', 'Disponível'];
  const rows   = Object.values(_est.estoqueCentral).map(i => [
    i.tipo, `"${i.label}"`, i.tamanho || '', i.qtdTotal || 0, i.qtdDist || 0, i.qtdDisp || 0,
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = `estoque_${_est.campanhaId}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('📥 CSV exportado!');
}

// ─────────────────────────────────────────────
// AUDITORIA / LOG
// ─────────────────────────────────────────────
function _registrarLog(acao, dados) {
  try {
    const { db, ref, push } = window._fb;
    push(ref(db, `campanhas/${_est.campanhaId}/logs`), {
      acao,
      autor:    window._session?.uid,
      autorNome: window._session?.nome,
      ts:       Date.now(),
      ...dados,
    });
  } catch (_) { /* log não crítico */ }
}

// ─────────────────────────────────────────────
// UTILITÁRIOS INTERNOS
// ─────────────────────────────────────────────
function _iniciais(nome) {
  if (!nome) return '?';
  const p = nome.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

function _corAvatar(nome) {
  const cores = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#f59e0b'];
  let h = 0;
  for (const c of (nome || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return cores[h % cores.length];
}

// ─────────────────────────────────────────────
// EXPORTS (para uso pelo router)
// ─────────────────────────────────────────────
window.estoqueInit           = estoqueInit;
window.estoqueDestroy        = estoqueDestroy;
window.abrirModalNovoMaterial     = abrirModalNovoMaterial;
window.abrirModalNovoMaterialEdit = abrirModalNovoMaterialEdit;
window.fecharModalNovoMaterial    = fecharModalNovoMaterial;
window.salvarNovoMaterial         = salvarNovoMaterial;
window._selNovoMatTipo            = _selNovoMatTipo;
window.abrirModalRepasse          = abrirModalRepasse;
window.fecharModalRepasse         = fecharModalRepasse;
window.confirmarRepasse           = confirmarRepasse;
window.verInventarioMilitante     = verInventarioMilitante;
window.fecharModalInventario      = fecharModalInventario;
window.exportarEstoqueCSV         = exportarEstoqueCSV;
