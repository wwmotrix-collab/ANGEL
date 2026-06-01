/**
 * master/banco-global.js — WWMX Campaign
 * Banco de dados central: locais de votação, histórico eleitoral, reutilização entre campanhas.
 */
(function (global) {
  'use strict';

  let _aba = 'locais';

  function init() {
    _renderizar();
    _carregarAba('locais');
  }
  function destroy() {}

  function _renderizar() {
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <button class="btn btn-secondary" id="abaLocais"  onclick="_bancoAba('locais')"   style="flex:1;">📍 Locais TSE</button>
          <button class="btn btn-secondary" id="abaHist"    onclick="_bancoAba('historico')" style="flex:1;">🗳️ Histórico</button>
          <button class="btn btn-secondary" id="abaImport"  onclick="_bancoAba('importar')"  style="flex:1;">📥 Importar</button>
        </div>
        <div id="bancoConteudo"></div>
      </div>`;
    _renderizarAbaLocais();
  }

  function _carregarAba(aba) {
    _aba = aba;
    document.querySelectorAll('#abaLocais,#abaHist,#abaImport').forEach(b => b.classList.remove('btn-primary'));
    const map = { locais:'abaLocais', historico:'abaHist', importar:'abaImport' };
    document.getElementById(map[aba])?.classList.add('btn-primary');
    if (aba === 'locais')    _renderizarAbaLocais();
    if (aba === 'historico') _renderizarAbaHistorico();
    if (aba === 'importar')  _renderizarAbaImportar();
  }
  global._bancoAba = _carregarAba;

  function _renderizarAbaLocais() {
    const el = document.getElementById('bancoConteudo');
    if (!el) return;
    el.innerHTML = `
      <div class="search-wrap" style="margin-bottom:12px;">
        <span class="search-icon">🔍</span>
        <input class="search-input" id="locaisBusca" placeholder="Buscar município...">
      </div>
      <div id="locaisList" class="banner-list"></div>`;
    document.getElementById('locaisBusca').oninput = (e) => _buscarLocais(e.target.value.trim());
    _buscarLocais('');
  }

  async function _buscarLocais(municipio) {
    const el = document.getElementById('locaisList');
    if (!el) return;
    if (!municipio) {
      el.innerHTML = '<div class="empty">Digite um município para buscar locais de votação do TSE</div>';
      return;
    }
    el.innerHTML = '<div class="empty">Buscando...</div>';
    try {
      const locais = await WWMX.fs.query('locais_votacao',
        [['municipio', '==', municipio.toLowerCase()]],
        { orderBy: 'nome', limit: 100 }
      );
      if (!locais.length) {
        el.innerHTML = `<div class="empty">Nenhum local encontrado para "${municipio}".<br><br>
          <button class="btn btn-primary" onclick="_bancoImportarMunicipio('${municipio}')">📥 Importar via Firebase Function</button>
        </div>`;
        return;
      }
      el.innerHTML = locais.map(l => `
        <div class="banner-item">
          <div style="font-size:20px;">📍</div>
          <div class="banner-info">
            <div class="banner-name">${l.nome}</div>
            <div class="banner-meta">ZE ${l.zona}ª · ${l.ns} seções · ${l.el?.toLocaleString('pt-BR')} eleitores</div>
            <div class="banner-meta">📍 ${l.lat?.toFixed(5)}, ${l.lng?.toFixed(5)}</div>
          </div>
        </div>`).join('');
    } catch (e) {
      el.innerHTML = '<div class="empty">Erro ao buscar locais</div>';
    }
  }

  function _renderizarAbaHistorico() {
    const el = document.getElementById('bancoConteudo');
    if (!el) return;
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📊 Histórico Eleitoral</div>
        <div style="font-size:12px;color:var(--muted);">
          Base de dados com resultados eleitorais anteriores por local de votação.
          Permite analisar desempenho histórico e projetar campanhas futuras.
        </div>
      </div>
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" id="histBusca" placeholder="Buscar candidato ou município...">
      </div>
      <div id="histList" class="banner-list" style="margin-top:12px;"></div>`;
    document.getElementById('histBusca').oninput = (e) => _buscarHistorico(e.target.value.trim());
    _buscarHistorico('');
  }

  async function _buscarHistorico(termo) {
    const el = document.getElementById('histList');
    if (!el) return;
    if (!termo) {
      el.innerHTML = '<div class="empty">Digite um candidato ou município para buscar no histórico</div>';
      return;
    }
    el.innerHTML = '<div class="empty">Buscando...</div>';
    try {
      const hist = await WWMX.fs.query('historico_eleitoral',
        [['municipio', '==', termo.toLowerCase()]],
        { orderBy: 'ano', dir: 'desc', limit: 50 }
      );
      if (!hist.length) {
        el.innerHTML = '<div class="empty">Nenhum dado histórico encontrado</div>';
        return;
      }
      el.innerHTML = hist.map(h => `
        <div class="banner-item">
          <div style="font-size:22px;">🗳️</div>
          <div class="banner-info">
            <div class="banner-name">${h.candidato} — ${h.cargo}</div>
            <div class="banner-meta">${h.municipio} · ${h.ano} · ${h.partido}</div>
            <div class="banner-meta">${(h.votos||0).toLocaleString('pt-BR')} votos · ${h.resultado || '—'}</div>
          </div>
        </div>`).join('');
    } catch (e) {
      el.innerHTML = '<div class="empty">Erro ao buscar histórico</div>';
    }
  }

  function _renderizarAbaImportar() {
    const el = document.getElementById('bancoConteudo');
    if (!el) return;
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📥 Importar Locais de Votação</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">
          Dispara a Cloud Function que coleta coordenadas dos locais de votação via API do TSE + Google Maps e salva no Firestore.
        </div>
        <div class="field"><label>Município</label><input id="importMunicipio" placeholder="Ex: Viamão"></div>
        <div class="field"><label>Estado (UF)</label>
          <select id="importUf">
            <option value="RS">RS</option><option value="SP">SP</option>
            <option value="RJ">RJ</option><option value="MG">MG</option>
            <option value="PR">PR</option><option value="SC">SC</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" id="btnImportar">🚀 Importar via Firebase Function</button>
        <div id="importStatus" style="margin-top:10px;font-size:12px;color:var(--muted);"></div>
      </div>`;
    document.getElementById('btnImportar').onclick = _dispararImportacao;
  }

  async function _dispararImportacao() {
    const municipio = document.getElementById('importMunicipio').value.trim();
    const uf        = document.getElementById('importUf').value;
    if (!municipio) { WWMX.UI.showToast('Digite o município', 'error'); return; }
    const status = document.getElementById('importStatus');
    status.textContent = '⏳ Disparando importação...';
    try {
      // Criar doc de config dispara o trigger onCreate da Cloud Function
      await WWMX.fs.setDoc(
        { municipio: municipio.toLowerCase(), uf, solicitadoEm: WWMX.fs.serverTimestamp() },
        'importacoes', `${municipio.toLowerCase()}_${uf}_${Date.now()}`
      );
      status.textContent = `✅ Importação disparada para ${municipio}-${uf}. Os locais aparecerão em alguns minutos.`;
      status.style.color = 'var(--green)';
    } catch (e) {
      status.textContent = '❌ Erro ao disparar importação. Verifique as permissões.';
      status.style.color = 'var(--red)';
    }
  }

  global._bancoImportarMunicipio = function(municipio) {
    _carregarAba('importar');
    setTimeout(() => {
      const inp = document.getElementById('importMunicipio');
      if (inp) inp.value = municipio;
    }, 100);
  };

  global.bancoInit    = init;
  global.bancoDestroy = destroy;
}(window));
