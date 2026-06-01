/**
 * campo/percursos.js
 * WWMX Campaign — Registro de percursos com GPS
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _percursoAtivo = null;
  let _watchId = null;
  let _polyline = null;
  let _pontos = [];
  let _banner = null;
  let _timer = null;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsub) _unsub();
    _encerrarPercurso();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div id="percursosStats" style="margin-bottom:16px;"></div>
        <div class="section-title">Meus Percursos</div>
        <div id="percursosList" class="banner-list"></div>
        <div style="margin-top:20px;">
          <button id="btnIniciarCaminhada" class="btn btn-primary" style="width:100%;">🚶 Iniciar Caminhada</button>
          <button id="btnIniciarCarroSom" class="btn btn-primary" style="width:100%;margin-top:8px;">📢 Iniciar Carro de Som</button>
        </div>
      </div>
    `;
    document.getElementById('btnIniciarCaminhada').onclick = () => _iniciar('caminhada');
    document.getElementById('btnIniciarCarroSom').onclick = () => _iniciar('carrosom');
  }

  function _assinar() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/percursos`, (snap) => {
      const todos = snap.val() || {};
      const meus = Object.values(todos).filter(p => p.autorUid === session.uid);
      _renderizarLista(meus);
      _atualizarStats(meus);
    });
  }

  function _renderizarLista(percursos) {
    const lista = document.getElementById('percursosList');
    if (!lista) return;
    if (!percursos.length) {
      lista.innerHTML = '<div class="empty">Nenhum percurso ainda</div>';
      return;
    }
    lista.innerHTML = percursos.sort((a, b) => b.dataTs - a.dataTs).map(p => `
      <div class="banner-item">
        <div style="font-size:24px;">${p.tipo === 'carrosom' ? '📢' : '🚶'}</div>
        <div class="banner-info">
          <div class="banner-name">${p.veiculo || p.tipo}</div>
          <div class="banner-meta">${p.km.toFixed(1)} km · ${new Date(p.dataTs).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  }

  function _atualizarStats(percursos) {
    const stats = document.getElementById('percursosStats');
    if (!stats) return;
    const total = percursos.length;
    const kmTotal = percursos.reduce((acc, p) => acc + (p.km || 0), 0);
    stats.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Percursos</div></div>
        <div class="stat-card inst"><div class="stat-num green">${kmTotal.toFixed(1)}</div><div class="stat-label">km totais</div></div>
      </div>
    `;
  }

  function _iniciar(tipo) {
    if (_percursoAtivo) {
      WWMX.UI.showToast('Já existe um percurso ativo. Encerre-o primeiro.', 'error');
      return;
    }
    if (!navigator.geolocation) {
      WWMX.UI.showToast('GPS não suportado', 'error');
      return;
    }

    _percursoAtivo = { tipo, inicio: Date.now(), turno: _obterTurno() };
    _pontos = [];
    _criarBanner(tipo);

    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ponto = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        _pontos.push(ponto);
        _atualizarBanner();
        if (!_polyline) {
          _polyline = L.polyline([], { color: tipo === 'carrosom' ? '#f97316' : '#8b5cf6', weight: 4 });
          _polyline.addTo(global.mapa._map);
        }
        _polyline.addLatLng([ponto.lat, ponto.lng]);
      },
      (err) => WWMX.UI.showToast('Erro GPS: ' + err.message, 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    _timer = setInterval(() => _atualizarBanner(), 1000);
  }

  function _criarBanner(tipo) {
    if (_banner) _banner.remove();
    _banner = document.createElement('div');
    _banner.id = 'bannerPercurso';
    _banner.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9000;background:var(--surface);border-radius:24px;padding:10px 18px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
    _banner.innerHTML = `
      <span id="percursoIcon">${tipo === 'carrosom' ? '📢' : '🚶'}</span>
      <span id="percursoKm">0.00 km</span>
      <span id="percursoTempo">00:00</span>
      <button id="btnEncerrarPercurso" style="background:rgba(239,68,68,0.8);border:none;border-radius:16px;padding:5px 12px;color:#fff;cursor:pointer;">⏹ Encerrar</button>
    `;
    document.body.appendChild(_banner);
    document.getElementById('btnEncerrarPercurso').onclick = () => _encerrarPercurso();
  }

  function _atualizarBanner() {
    const km = _calcularKm(_pontos);
    const seg = _pontos.length ? Math.floor((Date.now() - _pontos[0].ts) / 1000) : 0;
    const min = Math.floor(seg / 60);
    const sec = seg % 60;
    const kmEl = document.getElementById('percursoKm');
    const tempoEl = document.getElementById('percursoTempo');
    if (kmEl) kmEl.textContent = km.toFixed(2) + ' km';
    if (tempoEl) tempoEl.textContent = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }

  function _calcularKm(pontos) {
    if (pontos.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < pontos.length; i++) {
      const R = 6371;
      const dLat = (pontos[i].lat - pontos[i-1].lat) * Math.PI / 180;
      const dLng = (pontos[i].lng - pontos[i-1].lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(pontos[i-1].lat*Math.PI/180)*Math.cos(pontos[i].lat*Math.PI/180)*Math.sin(dLng/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return total;
  }

  function _obterTurno() {
    const h = new Date().getHours();
    if (h < 12) return 'manha';
    if (h < 18) return 'tarde';
    return 'noite';
  }

  async function _encerrarPercurso() {
    if (!_percursoAtivo) return;
    if (_watchId) navigator.geolocation.clearWatch(_watchId);
    if (_timer) clearInterval(_timer);
    if (_polyline) _polyline.remove();
    if (_banner) _banner.remove();

    const km = _calcularKm(_pontos);
    const session = WWMX.Auth.sessaoAtual();
    const percurso = {
      id: Date.now().toString(),
      tipo: _percursoAtivo.tipo,
      motorista: session.nome,
      autorUid: session.uid,
      veiculo: _percursoAtivo.tipo === 'carrosom' ? 'Carro de Som' : 'Caminhada',
      turno: _percursoAtivo.turno,
      data: new Date().toLocaleDateString('pt-BR'),
      dataTs: Date.now(),
      km,
      duracao: Math.floor((Date.now() - _percursoAtivo.inicio) / 1000),
      pontos: _pontos,
    };
    await WWMX.db.set(`campanhas/${_campanhaId}/percursos/${percurso.id}`, percurso);
    WWMX.UI.showToast(`✅ Percurso registrado · ${km.toFixed(2)} km`, 'success');
    _percursoAtivo = null;
    _pontos = [];
  }

  global.percursosInit = init;
  global.percursosDestroy = destroy;
})(window);