/**
 * coordenador/rotas.js
 * WWMX Campaign — Planejamento de rotas com mapa clicável + OSRM/OSM.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsubRotas = null;
  let _unsubMilitantes = null;
  let _pontos = [];
  let _routeGeometry = [];
  let _polylineTemp = null;
  let _markersTemp = [];
  let _modoRota = false;
  let _map = null;
  let _routeTimer = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsubRotas) _unsubRotas();
    if (_unsubMilitantes) _unsubMilitantes();
    _desativarModoRota();
    if (_map) { _map.remove(); _map = null; }
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view" style="padding-bottom:110px;">
        <div id="rotasStats" style="margin-bottom:16px;"></div>
        <button id="btnNovaRota" class="btn btn-primary" style="width:100%;margin-bottom:12px;">+ Planejar Rota no Mapa</button>
        <div id="rotaPlanner" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px;margin-bottom:12px;">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;margin-bottom:10px;">Nova Rota</div>
          <div class="field"><label>Nome da rota</label><input id="rotaNome" placeholder="Ex: Centro Sul - Manhã"></div>
          <div class="field"><label>Tipo</label><select id="rotaTipo"><option value="carrosom">📢 Carro de Som</option><option value="caminhada">🚶 Caminhada</option><option value="panfletagem">📄 Panfletagem</option><option value="portaaporta">🏠 Porta a Porta</option></select></div>
          <div class="field"><label>Atribuir a</label><select id="rotaMotorista"></select></div>
          <div class="field"><label>Pontos da rota</label><div id="rotaPontosInfo" style="background:var(--surface2);border-radius:8px;padding:10px;min-height:44px;line-height:1.45;">Clique no mapa para adicionar pontos.</div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;"><button id="btnLimparPontos" class="btn btn-ghost">Limpar pontos</button><button id="btnCancelarRota" class="btn btn-ghost">Cancelar</button><button id="btnSalvarRota" class="btn btn-primary" style="grid-column:1/-1;">Salvar Rota</button></div>
        </div>
        <div id="rotasMap" style="height:390px;border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:16px;background:#101318;"></div>
        <div style="font-size:11px;color:var(--muted);margin:-8px 0 14px;">Clique no mapa para adicionar pontos. Com 2+ pontos, o OSRM ajusta a rota às vias do OpenStreetMap.</div>
        <div class="section-title">Rotas Planejadas</div>
        <div id="rotasList" class="banner-list"></div>
      </div>
    `;
    document.getElementById('btnNovaRota').onclick = _ativarModoRota;
    document.getElementById('btnCancelarRota').onclick = _desativarModoRota;
    document.getElementById('btnSalvarRota').onclick = _salvarRota;
    document.getElementById('btnLimparPontos').onclick = _limparPontos;
    _inicializarMapa();
  }

  function _inicializarMapa() {
    if (!global.L) { document.getElementById('rotasMap').innerHTML = '<div class="empty">Leaflet não carregado</div>'; return; }
    if (_map) return;
    const centro = [-30.0807, -51.0258];
    _map = L.map('rotasMap', { zoomControl: true }).setView(centro, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap · OSRM' }).addTo(_map);
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => { const userPos = [pos.coords.latitude, pos.coords.longitude]; _map.setView(userPos, 14); L.circleMarker(userPos, { radius: 6 }).addTo(_map).bindPopup('Você está aqui'); }, () => {});
    setTimeout(() => _map.invalidateSize(), 250);
  }

  function _assinar() {
    _unsubRotas = WWMX.db.on(`campanhas/${_campanhaId}/rotas`, (snap) => { const rotas = Object.values(snap.val() || {}); _renderizarLista(rotas); _renderizarStats(rotas); _renderizarRotasNoMapa(rotas); });
    _unsubMilitantes = WWMX.db.on(`campanhas/${_campanhaId}/militantes`, (snap) => { const mils = Object.values(snap.val() || {}).filter(m => m.nivel === 'campo'); const select = document.getElementById('rotaMotorista'); if (select) select.innerHTML = '<option value="">Selecione...</option>' + mils.map(m => `<option value="${m.uid}">${_esc(m.nome || 'Sem nome')}</option>`).join(''); });
  }

  function _renderizarLista(rotas) {
    const lista = document.getElementById('rotasList');
    if (!lista) return;
    if (!rotas.length) { lista.innerHTML = '<div class="empty">Nenhuma rota criada</div>'; return; }
    lista.innerHTML = rotas.sort((a,b) => (b.ts || 0) - (a.ts || 0)).map(r => `<div class="banner-item"><div style="font-size:24px;">${_iconTipo(r.tipo)}</div><div class="banner-info"><div class="banner-name">${_esc(r.nome || r.titulo || 'Rota sem nome')}</div><div class="banner-meta">${Number(r.km || 0).toFixed(1)} km · ${(r.pontos || []).length} pontos · ${_esc(r.motoristaNome || r.responsavel || 'sem responsável')}</div></div><div style="display:flex;gap:6px;"><button onclick="window.dispatchEvent(new CustomEvent('wwmx:focar-rota', { detail: { rotaId: '${r.id}' } }))" class="btn btn-ghost" style="padding:6px;">🗺️</button><button onclick="window.dispatchEvent(new CustomEvent('wwmx:excluir-rota', { detail: { rotaId: '${r.id}' } }))" class="btn btn-ghost" style="padding:6px;">🗑️</button></div></div>`).join('');
  }

  function _renderizarStats(rotas) {
    const stats = document.getElementById('rotasStats');
    if (!stats) return;
    const total = rotas.length;
    const planejadas = rotas.filter(r => r.status === 'planejada').length;
    const km = rotas.reduce((a, r) => a + Number(r.km || 0), 0);
    stats.innerHTML = `<div class="dash-stats"><div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Total</div></div><div class="stat-card inst"><div class="stat-num green">${planejadas}</div><div class="stat-label">Planejadas</div></div><div class="stat-card ret"><div class="stat-num red">${km.toFixed(1)}</div><div class="stat-label">Km</div></div></div>`;
  }

  function _renderizarRotasNoMapa(rotas) {
    if (!_map) return;
    if (!_map._rotaLayers) _map._rotaLayers = [];
    _map._rotaLayers.forEach(l => l.remove());
    _map._rotaLayers = [];
    rotas.forEach(r => { const pts = (r.routeGeometry?.length ? r.routeGeometry : r.pontos || []).map(p => Array.isArray(p) ? p : [p.lat, p.lng]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])); if (pts.length < 2) return; const line = L.polyline(pts, { weight: 4 }).addTo(_map).bindPopup(_esc(r.nome || 'Rota')); _map._rotaLayers.push(line); });
  }

  function _ativarModoRota() {
    _inicializarMapa(); if (!_map) { WWMX.UI?.showToast?.('Mapa indisponível', 'error'); return; }
    _modoRota = true; _limparPontos(); document.getElementById('rotaPlanner').style.display = 'block'; document.getElementById('rotaNome').value = ''; _map.on('click', _onMapClick); WWMX.UI?.showToast?.('Clique no mapa para adicionar pontos da rota'); setTimeout(() => _map.invalidateSize(), 250);
  }

  function _onMapClick(e) {
    if (!_modoRota) return;
    const ponto = { lat: e.latlng.lat, lng: e.latlng.lng };
    _pontos.push(ponto);
    _markersTemp.push(L.marker([ponto.lat, ponto.lng]).addTo(_map).bindPopup(`Ponto ${_pontos.length}`));
    _atualizarLinha();
  }

  async function _atualizarLinha() {
    if (_polylineTemp) { _polylineTemp.remove(); _polylineTemp = null; }
    if (_pontos.length < 2) { _routeGeometry = []; _atualizarPontosInfo(); return; }
    _atualizarPontosInfo('Calculando rota nas vias...');
    clearTimeout(_routeTimer);
    _routeTimer = setTimeout(async () => {
      try {
        const coords = _pontos.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM indisponível');
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) throw new Error('rota não encontrada');
        _routeGeometry = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        _polylineTemp = L.polyline(_routeGeometry, { weight: 5, dashArray: '8,4' }).addTo(_map);
        _atualizarPontosInfo(null, route.distance / 1000);
      } catch (err) {
        _routeGeometry = [];
        _polylineTemp = L.polyline(_pontos.map(p => [p.lat, p.lng]), { weight: 5, dashArray: '8,4' }).addTo(_map);
        _atualizarPontosInfo('OSRM falhou; usando linha reta estimada.');
      }
    }, 350);
  }

  function _atualizarPontosInfo(msg, kmOsrm) {
    const info = document.getElementById('rotaPontosInfo'); if (!info) return;
    if (!_pontos.length) { info.textContent = 'Clique no mapa para adicionar pontos.'; return; }
    const km = Number.isFinite(kmOsrm) ? kmOsrm : _calcularKm(_pontos);
    info.innerHTML = `<strong>${_pontos.length} ponto(s) · ${km.toFixed(2)} km ${Number.isFinite(kmOsrm) ? 'por vias' : 'estimados'}</strong>${msg ? `<div style="color:var(--muted);font-size:12px;margin-top:4px;">${_esc(msg)}</div>` : ''}` + _pontos.map((p,i) => `<div>${i+1}: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`).join('');
  }

  async function _salvarRota() {
    const nome = document.getElementById('rotaNome').value.trim(); const tipo = document.getElementById('rotaTipo').value; const select = document.getElementById('rotaMotorista'); const motoristaUid = select.value; const motoristaNome = select.options[select.selectedIndex]?.text || '';
    if (!nome) { WWMX.UI?.showToast?.('Digite o nome da rota', 'error'); return; }
    if (!motoristaUid) { WWMX.UI?.showToast?.('Selecione um militante', 'error'); return; }
    if (_pontos.length < 2) { WWMX.UI?.showToast?.('Adicione pelo menos 2 pontos no mapa', 'error'); return; }
    const session = WWMX.Auth?.sessaoAtual?.() || {}; const km = _routeGeometry.length >= 2 ? _calcularKm(_routeGeometry.map(([lat,lng]) => ({lat,lng}))) : _calcularKm(_pontos);
    const rota = { id: Date.now().toString(), nome, tipo, pontos: _pontos, routeGeometry: _routeGeometry, routeProvider: _routeGeometry.length ? 'osrm' : 'straight_line', km, motoristaUid, motoristaNome, status: 'planejada', criadoPor: session.nome || 'coord', ts: Date.now() };
    await WWMX.db.set(`campanhas/${_campanhaId}/rotas/${rota.id}`, rota); WWMX.UI?.showToast?.(`✅ Rota "${nome}" salva!`, 'success'); _desativarModoRota();
  }

  function _limparPontos() { _pontos = []; _routeGeometry = []; _markersTemp.forEach(m => m.remove()); _markersTemp = []; if (_polylineTemp) { _polylineTemp.remove(); _polylineTemp = null; } _atualizarPontosInfo(); }
  function _desativarModoRota() { if (_map) _map.off('click', _onMapClick); _modoRota = false; _limparPontos(); const p = document.getElementById('rotaPlanner'); if (p) p.style.display = 'none'; }
  function _calcularKm(pontos) { if (pontos.length < 2) return 0; let total = 0; for (let i = 1; i < pontos.length; i++) { const R = 6371; const dLat = (pontos[i].lat - pontos[i-1].lat) * Math.PI / 180; const dLng = (pontos[i].lng - pontos[i-1].lng) * Math.PI / 180; const a = Math.sin(dLat/2)**2 + Math.cos(pontos[i-1].lat*Math.PI/180)*Math.cos(pontos[i].lat*Math.PI/180)*Math.sin(dLng/2)**2; total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); } return total; }
  function _iconTipo(tipo) { return ({ carrosom:'📢', caminhada:'🚶', panfletagem:'📄', portaaporta:'🏠' })[tipo] || '🚗'; }
  function _esc(v) { return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  global.addEventListener('wwmx:focar-rota', async (e) => { const rotaId = e.detail.rotaId; const snap = await WWMX.db.get(`campanhas/${_campanhaId}/rotas/${rotaId}`); const rota = snap.val?.() || snap; const pts = (rota?.routeGeometry?.length ? rota.routeGeometry : rota?.pontos || []).map(p => Array.isArray(p) ? p : [p.lat, p.lng]); if (_map && pts.length) _map.fitBounds(pts, { padding: [30, 30] }); });
  global.addEventListener('wwmx:excluir-rota', async (e) => { const rotaId = e.detail.rotaId; if (confirm('Excluir esta rota?')) { await WWMX.db.remove(`campanhas/${_campanhaId}/rotas/${rotaId}`); WWMX.UI?.showToast?.('Rota removida'); } });
  global.rotasCoordInit = init;
  global.rotasCoordDestroy = destroy;
})(window);
