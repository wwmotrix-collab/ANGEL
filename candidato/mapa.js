/**
 * candidato/mapa.js
 * WWMX Campaign — Mapa consolidado para candidato/admin
 * Mostra pins existentes + locais eleitorais + operação territorial.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _map = null;
  let _markers = {};
  let _opMarkers = {};
  let _heatLayer = null;
  let _locais = [];
  let _operacao = {};
  let _pins = [];
  let _territorio = { uf:'RS', municipio:'Viamão', slug:'viamao' };

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _detectarTerritorio();
    _renderizar();
    _iniciarMapa();
    _carregarLocaisEleitorais();
    _assinarPins();
    _assinarOperacao();
  }

  function destroy() {
    if (_map) { _map.remove(); _map = null; }
  }

  function _detectarTerritorio(){
    const qs = new URLSearchParams(location.search);
    const uf = qs.get('uf') || localStorage.getItem('wwmx_uf') || 'RS';
    const municipio = qs.get('municipio') || localStorage.getItem('wwmx_municipio') || 'Viamão';
    _territorio = { uf, municipio, slug: _slug(municipio) };
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div id="map" style="height:100%; width:100%;"></div>
      <div class="map-admin-legend">
        <strong>Operação territorial</strong>
        <span><i class="lg alta"></i> Alta</span>
        <span><i class="lg media"></i> Média</span>
        <span><i class="lg baixa"></i> Baixa</span>
        <span><i class="lg sem"></i> Sem prioridade</span>
      </div>
      <div style="position:absolute;bottom:16px;right:16px;z-index:400;display:flex;gap:8px;">
        <button id="btnLocais" class="btn btn-secondary" style="padding:8px 16px;">📍 Locais</button>
        <button id="btnCalor" class="btn btn-secondary" style="padding:8px 16px;">🌡️ Calor</button>
      </div>
    `;
    _style();
    document.getElementById('btnCalor').onclick = _toggleHeatmap;
    document.getElementById('btnLocais').onclick = _centralizarLocais;
  }

  function _iniciarMapa() {
    _map = L.map('map', {
      center: [-30.0807, -51.0258],
      zoom: 13,
      zoomControl: false,
    });
    const cfg = global.WWMX?.Config?.DEFAULT_CONFIG || {};
    L.tileLayer(cfg.mapaTileLayer || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: cfg.mapaAttribution || '&copy; OpenStreetMap contributors'
    }).addTo(_map);
    L.control.zoom({ position: 'bottomleft' }).addTo(_map);
  }

  async function _carregarLocaisEleitorais(){
    const caminhos = [
      `territorios/${_territorio.uf}/${_territorio.slug}/locais_votacao`,
      'locais_votacao',
      `campanhas/${_campanhaId}/territorio/locais_votacao`
    ];
    const resultados = [];
    for (const path of caminhos) {
      const data = await _dbVal(path);
      resultados.push({ path, data:data||{}, count:_contar(data) });
    }
    resultados.sort((a,b)=>b.count-a.count);
    _locais = _normalizarLocais(resultados[0]?.data || {});
    _renderizarCamadaOperacao();
  }

  function _assinarPins() {
    WWMX.db.on(`campanhas/${_campanhaId}/pins`, (snap) => {
      _pins = Object.values(snap.val() || {});
      _renderizarMarcadores(_pins);
      _prepararHeatmap(_pins);
    });
  }

  function _assinarOperacao(){
    WWMX.db.on(`campanhas/${_campanhaId}/operacao/locais`, snap => {
      _operacao = snap.val() || {};
      _renderizarCamadaOperacao();
    });
  }

  function _renderizarCamadaOperacao(){
    if (!_map || !_locais.length) return;
    Object.values(_opMarkers).forEach(m => _map.removeLayer(m));
    _opMarkers = {};

    const validos = [];
    _locais.forEach(local => {
      if (!_temGeo(local)) return;
      validos.push(local);
      const op = _operacao[local.id] || {};
      const visual = _visualOperacao(op);
      const marker = L.circleMarker([local.lat, local.lng], {
        radius: visual.radius,
        color: visual.border,
        fillColor: visual.fill,
        fillOpacity: 0.68,
        weight: visual.weight,
      }).addTo(_map).bindPopup(_popupLocal(local, op));
      _opMarkers[local.id] = marker;
    });

    if (validos.length) {
      setTimeout(()=>_centralizarLocais(), 120);
    }
  }

  function _renderizarMarcadores(pins) {
    Object.values(_markers).forEach(m => _map.removeLayer(m));
    _markers = {};
    pins.forEach(pin => {
      if (!pin.lat || !pin.lng) return;
      const cfg = global.TIPO_CONFIG?.[pin.tipo] || { icon: '📍', cor: '#3b82f6', label: pin.tipo || 'Pin' };
      const html = `<div style="width:30px;height:30px;border-radius:50%;background:${cfg.cor};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.35);">${cfg.icon}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(_map)
        .bindPopup(`<strong>${_esc(pin.nome)}</strong><br>${_esc(cfg.label)}<br>${new Date(pin.ts||Date.now()).toLocaleString()}`);
      _markers[pin.id] = marker;
    });
  }

  function _popupLocal(local, op){
    return `
      <div class="popup-wrap" style="min-width:220px">
        <div class="popup-name"><strong>${_esc(local.nome)}</strong></div>
        <div class="popup-meta">Zona ${_esc(local.zona)} · Seções ${_esc(local.secoes)}</div>
        <div>👥 ${_eleitoresLabel(local)}</div>
        <hr>
        <div>Prioridade: <strong>${_esc(op.prioridade || 'Sem prioridade')}</strong></div>
        <div>Status: <strong>${_esc(op.status || 'Pendente')}</strong></div>
        <div>Responsável: ${_esc(op.responsavel || '—')}</div>
        <div>Meta: ${_fmt(op.metaVotos || 0)} votos</div>
        ${op.acao ? `<div>Ação: ${_esc(op.acao)}</div>` : ''}
        ${op.observacao ? `<div style="margin-top:6px;color:var(--muted);font-size:12px;">${_esc(op.observacao)}</div>` : ''}
      </div>
    `;
  }

  function _visualOperacao(op){
    const p = op?.prioridade || '';
    const s = op?.status || 'Pendente';
    let fill = '#64748b', radius = 9;
    if (p === 'Alta') { fill = '#ef4444'; radius = 18; }
    else if (p === 'Média') { fill = '#f59e0b'; radius = 14; }
    else if (p === 'Baixa') { fill = '#22c55e'; radius = 11; }

    let border = '#ffffff', weight = 2;
    if (s === 'Concluído') { border = '#22c55e'; weight = 4; }
    else if (s === 'Em andamento') { border = '#3b82f6'; weight = 4; }
    else if (s === 'Bloqueado') { border = '#ef4444'; weight = 5; }

    return { fill, radius, border, weight };
  }

  function _prepararHeatmap(pins) {
    global._heatPoints = pins.filter(p => p.lat).map(p => [p.lat, p.lng]);
  }

  function _toggleHeatmap() {
    if (_heatLayer) {
      _map.removeLayer(_heatLayer);
      _heatLayer = null;
      document.getElementById('btnCalor').textContent = '🌡️ Calor';
    } else {
      const pontos = global._heatPoints || [];
      if (!pontos.length) {
        WWMX.UI?.showToast?.('Nenhum ponto para gerar calor', 'error');
        return;
      }
      _heatLayer = L.layerGroup();
      pontos.forEach(p => {
        L.circleMarker(p, { radius: 12, color: '#f97316', fillColor: '#f97316', fillOpacity: 0.4, weight: 0 }).addTo(_heatLayer);
      });
      _heatLayer.addTo(_map);
      document.getElementById('btnCalor').textContent = '❄️ Ocultar calor';
    }
  }

  function _centralizarLocais(){
    if (!_map) return;
    const validos = _locais.filter(_temGeo);
    if (!validos.length) return;
    const bounds = L.latLngBounds(validos.map(l=>[l.lat,l.lng]));
    _map.fitBounds(bounds, { padding:[28,28], maxZoom:14 });
  }

  function _normalizarLocais(data){
    const arr = Array.isArray(data) ? data.map((v,i)=>_normLocal(v, v.id || String(i))) : Object.entries(data||{}).map(([id,v])=>_normLocal(v||{}, id));
    return arr;
  }

  function _normLocal(v,id){
    const coords = _normalizarCoordenadas(_pick(v,['lat','latitude'],''), _pick(v,['lng','lon','longitude'],''));
    const eleitores = Number(_pick(v,['eleitores','el','qt_eleitores'],''));
    return {
      id,
      nome:_pick(v,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome'),
      zona:_pick(v,['zona','ze'],'—'),
      secoes:_pick(v,['secoes','secao','ns'],'—'),
      endereco:_pick(v,['endereco','address','enderecoCompleto'],''),
      eleitores:Number.isFinite(eleitores)&&eleitores>0?eleitores:null,
      lat:coords.lat,
      lng:coords.lng
    };
  }

  async function _dbVal(path){
    if (global.WWMX?.db?.val) return await WWMX.db.val(path) || {};
    if (global.WWMX?.db?.get) {
      const snap = await WWMX.db.get(path);
      return snap && typeof snap.val === 'function' ? (snap.val() || {}) : (snap || {});
    }
    return {};
  }

  function _temGeo(l){ return Number.isFinite(l.lat) && Number.isFinite(l.lng) && _dentroDoTerritorio(l.lat,l.lng); }
  function _parseCoord(v){ const n=Number(String(v??'').trim().replace(',','.')); return Number.isFinite(n)?n:NaN; }
  function _normalizarCoordenadas(rawLat, rawLng){
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

  function _style(){
    if(document.getElementById('adminMapaOperacaoStyle')) return;
    const s=document.createElement('style');
    s.id='adminMapaOperacaoStyle';
    s.textContent=`
      .map-admin-legend{position:absolute;left:12px;bottom:16px;z-index:400;background:rgba(15,23,42,.92);color:#f8fafc;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:5px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
      .map-admin-legend strong{font-size:12px;margin-bottom:2px}.map-admin-legend span{display:flex;align-items:center;gap:6px}.map-admin-legend .lg{width:10px;height:10px;border-radius:999px;display:inline-block}.lg.alta{background:#ef4444}.lg.media{background:#f59e0b}.lg.baixa{background:#22c55e}.lg.sem{background:#64748b}
      @media(max-width:760px){.map-admin-legend{left:10px;right:10px;bottom:70px;display:grid;grid-template-columns:1fr 1fr}.map-admin-legend strong{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  global.candMapaInit = init;
  global.candMapaDestroy = destroy;
})(window);
