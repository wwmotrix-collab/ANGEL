/**
 * modulos/inteligencia-eleitoral.js
 * ANGEL — Inteligência eleitoral: TSE/TRE, zonas, seções, projeção, odds e PicoClaw.
 */
(function (global) {
  'use strict';

  let _campanhaId = null;
  let _modoAtual = 'guto';
  let _filtroZona = 'todos';
  let _mapaEleitoralAtivo = false;
  let _layers = [];

  const LOCAIS_TSE = [
    { id:1155,nome:'EEEM NISIA FLORESTA',zona:59,ns:30,el:9366,lat:-30.017165,lng:-51.022970,pct_guto:29.7,votos_guto:1965,votos_total:6618,bairro:'Centro / Santa Isabel' },
    { id:1090,nome:'EEEM AÇORIANOS',zona:59,ns:23,el:7952,lat:-30.084357,lng:-51.039468,pct_guto:35.6,votos_guto:1703,votos_total:4786,bairro:'Tarumã' },
    { id:1031,nome:'E. M. MONTE ALEGRE',zona:59,ns:18,el:6120,lat:-30.061120,lng:-51.016840,pct_guto:32.4,votos_guto:1247,votos_total:3849,bairro:'Monte Alegre' },
    { id:1078,nome:'E. M. PRESIDENTE VARGAS',zona:59,ns:17,el:5844,lat:-30.075600,lng:-51.024300,pct_guto:27.9,votos_guto:1010,votos_total:3620,bairro:'São Lucas' },
    { id:1122,nome:'COLÉGIO ESTADUAL SETEMBRINA',zona:59,ns:25,el:8380,lat:-30.047050,lng:-51.028920,pct_guto:38.1,votos_guto:2010,votos_total:5275,bairro:'Centro' },
    { id:1180,nome:'E. M. FARROUPILHA',zona:59,ns:16,el:5108,lat:-30.032950,lng:-51.015230,pct_guto:24.5,votos_guto:780,votos_total:3184,bairro:'Farroupilha' },
    { id:2011,nome:'EEEF ANA JOBIM',zona:72,ns:21,el:7020,lat:-30.104210,lng:-51.067430,pct_guto:41.2,votos_guto:1825,votos_total:4429,bairro:'Viamópolis' },
    { id:2045,nome:'E. M. APOLINÁRIO ALVES',zona:72,ns:20,el:6762,lat:-30.118540,lng:-51.058820,pct_guto:33.8,votos_guto:1440,votos_total:4260,bairro:'Augusta' },
    { id:2088,nome:'E. M. ALBERTO PASQUALINI',zona:72,ns:19,el:6425,lat:-30.129300,lng:-51.075200,pct_guto:22.7,votos_guto:923,votos_total:4066,bairro:'Krahe' },
    { id:2120,nome:'E. M. JARDIM UNIVERSITÁRIO',zona:72,ns:22,el:7310,lat:-30.096250,lng:-51.082170,pct_guto:30.9,votos_guto:1422,votos_total:4602,bairro:'Jardim Universitário' },
    { id:2144,nome:'E. E. MÁRIO QUINTANA',zona:72,ns:15,el:4930,lat:-30.141800,lng:-51.091100,pct_guto:18.8,votos_guto:584,votos_total:3106,bairro:'Itapuã / Rural' },
    { id:2181,nome:'E. M. RECANTO DA LAGOA',zona:72,ns:14,el:4360,lat:-30.154200,lng:-51.045600,pct_guto:44.6,votos_guto:1225,votos_total:2747,bairro:'Recanto / Águas Claras' }
  ];

  const COLIGACAO = [
    { sigla:'PSD', cor:'#98ff00', pctEleitorado:12, transf:0.92, proprio:true, desc:'base própria' },
    { sigla:'MDB', cor:'#22c55e', pctEleitorado:14, transf:0.68, proprio:false, desc:'transferência alta' },
    { sigla:'PDT', cor:'#ffdf00', pctEleitorado:7, transf:0.55, proprio:false, desc:'transferência média' },
    { sigla:'SD',  cor:'#8b5cf6', pctEleitorado:5, transf:0.48, proprio:false, desc:'transferência moderada' },
    { sigla:'PT',  cor:'#ef4444', pctEleitorado:11, transf:0.41, proprio:false, desc:'transferência sensível' }
  ];

  const ADVERSARIOS = [
    { nome:'Adversário A', base:26, zona59:1.08, zona72:.92, cor:'#ef4444' },
    { nome:'Adversário B', base:18, zona59:.88, zona72:1.14, cor:'#f59e0b' },
    { nome:'Adversário C', base:12, zona59:1.02, zona72:.98, cor:'#8b5cf6' }
  ];

  function init(campanhaId) { _campanhaId = campanhaId; _renderizar(); }
  function destroy() { _limparMapaEleitoral(); }

  function _renderizar() {
    const c = document.getElementById('appView');
    if (!c) return;
    const totalEleitores = LOCAIS_TSE.reduce((a,l)=>a+l.el,0);
    const totalSecoes = LOCAIS_TSE.reduce((a,l)=>a+l.ns,0);
    c.innerHTML = `
      <div class="dash-view">
        <div class="intel-hero">
          <div class="intel-kicker">PicoClaw · Inteligência eleitoral</div>
          <div class="intel-title">Território, TSE/TRE e projeção de votos</div>
          <div class="intel-desc">Cruza zonas, seções, locais de votação, histórico, coligação, CRM e operação de campo para priorizar território.</div>
        </div>
        <div class="dash-stats">
          ${_stat('Eleitores', totalEleitores.toLocaleString('pt-BR'), 'accent')}
          ${_stat('Seções', totalSecoes.toLocaleString('pt-BR'), 'green')}
          ${_stat('Locais', LOCAIS_TSE.length, 'yellow')}
          ${_stat('Meta estimada', _metaGeral().toLocaleString('pt-BR'), 'purple')}
        </div>
        <div class="intel-card"><div class="section-title">Coligação e transferência</div><div id="coligacaoBadges"></div><div id="coligacaoBar" class="intel-stack"></div></div>
        <div class="intel-tabs">
          ${_tab('guto','Histórico')}${_tab('coligacao','Coligação')}${_tab('odds','Projeção')}${_tab('adversarios','Adversários')}
        </div>
        <div class="intel-filters">
          ${_filter('todos','Todas ZE')}${_filter('59','ZE 59ª')}${_filter('72','ZE 72ª')}
          <button class="chip intel-action" id="btnMapaEleitoral">🗺️ Mapa</button>
          <button class="chip intel-action" id="btnCsvEleitoral">📥 CSV</button>
          <button class="chip intel-action" id="btnPicoRelatorio">🧠 PicoClaw</button>
        </div>
        <div id="picoPanel" class="intel-card" style="display:none;"></div>
        <div class="section-title" id="eleitoralListTitle">Locais de votação · Histórico</div>
        <div id="eleitoralList"></div>
        <div id="eleitoralLegenda" class="intel-legenda"></div>
        <div style="height:90px"></div>
      </div>`;
    _style();
    _renderColigacao();
    _renderLista();
    _bind();
  }

  function _bind() {
    document.querySelectorAll('[data-modo]').forEach(b=>b.onclick=()=>{_modoAtual=b.dataset.modo;_renderLista();_syncButtons();if(_mapaEleitoralAtivo)_plotarMapa();});
    document.querySelectorAll('[data-zona]').forEach(b=>b.onclick=()=>{_filtroZona=b.dataset.zona;_renderLista();_syncButtons();if(_mapaEleitoralAtivo)_plotarMapa();});
    document.getElementById('btnMapaEleitoral').onclick = () => { _mapaEleitoralAtivo = !_mapaEleitoralAtivo; _plotarMapa(); };
    document.getElementById('btnCsvEleitoral').onclick = _exportarCSV;
    document.getElementById('btnPicoRelatorio').onclick = _togglePico;
  }

  function _renderColigacao() {
    const badges = document.getElementById('coligacaoBadges');
    if (badges) badges.innerHTML = COLIGACAO.map(p=>`<span class="chip" style="border-color:${p.cor}66;color:${p.cor};background:${p.cor}18">${p.sigla} · ${Math.round(p.transf*100)}%</span>`).join('');
    const bar = document.getElementById('coligacaoBar');
    if (bar) bar.innerHTML = COLIGACAO.map(p=>`<div style="width:${p.pctEleitorado*2.2}%;background:${p.cor};" title="${p.sigla}"></div>`).join('');
  }

  function _renderLista() {
    const list = document.getElementById('eleitoralList');
    const title = document.getElementById('eleitoralListTitle');
    if (!list) return;
    const locais = _locaisFiltrados().sort(_sortAtual);
    const label = { guto:'Histórico', coligacao:'Coligação', odds:'Projeção/Odds', adversarios:'Adversários' }[_modoAtual];
    if (title) title.textContent = `Locais de votação · ${label}`;
    list.innerHTML = locais.map(_cardLocal).join('');
    const leg = document.getElementById('eleitoralLegenda');
    if (leg) leg.innerHTML = _legenda();
    _syncButtons();
  }

  function _cardLocal(l) {
    const col = _projetarColigacao(l), odds = _calcOdds(l), adv = _estimarAdversarios(l)[0];
    let badge = '', meta = '';
    if (_modoAtual === 'guto') { badge = _round(l.pct_guto+'%', _corHistorico(l.pct_guto)); meta = `${l.votos_guto.toLocaleString('pt-BR')} votos históricos`; }
    if (_modoAtual === 'coligacao') { badge = _round(col.pct+'%', '#3b82f6'); meta = `${col.votos.toLocaleString('pt-BR')} votos projetados`; }
    if (_modoAtual === 'odds') { badge = _round(odds.prob+'%', _corOdds(odds.prob)); meta = `odd ${odds.odd}x · ${odds.prioridade}`; }
    if (_modoAtual === 'adversarios') { badge = _round((odds.vantagem>0?'+':'')+odds.vantagem+'pp', odds.vantagem>8?'#22c55e':odds.vantagem>0?'#f59e0b':'#ef4444'); meta = `principal: ${adv.nome} · ${adv.pct}%`; }
    return `<div class="banner-item intel-local" onclick="WWMX.IntelEleitoral.focarLocal(${l.id})">${badge}<div class="banner-info"><div class="banner-name">${_esc(l.nome)}</div><div class="banner-meta">ZE ${l.zona}ª · ${l.ns} seções · ${l.el.toLocaleString('pt-BR')} eleitores · ${_esc(l.bairro)}</div><div class="intel-mini">${_barMini(l, col, odds)}</div></div><div style="text-align:right;font-size:12px;color:var(--muted);min-width:92px;">${meta}</div></div>`;
  }

  function _barMini(l,col,odds){return `<span>Hist. ${l.pct_guto}%</span><span>Col. ${col.pct}%</span><span>Prob. ${odds.prob}%</span>`;}
  function _sortAtual(a,b){ if(_modoAtual==='guto')return b.pct_guto-a.pct_guto; if(_modoAtual==='coligacao')return _projetarColigacao(b).pct-_projetarColigacao(a).pct; if(_modoAtual==='odds')return _calcOdds(b).prob-_calcOdds(a).prob; return _calcOdds(b).vantagem-_calcOdds(a).vantagem; }
  function _locaisFiltrados(){return LOCAIS_TSE.filter(l=>_filtroZona==='todos'||String(l.zona)===_filtroZona);}

  function _estimarAdversarios(local) {
    const residual = Math.max(100 - _projetarColigacao(local).pct, 3);
    const z = local.zona === 59 ? 'zona59' : 'zona72';
    const raw = ADVERSARIOS.map(a => ({ ...a, peso: a.base * a[z] * (1 + (local.el/100000)) }));
    const totalPeso = raw.reduce((s,a)=>s+a.peso,0) || 1;
    return raw.map(a => ({ nome:a.nome, cor:a.cor, pct:Math.round((a.peso/totalPeso)*residual), votos:Math.round(local.votos_total*((a.peso/totalPeso)*residual)/100) })).sort((a,b)=>b.pct-a.pct);
  }

  function _projetarColigacao(local) {
    let total = local.votos_guto || 0;
    COLIGACAO.forEach(p => { if (!p.proprio) { const votosPartido = Math.round(local.el * p.pctEleitorado / 100 * 0.7); total += Math.round(votosPartido * p.transf); } });
    const pct = Math.min(Math.round(total / Math.max(local.el * 0.7,1) * 100), 97);
    return { pct, votos: total };
  }

  function _calcOdds(local) {
    const proj = _projetarColigacao(local);
    const adv = _estimarAdversarios(local)[0];
    const pesoLocal = Math.min(local.el / 9000, 1.25);
    const forcaHistorica = (local.pct_guto || 0) / 100;
    const forcaColigacao = Math.min(proj.pct / 55, 1.35);
    const fragmentacao = 1 - Math.min((adv.pct || 0) / 100, .45);
    const score = (forcaHistorica * .34 + forcaColigacao * .46 + fragmentacao * .20) * (0.92 + pesoLocal*.08);
    const prob = Math.max(8, Math.min(Math.round(score * 100), 97));
    const odd = (100 / prob).toFixed(2);
    const vantagem = Math.round(proj.pct - adv.pct);
    const prioridade = vantagem < 5 && local.el > 6000 ? 'prioridade máxima' : vantagem < 10 ? 'disputa' : local.el > 7000 ? 'consolidar' : 'manter presença';
    return { prob, odd, vantagem, prioridade, adversario: adv.nome };
  }

  function _togglePico(){const p=document.getElementById('picoPanel'); if(!p)return; p.style.display=p.style.display==='none'?'block':'none'; p.innerHTML=_relatorioPico();}
  function _relatorioPico(){const locais=[..._locaisFiltrados()];const criticos=locais.map(l=>({l,o:_calcOdds(l),c:_projetarColigacao(l)})).sort((a,b)=>(a.o.vantagem-b.o.vantagem)||(b.l.el-a.l.el)).slice(0,5);return `<div class="section-title">🧠 Leitura PicoClaw</div><div class="intel-desc">O PicoClaw deve coletar dados oficiais TSE/TRE, normalizar zonas/seções, geocodificar endereços, comparar histórico do candidato/partido/coligação e gerar metas por local.</div>${criticos.map(x=>`<div class="tse-alerta ${x.o.vantagem<5?'danger':'warn'}"><b>${_esc(x.l.nome)}</b><br>ZE ${x.l.zona} · ${x.l.el.toLocaleString('pt-BR')} eleitores · vantagem ${x.o.vantagem}pp · ${x.o.prioridade}</div>`).join('')}<div class="intel-pre">pipeline: coletar_tse → normalizar_endereços → geocodificar → cruzar_histórico → projetar_coligação → classificar_prioridade → gerar_metas</div>`;}

  function _plotarMapa(){const btn=document.getElementById('btnMapaEleitoral'); if(btn)btn.textContent=_mapaEleitoralAtivo?'🙈 Ocultar mapa':'🗺️ Mapa'; if(!_mapaEleitoralAtivo)return _limparMapaEleitoral(); const map=WWMX.mapaInstance; if(!map){WWMX.UI?.showToast?.('Abra o mapa primeiro para ver os locais eleitorais','error');return;} _limparMapaEleitoral(); _locaisFiltrados().forEach(l=>{const col=_projetarColigacao(l),od=_calcOdds(l); const val=_modoAtual==='guto'?l.pct_guto:_modoAtual==='coligacao'?col.pct:_modoAtual==='odds'?od.prob:od.vantagem; const cor=_modoAtual==='guto'?_corHistorico(val):_modoAtual==='odds'?_corOdds(val):val<5?'#ef4444':val<12?'#f59e0b':'#22c55e'; const r=Math.max(8,Math.min(28,Math.sqrt(l.el)/4)); const layer=L.circleMarker([l.lat,l.lng],{radius:r,color:cor,fillColor:cor,fillOpacity:.28,weight:2}).addTo(map).bindPopup(`<b>${_esc(l.nome)}</b><br>ZE ${l.zona} · ${l.ns} seções<br>${l.el.toLocaleString('pt-BR')} eleitores<br>Histórico ${l.pct_guto}% · Coligação ${col.pct}% · Prob. ${od.prob}%`); _layers.push(layer);}); const pts=_locaisFiltrados().map(l=>[l.lat,l.lng]); if(pts.length)map.fitBounds(pts,{padding:[30,30]});}
  function _limparMapaEleitoral(){_layers.forEach(l=>{try{l.remove()}catch(_){}}); _layers=[];}
  function focarLocal(id){const l=LOCAIS_TSE.find(x=>x.id===id); const map=WWMX.mapaInstance; if(l&&map){map.setView([l.lat,l.lng],16); WWMX.UI?.showToast?.(`${l.nome} · ZE ${l.zona}`);}}
  function validarTseLider(lider){const local=_localMaisProximo(lider.lat,lider.lng)||_matchBairro(lider.bairro); if(!local)return {status:'sem_local',msg:'Sem local eleitoral aproximado.'}; const pct=Number(lider.votos||0)/Math.max(local.el,1)*100; const risco=pct>8?'danger':pct>3?'warn':'ok'; return {status:risco,local,percentual:pct.toFixed(2),msg:`${lider.votos||0} votos = ${pct.toFixed(2)}% de ${local.nome}`};}
  function _localMaisProximo(lat,lng){if(!lat||!lng)return null; return LOCAIS_TSE.map(l=>({...l,d:Math.hypot(l.lat-lat,l.lng-lng)})).sort((a,b)=>a.d-b.d)[0];}
  function _matchBairro(b){if(!b)return null; const s=String(b).toLowerCase(); return LOCAIS_TSE.find(l=>String(l.bairro).toLowerCase().includes(s)||s.includes(String(l.bairro).toLowerCase().split('/')[0].trim()))||null;}

  function _exportarCSV(){const rows=[['id','nome','zona','secoes','eleitores','bairro','historico_pct','coligacao_pct','coligacao_votos','prob','odd','vantagem','prioridade']].concat(_locaisFiltrados().map(l=>{const c=_projetarColigacao(l),o=_calcOdds(l);return [l.id,l.nome,l.zona,l.ns,l.el,l.bairro,l.pct_guto,c.pct,c.votos,o.prob,o.odd,o.vantagem,o.prioridade]})); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`angel-eleitoral-${_campanhaId||'demo'}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  function _stat(label,value,cls){return `<div class="stat-card total"><div class="stat-num ${cls}">${value}</div><div class="stat-label">${label}</div></div>`;}
  function _tab(m,l){return `<button class="status-opt ${_modoAtual===m?'active':''}" data-modo="${m}">${l}</button>`;}
  function _filter(z,l){return `<button class="status-opt ${_filtroZona===z?'active':''}" data-zona="${z}">${l}</button>`;}
  function _round(v,c){return `<div style="width:48px;height:48px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;flex-shrink:0;">${v}</div>`;}
  function _metaGeral(){return LOCAIS_TSE.reduce((a,l)=>a+_projetarColigacao(l).votos,0);}
  function _corHistorico(p){if(p<20)return'#ef4444';if(p<35)return'#f97316';if(p<50)return'#f59e0b';if(p<65)return'#22c55e';return'#15803d';}
  function _corOdds(p){if(p>=70)return'#22c55e';if(p>=55)return'#84cc16';if(p>=45)return'#f59e0b';if(p>=35)return'#f97316';return'#ef4444';}
  function _legenda(){return 'Cores indicam força relativa. Tamanho no mapa indica volume de eleitores. Dados demo devem ser substituídos por coleta oficial TSE/TRE via PicoClaw.';}
  function _syncButtons(){document.querySelectorAll('[data-modo]').forEach(b=>b.classList.toggle('active',b.dataset.modo===_modoAtual));document.querySelectorAll('[data-zona]').forEach(b=>b.classList.toggle('active',b.dataset.zona===_filtroZona));}
  function _esc(v){return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function _style(){if(document.getElementById('intelStyles'))return; const s=document.createElement('style'); s.id='intelStyles'; s.textContent='.intel-hero,.intel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px}.intel-kicker{font-size:10px;color:var(--angel-lime,var(--accent));text-transform:uppercase;letter-spacing:1.4px;font-weight:800}.intel-title{font-family:Syne,sans-serif;font-size:20px;font-weight:800;margin-top:4px}.intel-desc{font-size:12px;color:var(--muted);line-height:1.45;margin-top:6px}.intel-tabs,.intel-filters{display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;padding-bottom:2px}.intel-action{cursor:pointer;white-space:nowrap}.intel-stack{height:8px;background:var(--border);border-radius:8px;overflow:hidden;display:flex;margin-top:10px}.intel-stack div{height:8px}.intel-local{align-items:flex-start}.intel-mini{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.intel-mini span{font-size:10px;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:999px;padding:2px 6px}.intel-legenda{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:8px;font-size:11px;color:var(--muted)}.intel-pre{white-space:pre-wrap;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:10px;color:var(--muted);font-size:11px}.tse-alerta{font-size:12px;padding:8px 12px;border-radius:8px;margin-top:10px}.tse-alerta.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3)}.tse-alerta.warn{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3)}.tse-alerta.danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3)}'; document.head.appendChild(s);}

  global.WWMX = global.WWMX || {};
  global.WWMX.IntelEleitoral = { focarLocal, validarTseLider, locais: LOCAIS_TSE, projetarColigacao: _projetarColigacao, calcOdds: _calcOdds };
  global.intelInit = init;
  global.intelDestroy = destroy;
})(window);
