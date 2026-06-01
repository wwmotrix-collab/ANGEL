/**
 * master/campanhas.js — WWMX Campaign
 * Criação e gestão completa de campanhas pelo Master.
 */
(function (global) {
  'use strict';

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
        <div id="masterStats" style="margin-bottom:16px;"></div>
        <button id="btnNovaCampanha" class="btn btn-primary w-full" style="margin-bottom:16px;">+ Nova Campanha</button>
        <div class="section-title">Campanhas ativas</div>
        <div id="listaCampanhas" class="banner-list"></div>
      </div>

      <!-- Modal: Nova Campanha -->
      <div class="modal-overlay" id="modalNovaCampanha">
        <div class="modal" style="border-radius:var(--radius-lg);">
          <div class="modal-handle"></div>
          <div class="modal-title">🏗️ Nova Campanha</div>

          <div class="field"><label>ID da campanha</label>
            <input id="cmpId" placeholder="Ex: mendes2026 (sem espaços)" autocomplete="off">
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">Usado na URL: app.wwmx.com/?c=<strong id="cmpIdPreview">mendes2026</strong></div>
          </div>
          <div class="field"><label>Nome exibição</label><input id="cmpNome" placeholder="Ex: Dr. Carlos Mendes"></div>
          <div class="field"><label>Número eleitoral</label><input id="cmpNumero" placeholder="Ex: 40" maxlength="6" inputmode="numeric"></div>
          <div class="field"><label>Cargo</label>
            <select id="cmpCargo">
              <option value="vereador">Vereador</option>
              <option value="dep_estadual" selected>Deputado Estadual</option>
              <option value="dep_federal">Deputado Federal</option>
              <option value="senador">Senador</option>
              <option value="governador">Governador</option>
              <option value="prefeito">Prefeito</option>
            </select>
          </div>
          <div class="field"><label>Município</label><input id="cmpMunicipio" placeholder="Ex: Viamão"></div>
          <div class="field"><label>Estado (UF)</label>
            <select id="cmpUf">
              <option value="RS" selected>RS</option><option value="SP">SP</option>
              <option value="RJ">RJ</option><option value="MG">MG</option>
              <option value="PR">PR</option><option value="SC">SC</option>
              <option value="BA">BA</option><option value="GO">GO</option>
              <option value="PE">PE</option><option value="CE">CE</option>
            </select>
          </div>
          <div class="field"><label>Ano eleitoral</label>
            <input id="cmpAno" value="2026" maxlength="4" inputmode="numeric">
          </div>

          <div class="section-title" style="margin-top:16px;">Senhas de acesso</div>
          <div class="field"><label>Senha — Campo</label><input id="cmpSenhaCampo" placeholder="Mínimo 6 caracteres" type="password"></div>
          <div class="field"><label>Senha — Coordenador</label><input id="cmpSenhaCoord" placeholder="Mínimo 6 caracteres" type="password"></div>
          <div class="field"><label>Senha — Candidato</label><input id="cmpSenhaCand" placeholder="Mínimo 8 caracteres" type="password"></div>

          <div class="section-title" style="margin-top:16px;">Módulos ativos</div>
          <div id="modulosCheckboxes" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;"></div>

          <div style="display:flex;gap:10px;margin-top:4px;">
            <button class="btn btn-ghost" onclick="WWMX.UI.closeModal('modalNovaCampanha')" style="flex:0 0 auto;padding:14px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarCampanha" style="flex:1;">Criar Campanha</button>
          </div>
        </div>
      </div>`;

    // Preencher checkboxes de módulos
    const modulos = global.WWMX.Config?.MODULOS_DISPONIVEIS || [];
    document.getElementById('modulosCheckboxes').innerHTML = modulos.map(m => `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;background:var(--surface2);border-radius:8px;">
        <input type="checkbox" id="mod_${m.id}" checked style="width:auto;cursor:pointer;">
        <span>${m.icon} ${m.label}</span>
      </label>`).join('');

    // Preview do ID
    document.getElementById('cmpId').oninput = (e) => {
      const val = e.target.value.replace(/\s+/g,'').toLowerCase();
      e.target.value = val;
      document.getElementById('cmpIdPreview').textContent = val || 'id-campanha';
    };

    document.getElementById('btnNovaCampanha').onclick = () => WWMX.UI.openModal('modalNovaCampanha');
    document.getElementById('btnSalvarCampanha').onclick = _salvarCampanha;
  }

  function _assinar() {
    WWMX.fs.getCol('campanhas').then(campanhas => {
      _campanhas = campanhas;
      _renderizarStats();
      _renderizarLista();
    }).catch(err => {
      console.warn('[master/campanhas] Erro ao carregar:', err);
      _renderizarLista();
    });
  }

  function _renderizarStats() {
    const el = document.getElementById('masterStats');
    if (!el) return;
    const ativas   = _campanhas.filter(c => c.status === 'ativo' || !c.status).length;
    const inativas = _campanhas.length - ativas;
    el.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${_campanhas.length}</div><div class="stat-label">Campanhas</div></div>
        <div class="stat-card inst"><div class="stat-num green">${ativas}</div><div class="stat-label">Ativas</div></div>
        <div class="stat-card ret"><div class="stat-num red">${inativas}</div><div class="stat-label">Inativas</div></div>
      </div>`;
  }

  function _renderizarLista() {
    const el = document.getElementById('listaCampanhas');
    if (!el) return;
    if (!_campanhas.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🏗️</div>Nenhuma campanha criada ainda.<br>Clique em "+ Nova Campanha" para começar.</div>';
      return;
    }
    el.innerHTML = _campanhas.map(c => `
      <div class="banner-item">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1a3a7a,#c0392b);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#fff;flex-shrink:0;">${c.numero || '?'}</div>
        <div class="banner-info">
          <div class="banner-name">${c.nomeExibicao || c.id}</div>
          <div class="banner-meta">📍 ${c.municipio || '—'}-${c.uf || ''} · ${c.cargo || ''} · ${c.ano || ''}</div>
          <div class="banner-meta">ID: <span style="font-family:var(--font-mono);font-size:11px;">${c.id}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
          <span class="pill ${c.status === 'inativo' ? 'pill-danger' : 'pill-success'}">${c.status === 'inativo' ? 'Inativa' : 'Ativa'}</span>
          <button onclick="_toggleStatusCampanha('${c.id}','${c.status||'ativo'}')"
            style="font-size:11px;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--muted);cursor:pointer;">
            ${c.status === 'inativo' ? 'Reativar' : 'Desativar'}
          </button>
        </div>
      </div>`).join('');
  }

  async function _salvarCampanha() {
    const id        = document.getElementById('cmpId').value.trim();
    const nome      = document.getElementById('cmpNome').value.trim();
    const numero    = document.getElementById('cmpNumero').value.trim();
    const cargo     = document.getElementById('cmpCargo').value;
    const municipio = document.getElementById('cmpMunicipio').value.trim();
    const uf        = document.getElementById('cmpUf').value;
    const ano       = document.getElementById('cmpAno').value.trim();
    const senhaCampo= document.getElementById('cmpSenhaCampo').value;
    const senhaCoord= document.getElementById('cmpSenhaCoord').value;
    const senhaCand = document.getElementById('cmpSenhaCand').value;

    if (!id)          { WWMX.UI.showToast('Digite o ID da campanha', 'error'); return; }
    if (!nome)        { WWMX.UI.showToast('Digite o nome de exibição', 'error'); return; }
    if (!municipio)   { WWMX.UI.showToast('Digite o município', 'error'); return; }
    if (senhaCampo.length < 6) { WWMX.UI.showToast('Senha de campo muito curta (mín. 6)', 'error'); return; }
    if (senhaCoord.length < 6) { WWMX.UI.showToast('Senha de coordenador muito curta', 'error'); return; }
    if (senhaCand.length < 8)  { WWMX.UI.showToast('Senha de candidato muito curta (mín. 8)', 'error'); return; }

    // Módulos selecionados
    const modulos = global.WWMX.Config?.MODULOS_DISPONIVEIS || [];
    const modulosAtivos = modulos.filter(m => document.getElementById(`mod_${m.id}`)?.checked).map(m => m.id);

    WWMX.UI.showLoading();
    try {
      const session = WWMX.Auth.sessaoAtual();

      // 1. Criar documento da campanha no Firestore
      await WWMX.fs.setDoc({
        id,
        nomeExibicao: nome,
        numero,
        cargo,
        municipio,
        uf,
        ano,
        status: 'ativo',
        criadoPor: session?.uid || 'master',
        criadoEm: WWMX.fs.serverTimestamp(),
        modulosAtivos,
        subTitulo: `WWMX Campaign · ${municipio} ${ano}`,
      }, 'campanhas', id);

      // 2. Criar config com senhas (subcoleção config/main)
      await WWMX.fs.setDoc({
        municipio, uf, ano, modulosAtivos,
        nomeExibicao: nome,
        numero,
        cargo,
        metaVotos: 49000,
        senhas: {
          campo:     senhaCampo,
          coord:     senhaCoord,
          candidato: senhaCand,
          master:    'master2026',
        },
      }, 'campanhas', id, 'config', 'main');

      // 3. Disparar log
      await WWMX.log(id, 'campanha_criada', { municipio, cargo, modulosAtivos }, session);

      WWMX.UI.hideLoading();
      WWMX.UI.closeModal('modalNovaCampanha');
      WWMX.UI.showToast(`✅ Campanha "${nome}" criada!`, 'success');

      // Recarregar lista
      _assinar();
    } catch (err) {
      WWMX.UI.hideLoading();
      console.error('[master/campanhas] Erro ao salvar:', err);
      WWMX.UI.showToast('Erro ao criar campanha. Verifique o console.', 'error');
    }
  }

  // Exposto globalmente para o botão inline no HTML gerado
  global._toggleStatusCampanha = async function(id, statusAtual) {
    const novoStatus = statusAtual === 'inativo' ? 'ativo' : 'inativo';
    try {
      await WWMX.fs.updateDoc({ status: novoStatus }, 'campanhas', id);
      WWMX.UI.showToast(`Campanha ${novoStatus === 'ativo' ? 'reativada' : 'desativada'}`, 'success');
      _assinar();
    } catch (err) {
      WWMX.UI.showToast('Erro ao atualizar status', 'error');
    }
  };

  global.campanhasInit    = init;
  global.campanhasDestroy = destroy;
}(window));
