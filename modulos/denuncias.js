/**
 * modulos/denuncias.js
 * WWMX Campaign — Registro e gestão de denúncias eleitorais
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _denunciaLatLng = null;
  let _denunciaFoto = null;

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
    const session = WWMX.Auth.sessaoAtual();
    const isCoord = session?.nivel === 'coord';
    container.innerHTML = `
      <div class="dash-view">
        <button id="btnNovaDenuncia" class="btn btn-primary" style="width:100%;margin-bottom:16px;">🚨 Nova Denúncia</button>
        <div class="section-title">Denúncias ${isCoord ? 'Pendentes' : 'Minhas Denúncias'}</div>
        <div id="denunciasList" class="banner-list"></div>
      </div>
    `;
    document.getElementById('btnNovaDenuncia').onclick = () => _abrirModalDenuncia();
  }

  function _assinar() {
    const session = WWMX.Auth.sessaoAtual();
    if (!session) return;
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/denuncias`, (snap) => {
      const todas = Object.values(snap.val() || {});
      const filtradas = session.nivel === 'coord' ? todas : todas.filter(d => d.autorUid === session.uid);
      _renderizarLista(filtradas);
    });
  }

  function _renderizarLista(denuncias) {
    const lista = document.getElementById('denunciasList');
    if (!lista) return;
    if (!denuncias.length) {
      lista.innerHTML = '<div class="empty">Nenhuma denúncia registrada</div>';
      return;
    }
    lista.innerHTML = denuncias.sort((a,b) => b.ts - a.ts).map(d => `
      <div class="banner-item" style="border-left:3px solid var(--red);">
        <div style="font-size:20px;">🚨</div>
        <div class="banner-info">
          <div class="banner-name">${d.tipo}</div>
          <div class="banner-meta">${d.desc.substring(0, 80)}... · ${new Date(d.ts).toLocaleDateString()}</div>
          <div class="banner-meta">👤 ${d.autor} · ${d.status || 'pendente'}</div>
        </div>
        <button onclick="window.dispatchEvent(new CustomEvent('wwmx:ver-denuncia', { detail: { id: '${d.id}' } }))" class="btn btn-ghost" style="padding:6px 12px;">Ver</button>
      </div>
    `).join('');
  }

  function _abrirModalDenuncia() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">🚨 Registrar Denúncia</div>
        <div class="field"><label>Tipo de irregularidade</label>
          <select id="denunciaTipo">
            <option value="poste_arvore">Material em poste/árvore</option>
            <option value="predio_publico">Propaganda em prédio público</option>
            <option value="carro_horario">Carro de som fora do horário</option>
            <option value="boca_urna">Boca de urna</option>
            <option value="compra_votos">Compra de votos</option>
            <option value="fake_news">Fake news eleitoral</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div class="field"><label>Descrição detalhada</label><textarea id="denunciaDesc" rows="3"></textarea></div>
        <div class="field"><label>Foto (evidência)</label>
          <div class="photo-upload" onclick="document.getElementById('denunciaFotoInput').click()">
            <span class="photo-upload-icon">📷</span>
            <span class="photo-upload-text">Tirar foto</span>
            <img id="denunciaFotoPreview" style="display:none;">
            <input type="file" id="denunciaFotoInput" accept="image/*" capture="environment" style="display:none;">
          </div>
        </div>
        <div id="denunciaLocBox" style="padding:8px;background:rgba(245,158,11,0.1);border-radius:8px;margin-bottom:8px;">
          📍 <span id="denunciaLocTxt">Aguardando GPS...</span>
        </div>
        <button id="btnMarcarMapa" class="btn btn-ghost" style="width:100%;margin-bottom:8px;">📌 Ou marcar manualmente no mapa</button>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" data-fechar>Cancelar</button>
          <button class="btn btn-danger" data-salvar>Registrar Denúncia</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Capturar GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          _denunciaLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          document.getElementById('denunciaLocTxt').innerHTML = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          document.getElementById('denunciaLocBox').style.background = 'rgba(34,197,94,0.1)';
        },
        () => document.getElementById('denunciaLocTxt').innerHTML = 'GPS não obtido'
      );
    }
    // Foto
    const fotoInput = document.getElementById('denunciaFotoInput');
    fotoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          _denunciaFoto = ev.target.result;
          const preview = document.getElementById('denunciaFotoPreview');
          preview.src = _denunciaFoto;
          preview.style.display = 'block';
          document.querySelector('.photo-upload-icon').textContent = '✅';
        };
        reader.readAsDataURL(file);
      }
    };
    document.getElementById('btnMarcarMapa').onclick = () => {
      overlay.remove();
      global.WWMX.UI.showToast('Toque no mapa para marcar o local');
      const map = global.mapa?._map;
      if (map) map.once('click', (e) => {
        _denunciaLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
        _abrirModalDenuncia(); // reabre com GPS já definido
      });
    };
    overlay.querySelector('[data-fechar]').onclick = () => overlay.remove();
    overlay.querySelector('[data-salvar]').onclick = () => _salvarDenuncia(overlay);
  }

  async function _salvarDenuncia(overlay) {
    const tipo = document.getElementById('denunciaTipo').value;
    const desc = document.getElementById('denunciaDesc').value.trim();
    if (!desc) { WWMX.UI.showToast('Descreva a irregularidade', 'error'); return; }
    const session = WWMX.Auth.sessaoAtual();
    const denuncia = {
      id: Date.now().toString(),
      tipo,
      desc,
      foto: _denunciaFoto || null,
      lat: _denunciaLatLng?.lat || null,
      lng: _denunciaLatLng?.lng || null,
      autor: session.nome,
      autorUid: session.uid,
      ts: Date.now(),
      status: 'pendente',
    };
    await WWMX.db.set(`campanhas/${_campanhaId}/denuncias/${denuncia.id}`, denuncia);
    overlay.remove();
    WWMX.UI.showToast('🚨 Denúncia registrada!', 'success');
  }

  global.denunciasInit = init;
  global.denunciasDestroy = destroy;
})(window);