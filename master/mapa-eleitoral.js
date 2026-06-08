(function(global){'use strict';

let campanhaId=null;
let territorio={uf:'RS',municipio:'Viamão',slug:'viamao'};
let fonteAtual=null;
let locais=[];
let filtrados=[];
let selecionado=null;
let mapaLeaflet=null;
let mapaLayer=null;
let leafletPromise=null;

function init(camp){
  campanhaId=camp||localStorage.getItem('wwmx_campanha')||new URLSearchParams(location.search).get('c')||'angel-referencia-viamao';
  detectarTerritorio();
  render();
  carregar();
}

function destroy(){
  if(mapaLeaflet){
    mapaLeaflet.remove();
    mapaLeaflet=null;
    mapaLayer=null;
  }
}

function detectarTerritorio(){
  const qs=new URLSearchParams(location.search);
  const uf=qs.get('uf')||localStorage.getItem('wwmx_uf')||'RS';
  const municipio=qs.get('municipio')||localStorage.getItem('wwmx_municipio')||'Viamão';
  territorio={uf,municipio,slug:slug(municipio)};
}

function render(){
  const root=document.getElementById('appView');
  if(!root) return;

  root.innerHTML=`
    <div class="dash-view mapa-eleitoral-view">
      <div class="camp-hero">
        <div class="camp-kicker">Território · PINs eleitorais</div>
        <div class="camp-title">Mapa Eleitoral</div>
        <div class="camp-desc">Visualize locais de votação, zonas, seções, eleitores conhecidos e força territorial por ponto.</div>
      </div>

      <div id="mapaFonte" class="mapa-source-card"></div>
      <div id="mapaStats" class="dash-stats"></div>

      <section class="mapa-panel">
        <div class="section-title">Filtros territoriais</div>
        <div class="mapa-filters">
          <input id="mapaBusca" placeholder="Buscar local, bairro, zona..." />
          <select id="mapaZona"><option value="">Todas as zonas</option></select>
          <select id="mapaStatus">
            <option value="">Todos</option>
            <option value="com_geo">Com coordenada</option>
            <option value="sem_geo">Sem coordenada</option>
            <option value="com_eleitores">Com eleitores</option>
            <option value="sem_eleitores">Eleitores pendentes</option>
          </select>
          <button class="btn btn-ghost" id="mapaRecarregar">Recarregar</button>
        </div>
      </section>

      <section class="mapa-panel">
        <div class="section-title">Mapa territorial</div>
        <div id="mapaCanvas" class="mapa-canvas"></div>
      </section>

      <section class="mapa-panel">
        <div class="section-title">Locais / PINs</div>
        <div id="mapaLista" class="mapa-list"></div>
      </section>

      <section class="mapa-panel">
        <div class="section-title">Local selecionado</div>
        <div id="mapaDetalhe" class="empty"><div class="empty-icon">📍</div>Selecione um PIN ou local para ver os detalhes.</div>
      </section>
      <div style="height:90px"></div>
    </div>
  `;

  style();
  document.getElementById('mapaBusca').oninput=aplicarFiltros;
  document.getElementById('mapaZona').onchange=aplicarFiltros;
  document.getElementById('mapaStatus').onchange=aplicarFiltros;
  document.getElementById('mapaRecarregar').onclick=carregar;
}

async function carregar(){
  try{
    setLoading('Carregando base territorial...');
    const fonte=await lerLocais();
    fonteAtual=fonte;
    locais=normalizar(fonte.data);
    preencherZonas();
    aplicarFiltros();
  }catch(e){
    console.error('[mapa-eleitoral]',e);
    const msg=esc(e.message||e);
    const lista=document.getElementById('mapaLista');
    const canvas=document.getElementById('mapaCanvas');
    if(lista) lista.innerHTML=`<div class="empty err">Erro ao carregar mapa: ${msg}</div>`;
    if(canvas) canvas.innerHTML=`<div class="empty err">Erro ao carregar mapa: ${msg}</div>`;
  }
}

async function lerLocais(){
  const caminhos=[
    {tipo:'território global',path:`territorios/${territorio.uf}/${territorio.slug}/locais_votacao`},
    {tipo:'raiz compartilhada',path:'locais_votacao'},
    {tipo:'campanha legacy',path:`campanhas/${campanhaId}/territorio/locais_votacao`}
  ];

  const resultados=[];
  for(const item of caminhos){
    const data=await dbGet(item.path);
    resultados.push({...item,data:data||{},count:contar(data)});
  }
  resultados.sort((a,b)=>b.count-a.count);
  const melhor=resultados[0]||{tipo:caminhos[0].tipo,path:caminhos[0].path,data:{},count:0};
  return melhor.count>0?melhor:{tipo:caminhos[0].tipo,path:caminhos[0].path,data:{},count:0};
}

async function dbGet(path){
  if(global.WWMX?.db?.val) return await WWMX.db.val(path)||{};
  if(global.WWMX?.db?.get){
    const snap=await WWMX.db.get(path);
    return snap&&typeof snap.val==='function'?(snap.val()||{}):(snap||{});
  }
  throw new Error('Firebase RTDB indisponível.');
}

function normalizar(data){
  if(Array.isArray(data)) return data.map((v,i)=>normItem(v,v.id||String(i)));
  return Object.entries(data||{}).map(([id,v])=>normItem(v||{},id));
}

function normItem(v,id){
  const lat=Number(pick(v,['lat','latitude'],''));
  const lng=Number(pick(v,['lng','lon','longitude'],''));
  const eleitoresRaw=pick(v,['eleitores','el','qt_eleitores'],'');
  const eleitores=Number(eleitoresRaw);
  const votosCand=num(pick(v,['votos_candidato','votosCandidato','votos_do_candidato','votos_guto','votosGuto'],0));
  const pctCand=num(pick(v,['pct_candidato','pctCandidato','percentual_candidato','pct_guto','pctGuto'],0));

  return {
    raw:v,
    id,
    nome:pick(v,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome'),
    bairro:pick(v,['bairro','regiao','zona_bairro'],''),
    endereco:pick(v,['endereco','address','enderecoCompleto'],'Endereço não informado'),
    zona:pick(v,['zona','ze'],'—'),
    secoes:pick(v,['secoes','secao','ns'],'—'),
    eleitores:Number.isFinite(eleitores)&&eleitores>0?eleitores:null,
    votosTotal:num(pick(v,['votos_total','votosTotal','total_votos'],0)),
    votosCandidato:votosCand,
    pctCandidato:pctCand,
    lat:Number.isFinite(lat)?lat:null,
    lng:Number.isFinite(lng)?lng:null,
    geoStatus:pick(v,['geoStatus','geocodingStatus'],'')
  };
}

function aplicarFiltros(){
  const busca=(document.getElementById('mapaBusca')?.value||'').toLowerCase();
  const zona=document.getElementById('mapaZona')?.value||'';
  const status=document.getElementById('mapaStatus')?.value||'';

  filtrados=locais.filter(l=>{
    const hay=`${l.nome} ${l.bairro} ${l.endereco} ${l.zona}`.toLowerCase();
    if(busca&&!hay.includes(busca)) return false;
    if(zona&&String(l.zona)!==String(zona)) return false;
    if(status==='com_geo'&&!temGeo(l)) return false;
    if(status==='sem_geo'&&temGeo(l)) return false;
    if(status==='com_eleitores'&&!temEleitores(l)) return false;
    if(status==='sem_eleitores'&&temEleitores(l)) return false;
    return true;
  });

  stats();
  renderFonte();
  renderMapa();
  renderLista();
}

function preencherZonas(){
  const select=document.getElementById('mapaZona');
  if(!select) return;
  const zonas=[...new Set(locais.map(l=>l.zona).filter(z=>z&&z!=='—'))].sort((a,b)=>Number(a)-Number(b));
  select.innerHTML='<option value="">Todas as zonas</option>'+zonas.map(z=>`<option value="${escAttr(z)}">Zona ${esc(z)}</option>`).join('');
}

function stats(){
  const total=locais.length;
  const comGeo=locais.filter(temGeo).length;
  const semGeo=total-comGeo;
  const eleitoresConhecidos=locais.reduce((acc,l)=>acc+(temEleitores(l)?l.eleitores:0),0);
  const pendEleitores=locais.filter(l=>!temEleitores(l)).length;
  const el=document.getElementById('mapaStats');
  if(!el) return;
  el.innerHTML=`
    <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Locais</div></div>
    <div class="stat-card inst"><div class="stat-num green">${comGeo}</div><div class="stat-label">Com coordenada</div></div>
    <div class="stat-card ret"><div class="stat-num red">${semGeo}</div><div class="stat-label">Sem coordenada</div></div>
    <div class="stat-card total"><div class="stat-num yellow">${fmt(eleitoresConhecidos)}</div><div class="stat-label">Eleitores conhecidos</div></div>
    <div class="stat-card ret"><div class="stat-num red">${pendEleitores}</div><div class="stat-label">Eleitores pendentes</div></div>
  `;
}

function renderFonte(){
  const el=document.getElementById('mapaFonte');
  if(!el||!fonteAtual) return;
  el.innerHTML=`
    <div><span>Campanha:</span> <strong>${esc(campanhaId)}</strong></div>
    <div><span>Território:</span> <strong>${esc(territorio.uf)} / ${esc(territorio.slug)}</strong></div>
    <div><span>Fonte:</span> <strong>${esc(fonteAtual.tipo)}</strong></div>
    <code>${esc(fonteAtual.path)}</code>
  `;
}

function renderMapa(){
  const el=document.getElementById('mapaCanvas');
  if(!el) return;
  if(!filtrados.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">🗺️</div>Nenhum PIN encontrado para os filtros.</div>';
    return;
  }

  const comGeo=filtrados.filter(temGeo);
  const semGeo=filtrados.filter(l=>!temGeo(l));
  el.innerHTML=`
    <div class="mapa-real-head">
      <div><strong>${esc(territorio.municipio)} / ${esc(territorio.uf)}</strong><small>${comGeo.length} PINs com coordenada · ${semGeo.length} pendentes</small></div>
      <button class="btn btn-ghost btn-sm" id="mapaCentralizar">Centralizar</button>
    </div>
    <div id="mapaLeaflet" class="mapa-leaflet"></div>
    ${semGeo.length?`<div class="mapa-warn">⚠️ ${semGeo.length} locais ainda não têm coordenadas e ficam fora do mapa.</div>`:''}
  `;
  document.getElementById('mapaCentralizar').onclick=()=>centralizarMapa();

  loadLeaflet().then(()=>desenharMapaReal()).catch(err=>{
    console.error('[mapa-eleitoral] leaflet',err);
    fallbackMapaVisual();
  });
}

function loadLeaflet(){
  if(global.L) return Promise.resolve(global.L);
  if(leafletPromise) return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.getElementById('leafletCss')){
      const link=document.createElement('link');
      link.id='leafletCss';
      link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if(document.getElementById('leafletJs')){
      const wait=()=>global.L?resolve(global.L):setTimeout(wait,80);
      wait();
      return;
    }
    const script=document.createElement('script');
    script.id='leafletJs';
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload=()=>global.L?resolve(global.L):reject(new Error('Leaflet não inicializou.'));
    script.onerror=()=>reject(new Error('Falha ao carregar Leaflet/OpenStreetMap.'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function desenharMapaReal(){
  const el=document.getElementById('mapaLeaflet');
  if(!el||!global.L) return;
  const pins=filtrados.filter(temGeo);
  if(!pins.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">📍</div>Nenhum local com coordenada para plotar.</div>';
    return;
  }

  if(mapaLeaflet){
    mapaLeaflet.remove();
    mapaLeaflet=null;
    mapaLayer=null;
  }

  mapaLeaflet=L.map(el,{zoomControl:true,attributionControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapaLeaflet);
  mapaLayer=L.layerGroup().addTo(mapaLeaflet);

  pins.forEach(local=>{
    const marker=L.circleMarker([local.lat,local.lng],{
      radius:raioPin(local),
      weight:2,
      opacity:1,
      fillOpacity:.78
    });
    marker.bindPopup(`
      <div style="min-width:190px">
        <strong>${esc(local.nome)}</strong><br>
        <small>Zona ${esc(local.zona)} · Seções ${esc(local.secoes)}</small><br>
        <small>${eleitoresLabel(local)}</small><br>
        <small>${esc(local.endereco)}</small>
      </div>
    `);
    marker.on('click',()=>{
      selecionar(local.id);
      const detalheEl=document.getElementById('mapaDetalhe');
      if(detalheEl) detalheEl.scrollIntoView({behavior:'smooth',block:'center'});
    });
    marker.addTo(mapaLayer);
  });
  setTimeout(()=>{
    mapaLeaflet.invalidateSize();
    centralizarMapa();
  },120);
}

function centralizarMapa(){
  if(!mapaLeaflet||!global.L) return;
  const pins=filtrados.filter(temGeo);
  if(!pins.length) return;
  const bounds=L.latLngBounds(pins.map(l=>[l.lat,l.lng]));
  mapaLeaflet.fitBounds(bounds,{padding:[28,28],maxZoom:14});
}

function raioPin(local){
  if(!temEleitores(local)) return 7;
  if(local.eleitores>=9000) return 18;
  if(local.eleitores>=6000) return 15;
  if(local.eleitores>=3000) return 12;
  if(local.eleitores>=1000) return 9;
  return 7;
}

function fallbackMapaVisual(){
  const el=document.getElementById('mapaCanvas');
  if(!el) return;
  const comGeo=filtrados.filter(temGeo);
  const semGeo=filtrados.filter(l=>!temGeo(l));
  el.innerHTML=`
    <div class="mapa-mini">
      <div class="mapa-mini-head"><strong>${esc(territorio.municipio)} / ${esc(territorio.uf)}</strong><small>${comGeo.length} PINs com coordenada · ${semGeo.length} pendentes</small></div>
      <div class="pin-cloud">${filtrados.slice(0,160).map(pinHtml).join('')}</div>
      <div class="mapa-warn">Mapa real indisponível. Exibindo fallback visual.</div>
    </div>
  `;
}

function pinHtml(l){
  const size=pinSize(l);
  const cls=temGeo(l)?'ok':'pending';
  return `<button class="pin ${cls} s${size}" title="${escAttr(l.nome)}" onclick="mapaEleitoralSelecionar('${escAttr(l.id)}')"><span>${pinLabel(l)}</span></button>`;
}

function renderLista(){
  const el=document.getElementById('mapaLista');
  if(!el) return;
  if(!filtrados.length){
    el.innerHTML='<div class="empty">Nenhum local encontrado.</div>';
    return;
  }
  el.innerHTML=filtrados.map(l=>`
    <button class="mapa-item" onclick="mapaEleitoralSelecionar('${escAttr(l.id)}')">
      <div><strong>${esc(l.nome)}</strong><small>Zona ${esc(l.zona)} · Seções ${esc(l.secoes)} · ${eleitoresLabel(l)}</small><small>${esc(l.endereco)}</small></div>
      <span class="mapa-badge ${temGeo(l)?'ok':'warn'}">${temGeo(l)?'PIN':'Sem geo'}</span>
    </button>
  `).join('');
}

function selecionar(id){
  selecionado=locais.find(l=>String(l.id)===String(id));
  detalhe();
}

function detalhe(){
  const el=document.getElementById('mapaDetalhe');
  if(!el||!selecionado) return;
  const l=selecionado;
  el.innerHTML=`
    <div class="mapa-detail">
      <div class="camp-kicker">${temGeo(l)?'PIN confirmado':'Geocoding pendente'}</div>
      <div class="camp-title small">${esc(l.nome)}</div>
      <div class="camp-desc">${esc(l.endereco)}<br>${esc(l.bairro||'Bairro não informado')}</div>
      <div class="mapa-detail-grid">
        <div><strong>${esc(l.zona)}</strong><span>Zona</span></div>
        <div><strong>${esc(l.secoes)}</strong><span>Seções</span></div>
        <div><strong>${eleitoresLabel(l)}</strong><span>Eleitores</span></div>
        <div><strong>${fmt(l.votosTotal)}</strong><span>Votos total</span></div>
        <div><strong>${fmt(l.votosCandidato)}</strong><span>Votos candidato</span></div>
        <div><strong>${l.pctCandidato?l.pctCandidato+'%':'—'}</strong><span>% candidato</span></div>
      </div>
      <div class="mapa-coords"><code>lat: ${l.lat??'pendente'}</code><code>lng: ${l.lng??'pendente'}</code></div>
      <div class="camp-desc">Próxima etapa: #12 poderá marcar prioridade, meta, rota e responsável por este local.</div>
    </div>
  `;
}

function setLoading(msg){
  const lista=document.getElementById('mapaLista');
  const canvas=document.getElementById('mapaCanvas');
  if(lista) lista.innerHTML=`<div class="empty">${esc(msg)}</div>`;
  if(canvas) canvas.innerHTML=`<div class="empty"><div class="empty-icon">🗺️</div>${esc(msg)}</div>`;
}

function temGeo(l){return Number.isFinite(l.lat)&&Number.isFinite(l.lng);}
function temEleitores(l){return Number.isFinite(l.eleitores)&&l.eleitores>0;}
function eleitoresLabel(l){return temEleitores(l)?`${fmt(l.eleitores)} eleitores`:'eleitores pendentes';}
function pinSize(l){if(!temEleitores(l))return 1;if(l.eleitores>=9000)return 5;if(l.eleitores>=6000)return 4;if(l.eleitores>=3000)return 3;if(l.eleitores>=1000)return 2;return 1;}
function pinLabel(l){return temEleitores(l)?Math.round(l.eleitores/1000)+'k':'?';}
function pick(obj,keys,fallback=''){for(const k of keys){if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=='')return obj[k];}return fallback;}
function contar(data){if(!data)return 0;if(Array.isArray(data))return data.length;if(typeof data==='object')return Object.keys(data).length;return 0;}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function fmt(v){const n=Number(v||0);return Number.isFinite(n)?n.toLocaleString('pt-BR'):'0';}
function slug(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'territorio';}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escAttr(v){return esc(v).replace(/`/g,'');}

function style(){
  if(document.getElementById('mapaEleitoralStyle')) return;
  const s=document.createElement('style');
  s.id='mapaEleitoralStyle';
  s.textContent=`
    .mapa-source-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px;color:var(--muted);font-size:13px}.mapa-source-card div{margin-bottom:6px}.mapa-source-card strong{color:var(--text)}.mapa-source-card code{display:block;color:var(--muted);font-size:11px;overflow:auto}
    .mapa-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px}.mapa-filters{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px}
    .mapa-canvas{min-height:500px}.mapa-real-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.mapa-real-head small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.mapa-leaflet{height:480px;width:100%;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--bg);z-index:1}.mapa-warn{margin-top:10px;color:#f59e0b;font-size:12px}.leaflet-container{font-family:inherit}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#111827;color:#f9fafb}
    .mapa-mini{border:1px solid var(--border);border-radius:16px;padding:14px;background:radial-gradient(circle at 20% 10%,rgba(132,255,0,.12),transparent 30%),radial-gradient(circle at 80% 80%,rgba(59,130,246,.12),transparent 35%),var(--bg)}.mapa-mini-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.mapa-mini-head small{color:var(--muted)}.pin-cloud{display:flex;flex-wrap:wrap;gap:9px;align-content:flex-start;min-height:300px}.pin{border:1px solid var(--border);border-radius:999px;background:rgba(132,255,0,.14);color:var(--text);font-weight:800;display:flex;align-items:center;justify-content:center}.pin.ok{box-shadow:0 0 0 1px rgba(132,255,0,.25)}.pin.pending{background:rgba(245,158,11,.15)}.pin.s1{width:30px;height:30px;font-size:10px}.pin.s2{width:36px;height:36px;font-size:11px}.pin.s3{width:44px;height:44px;font-size:12px}.pin.s4{width:54px;height:54px;font-size:13px}.pin.s5{width:66px;height:66px;font-size:14px}
    .mapa-list{display:flex;flex-direction:column;gap:8px;max-height:520px;overflow:auto}.mapa-item{width:100%;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:10px;color:var(--text)}.mapa-item strong{display:block;font-size:14px}.mapa-item small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.mapa-badge{font-size:10px;border-radius:999px;padding:5px 8px;height:max-content}.mapa-badge.ok{background:rgba(34,197,94,.18);color:#22c55e}.mapa-badge.warn{background:rgba(245,158,11,.18);color:#f59e0b}
    .mapa-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.mapa-detail-grid div{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px}.mapa-detail-grid strong{display:block;font-size:18px}.mapa-detail-grid span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.mapa-coords{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.mapa-coords code{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px;color:var(--muted)}
    @media(max-width:760px){.mapa-filters{grid-template-columns:1fr}.mapa-real-head{align-items:flex-start;flex-direction:column}.mapa-leaflet{height:420px}.mapa-detail-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(s);
}

global.mapaEleitoralInit=init;
global.mapaEleitoralDestroy=destroy;
global.mapaEleitoralSelecionar=selecionar;

})(window);
