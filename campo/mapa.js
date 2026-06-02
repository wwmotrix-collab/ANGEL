/**
 * campo/mapa.js
 * WWMX Campaign — Mapa para militante de campo
 * Restaura FAB speed-dial completo: Denúncia, Evento, Material e Liderança.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _map = null;
  let _markers = {};
  let _modoAdd = false;
  let _tempMarker = null;
  let _fabAberto = false;
  let _pendingTipo = null;
  let _latLng = null;
  let _unsubPins = null;
  let _unsubLiderancas = null;
  let _unsubDenuncias = null;
  let _fotoBase64 = null;
  let _fabBtn, _fabMenu, _fabOverlay, _fabGps, _mapHint;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizarContainer();
    _configurarFAB();
    _configurarGPS();
    _iniciarMapa();
    _inscreverDados();
  }

  function destroy() {
    if (_unsubPins) _unsubPins();
    if (_unsubLiderancas) _unsubLiderancas();
    if (_unsubDenuncias) _unsubDenuncias();
    if (_map) { _map.remove(); _map = null; }
    global.WWMX.mapaInstance = null;
  }

  function _renderizarContainer() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.style.position = 'relative';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.innerHTML = `
      <div id="map" style="height:100%;width:100%;"></div>
      <div class="map-hint" id="mapHint">📍 Toque no mapa ou use o GPS 🛰️</div>
      <button class="fab-gps" id="fabGps">🛰️</button>
      <div class="fab-overlay" id="fabOverlay"></div>
      <div class="fab-menu" id="fabMenu">
        <div class="fab-item" data-tipo="denuncia"><span class="fab-item-label">🚨 Denúncia</span><button class="fab-item-btn" style="background:#ef4444;">🚨</button></div>
        <div class="fab-item" data-tipo="evento"><span class="fab-item-label">🎯 Evento</span><button class="fab-item-btn" style="background:#8b5cf6;">🎯</button></div>
        <div class="fab-item" data-tipo="material"><span class="fab-item-label">📦 Material</span><button class="fab-item-btn" style="background:var(--accent);">📦</button></div>
        <div class="fab-item" data-tipo="lideranca"><span class="fab-item-label">👤 Liderança</span><button class="fab-item-btn" style="background:#22c55e;">👤</button></div>
      </div>
      <button class="fab" id="fabBtn">+</button>
    `;
  }

  function _iniciarMapa() {
    const cfg = global.WWMX?.Config?.DEFAULT_CONFIG;
    _map = L.map('map', { center: [-30.0807, -51.0258], zoom: 14, zoomControl: false });
    L.tileLayer(cfg?.mapaTileDark || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: cfg?.mapaAttribution || '&copy; OpenStreetMap contributors' }).addTo(_map);
    L.control.zoom({ position: 'bottomleft' }).addTo(_map);
    _map.on('click', _onMapClick);
    global.WWMX.mapaInstance = _map;
  }

  function _onMapClick(e) {
    if (!_modoAdd) return;
    _latLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    _marcarTemp(_latLng);
    _abrirFormularioPendente();
  }

  function _marcarTemp(latLng) {
    if (!_map || !latLng) return;
    if (_tempMarker) _map.removeLayer(_tempMarker);
    _tempMarker = L.circleMarker([latLng.lat, latLng.lng], { radius: 10, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2 }).addTo(_map);
  }

  function _inscreverDados() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    const render = () => _renderizarMarcadores();
    _unsubPins = WWMX.db.on(`campanhas/${_campanhaId}/pins`, snap => { _cachePins = Object.values(snap.val() || {}).filter(p => p.autorUid === session.uid || p.autor === session.nome); render(); });
    _unsubLiderancas = WWMX.db.on(`campanhas/${_campanhaId}/crm_liderancas`, snap => { _cacheLiderancas = Object.values(snap.val() || {}).filter(l => l.autorUid === session.uid || l.autor === session.nome); render(); });
    _unsubDenuncias = WWMX.db.on(`campanhas/${_campanhaId}/denuncias`, snap => { _cacheDenuncias = Object.values(snap.val() || {}).filter(d => d.autorUid === session.uid || d.autor === session.nome); render(); });
  }

  let _cachePins = [];
  let _cacheLiderancas = [];
  let _cacheDenuncias = [];

  function _renderizarMarcadores() {
    if (!_map) return;
    Object.values(_markers).forEach(m => _map.removeLayer(m));
    _markers = {};
    const todos = [
      ..._cachePins.map(p => ({ ...p, _kind: 'pin' })),
      ..._cacheLiderancas.map(l => ({ ...l, tipo: 'lideranca', nome: l.nome, _kind: 'lideranca' })),
      ..._cacheDenuncias.map(d => ({ ...d, tipo: 'denuncia', nome: d.titulo || d.nome || 'Denúncia', _kind: 'denuncia' })),
    ];
    todos.forEach(item => {
      if (!item.lat || !item.lng) return;
      const cfg = _tipoCfg(item);
      const html = `<div style="width:34px;height:34px;border-radius:50%;background:${cfg.cor};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${cfg.icon}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(_map).bindPopup(_buildPopup(item));
      _markers[`${item._kind}_${item.id}`] = marker;
    });
  }

  function _tipoCfg(item) {
    if (item.tipo === 'lideranca') return { icon: '👤', label: 'Liderança', cor: '#22c55e' };
    if (item.tipo === 'denuncia') return { icon: '🚨', label: 'Denúncia', cor: '#ef4444' };
    return global.TIPO_CONFIG?.[item.tipo] || { icon: '📍', label: item.tipo || 'Ponto', cor: '#3b82f6' };
  }

  function _buildPopup(item) {
    const cfg = _tipoCfg(item);
    const data = formatDate(item.ts);
    const statusCor = { instalado: '#22c55e', retirado: '#ef4444', danificado: '#f59e0b', aberto: '#ef4444', resolvido: '#22c55e' }[item.status] || cfg.cor;
    return `<div class="popup-wrap"><div class="popup-status-bar" style="background:${statusCor};"></div>${item.foto ? `<img class="popup-photo" src="${item.foto}" onclick="abrirLightbox(this.src);event.stopPropagation();">` : ''}<div class="popup-name">${_esc(item.nome || item.titulo || cfg.label)}</div><div class="popup-meta">${cfg.label} · ${data}</div>${item.qtd ? `<div class="popup-row">📦 <span>${item.qtd} unidades</span></div>` : ''}${item.pessoas ? `<div class="popup-row">👥 <span>${item.pessoas} pessoas</span></div>` : ''}${item.votos ? `<div class="popup-row">🗳️ <span>${item.votos} votos estimados</span></div>` : ''}${item.status ? `<div class="popup-row"><span class="status-pill s-${item.status}">${item.status}</span></div>` : ''}${item.obs || item.descricao ? `<div class="popup-row" style="font-size:12px;color:var(--muted);">${_esc(item.obs || item.descricao)}</div>` : ''}</div>`;
  }

  function _configurarFAB() {
    _fabBtn = document.getElementById('fabBtn');
    _fabMenu = document.getElementById('fabMenu');
    _fabOverlay = document.getElementById('fabOverlay');
    _fabGps = document.getElementById('fabGps');
    _mapHint = document.getElementById('mapHint');
    _fabBtn.addEventListener('click', _toggleFab);
    _fabOverlay.addEventListener('click', _fecharFab);
    document.querySelectorAll('.fab-item').forEach(item => item.addEventListener('click', e => { e.stopPropagation(); _fecharFab(); _abrirFabOpcao(item.dataset.tipo); }));
  }

  function _toggleFab() {
    _fabAberto = !_fabAberto;
    _fabBtn.classList.toggle('open', _fabAberto);
    _fabBtn.textContent = _fabAberto ? '✕' : '+';
    _fabMenu.classList.toggle('open', _fabAberto);
    _fabOverlay.classList.toggle('open', _fabAberto);
  }

  function _fecharFab() {
    _fabAberto = false;
    _fabBtn.classList.remove('open');
    _fabBtn.textContent = '+';
    _fabMenu.classList.remove('open');
    _fabOverlay.classList.remove('open');
  }

  function _abrirFabOpcao(categoria) {
    _modoAdd = true;
    _pendingTipo = categoria;
    _fabGps.classList.add('show');
    _mapHint.classList.add('show');
    _mapHint.textContent = categoria === 'lideranca' ? '👤 Toque no mapa para marcar a liderança ou use GPS' : categoria === 'denuncia' ? '🚨 Toque no mapa para marcar a denúncia ou use GPS' : '📍 Toque no mapa ou use o GPS 🛰️';
    WWMX.UI.showToast(_mapHint.textContent);
  }

  function _abrirFormularioPendente() {
    if (_pendingTipo === 'material') _abrirSeletorMaterial();
    else if (_pendingTipo === 'evento') _abrirSeletorEvento();
    else if (_pendingTipo === 'lideranca') _abrirFormularioLideranca();
    else if (_pendingTipo === 'denuncia') _abrirFormularioDenuncia();
    else _abrirSeletorTipoGeral();
  }

  function _cancelarAdd() {
    _modoAdd = false;
    _pendingTipo = null;
    _latLng = null;
    _fabGps.classList.remove('show');
    _mapHint.classList.remove('show');
    if (_tempMarker) { _map.removeLayer(_tempMarker); _tempMarker = null; }
  }

  function _configurarGPS() { document.getElementById('fabGps')?.addEventListener('click', _usarGPS); }
  function _usarGPS() {
    if (!navigator.geolocation) { WWMX.UI.showToast('GPS não suportado neste dispositivo', 'error'); return; }
    _fabGps.classList.add('locating'); _fabGps.textContent = '⏳';
    navigator.geolocation.getCurrentPosition(pos => { _fabGps.classList.remove('locating'); _fabGps.textContent = '🛰️'; _latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude }; _map.setView([_latLng.lat, _latLng.lng], 17); _marcarTemp(_latLng); WWMX.UI.showToast('🛰️ Localização capturada!'); _abrirFormularioPendente(); }, err => { _fabGps.classList.remove('locating'); _fabGps.textContent = '🛰️'; WWMX.UI.showToast('GPS indisponível: ' + (err.code === 1 ? 'permissão negada' : 'timeout'), 'error'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  function _abrirSeletorTipoGeral() {
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">📌 O que deseja registrar?</div><div style="display:flex;flex-direction:column;gap:8px;"><button class="btn btn-secondary" data-acao="material">📦 Material de campanha</button><button class="btn btn-secondary" data-acao="evento">🎯 Evento ou ação</button><button class="btn btn-secondary" data-acao="lideranca">👤 Liderança</button><button class="btn btn-secondary" data-acao="denuncia">🚨 Denúncia</button><button class="btn btn-ghost" data-acao="cancelar">Cancelar</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-acao]').forEach(btn => btn.onclick = () => { const a = btn.dataset.acao; overlay.remove(); if (a === 'cancelar') return _cancelarAdd(); _pendingTipo = a; _abrirFormularioPendente(); });
  }

  function _abrirSeletorMaterial() {
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">📦 Tipo de Material</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${Object.entries(global.TIPO_MATERIAL || {}).map(([k,v]) => `<button class="btn btn-ghost" data-tipo="${k}" style="padding:12px 8px;"><span style="font-size:24px;">${v.icon}</span><br><span style="font-size:12px;">${v.label}</span></button>`).join('')}</div><button class="btn btn-ghost" data-fechar style="width:100%;padding:12px;margin-top:12px;">Cancelar</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tipo]').forEach(btn => btn.onclick = () => { overlay.remove(); _abrirFormularioMaterial(btn.dataset.tipo); });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
  }

  function _abrirSeletorEvento() {
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">🎯 Tipo de Evento/Ação</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${Object.entries(global.TIPO_EVENTO || {}).map(([k,v]) => `<button class="btn btn-ghost" data-tipo="${k}" style="padding:12px 8px;"><span style="font-size:24px;">${v.icon}</span><br><span style="font-size:12px;">${v.label}</span></button>`).join('')}</div><button class="btn btn-ghost" data-fechar style="width:100%;padding:12px;margin-top:12px;">Cancelar</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tipo]').forEach(btn => btn.onclick = () => { overlay.remove(); _abrirFormularioEvento(btn.dataset.tipo); });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
  }

  function _abrirFormularioMaterial(tipo) {
    const cfg = global.TIPO_MATERIAL?.[tipo] || { icon: '📦', label: tipo };
    _fotoBase64 = null;
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">${cfg.icon} Registrar ${cfg.label}</div><div class="field"><label>Local / Referência</label><input id="fNome" placeholder="Ex: Salgado Filho × Farroupilha"></div><div class="field"><label>Quantidade</label><input type="number" id="fQtd" value="1" min="1" max="500" inputmode="numeric"></div><div class="field"><label>Status</label><div class="status-sel"><button class="status-opt s-instalado active" data-status="instalado">✅ Instalado</button><button class="status-opt s-retirado" data-status="retirado">❌ Retirado</button><button class="status-opt s-danificado" data-status="danificado">⚠️ Danificado</button></div></div><div class="field"><label>Observação</label><textarea id="fObs"></textarea></div>${_fotoFieldHtml()}${_coordHtml()}<div style="display:flex;gap:10px;"><button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button><button class="btn btn-primary" data-salvar style="flex:1;">Registrar</button></div></div>`;
    document.body.appendChild(overlay); _bindFoto(overlay);
    let statusSel = 'instalado'; overlay.querySelectorAll('[data-status]').forEach(btn => btn.onclick = () => { overlay.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); statusSel = btn.dataset.status; });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => { const nome = overlay.querySelector('#fNome').value.trim(); if (!nome) return WWMX.UI.showToast('Digite o nome do local', 'error'); _salvarPinMaterial({ tipo, nome, qtd: parseInt(overlay.querySelector('#fQtd').value) || 1, obs: overlay.querySelector('#fObs').value.trim(), status: statusSel }); overlay.remove(); };
  }

  function _abrirFormularioEvento(tipo) {
    const cfg = global.TIPO_EVENTO?.[tipo] || { icon: '🎯', label: tipo };
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">${cfg.icon} ${cfg.label}</div><div class="field"><label>Nome do evento / local</label><input id="evNome" placeholder="Ex: Caminhada Centro"></div><div class="field"><label>Estimativa de pessoas</label><input type="number" id="evPessoas" value="0" min="0" inputmode="numeric"></div><div class="field"><label>Turno</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><button class="status-opt active" data-turno="manha">🌅 Manhã</button><button class="status-opt" data-turno="tarde">☀️ Tarde</button><button class="status-opt" data-turno="noite">🌙 Noite</button></div></div><div class="field"><label>Observação</label><textarea id="evObs"></textarea></div>${_coordHtml()}<div style="display:flex;gap:10px;"><button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button><button class="btn btn-primary" data-salvar style="flex:1;">Registrar</button></div></div>`;
    document.body.appendChild(overlay);
    let turnoSel = 'manha'; overlay.querySelectorAll('[data-turno]').forEach(btn => btn.onclick = () => { overlay.querySelectorAll('[data-turno]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); turnoSel = btn.dataset.turno; });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => { const nome = overlay.querySelector('#evNome').value.trim(); if (!nome) return WWMX.UI.showToast('Digite o nome do evento', 'error'); _salvarPinEvento({ tipo, nome, pessoas: parseInt(overlay.querySelector('#evPessoas').value) || 0, obs: overlay.querySelector('#evObs').value.trim(), turno: turnoSel }); overlay.remove(); };
  }

  function _abrirFormularioLideranca() {
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">👤 Nova Liderança</div><div class="field"><label>Nome completo</label><input id="lNome" placeholder="Nome da liderança"></div><div class="field"><label>WhatsApp</label><input id="lTel" inputmode="tel" placeholder="(51) 99999-9999"></div><div class="field"><label>Bairro / Localidade</label><input id="lBairro" placeholder="Bairro ou região"></div><div class="field"><label>Status</label><select id="lStatus"><option value="confirmado">✅ Confirmado</option><option value="provavel" selected>🟡 Provável</option><option value="indefinido">⬜ Indefinido</option><option value="contra">🔴 Contra</option></select></div><div class="field"><label>Votos declarados / estimados</label><input id="lVotos" type="number" min="0" inputmode="numeric" value="0"></div><div class="field"><label>Observação</label><textarea id="lObs"></textarea></div>${_coordHtml()}<div style="display:flex;gap:10px;"><button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button><button class="btn btn-primary" data-salvar style="flex:1;">Salvar</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => { const nome = overlay.querySelector('#lNome').value.trim(); if (!nome) return WWMX.UI.showToast('Informe o nome da liderança', 'error'); _salvarLideranca({ nome, whatsapp: overlay.querySelector('#lTel').value.trim(), bairro: overlay.querySelector('#lBairro').value.trim(), status: overlay.querySelector('#lStatus').value, votos: parseInt(overlay.querySelector('#lVotos').value) || 0, obs: overlay.querySelector('#lObs').value.trim() }); overlay.remove(); };
  }

  function _abrirFormularioDenuncia() {
    _fotoBase64 = null;
    const overlay = _criarOverlay();
    overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">🚨 Nova Denúncia</div><div class="field"><label>Título / referência</label><input id="dTitulo" placeholder="Ex: Material irregular na esquina"></div><div class="field"><label>Tipo</label><select id="dTipo"><option value="material_irregular">Material irregular</option><option value="ocorrencia">Ocorrência</option><option value="risco">Risco / dano</option><option value="outro">Outro</option></select></div><div class="field"><label>Descrição</label><textarea id="dDesc" placeholder="Descreva o que foi visto"></textarea></div>${_fotoFieldHtml()}${_coordHtml()}<div style="display:flex;gap:10px;"><button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button><button class="btn btn-danger" data-salvar style="flex:1;">Salvar Denúncia</button></div></div>`;
    document.body.appendChild(overlay); _bindFoto(overlay);
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => { const titulo = overlay.querySelector('#dTitulo').value.trim(); if (!titulo) return WWMX.UI.showToast('Informe a referência da denúncia', 'error'); _salvarDenuncia({ titulo, subtipo: overlay.querySelector('#dTipo').value, descricao: overlay.querySelector('#dDesc').value.trim() }); overlay.remove(); };
  }

  function _fotoFieldHtml() { return `<div class="field"><label>Foto</label><div class="photo-upload" id="fotoUploadBtn"><span class="photo-upload-icon" id="fotoIcon">📷</span><span class="photo-upload-text" id="fotoLabel">Tirar foto</span><img id="fotoPreview" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"><input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none;"></div></div>`; }
  function _bindFoto(overlay) { const fotoBtn = overlay.querySelector('#fotoUploadBtn'); const fotoInput = overlay.querySelector('#fotoInput'); if (!fotoBtn || !fotoInput) return; fotoBtn.onclick = () => fotoInput.click(); fotoInput.onchange = e => { const file = e.target.files[0]; if (!file) return; comprimirFoto(file, b64 => { _fotoBase64 = b64; overlay.querySelector('#fotoPreview').src = b64; overlay.querySelector('#fotoPreview').style.display = 'block'; overlay.querySelector('#fotoIcon').textContent = '✅'; overlay.querySelector('#fotoLabel').textContent = 'Foto capturada'; }); }; }
  function _coordHtml() { return `<div style="margin-bottom:12px;padding:10px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;font-size:12px;color:var(--green);">📍 ${_latLng ? `${_latLng.lat.toFixed(5)}, ${_latLng.lng.toFixed(5)}` : 'Localização não capturada'}</div>`; }

  function _salvarPinMaterial({ tipo, nome, qtd, obs, status }) { const session = WWMX.Auth.sessaoAtual(); const pin = { id: Date.now().toString(), tipo, nome, qtd, obs: obs || '', status: status || 'instalado', foto: _fotoBase64 || null, lat: _latLng?.lat || 0, lng: _latLng?.lng || 0, autor: session.nome, autorUid: session.uid, ts: Date.now() }; WWMX.db.set(`campanhas/${_campanhaId}/pins/${pin.id}`, pin); WWMX.XP?.invalidarCache?.(); WWMX.UI.showToast(`✅ ${global.TIPO_MATERIAL?.[tipo]?.label || tipo} registrado!`, 'success'); _cancelarAdd(); _fotoBase64 = null; }
  function _salvarPinEvento({ tipo, nome, pessoas, obs, turno }) { const session = WWMX.Auth.sessaoAtual(); const pin = { id: Date.now().toString(), tipo, nome, pessoas: pessoas || 0, obs: obs || '', turno, lat: _latLng?.lat || 0, lng: _latLng?.lng || 0, autor: session.nome, autorUid: session.uid, ts: Date.now() }; WWMX.db.set(`campanhas/${_campanhaId}/pins/${pin.id}`, pin); WWMX.XP?.invalidarCache?.(); WWMX.UI.showToast(`✅ ${global.TIPO_EVENTO?.[tipo]?.label || tipo} registrado!`, 'success'); _cancelarAdd(); }
  function _salvarLideranca(data) { const session = WWMX.Auth.sessaoAtual(); const id = `lid_${Date.now()}`; const lider = { id, ...data, lat: _latLng?.lat || 0, lng: _latLng?.lng || 0, autor: session.nome, autorUid: session.uid, ts: Date.now(), interacoes: [] }; WWMX.db.set(`campanhas/${_campanhaId}/crm_liderancas/${id}`, lider); WWMX.XP?.invalidarCache?.(); WWMX.UI.showToast('✅ Liderança cadastrada!', 'success'); _cancelarAdd(); }
  function _salvarDenuncia(data) { const session = WWMX.Auth.sessaoAtual(); const id = `den_${Date.now()}`; const denuncia = { id, ...data, tipo: 'denuncia', status: 'aberto', foto: _fotoBase64 || null, lat: _latLng?.lat || 0, lng: _latLng?.lng || 0, autor: session.nome, autorUid: session.uid, ts: Date.now() }; WWMX.db.set(`campanhas/${_campanhaId}/denuncias/${id}`, denuncia); WWMX.XP?.invalidarCache?.(); WWMX.UI.showToast('✅ Denúncia registrada!', 'success'); _cancelarAdd(); _fotoBase64 = null; }

  function _criarOverlay() { const overlay = document.createElement('div'); overlay.className = 'modal-overlay show'; overlay.style.alignItems = 'flex-end'; return overlay; }
  function _esc(v) { return String(v || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

  global.mapaInit = init;
  global.mapaDestroy = destroy;
})(window);
