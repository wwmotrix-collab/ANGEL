/**
 * modulos/crm.js
 * WWMX Campaign — CRM de lideranças (cadastro, status, projeção de votos)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _liderEditando = null;
  let _liderStatusSel = 'confirmado';

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsub) _unsub();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div id="crmProjecaoCard" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;"></div>
        <div class="search-wrap"><input class="search-input" placeholder="Buscar liderança..." id="buscaLider"></div>
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <button class="chip" data-filtro="todos">Todos</button>
          <button class="chip" data-filtro="confirmado">✅ Confirmados</button>
          <button class="chip" data-filtro="provavel">🟡 Prováveis</button>
          <button class="chip" data-filtro="indefinido">⬜ Indefinidos</button>
          <button class="chip" data-filtro="contra">🔴 Contra</button>
        </div>
        <div class="section-title">Lideranças</div>
        <div id="crmLiderList" class="banner-list"></div>
        <button id="btnNovaLideranca" class="btn btn-primary" style="width:100%;margin-top:16px;">+ Nova Liderança</button>
      </div>
      <!-- Modal de cadastro (será criado dinamicamente) -->
    `;
    document.getElementById('btnNovaLideranca').onclick = () => _abrirModalLider();
    document.getElementById('buscaLider').oninput = () => _renderizarLista();
    document.querySelectorAll('[data-filtro]').forEach(btn => {
      btn.onclick = () => {
        const filtro = btn.dataset.filtro;
        _filtroAtivo = filtro;
        _renderizarLista();
      };
    });
  }

  let _filtroAtivo = 'todos';
  let _busca = '';

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, (snap) => {
      const lids = Object.values(snap.val() || {});
      _renderizarProjecao(lids);
      _renderizarLista(lids);
    });
  }

  function _renderizarProjecao(lids) {
    let vConf = 0, vProv = 0, vIndef = 0;
    lids.forEach(l => {
      const v = l.votos || 0;
      if (l.status === 'confirmado') vConf += v;
      else if (l.status === 'provavel') vProv += v;
      else if (l.status === 'indefinido') vIndef += v;
    });
    const vProj = vConf + Math.round(vProv * 0.6) + Math.round(vIndef * 0.2);
    const container = document.getElementById('crmProjecaoCard');
    if (container) {
      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;">
          <div>
            <div style="font-size:10px;color:var(--muted);">Projeção de Votos</div>
            <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:800;color:var(--accent);">${vProj.toLocaleString('pt-BR')}</div>
            <div style="font-size:11px;">${lids.length} lideranças</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--green);">${vConf}</div><div style="font-size:10px;">Confirm.</div></div>
            <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--yellow);">${vProv}</div><div style="font-size:10px;">Prov.</div></div>
            <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--muted);">${vIndef}</div><div style="font-size:10px;">Indef.</div></div>
          </div>
        </div>
      `;
    }
  }

  function _renderizarLista(lids) {
    const lista = document.getElementById('crmLiderList');
    if (!lista) return;
    let filtrados = lids.filter(l => _filtroAtivo === 'todos' || l.status === _filtroAtivo);
    const busca = document.getElementById('buscaLider').value.toLowerCase();
    if (busca) filtrados = filtrados.filter(l => l.nome.toLowerCase().includes(busca) || (l.bairro || '').toLowerCase().includes(busca));
    filtrados.sort((a,b) => (b.votos || 0) - (a.votos || 0));
    if (!filtrados.length) {
      lista.innerHTML = '<div class="empty">Nenhuma liderança encontrada</div>';
      return;
    }
    const corStatus = { confirmado:'var(--green)', provavel:'var(--yellow)', indefinido:'var(--muted)', contra:'var(--red)' };
    lista.innerHTML = filtrados.map(l => `
      <div class="banner-item" style="cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('wwmx:ver-lider', { detail: { id: '${l.id}' } }))">
        <div class="lider-avatar" style="width:44px;height:44px;background:${_corAvatar(l.nome)};color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;">${_iniciais(l.nome)}</div>
        <div class="banner-info">
          <div class="banner-name">${l.nome}</div>
          <div class="banner-meta">📍 ${l.bairro || '—'}</div>
          <div><span style="color:${corStatus[l.status]}; font-size:11px;">${l.status}</span></div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">${(l.votos || 0).toLocaleString('pt-BR')}</div>
          <div style="font-size:10px;">votos</div>
        </div>
      </div>
    `).join('');
  }

  function _abrirModalLider(lider = null) {
    _liderEditando = lider;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">${lider ? '✏️ Editar Liderança' : '👤 Nova Liderança'}</div>
        <div class="field"><label>Nome</label><input id="liderNome" value="${lider?.nome || ''}"></div>
        <div class="field"><label>WhatsApp</label><input id="liderTel" value="${lider?.tel || ''}"></div>
        <div class="field"><label>Bairro</label><input id="liderBairro" value="${lider?.bairro || ''}"></div>
        <div class="field"><label>Status</label>
          <div class="status-sel">
            <button class="status-opt ${lider?.status === 'confirmado' ? 'active' : ''}" data-status="confirmado">✅ Confirmado</button>
            <button class="status-opt ${lider?.status === 'provavel' ? 'active' : ''}" data-status="provavel">🟡 Provável</button>
            <button class="status-opt ${lider?.status === 'indefinido' ? 'active' : ''}" data-status="indefinido">⬜ Indefinido</button>
            <button class="status-opt ${lider?.status === 'contra' ? 'active' : ''}" data-status="contra">🔴 Contra</button>
          </div>
        </div>
        <div class="field"><label>Votos declarados</label><input id="liderVotos" type="number" value="${lider?.votos || 0}"></div>
        <div class="field"><label>Candidato anterior</label><input id="liderCandAnterior" value="${lider?.candAnterior || ''}"></div>
        <div class="field"><label>Observações</label><textarea id="liderObs">${lider?.obs || ''}</textarea></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-ghost" data-fechar>Cancelar</button>
          <button class="btn btn-primary" data-salvar>Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-fechar]').onclick = () => overlay.remove();
    overlay.querySelector('[data-salvar]').onclick = () => _salvarLider(overlay);
    overlay.querySelectorAll('[data-status]').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _liderStatusSel = btn.dataset.status;
      };
    });
    if (lider) _liderStatusSel = lider.status;
  }

  async function _salvarLider(overlay) {
    const nome = document.getElementById('liderNome').value.trim();
    if (!nome) { WWMX.UI.showToast('Digite o nome', 'error'); return; }
    const dados = {
      nome,
      tel: document.getElementById('liderTel').value.trim(),
      bairro: document.getElementById('liderBairro').value.trim(),
      status: _liderStatusSel,
      votos: parseInt(document.getElementById('liderVotos').value) || 0,
      candAnterior: document.getElementById('liderCandAnterior').value.trim(),
      obs: document.getElementById('liderObs').value.trim(),
    };
    const session = WWMX.Auth.sessaoAtual();
    if (_liderEditando) {
      await WWMX.db.update(`campanhas/${_campanhaId}/crm_liderancas/${_liderEditando.id}`, dados);
    } else {
      dados.id = Date.now().toString();
      dados.ts = Date.now();
      dados.autor = session.nome;
      dados.autorUid = session.uid;
      dados.interacoes = [];
      await WWMX.db.set(`campanhas/${_campanhaId}/crm_liderancas/${dados.id}`, dados);
    }
    overlay.remove();
    WWMX.UI.showToast('✅ Liderança salva!');
  }

  function _corAvatar(nome) {
    const cores = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e'];
    let h = 0;
    for (let c of nome) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return cores[h % cores.length];
  }

  function _iniciais(nome) {
    return nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  global.crmInit = init;
  global.crmDestroy = destroy;
})(window);