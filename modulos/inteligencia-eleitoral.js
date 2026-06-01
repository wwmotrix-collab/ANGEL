/**
 * modulos/inteligencia-eleitoral.js
 * WWMX Campaign — Dados do TSE, locais de votação, projeção de vitória
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _modoAtual = 'guto'; // guto, coligacao, odds, adversarios
  let _filtroZona = 'todos';

  // Dados estáticos dos locais (vindos do TSE)
  const LOCAIS_TSE = [
    { id:1155, nome:"EEEM NISIA FLORESTA", zona:59, ns:30, el:9366, lat:-30.017165, lng:-51.02297, pct_guto:29.7, votos_guto:1965, votos_total:6618 },
    { id:1090, nome:"EEEM AÇORIANOS", zona:59, ns:23, el:7952, lat:-30.084357, lng:-51.039468, pct_guto:35.6, votos_guto:1703, votos_total:4786 },
    // ... (todos os locais do demo)
  ];

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
    container.innerHTML = `
      <div class="dash-view">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;">
            <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">193.894</div><div>Eleitores</div></div>
            <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--green);">481</div><div>Seções</div></div>
            <div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--yellow);">78</div><div>Locais</div></div>
          </div>
          <div id="coligacaoBadges" style="margin-top:8px;"></div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px;overflow-x:auto;">
          <button class="status-opt active" onclick="window.dispatchEvent(new CustomEvent('wwmx:modo-eleitoral', { detail: { modo: 'guto' } }))">Mendes 2022</button>
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:modo-eleitoral', { detail: { modo: 'coligacao' } }))">Coligação</button>
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:modo-eleitoral', { detail: { modo: 'odds' } }))">Projeção</button>
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:modo-eleitoral', { detail: { modo: 'adversarios' } }))">Adversários</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px;">
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:filtro-eleitoral', { detail: { zona: 'todos' } }))">Todas ZE</button>
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:filtro-eleitoral', { detail: { zona: '59' } }))">ZE 59ª</button>
          <button class="status-opt" onclick="window.dispatchEvent(new CustomEvent('wwmx:filtro-eleitoral', { detail: { zona: '72' } }))">ZE 72ª</button>
        </div>
        <div class="section-title" id="eleitoralListTitle">Locais de Votação · Mendes 2022</div>
        <div id="eleitoralList"></div>
      </div>
    `;
    _renderizarColigacaoBadges();
    _renderizarLista();
    _configurarEventos();
  }

  function _assinar() {
    // Nenhum dado dinâmico, apenas escuta eventos internos
  }

  function _configurarEventos() {
    global.addEventListener('wwmx:modo-eleitoral', (e) => {
      _modoAtual = e.detail.modo;
      _renderizarLista();
    });
    global.addEventListener('wwmx:filtro-eleitoral', (e) => {
      _filtroZona = e.detail.zona;
      _renderizarLista();
    });
  }

  function _renderizarColigacaoBadges() {
    const COLIGACAO = [
      { sigla:'PSD', cor:'#1e4db7', transf:0.92 },
      { sigla:'MDB', cor:'#22c55e', transf:0.68 },
      { sigla:'PDT', cor:'#f59e0b', transf:0.55 },
      { sigla:'SD',  cor:'#8b5cf6', transf:0.48 },
      { sigla:'PT',  cor:'#dc2626', transf:0.41 },
    ];
    const badges = document.getElementById('coligacaoBadges');
    if (badges) {
      badges.innerHTML = COLIGACAO.map(p => `
        <span style="display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:16px;font-size:11px;background:${p.cor}22;border:1px solid ${p.cor}55;color:${p.cor};">${p.sigla} ${Math.round(p.transf*100)}%</span>
      `).join('');
    }
  }

  function _renderizarLista() {
    const lista = document.getElementById('eleitoralList');
    if (!lista) return;
    const filtrados = LOCAIS_TSE.filter(l => _filtroZona === 'todos' || String(l.zona) === _filtroZona);
    const sorted = [...filtrados].sort((a,b) => {
      if (_modoAtual === 'guto') return b.pct_guto - a.pct_guto;
      if (_modoAtual === 'coligacao') return _projetarColigacao(b).pct - _projetarColigacao(a).pct;
      if (_modoAtual === 'odds') return _calcOdds(b).prob - _calcOdds(a).prob;
      return b.el - a.el;
    });

    lista.innerHTML = sorted.map(l => {
      let badge, valor;
      if (_modoAtual === 'guto') {
        const cor = _corPorGuto(l.pct_guto);
        badge = `<div style="width:40px;height:40px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;color:#fff;">${l.pct_guto}%</div>`;
        valor = `<div style="font-size:13px;">${l.el.toLocaleString('pt-BR')} eleitores</div>`;
      } else if (_modoAtual === 'coligacao') {
        const proj = _projetarColigacao(l);
        badge = `<div style="width:40px;height:40px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;color:#fff;">${proj.pct}%</div>`;
        valor = `<div style="font-size:13px;">${proj.votos.toLocaleString('pt-BR')} votos proj.</div>`;
      } else if (_modoAtual === 'odds') {
        const odds = _calcOdds(l);
        badge = `<div style="width:40px;height:40px;border-radius:50%;background:${_corOdds(odds.prob)};display:flex;align-items:center;justify-content:center;color:#fff;">${odds.prob}%</div>`;
        valor = `<div style="font-size:13px;">odd ${odds.odd}x</div>`;
      } else {
        const vant = _calcOdds(l).vantagem;
        const cor = vant > 10 ? '#22c55e' : vant > 0 ? '#f59e0b' : '#ef4444';
        badge = `<div style="width:40px;height:40px;border-radius:50%;background:${cor};display:flex;align-items:center;justify-content:center;color:#fff;">${vant>0?'+':''}${vant}pp</div>`;
        valor = `<div style="font-size:13px;">Vantagem</div>`;
      }
      return `
        <div class="banner-item">
          ${badge}
          <div class="banner-info">
            <div class="banner-name">${l.nome}</div>
            <div class="banner-meta">ZE ${l.zona}ª · ${l.ns} seções</div>
          </div>
          <div style="text-align:right;">${valor}</div>
        </div>
      `;
    }).join('');
  }

  function _corPorGuto(pct) {
    if (pct < 20) return '#c0392b';
    if (pct < 35) return '#e67e22';
    if (pct < 50) return '#f1c40f';
    if (pct < 65) return '#27ae60';
    return '#1a7a40';
  }

  function _corOdds(prob) {
    if (prob >= 70) return '#22c55e';
    if (prob >= 55) return '#84cc16';
    if (prob >= 45) return '#f59e0b';
    if (prob >= 35) return '#f97316';
    return '#ef4444';
  }

  function _projetarColigacao(local) {
    const COLIGACAO = [
      { sigla:'PSD', pctEleitorado:12, transf:0.92, proprio:true },
      { sigla:'MDB', pctEleitorado:14, transf:0.68, proprio:false },
      { sigla:'PDT', pctEleitorado:7,  transf:0.55, proprio:false },
      { sigla:'SD',  pctEleitorado:5,  transf:0.48, proprio:false },
      { sigla:'PT',  pctEleitorado:11, transf:0.41, proprio:false },
    ];
    let total = local.votos_guto || 0;
    COLIGACAO.forEach(p => {
      if (!p.proprio) {
        const votosPartido = Math.round(local.el * p.pctEleitorado / 100 * 0.7);
        total += Math.round(votosPartido * p.transf);
      }
    });
    const pct = Math.round(total / (local.el * 0.7) * 100);
    return { pct: Math.min(pct, 97), votos: total };
  }

  function _calcOdds(local) {
    const proj = _projetarColigacao(local);
    const fHistorico = (local.pct_guto || 0) / 100;
    const fColigacao = Math.min(proj.pct / 52, 1.3);
    const score = fHistorico * 0.4 + fColigacao * 0.6;
    const prob = Math.min(Math.round(score * 100 * 1.1), 97);
    const odd = prob > 0 ? (100 / prob).toFixed(2) : '—';
    const vantagem = (local.pct_guto || 0) - 28; // exemplo
    return { prob, odd, vantagem };
  }

  global.intelInit = init;
  global.intelDestroy = destroy;
})(window);