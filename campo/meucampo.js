/**
 * campo/meucampo.js
 * WWMX Campaign — Visão consolidada das próprias atividades + entrada de liderança.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsubPins = null;
  let _unsubLiderancas = null;
  let _unsubPercursos = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinarDados();
  }

  function destroy() {
    if (_unsubPins) _unsubPins();
    if (_unsubLiderancas) _unsubLiderancas();
    if (_unsubPercursos) _unsubPercursos();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view" style="padding-bottom:100px;">
        <div id="meucampoStats" style="margin-bottom:16px;"></div>
        <button id="btnNovaLiderancaCampo" class="btn btn-primary" style="width:100%;margin-bottom:16px;">+ Cadastrar Liderança</button>

        <div class="section-title">Meus Materiais</div>
        <div id="meusMateriais" class="banner-list"></div>
        <div class="section-title">Meus Eventos</div>
        <div id="meusEventos" class="banner-list"></div>
        <div class="section-title">Minhas Lideranças</div>
        <div id="minhasLiderancas" class="banner-list"></div>
        <div class="section-title">Meus Percursos</div>
        <div id="meusPercursos" class="banner-list"></div>

        <div class="modal-overlay" id="modalNovaLiderancaCampo" onclick="window.fecharModalLiderancaCampo(event)">
          <div class="modal">
            <div class="modal-handle"></div>
            <div class="modal-title">👥 Nova Liderança</div>
            <div class="field"><label>Nome</label><input id="liderNomeCampo" placeholder="Nome completo"></div>
            <div class="field"><label>WhatsApp</label><input id="liderWhatsCampo" placeholder="(xx) xxxxx-xxxx" inputmode="tel"></div>
            <div class="field"><label>Bairro</label><input id="liderBairroCampo" placeholder="Bairro / região"></div>
            <div class="field"><label>Votos estimados</label><input id="liderVotosCampo" type="number" min="0" placeholder="0" inputmode="numeric"></div>
            <div class="field"><label>Status</label><select id="liderStatusCampo"><option value="confirmado">Confirmado</option><option value="provavel">Provável</option><option value="indefinido">Indefinido</option><option value="contra">Contra</option></select></div>
            <div class="field"><label>Observação</label><textarea id="liderObsCampo" style="height:80px;" placeholder="Histórico, vínculo, demanda, contato..."></textarea></div>
            <div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-ghost" onclick="window.fecharModalLiderancaCampo()" style="width:auto;padding:14px 20px;">Cancelar</button><button class="btn btn-primary" onclick="window.salvarLiderancaCampo()">Salvar</button></div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('btnNovaLiderancaCampo').onclick = abrirModalLiderancaCampo;
  }

  function _assinarDados() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    _unsubPins = WWMX.db.on(`campanhas/${_campanhaId}/pins`, (snap) => { const meus = Object.values(snap.val() || {}).filter(p => p.autorUid === session.uid); _renderizarMateriais(meus); _renderizarEventos(meus); });
    _unsubLiderancas = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, (snap) => { const minhas = Object.values(snap.val() || {}).filter(l => l.autorUid === session.uid); _renderizarLiderancas(minhas); });
    _unsubPercursos = WWMX.db.on(`campanhas/${_campanhaId}/percursos`, (snap) => { const meus = Object.values(snap.val() || {}).filter(p => p.autorUid === session.uid); _renderizarPercursos(meus); });
  }

  function abrirModalLiderancaCampo() {
    ['liderNomeCampo','liderWhatsCampo','liderBairroCampo','liderVotosCampo','liderObsCampo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const status = document.getElementById('liderStatusCampo'); if (status) status.value = 'provavel';
    document.getElementById('modalNovaLiderancaCampo')?.classList.add('show');
  }

  function fecharModalLiderancaCampo(e) {
    if (e && e.target !== document.getElementById('modalNovaLiderancaCampo')) return;
    document.getElementById('modalNovaLiderancaCampo')?.classList.remove('show');
  }

  async function salvarLiderancaCampo() {
    const session = WWMX.Auth.sessaoAtual();
    const nome = document.getElementById('liderNomeCampo').value.trim();
    if (!nome) { WWMX.UI?.showToast?.('Informe o nome da liderança', 'error'); return; }
    const id = `lid_${Date.now()}`;
    const latLng = await _obterGeoAtual();
    const lider = {
      id,
      nome,
      whatsapp: document.getElementById('liderWhatsCampo').value.trim(),
      bairro: document.getElementById('liderBairroCampo').value.trim(),
      votos: Number(document.getElementById('liderVotosCampo').value || 0),
      status: document.getElementById('liderStatusCampo').value,
      obs: document.getElementById('liderObsCampo').value.trim(),
      autor: session.nome,
      autorUid: session.uid,
      ts: Date.now(),
      interacoes: [],
      ...(latLng || {})
    };
    await WWMX.db.set(`campanhas/${_campanhaId}/crm_liderancas/${id}`, lider);
    WWMX.UI?.showToast?.('✅ Liderança cadastrada', 'success');
    fecharModalLiderancaCampo();
  }

  function _obterGeoAtual() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, geoStatus: 'gps_campo' }), () => resolve(null), { enableHighAccuracy: true, timeout: 5000 });
    });
  }

  function _renderizarMateriais(pins) {
    const materiais = pins.filter(p => global.TIPO_MATERIAL[p.tipo]);
    const lista = document.getElementById('meusMateriais'); if (!lista) return;
    if (!materiais.length) { lista.innerHTML = '<div class="empty">Nenhum material registrado</div>'; return; }
    lista.innerHTML = materiais.map(p => { const cfg = global.TIPO_MATERIAL[p.tipo] || { icon: '📦' }; return `<div class="banner-item"><div style="font-size:24px;">${cfg.icon}</div><div class="banner-info"><div class="banner-name">${_esc(p.nome)}</div><div class="banner-meta">${p.qtd || 0} un. · ${new Date(p.ts).toLocaleDateString()}</div></div></div>`; }).join('');
  }
  function _renderizarEventos(pins) {
    const eventos = pins.filter(p => global.TIPO_EVENTO[p.tipo]);
    const lista = document.getElementById('meusEventos'); if (!lista) return;
    if (!eventos.length) { lista.innerHTML = '<div class="empty">Nenhum evento registrado</div>'; return; }
    lista.innerHTML = eventos.map(p => { const cfg = global.TIPO_EVENTO[p.tipo] || { icon: '🎯' }; return `<div class="banner-item"><div style="font-size:24px;">${cfg.icon}</div><div class="banner-info"><div class="banner-name">${_esc(p.nome)}</div><div class="banner-meta">${p.pessoas || 0} pessoas · ${new Date(p.ts).toLocaleDateString()}</div></div></div>`; }).join('');
  }
  function _renderizarLiderancas(liderancas) {
    const lista = document.getElementById('minhasLiderancas'); if (!lista) return;
    if (!liderancas.length) { lista.innerHTML = '<div class="empty">Nenhuma liderança cadastrada</div>'; return; }
    lista.innerHTML = liderancas.map(l => `<div class="banner-item"><div class="lider-avatar" style="width:40px;height:40px;border-radius:50%;background:${_corAvatar(l.nome)};color:#fff;display:flex;align-items:center;justify-content:center;">${_iniciais(l.nome)}</div><div class="banner-info"><div class="banner-name">${_esc(l.nome)}</div><div class="banner-meta">${l.votos || 0} votos · ${_esc(l.bairro || '')} · ${_esc(l.status || '')}</div></div></div>`).join('');
  }
  function _renderizarPercursos(percursos) {
    const lista = document.getElementById('meusPercursos'); if (!lista) return;
    if (!percursos.length) { lista.innerHTML = '<div class="empty">Nenhum percurso registrado</div>'; return; }
    lista.innerHTML = percursos.map(p => `<div class="banner-item"><div style="font-size:24px;">${p.tipo === 'carrosom' ? '📢' : '🚶'}</div><div class="banner-info"><div class="banner-name">${_esc(p.veiculo || p.tipo)}</div><div class="banner-meta">${Number(p.km || 0).toFixed(1)} km · ${new Date(p.dataTs || p.ts).toLocaleDateString()}</div></div></div>`).join('');
  }
  function _corAvatar(nome) { const cores = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#22c55e']; let h = 0; for (let c of (nome || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffff; return cores[h % cores.length]; }
  function _iniciais(nome) { return String(nome || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(); }
  function _esc(v) { return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  global.meucampoInit = init;
  global.meucampoDestroy = destroy;
  global.abrirModalLiderancaCampo = abrirModalLiderancaCampo;
  global.fecharModalLiderancaCampo = fecharModalLiderancaCampo;
  global.salvarLiderancaCampo = salvarLiderancaCampo;
})(window);
