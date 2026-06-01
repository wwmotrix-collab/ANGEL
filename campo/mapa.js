/**
 * campo/mapa.js
 * WWMX Campaign — Mapa para militante de campo
 *
 * FIX aplicados vs versão Deepseek:
 *  1. prompt() substituído por modais HTML reais (bloqueavam mobile)
 *  2. _configurarFAB() movido para depois do DOM existir
 *  3. Formulário de material com foto + GPS + status
 *  4. Formulário de evento com turno + estimativa de pessoas
 *  5. comprimirFoto() integrado (definido em index.html)
 *  6. WWMX.mapaInstance exposto para o botão 🎯 da header
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _map        = null;
  let _markers    = {};
  let _modoAdd    = false;
  let _tempMarker = null;
  let _fabAberto  = false;
  let _pendingTipo = null;
  let _latLng      = null;
  let _unsubPins   = null;

  // Elementos DOM
  let _fabBtn, _fabMenu, _fabOverlay, _fabGps, _mapHint;

  // ─────────────────────────────────────────────────────────
  // INIT / DESTROY
  // ─────────────────────────────────────────────────────────
  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizarContainer();
    _configurarFAB();      // depois do _renderizarContainer
    _configurarGPS();
    _iniciarMapa();
    _inscreverPins();
  }

  function destroy() {
    if (_unsubPins) _unsubPins();
    if (_map) { _map.remove(); _map = null; }
    global.WWMX.mapaInstance = null;
  }

  // ─────────────────────────────────────────────────────────
  // HTML DO CONTAINER
  // ─────────────────────────────────────────────────────────
  function _renderizarContainer() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.style.position = 'relative';
    container.style.height   = '100%';
    container.style.overflow = 'hidden';
    container.innerHTML = `
      <div id="map" style="height:100%;width:100%;"></div>
      <div class="map-hint" id="mapHint">📍 Toque no mapa para adicionar</div>
      <button class="fab-gps" id="fabGps">🛰️</button>
      <div class="fab-overlay" id="fabOverlay"></div>
      <div class="fab-menu" id="fabMenu">
        <div class="fab-item" data-tipo="denuncia">
          <span class="fab-item-label">🚨 Denúncia</span>
          <button class="fab-item-btn" style="background:#ef4444;">🚨</button>
        </div>
        <div class="fab-item" data-tipo="evento">
          <span class="fab-item-label">🎯 Evento</span>
          <button class="fab-item-btn" style="background:#8b5cf6;">🎯</button>
        </div>
        <div class="fab-item" data-tipo="material">
          <span class="fab-item-label">📦 Material</span>
          <button class="fab-item-btn" style="background:var(--accent);">📦</button>
        </div>
        <div class="fab-item" data-tipo="lideranca">
          <span class="fab-item-label">👤 Liderança</span>
          <button class="fab-item-btn" style="background:#22c55e;">👤</button>
        </div>
      </div>
      <button class="fab" id="fabBtn">+</button>
    `;
  }

  // ─────────────────────────────────────────────────────────
  // MAPA LEAFLET
  // ─────────────────────────────────────────────────────────
  function _iniciarMapa() {
    const cfg = global.WWMX?.Config?.DEFAULT_CONFIG;
    _map = L.map('map', { center: [-30.0807, -51.0258], zoom: 14, zoomControl: false });
    L.tileLayer(cfg?.mapaTileDark || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: cfg?.mapaAttribution || '&copy; OpenStreetMap contributors',
    }).addTo(_map);
    L.control.zoom({ position: 'bottomleft' }).addTo(_map);
    _map.on('click', _onMapClick);
    // Expõe instância para o botão 🎯 da header
    global.WWMX.mapaInstance = _map;
  }

  function _onMapClick(e) {
    if (!_modoAdd) return;
    _latLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (_tempMarker) _map.removeLayer(_tempMarker);
    _tempMarker = L.circleMarker([_latLng.lat, _latLng.lng], {
      radius: 10, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2,
    }).addTo(_map);
    if (_pendingTipo === 'material') _abrirSeletorMaterial();
    else if (_pendingTipo === 'evento') _abrirSeletorEvento();
    else _abrirSeletorTipoGeral();
  }

  // ─────────────────────────────────────────────────────────
  // PINS DO MILITANTE
  // ─────────────────────────────────────────────────────────
  function _inscreverPins() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    _unsubPins = WWMX.db.on(`campanhas/${_campanhaId}/pins`, snap => {
      const todos = snap.val() || {};
      const meus  = Object.values(todos).filter(
        p => p.autorUid === session.uid || p.autor === session.nome
      );
      _renderizarMarcadores(meus);
    });
  }

  function _renderizarMarcadores(pins) {
    Object.values(_markers).forEach(m => _map.removeLayer(m));
    _markers = {};
    pins.forEach(pin => {
      if (!pin.lat || !pin.lng) return;
      const cfg  = global.TIPO_CONFIG?.[pin.tipo] || { icon: '📍', cor: '#3b82f6', label: pin.tipo };
      const html = `<div style="width:32px;height:32px;border-radius:50%;background:${cfg.cor};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${cfg.icon}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(_map)
        .bindPopup(_buildPopup(pin));
      _markers[pin.id] = marker;
    });
  }

  function _buildPopup(pin) {
    const cfg  = global.TIPO_CONFIG?.[pin.tipo] || { label: pin.tipo, cor: '#888' };
    const data = formatDate(pin.ts);
    const statusCor = { instalado: '#22c55e', retirado: '#ef4444', danificado: '#f59e0b' }[pin.status] || '#888';
    return `
      <div class="popup-wrap">
        <div class="popup-status-bar" style="background:${statusCor};"></div>
        <div class="popup-name">${pin.nome}</div>
        <div class="popup-meta">${cfg.label} · ${data}</div>
        ${pin.qtd    ? `<div class="popup-row">📦 <span>${pin.qtd} unidades</span></div>` : ''}
        ${pin.status ? `<div class="popup-row"><span class="status-pill s-${pin.status}">${pin.status}</span></div>` : ''}
        ${pin.obs    ? `<div class="popup-row" style="font-size:12px;color:var(--muted);">${pin.obs}</div>` : ''}
        ${pin.foto   ? `<img class="popup-photo" src="${pin.foto}" onclick="abrirLightbox(this.src);event.stopPropagation();">` : ''}
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────
  // FAB SPEED-DIAL
  // ─────────────────────────────────────────────────────────
  function _configurarFAB() {
    _fabBtn     = document.getElementById('fabBtn');
    _fabMenu    = document.getElementById('fabMenu');
    _fabOverlay = document.getElementById('fabOverlay');
    _fabGps     = document.getElementById('fabGps');
    _mapHint    = document.getElementById('mapHint');

    _fabBtn.addEventListener('click', _toggleFab);
    _fabOverlay.addEventListener('click', _fecharFab);

    document.querySelectorAll('.fab-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        _fecharFab();
        _abrirFabOpcao(item.dataset.tipo);
      });
    });
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
    if (categoria === 'denuncia') {
      global.dispatchEvent(new CustomEvent('wwmx:abrir-denuncia'));
      return;
    }
    if (categoria === 'lideranca') {
      global.dispatchEvent(new CustomEvent('wwmx:abrir-lideranca'));
      return;
    }
    _modoAdd      = true;
    _pendingTipo  = categoria;
    _fabGps.classList.add('show');
    _mapHint.classList.add('show');
    _mapHint.textContent = '📍 Toque no mapa ou use o GPS 🛰️';
    WWMX.UI.showToast('Toque no mapa para marcar o local');
  }

  function _cancelarAdd() {
    _modoAdd = false;
    _pendingTipo = null;
    _latLng = null;
    _fabGps.classList.remove('show');
    _mapHint.classList.remove('show');
    if (_tempMarker) { _map.removeLayer(_tempMarker); _tempMarker = null; }
  }

  // ─────────────────────────────────────────────────────────
  // GPS
  // ─────────────────────────────────────────────────────────
  function _configurarGPS() {
    document.getElementById('fabGps')?.addEventListener('click', _usarGPS);
  }

  function _usarGPS() {
    if (!navigator.geolocation) {
      WWMX.UI.showToast('GPS não suportado neste dispositivo', 'error');
      return;
    }
    _fabGps.classList.add('locating');
    _fabGps.textContent = '⏳';
    navigator.geolocation.getCurrentPosition(
      pos => {
        _fabGps.classList.remove('locating');
        _fabGps.textContent = '🛰️';
        _latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _map.setView([_latLng.lat, _latLng.lng], 17);
        if (_tempMarker) _map.removeLayer(_tempMarker);
        _tempMarker = L.circleMarker([_latLng.lat, _latLng.lng], {
          radius: 12, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2,
        }).addTo(_map);
        WWMX.UI.showToast('🛰️ Localização capturada!');
        if (_pendingTipo === 'material')     _abrirSeletorMaterial();
        else if (_pendingTipo === 'evento')  _abrirSeletorEvento();
        else                                 _abrirSeletorTipoGeral();
      },
      err => {
        _fabGps.classList.remove('locating');
        _fabGps.textContent = '🛰️';
        WWMX.UI.showToast('GPS indisponível: ' + (err.code === 1 ? 'permissão negada' : 'timeout'), 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // SELETORES DE TIPO
  // ─────────────────────────────────────────────────────────
  function _abrirSeletorTipoGeral() {
    const overlay = _criarOverlay();
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">📌 O que deseja registrar?</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-secondary" data-acao="material" style="padding:14px;font-size:15px;">📦 Material de campanha</button>
          <button class="btn btn-secondary" data-acao="evento"   style="padding:14px;font-size:15px;">🎯 Evento ou ação</button>
          <button class="btn btn-ghost"     data-acao="cancelar" style="padding:12px;">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-acao="material"]').onclick  = () => { overlay.remove(); _abrirSeletorMaterial(); };
    overlay.querySelector('[data-acao="evento"]').onclick    = () => { overlay.remove(); _abrirSeletorEvento(); };
    overlay.querySelector('[data-acao="cancelar"]').onclick  = () => { overlay.remove(); _cancelarAdd(); };
  }

  function _abrirSeletorMaterial() {
    const overlay = _criarOverlay();
    const tipos   = global.TIPO_MATERIAL || {};
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">📦 Tipo de material</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          ${Object.entries(tipos).map(([k, v]) => `
            <button class="btn btn-secondary" data-tipo="${k}"
              style="flex-direction:column;gap:6px;padding:14px;height:72px;">
              <span style="font-size:24px;">${v.icon}</span>
              <span style="font-size:12px;">${v.label}</span>
            </button>
          `).join('')}
        </div>
        <button class="btn btn-ghost" data-fechar style="width:100%;padding:12px;">Cancelar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tipo]').forEach(btn => {
      btn.onclick = () => { overlay.remove(); _abrirFormularioMaterial(btn.dataset.tipo); };
    });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
  }

  function _abrirSeletorEvento() {
    const overlay = _criarOverlay();
    const tipos   = global.TIPO_EVENTO || {};
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">🎯 Tipo de evento</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          ${Object.entries(tipos).map(([k, v]) => `
            <button class="btn btn-secondary" data-tipo="${k}"
              style="flex-direction:column;gap:6px;padding:14px;height:72px;">
              <span style="font-size:24px;">${v.icon}</span>
              <span style="font-size:12px;">${v.label}</span>
            </button>
          `).join('')}
        </div>
        <button class="btn btn-ghost" data-fechar style="width:100%;padding:12px;">Cancelar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tipo]').forEach(btn => {
      btn.onclick = () => { overlay.remove(); _abrirFormularioEvento(btn.dataset.tipo); };
    });
    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
  }

  // ─────────────────────────────────────────────────────────
  // FORMULÁRIO DE MATERIAL (substitui prompt())
  // ─────────────────────────────────────────────────────────
  let _fotoBase64 = null;

  function _abrirFormularioMaterial(tipo) {
    const cfg = global.TIPO_MATERIAL?.[tipo] || { icon: '📦', label: tipo };
    _fotoBase64 = null;
    const overlay = _criarOverlay();
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">${cfg.icon} Registrar ${cfg.label}</div>

        <div class="field">
          <label>Local / Referência</label>
          <input type="text" id="fNome" placeholder="Ex: Salgado Filho × Farroupilha" autocomplete="off">
        </div>

        <div class="field">
          <label>Quantidade</label>
          <input type="number" id="fQtd" value="1" min="1" max="500" inputmode="numeric">
        </div>

        <div class="field">
          <label>Status</label>
          <div class="status-sel">
            <button class="status-opt s-instalado active" data-status="instalado">✅ Instalado</button>
            <button class="status-opt s-retirado"         data-status="retirado" >❌ Retirado</button>
            <button class="status-opt s-danificado"       data-status="danificado">⚠️ Danificado</button>
          </div>
        </div>

        <div class="field">
          <label>Observação <span style="color:var(--muted);font-size:10px;">(opcional)</span></label>
          <textarea id="fObs" rows="2" placeholder="Canteiro, semáforo, referência..."></textarea>
        </div>

        <div class="field">
          <label>Foto <span style="color:var(--muted);font-size:10px;">(opcional)</span></label>
          <div class="photo-upload" id="fotoUploadBtn">
            <span class="photo-upload-icon" id="fotoIcon">📷</span>
            <span class="photo-upload-text" id="fotoLabel">Tirar foto</span>
            <img id="fotoPreview" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;">
            <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none;">
          </div>
        </div>

        <div id="coordDisplay" style="margin-bottom:12px;padding:10px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;font-size:12px;color:var(--green);">
          📍 ${_latLng ? `${_latLng.lat.toFixed(5)}, ${_latLng.lng.toFixed(5)}` : 'Localização não capturada'}
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button>
          <button class="btn btn-primary" data-salvar style="flex:1;">Registrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Status selector
    let statusSel = 'instalado';
    overlay.querySelectorAll('[data-status]').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statusSel = btn.dataset.status;
      };
    });

    // Foto
    const fotoBtn   = overlay.querySelector('#fotoUploadBtn');
    const fotoInput = overlay.querySelector('#fotoInput');
    fotoBtn.onclick = () => fotoInput.click();
    fotoInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      comprimirFoto(file, b64 => {
        _fotoBase64 = b64;
        overlay.querySelector('#fotoPreview').src     = b64;
        overlay.querySelector('#fotoPreview').style.display = 'block';
        overlay.querySelector('#fotoIcon').textContent  = '✅';
        overlay.querySelector('#fotoLabel').textContent = 'Foto capturada';
      });
    };

    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => {
      const nome = overlay.querySelector('#fNome').value.trim();
      if (!nome) { WWMX.UI.showToast('Digite o nome do local', 'error'); return; }
      const qtd = parseInt(overlay.querySelector('#fQtd').value) || 1;
      const obs = overlay.querySelector('#fObs').value.trim();
      _salvarPinMaterial({ tipo, nome, qtd, obs, status: statusSel });
      overlay.remove();
    };
  }

  // ─────────────────────────────────────────────────────────
  // FORMULÁRIO DE EVENTO (substitui prompt())
  // ─────────────────────────────────────────────────────────
  function _abrirFormularioEvento(tipo) {
    const cfg = global.TIPO_EVENTO?.[tipo] || { icon: '🎯', label: tipo };
    const overlay = _criarOverlay();
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">${cfg.icon} ${cfg.label}</div>

        <div class="field">
          <label>Nome do evento / local</label>
          <input type="text" id="evNome" placeholder="Ex: Caminhada Centro" autocomplete="off">
        </div>

        <div class="field">
          <label>Estimativa de pessoas</label>
          <input type="number" id="evPessoas" value="0" min="0" inputmode="numeric">
        </div>

        <div class="field">
          <label>Turno</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <button class="status-opt active" data-turno="manha">🌅 Manhã</button>
            <button class="status-opt"        data-turno="tarde">☀️ Tarde</button>
            <button class="status-opt"        data-turno="noite">🌙 Noite</button>
          </div>
        </div>

        <div class="field">
          <label>Observação <span style="color:var(--muted);font-size:10px;">(opcional)</span></label>
          <textarea id="evObs" rows="2"></textarea>
        </div>

        <div id="evCoordDisplay" style="margin-bottom:12px;padding:10px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;font-size:12px;color:var(--green);">
          📍 ${_latLng ? `${_latLng.lat.toFixed(5)}, ${_latLng.lng.toFixed(5)}` : 'Localização não capturada'}
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" data-fechar style="flex:0 0 auto;padding:14px 20px;">Cancelar</button>
          <button class="btn btn-primary" data-salvar style="flex:1;">Registrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let turnoSel = 'manha';
    overlay.querySelectorAll('[data-turno]').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('[data-turno]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        turnoSel = btn.dataset.turno;
      };
    });

    overlay.querySelector('[data-fechar]').onclick = () => { overlay.remove(); _cancelarAdd(); };
    overlay.querySelector('[data-salvar]').onclick = () => {
      const nome = overlay.querySelector('#evNome').value.trim();
      if (!nome) { WWMX.UI.showToast('Digite o nome do evento', 'error'); return; }
      const pessoas = parseInt(overlay.querySelector('#evPessoas').value) || 0;
      const obs     = overlay.querySelector('#evObs').value.trim();
      _salvarPinEvento({ tipo, nome, pessoas, obs, turno: turnoSel });
      overlay.remove();
    };
  }

  // ─────────────────────────────────────────────────────────
  // SALVAR PINS NO FIREBASE
  // ─────────────────────────────────────────────────────────
  function _salvarPinMaterial({ tipo, nome, qtd, obs, status }) {
    const session = WWMX.Auth.sessaoAtual();
    const pin = {
      id:       Date.now().toString(),
      tipo,
      nome,
      qtd,
      obs:      obs || '',
      status:   status || 'instalado',
      foto:     _fotoBase64 || null,
      lat:      _latLng?.lat || 0,
      lng:      _latLng?.lng || 0,
      autor:    session.nome,
      autorUid: session.uid,
      ts:       Date.now(),
    };
    WWMX.db.set(`campanhas/${_campanhaId}/pins/${pin.id}`, pin);
    WWMX.XP?.invalidarCache?.();
    WWMX.UI.showToast(`✅ ${global.TIPO_MATERIAL?.[tipo]?.label || tipo} registrado!`, 'success');
    _cancelarAdd();
    _fotoBase64 = null;
  }

  function _salvarPinEvento({ tipo, nome, pessoas, obs, turno }) {
    const session = WWMX.Auth.sessaoAtual();
    const pin = {
      id:       Date.now().toString(),
      tipo,
      nome,
      pessoas:  pessoas || 0,
      obs:      obs || '',
      turno,
      lat:      _latLng?.lat || 0,
      lng:      _latLng?.lng || 0,
      autor:    session.nome,
      autorUid: session.uid,
      ts:       Date.now(),
    };
    WWMX.db.set(`campanhas/${_campanhaId}/pins/${pin.id}`, pin);
    WWMX.XP?.invalidarCache?.();
    WWMX.UI.showToast(`✅ ${global.TIPO_EVENTO?.[tipo]?.label || tipo} registrado!`, 'success');
    _cancelarAdd();
  }

  // ─────────────────────────────────────────────────────────
  // HELPER — criar overlay modal
  // ─────────────────────────────────────────────────────────
  function _criarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.alignItems = 'flex-end';
    return overlay;
  }

  // ─────────────────────────────────────────────────────────
  // EXPORTS
  // ─────────────────────────────────────────────────────────
  global.mapaInit    = init;
  global.mapaDestroy = destroy;

})(window);
