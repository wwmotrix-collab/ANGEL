/**
 * candidato/mapa.js
 * WWMX Campaign — Mapa consolidado para candidato
 * Mostra todos os pins, locais eleitorais, heatmap de atividade
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _map = null;
  let _markers = {};
  let _heatLayer = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _iniciarMapa();
    _assinar();
  }

  function destroy() {
    if (_map) _map.remove();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div id="map" style="height:100%; width:100%;"></div>
      <div style="position:absolute;bottom:16px;right:16px;z-index:400;">
        <button id="btnCalor" class="btn btn-secondary" style="padding:8px 16px;">🌡️ Calor</button>
      </div>
    `;
    document.getElementById('btnCalor').onclick = _toggleHeatmap;
  }

  function _iniciarMapa() {
    _map = L.map('map', {
      center: [-30.0807, -51.0258],
      zoom: 13,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(_map);
    L.control.zoom({ position: 'bottomleft' }).addTo(_map);
  }

  function _assinar() {
    WWMX.db.on(`campanhas/${_campanhaId}/pins`, (snap) => {
      const pins = Object.values(snap.val() || {});
      _renderizarMarcadores(pins);
      _prepararHeatmap(pins);
    });
  }

  function _renderizarMarcadores(pins) {
    Object.values(_markers).forEach(m => _map.removeLayer(m));
    _markers = {};
    pins.forEach(pin => {
      const cfg = global.TIPO_CONFIG[pin.tipo] || { icon: '📍', cor: '#3b82f6' };
      const html = `<div style="width:30px;height:30px;border-radius:50%;background:${cfg.cor};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;">${cfg.icon}</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(_map)
        .bindPopup(`<strong>${pin.nome}</strong><br>${cfg.label}<br>${new Date(pin.ts).toLocaleString()}`);
      _markers[pin.id] = marker;
    });
  }

  function _prepararHeatmap(pins) {
    // Para usar heatmap precisaríamos da lib Leaflet.heat
    // Aqui guardamos os pontos para quando o botão for clicado
    global._heatPoints = pins.filter(p => p.lat).map(p => [p.lat, p.lng]);
  }

  function _toggleHeatmap() {
    if (_heatLayer) {
      _map.removeLayer(_heatLayer);
      _heatLayer = null;
      document.getElementById('btnCalor').textContent = '🌡️ Calor';
    } else {
      if (!global._heatPoints || global._heatPoints.length === 0) {
        WWMX.UI.showToast('Nenhum ponto para gerar calor', 'error');
        return;
      }
      // Simular heatmap simples (círculos com opacidade)
      _heatLayer = L.layerGroup();
      global._heatPoints.forEach(p => {
        L.circleMarker(p, {
          radius: 12,
          color: '#f97316',
          fillColor: '#f97316',
          fillOpacity: 0.4,
          weight: 0,
        }).addTo(_heatLayer);
      });
      _heatLayer.addTo(_map);
      document.getElementById('btnCalor').textContent = '❄️ Ocultar calor';
    }
  }

  global.candMapaInit = init;
  global.candMapaDestroy = destroy;
})(window);