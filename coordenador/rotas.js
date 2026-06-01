/**
 * coordenador/rotas.js
 * WWMX Campaign — Criação e gestão de rotas (planejamento)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _rotaEditando = null;
  let _pontos = [];
  let _polylineTemp = null;
  let _modoRota = false;

  function init(campanhaId) {
    _campanhaId = campanhaId;
    _renderizar();
    _assinar();
  }

  function destroy() {
    if (_unsub) _unsub();
    if (_polylineTemp) _polylineTemp.remove();
    if (_modoRota) _desativarModoRota();
  }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `
      <div class="dash-view">
        <div id="rotasStats" style="margin-bottom:16px;"></div>
        <button id="btnNovaRota" class="btn btn-primary" style="width:100%;margin-bottom:16px;">+ Nova Rota</button>
        <div class="section-title">Rotas Planejadas</div>
        <div id="rotasList" class="banner-list"></div>
        <!-- Modal de criação (inline, aparece dinamicamente) -->
        <div id="modalRota" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:800;background:var(--surface);border-top:2px solid var(--accent);border-radius:20px 20px 0 0;padding:20px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <div class="modal-title">Nova Rota</div>
            <button onclick="window.dispatchEvent(new Event('wwmx:fechar-modal-rota'))">✕</button>
          </div>
          <div class="field"><label>Nome da rota</label><input id="rotaNome" placeholder="Ex: Centro Sul - Manhã"></div>
          <div class="field"><label>Tipo</label>
            <select id="rotaTipo"><option value="carrosom">📢 Carro de Som</option><option value="caminhada">🚶 Caminhada</option></select>
          </div>
          <div class="field"><label>Atribuir a</label><select id="rotaMotorista"></select></div>
          <div class="field"><label>Pontos (clique no mapa)</label><div id="rotaPontosInfo" style="background:var(--surface2);border-radius:8px;padding:10px;min-height:40px;">Nenhum ponto</div></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button id="btnCancelarRota" class="btn btn-ghost">Cancelar</button>
            <button id="btnSalvarRota" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('btnNovaRota').onclick = () => _ativarModoRota();
    document.addEventListener('wwmx:fechar-modal-rota', () => _desativarModoRota());
  }

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}/rotas`, (snap) => {
      const rotas = Object.values(snap.val() || {});
      _renderizarLista(rotas);
      _renderizarStats(rotas);
    });
    // Carregar militantes para o select
    WWMX.db.on(`campanhas/${_campanhaId}/militantes`, (snap) => {
      const mils = Object.values(snap.val() || {}).filter(m => m.nivel === 'campo');
      const select = document.getElementById('rotaMotorista');
      if (select) {
        select.innerHTML = '<option value="">Selecione...</option>' + mils.map(m => `<option value="${m.uid}">${m.nome}</option>`).join('');
      }
    });
  }

  function _renderizarLista(rotas) {
    const lista = document.getElementById('rotasList');
    if (!lista) return;
    if (!rotas.length) {
      lista.innerHTML = '<div class="empty">Nenhuma rota criada</div>';
      return;
    }
    lista.innerHTML = rotas.sort((a,b) => b.ts - a.ts).map(r => `
      <div class="banner-item">
        <div style="font-size:24px;">${r.tipo === 'carrosom' ? '📢' : '🚶'}</div>
        <div class="banner-info">
          <div class="banner-name">${r.nome}</div>
          <div class="banner-meta">${r.km?.toFixed(1) || 0} km · status: ${r.status}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="window.dispatchEvent(new CustomEvent('wwmx:ver-rota-mapa', { detail: { rotaId: '${r.id}' } }))" class="btn btn-ghost" style="padding:6px;">🗺️</button>
          <button onclick="window.dispatchEvent(new CustomEvent('wwmx:excluir-rota', { detail: { rotaId: '${r.id}' } }))" class="btn btn-ghost" style="padding:6px;">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function _renderizarStats(rotas) {
    const stats = document.getElementById('rotasStats');
    if (!stats) return;
    const total = rotas.length;
    const planejadas = rotas.filter(r => r.status === 'planejada').length;
    const emAndamento = rotas.filter(r => r.status === 'em_andamento').length;
    stats.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Total</div></div>
        <div class="stat-card inst"><div class="stat-num green">${planejadas}</div><div class="stat-label">Planejadas</div></div>
        <div class="stat-card ret"><div class="stat-num red">${emAndamento}</div><div class="stat-label">Em andamento</div></div>
      </div>
    `;
  }

  function _ativarModoRota() {
    _modoRota = true;
    _pontos = [];
    const map = global.mapa?._map;
    if (map) {
      _polylineTemp = L.polyline([], { color: '#f59e0b', weight: 4, dashArray: '8,4' }).addTo(map);
      map.on('click', _onMapClick);
      global.WWMX.UI.showToast('Clique no mapa para adicionar pontos');
    }
    const modal = document.getElementById('modalRota');
    if (modal) modal.style.display = 'block';
    document.getElementById('rotaNome').value = '';
    document.getElementById('rotaPontosInfo').textContent = 'Nenhum ponto';
    document.getElementById('btnSalvarRota').onclick = _salvarRota;
    document.getElementById('btnCancelarRota').onclick = _desativarModoRota;
  }

  function _onMapClick(e) {
    if (!_modoRota) return;
    _pontos.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    _polylineTemp.setLatLngs(_pontos.map(p => [p.lat, p.lng]));
    document.getElementById('rotaPontosInfo').innerHTML = _pontos.map((p,i) => `<div>${i+1}: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div>`).join('');
  }

  async function _salvarRota() {
    const nome = document.getElementById('rotaNome').value.trim();
    const tipo = document.getElementById('rotaTipo').value;
    const motoristaUid = document.getElementById('rotaMotorista').value;
    if (!nome) { WWMX.UI.showToast('Digite o nome da rota', 'error'); return; }
    if (!motoristaUid) { WWMX.UI.showToast('Selecione um militante', 'error'); return; }
    if (_pontos.length < 2) { WWMX.UI.showToast('Adicione pelo menos 2 pontos', 'error'); return; }
    const km = _calcularKm(_pontos);
    const session = WWMX.Auth.sessaoAtual();
    const rota = {
      id: Date.now().toString(),
      nome,
      tipo,
      pontos: _pontos,
      km,
      motoristaUid,
      status: 'planejada',
      criadoPor: session.nome,
      ts: Date.now(),
    };
    await WWMX.db.set(`campanhas/${_campanhaId}/rotas/${rota.id}`, rota);
    WWMX.UI.showToast(`✅ Rota "${nome}" salva!`, 'success');
    _desativarModoRota();
  }

  function _desativarModoRota() {
    _modoRota = false;
    if (_polylineTemp) _polylineTemp.remove();
    const map = global.mapa?._map;
    if (map) map.off('click', _onMapClick);
    const modal = document.getElementById('modalRota');
    if (modal) modal.style.display = 'none';
    _pontos = [];
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

  // Expor handlers para eventos
  global.addEventListener('wwmx:ver-rota-mapa', (e) => {
    const rotaId = e.detail.rotaId;
    // Implementar visualização no mapa (pode usar um módulo separado)
    WWMX.UI.showToast(`Ver rota ${rotaId} no mapa (funcionalidade em breve)`, 'info');
  });
  global.addEventListener('wwmx:excluir-rota', async (e) => {
    const rotaId = e.detail.rotaId;
    if (confirm('Excluir esta rota?')) {
      await WWMX.db.remove(`campanhas/${_campanhaId}/rotas/${rotaId}`);
      WWMX.UI.showToast('Rota removida');
    }
  });

  global.rotasCoordInit = init;
  global.rotasCoordDestroy = destroy;
})(window);