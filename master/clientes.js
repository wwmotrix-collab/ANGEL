/**
 * master/clientes.js — WWMX Campaign
 * Gestão de clientes (candidatos contratantes) e contratos.
 */
(function (global) {
  'use strict';

  let _clientes = [];
  let _campanhas = [];

  function init() {
    _renderizar();
    _assinar();
  }
  function destroy() {}

  function _renderizar() {
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view">
        <div id="clientesStats" style="margin-bottom:16px;"></div>
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="clientesBusca" placeholder="Buscar cliente...">
        </div>
        <div class="section-title">Clientes</div>
        <div id="clientesList" class="banner-list"></div>
        <button id="btnNovoCliente" class="btn btn-primary w-full" style="margin-top:4px;">+ Novo Cliente</button>
      </div>

      <div class="modal-overlay" id="modalNovoCliente">
        <div class="modal">
          <div class="modal-handle"></div>
          <div class="modal-title">🤝 Novo Cliente</div>
          <div class="field"><label>Nome do candidato</label><input id="clNome" placeholder="Nome completo"></div>
          <div class="field"><label>E-mail</label><input id="clEmail" type="email" placeholder="email@dominio.com"></div>
          <div class="field"><label>Telefone / WhatsApp</label><input id="clTel" placeholder="+55 51 9..."></div>
          <div class="field"><label>Campanha vinculada</label><select id="clCampanha"></select></div>
          <div class="field"><label>Plano contratado</label>
            <select id="clPlano">
              <option value="starter">Starter — R$ 1.490</option>
              <option value="pro">Pro — R$ 3.490</option>
              <option value="elite">Elite — R$ 7.490</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div class="field"><label>Valor contratado (R$)</label><input id="clValor" type="number" placeholder="0"></div>
          <div class="field"><label>Status do contrato</label>
            <select id="clStatus">
              <option value="prospecto">Prospecto</option>
              <option value="negociacao">Em negociação</option>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          <div class="field"><label>Observações</label><textarea id="clObs" rows="2"></textarea></div>
          <div style="display:flex;gap:10px;margin-top:4px;">
            <button class="btn btn-ghost" onclick="WWMX.UI.closeModal('modalNovoCliente')" style="flex:0 0 auto;padding:14px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarCliente" style="flex:1;">Salvar</button>
          </div>
        </div>
      </div>`;

    document.getElementById('btnNovoCliente').onclick = _abrirModal;
    document.getElementById('btnSalvarCliente').onclick = _salvar;
    document.getElementById('clientesBusca').oninput = (e) => _renderizarLista(e.target.value.toLowerCase());
  }

  function _assinar() {
    Promise.all([
      WWMX.fs.getCol('master/clientes'),
      WWMX.fs.getCol('campanhas'),
    ]).then(([clientes, campanhas]) => {
      _clientes  = clientes;
      _campanhas = campanhas;
      _renderizarStats();
      _renderizarLista('');
    }).catch(() => { _renderizarLista(''); });
  }

  function _abrirModal() {
    const sel = document.getElementById('clCampanha');
    if (sel) {
      sel.innerHTML = '<option value="">Selecione...</option>' +
        _campanhas.map(c => `<option value="${c.id}">${c.nomeExibicao || c.id}</option>`).join('');
    }
    WWMX.UI.openModal('modalNovoCliente');
  }

  async function _salvar() {
    const nome   = document.getElementById('clNome').value.trim();
    const email  = document.getElementById('clEmail').value.trim();
    if (!nome)  { WWMX.UI.showToast('Digite o nome', 'error'); return; }
    if (!email) { WWMX.UI.showToast('Digite o e-mail', 'error'); return; }
    const dados = {
      nome, email,
      tel:       document.getElementById('clTel').value.trim(),
      campanhaId:document.getElementById('clCampanha').value,
      plano:     document.getElementById('clPlano').value,
      valor:     parseFloat(document.getElementById('clValor').value) || 0,
      status:    document.getElementById('clStatus').value,
      obs:       document.getElementById('clObs').value.trim(),
      criadoEm:  WWMX.fs.serverTimestamp(),
    };
    try {
      await WWMX.fs.addDoc('master/clientes', dados);
      WWMX.UI.closeModal('modalNovoCliente');
      WWMX.UI.showToast(`✅ Cliente "${nome}" salvo!`, 'success');
      _assinar();
    } catch (e) {
      WWMX.UI.showToast('Erro ao salvar cliente', 'error');
    }
  }

  function _renderizarStats() {
    const el = document.getElementById('clientesStats');
    if (!el) return;
    const ativos = _clientes.filter(c => c.status === 'ativo').length;
    const mrr    = _clientes.filter(c => c.status === 'ativo').reduce((a, c) => a + (c.valor || 0), 0);
    el.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${_clientes.length}</div><div class="stat-label">Clientes</div></div>
        <div class="stat-card inst"><div class="stat-num green">${ativos}</div><div class="stat-label">Contratos ativos</div></div>
        <div class="stat-card purple"><div class="stat-num purple">R$&nbsp;${mrr.toLocaleString('pt-BR')}</div><div class="stat-label">Receita ativa</div></div>
      </div>`;
  }

  function _renderizarLista(busca) {
    const el = document.getElementById('clientesList');
    if (!el) return;
    let lista = busca ? _clientes.filter(c => (c.nome||'').toLowerCase().includes(busca)) : _clientes;
    if (!lista.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🤝</div>Nenhum cliente cadastrado</div>';
      return;
    }
    const corStatus = { prospecto:'var(--muted)', negociacao:'var(--yellow)', ativo:'var(--green)', encerrado:'var(--red)' };
    const cores = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#22c55e'];
    const cor  = n => { let h=0; for(let c of (n||'?')) h=(h*31+c.charCodeAt(0))&0xffff; return cores[h%cores.length]; };
    const ini  = n => (n||'?').trim().split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    el.innerHTML = lista.map(c => `
      <div class="banner-item">
        <div class="lider-avatar" style="width:42px;height:42px;font-size:15px;background:${cor(c.nome)};color:#fff;">${ini(c.nome)}</div>
        <div class="banner-info">
          <div class="banner-name">${c.nome}</div>
          <div class="banner-meta">${c.email} · ${c.plano || '—'}</div>
          <div class="banner-meta">💰 R$ ${(c.valor||0).toLocaleString('pt-BR')}</div>
        </div>
        <span class="pill" style="background:${corStatus[c.status]}22;color:${corStatus[c.status]};border:1px solid ${corStatus[c.status]}44;font-size:10px;">${c.status}</span>
      </div>`).join('');
  }

  global.clientesInit    = init;
  global.clientesDestroy = destroy;
}(window));
