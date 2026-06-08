/**
 * campo/mapa.js
 * WWMX Campaign — Mapa para coordenador/campo
 * Mantém registro de pins e adiciona camada de operação territorial.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _map        = null;
  let _markers    = {};
  let _opMarkers  = {};
  let _modoAdd    = false;
  let _tempMarker = null;
  let _fabAberto  = false;
  let _pendingTipo = null;
  let _latLng      = null;
  let _unsubPins   = null;
  let _unsubOperacao = null;
  let _locaisOperacao = [];
  let _operacao = {};
  let _territorio = { uf:'RS', municipio:'Viamão', slug:'viamao' };

  // Elementos DOM
  let _fabBtn, _fabMenu, _fabOverlay, _fabGps, _mapHint;

  // ─────────────────────────────────────────────────────────
  // INIT / DESTROY
  // ─────────────────────────────────────────────────────────
  function init(campanhaId) {
    _campanhaId = campanhaId;
    _detectarTerritorio();
    _renderizarContainer();
    _configurarFAB();
    _configurarGPS();
    _iniciarMapa();
    _carregarLocaisOperacao();
    _inscreverPins();
    _inscreverOperacao();
  }

  function destroy() {
    if (_unsubPins) _unsubPins();
    if (_unsubOperacao) _unsubOperacao();
    if (_map) { _map.remove(); _map = null; }
    global.WWMX.mapaInstance = null;
  }

  function _detectarTerritorio(){
    const qs = new URLSearchParams(location.search);
    const uf = qs.get('uf') || localStorage.getItem('wwmx_uf') || 'RS';
    const municipio = qs.get('municipio') || localStorage.getItem('wwmx_municipio') || 'Viamão';
    _territorio = { uf, municipio, slug: _slug(municipio) };
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
      <div class="coord-op-legend">
        <strong>Operação</strong>
        <span><i class="lg alta"></i> Alta</span>
        <span><i class="lg media"></i> Média</span>
        <span><i class="lg baixa"></i> Baixa</span>
        <span><i class="lg sem"></i> Sem prioridade</span>
      </div>
      <button class="fab-gps" id="fabGps">🛰️</button>
      <button class="fab-locais" id="fabLocais">🎯</button>
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
    _styleOperacao();
    document.getElementById('fabLocais').onclick = _centralizarOperacao;
  }

  // ─────────────────────────────────────────────────────────
  // MAPA LEAFLET
  // ─────────────────────────────────────────────────────────
  function _iniciarMapa() {
    const cfg = global.WWMX?.Config?.DEFAULT_CONFIG;
    _map = L.map('map', { center: [-30.0807, -51.0258], zoom: 14, zoomControl: false });
    L.tileLayer(cfg?.mapaTileDark || cfg?.mapaTileLayer || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: cfg?.mapaAttribution || '&copy; OpenStreetMap contributors',
    }).addTo(_map);
    L.control.zoom({ position: 'bottomleft' }).addTo(_map);
    _map.on('click', _onMapClick);
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
  // CAMADA OPERACIONAL — reflete a aba Operação Territorial
  // ─────────────────────────────────────────────────────────
  async function _carregarLocaisOperacao(){
    const caminhos = [
      `territorios/${_territorio.uf}/${_territorio.slug}/locais_votacao`,
      'locais_votacao',
      `campanhas/${_campanhaId}/territorio/locais_votacao`
    ];
    const resultados = [];
    for (const path of caminhos) {
      const data = await _dbVal(path);
      resultados.push({ path, data:data || {}, count:_contar(data) });
    }
    resultados.sort((a,b)=>b.count-a.count);
    _locaisOperacao = _normalizarLocais(resultados[0]?.data || {});
    _renderizarOperacaoTerritorial();
  }

  function _inscreverOperacao(){
    _unsubOperacao = WWMX.db.on(`campanhas/${_campanhaId}/operacao/locais`, snap => {
      _operacao = snap.val() || {};
      _renderizarOperacaoTerritorial();
    });
  }

  function _renderizarOperacaoTerritorial(){
    if (!_map || !_locaisOperacao.length) return;
    Object.values(_opMarkers).forEach(m => _map.removeLayer(m));
    _opMarkers = {};
    _locaisOperacao.forEach(local => {
      if (!_temGeo(local)) return;
      const op = _operacao[local.id] || {};
      const visual = _visualOperacao(op);
      const marker = L.circleMarker([local.lat, local.lng], {
        radius: visual.radius,
        color: visual.border,
        fillColor: visual.fill,
        fillOpacity: .62,
        weight: visual.weight
      }).addTo(_map).bindPopup(_popupOperacao(local, op));
      _opMarkers[local.id] = marker;
    });
  }

  function _popupOperacao(local, op){
    return `
      <div class="popup-wrap" style="min-width:210px">
        <div class="popup-name">${_esc(local.nome)}</div>
        <div class="popup-meta">Zona ${_esc(local.zona)} · Seções ${_esc(local.secoes)}</div>
        <div>👥 ${_eleitoresLabel(local)}</div>
        <hr>
        <div>Prioridade: <strong>${_esc(op.prioridade || 'Sem prioridade')}</strong></div>
        <div>Status: <strong>${_esc(op.status || 'Pendente')}</strong></div>
        <div>Responsável: ${_esc(op.responsavel || '—')}</div>
        <div>Meta: ${_fmt(op.metaVotos || 0)} votos</div>
        ${op.acao ? `<div>Ação: ${_esc(op.acao)}</div>` : ''}
      </div>
    `;
  }

  function _visualOperacao(op){
    const p = op?.prioridade || '';
    const s = op?.status || 'Pendente';
    let fill = '#64748b', radius = 8;
    if (p === 'Alta') { fill = '#ef4444'; radius = 16; }
    else if (p === 'Média') { fill = '#f59e0b'; radius = 13; }
    else if (p === 'Baixa') { fill = '#22c55e'; radius = 10; }
    let border = '#ffffff', weight = 2;
    if (s === 'Concluído') { border = '#22c55e'; weight = 4; }
    else if (s === 'Em andamento') { border = '#3b82f6'; weight = 4; }
    else if (s === 'Bloqueado') { border = '#ef4444'; weight = 5; }
    return { fill, radius, border, weight };
  }

  function _centralizarOperacao(){
    if (!_map) return;
    const validos = _locaisOperacao.filter(_temGeo);
    if (!validos.length) return;
    const bounds = L.latLngBounds(validos.map(l=>[l.lat,l.lng]));
    _map.fitBounds(bounds, { padding:[28,28], maxZoom:14 });
  }

  async function _dbVal(path){
    if (global.WWMX?.db?.val) return await WWMX.db.val(path) || {};
    if (global.WWMX?.db?.get) {
      const snap = await WWMX.db.get(path);
      return snap && typeof snap.val === 'function' ? (snap.val() || {}) : (snap || {});
    }
    return {};
  }

  function _normalizarLocais(data){
    return Array.isArray(data) ? data.map((v,i)=>_normLocal(v, v.id || String(i))) : Object.entries(data||{}).map(([id,v])=>_normLocal(v||{}, id));
  }

  function _normLocal(v,id){
    const coords = _normalizarCoordenadas(_pick(v,['lat','latitude'],''), _pick(v,['lng','lon','longitude'],''));
    const eleitores = Number(_pick(v,['eleitores','el','qt_eleitores'],''));
    return {
      id,
      nome:_pick(v,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome'),
      zona:_pick(v,['zona','ze'],'—'),
      secoes:_pick(v,['secoes','secao','ns'],'—'),
      eleitores:Number.isFinite(eleitores)&&eleitores>0?eleitores:null,
      lat:coords.lat,
      lng:coords.lng
    };
  }

  function _temGeo(l){ return Number.isFinite(l.lat) && Number.isFinite(l.lng) && _dentroDoTerritorio(l.lat,l.lng); }
  function _parseCoord(v){ const n=Number(String(v??'').trim().replace(',','.')); return Number.isFinite(n)?n:NaN; }
  function _normalizarCoordenadas(rawLat,rawLng){
    const lat=_parseCoord(rawLat), lng=_parseCoord(rawLng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return {lat:null,lng:null};
    const cand=[{lat,lng},{lat:lng,lng:lat},{lat:-Math.abs(lat),lng:-Math.abs(lng)},{lat:-Math.abs(lng),lng:-Math.abs(lat)}];
    return cand.find(c=>_dentroDoTerritorio(c.lat,c.lng)) || {lat:null,lng:null};
  }
  function _dentroDoTerritorio(lat,lng){
    if(_territorio.uf==='RS'&&_territorio.slug==='viamao') return lat>=-30.35&&lat<=-29.75&&lng>=-51.35&&lng<=-50.65;
    if(_territorio.uf==='RS') return lat>=-34.1&&lat<=-27.0&&lng>=-58.9&&lng<=-49.0;
    return lat>=-34.5&&lat<=5.5&&lng>=-74.5&&lng<=-32.0;
  }
  function _pick(obj,keys,fallback=''){ for(const k of keys){ if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=='') return obj[k]; } return fallback; }
  function _contar(data){ if(!data) return 0; if(Array.isArray(data)) return data.length; if(typeof data==='object') return Object.keys(data).length; return 0; }
  function _eleitoresLabel(l){ return l.eleitores ? `${_fmt(l.eleitores)} eleitores` : 'eleitores pendentes'; }
  function _fmt(v){ const n=Number(v||0); return Number.isFinite(n)?n.toLocaleString('pt-BR'):'0'; }
  function _slug(value){ return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'territorio'; }
  function _esc(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function _styleOperacao(){
    if(document.getElementById('coordOperacaoMapaStyle')) return;
    const s=document.createElement('style');
    s.id='coordOperacaoMapaStyle';
    s.textContent=`
      .coord-op-legend{position:absolute;left:12px;bottom:16px;z-index:400;background:rgba(15,23,42,.92);color:#f8fafc;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:9px 11px;display:flex;flex-direction:column;gap:4px;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
      .coord-op-legend strong{font-size:12px;margin-bottom:2px}.coord-op-legend span{display:flex;align-items:center;gap:6px}.coord-op-legend .lg{width:9px;height:9px;border-radius:999px;display:inline-block}.coord-op-legend .alta{background:#ef4444}.coord-op-legend .media{background:#f59e0b}.coord-op-legend .baixa{background:#22c55e}.coord-op-legend .sem{background:#64748b}
      .fab-locais{position:absolute;right:16px;bottom:84px;width:48px;height:48px;border-radius:999px;border:0;background:#1f2937;color:white;font-size:20px;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:420}
      @media(max-width:760px){.coord-op-legend{left:10px;right:auto;bottom:74px}.fab-locais{right:16px;bottom:142px}}
    `;
    document.head.appendChild(s);
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

    let statusSel = 'instalado';
    overlay.querySelectorAll('[data-status]').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statusSel = btn.dataset.status;
      };
    });

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
