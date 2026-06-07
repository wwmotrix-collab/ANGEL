(function(global){'use strict';

let campanhaId=null;
let territorio={uf:'RS',municipio:'Viamão',slug:'viamao'};
let fonteAtual='';
let fonteTipo='';
let locais=[];
let selecionado=null;

function init(camp){
  const qs=new URLSearchParams(location.search);
  campanhaId = camp || localStorage.getItem('wwmx_campanha') || qs.get('c') || 'angel-referencia-viamao';
  territorio.uf=(qs.get('uf')||'RS').toUpperCase();
  territorio.municipio=qs.get('municipio')||qs.get('cidade')||territorio.municipio||'Viamão';
  territorio.slug=slug(territorio.municipio);
  render();
  carregar();
}

function destroy(){}

function render(){
  const root=document.getElementById('appView');
  if(!root)return;

  root.innerHTML=`
    <div class="dash-view geo-view">
      <div class="camp-hero">
        <div class="camp-kicker">PicoClaw · Geocoding</div>
        <div class="camp-title">Geocoding eleitoral</div>
        <div class="camp-desc">
          Revise endereços TSE/TRE importados, confirme coordenadas e prepare os PINs eleitorais para o mapa territorial.
        </div>
        <div id="geoFonte" class="geo-source"></div>
      </div>

      <div id="geoStats" class="dash-stats"></div>

      <div class="geo-grid">
        <section class="geo-panel">
          <div class="section-title">Locais de votação</div>
          <div class="geo-tools">
            <select id="geoFiltro">
              <option value="todos">Todos</option>
              <option value="sem_geo">Sem coordenada</option>
              <option value="pendente">Pendente revisão</option>
              <option value="confirmado">Confirmados</option>
              <option value="erro">Com erro</option>
            </select>
            <button class="btn btn-ghost" id="geoRecarregar">Recarregar</button>
          </div>
          <div id="geoLista" class="geo-list"></div>
        </section>

        <section class="geo-panel">
          <div class="section-title">Revisão manual</div>
          <div id="geoDetalhe" class="empty">
            <div class="empty-icon">🧭</div>
            Selecione um local para revisar.
          </div>
        </section>
      </div>

      <div style="height:90px"></div>
    </div>
  `;

  style();
  document.getElementById('geoFiltro').onchange=listar;
  document.getElementById('geoRecarregar').onclick=carregar;
}

async function carregar(){
  try{
    setStatus('Carregando locais...');
    const result = await lerLocais();
    locais = normalizar(result.data);
    fonteAtual = result.path;
    fonteTipo = result.tipo;
    atualizarFonte();
    stats();
    listar();
  }catch(e){
    console.error('[geocoding]',e);
    setStatus('Erro ao carregar locais: '+(e.message||e),'error');
    atualizarFonte(String(e.message||e));
  }
}

async function lerLocais(){
  const caminhos=[
    {tipo:'territorio_global',path:`territorios/${territorio.uf}/${territorio.slug}/locais_votacao`},
    {tipo:'raiz_compatibilidade',path:'locais_votacao'},
    {tipo:'campanha_legacy',path:`campanhas/${campanhaId}/territorio/locais_votacao`}
  ];

  const resultados=[];

  for(const item of caminhos){
    const data=await dbGet(item.path);
    resultados.push({
      ...item,
      data:data||{},
      count:contar(data)
    });
  }

  // Escolhe a fonte com mais registros.
  // Isso evita parar numa base global antiga com só 2 locais
  // quando a raiz compartilhada já tem os 78 importados.
  resultados.sort((a,b)=>b.count-a.count);

  const melhor=resultados[0] || {
    tipo:caminhos[0].tipo,
    path:caminhos[0].path,
    data:{},
    count:0
  };

  return melhor.count>0
    ? melhor
    : {tipo:caminhos[0].tipo,path:caminhos[0].path,data:{},count:0};
}

async function dbGet(path){
  if(global.WWMX?.db?.val){
    return await WWMX.db.val(path) || {};
  }

  if(global.WWMX?.db?.get){
    const snap = await WWMX.db.get(path);
    return snap && typeof snap.val === 'function' ? (snap.val() || {}) : (snap || {});
  }

  if(global.WWMX?.fs?.getCol){
    const parts=path.split('/').filter(Boolean);
    if(parts[0]==='campanhas' && parts.length>=4){
      return await WWMX.fs.getCol(parts[0],parts[1],parts[2],parts[3]) || [];
    }
  }

  throw new Error('Firebase não disponível.');
}

function contar(data){
  if(Array.isArray(data))return data.length;
  if(data && typeof data==='object')return Object.keys(data).length;
  return 0;
}

function normalizar(data){
  if(Array.isArray(data)) return data.map((x,i)=>({id:x.id||x.key||String(i),...x}));
  return Object.entries(data||{}).map(([id,v])=>({id,...(v||{})}));
}

function atualizarFonte(extra){
  const el=document.getElementById('geoFonte');
  if(!el)return;
  const origem=fundoFonte(fonteTipo);
  el.innerHTML=`
    <span>Campanha: <strong>${esc(campanhaId)}</strong></span>
    <span>Território: <strong>${esc(territorio.uf)} / ${esc(territorio.slug)}</strong></span>
    <span>Fonte: <strong>${esc(origem)}</strong></span>
    <small>${esc(fonteAtual||extra||'')}</small>
  `;
}

function fundoFonte(tipo){
  return ({
    territorio_global:'território global',
    raiz_compatibilidade:'raiz compartilhada',
    campanha_legacy:'campanha legada'
  })[tipo]||'território global';
}

function stats(){
  const el=document.getElementById('geoStats');
  if(!el)return;

  const total=locais.length;
  const sem=locais.filter(l=>!num(l.lat)||!num(l.lng)).length;
  const pend=locais.filter(l=>['pendente','automatico','revisao','ok'].includes(statusGeo(l))).length;
  const conf=locais.filter(l=>statusGeo(l)==='confirmado').length;

  el.innerHTML=`
    <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Locais</div></div>
    <div class="stat-card ret"><div class="stat-num red">${sem}</div><div class="stat-label">Sem coordenada</div></div>
    <div class="stat-card inst"><div class="stat-num yellow">${pend}</div><div class="stat-label">Revisar</div></div>
    <div class="stat-card inst"><div class="stat-num green">${conf}</div><div class="stat-label">Confirmados</div></div>
  `;
}

function listar(){
  const box=document.getElementById('geoLista');
  if(!box)return;

  const filtro=document.getElementById('geoFiltro')?.value||'todos';
  let arr=locais.slice();

  if(filtro==='sem_geo') arr=arr.filter(l=>!num(l.lat)||!num(l.lng));
  if(filtro==='pendente') arr=arr.filter(l=>['pendente','automatico','revisao','ok'].includes(statusGeo(l)));
  if(filtro==='confirmado') arr=arr.filter(l=>statusGeo(l)==='confirmado');
  if(filtro==='erro') arr=arr.filter(l=>statusGeo(l)==='erro');

  if(!arr.length){
    box.innerHTML='<div class="empty"><div class="empty-icon">🗳️</div>Nenhum local encontrado para este filtro.</div>';
    return;
  }

  box.innerHTML=arr.map(l=>`
    <button class="geo-item" onclick="geocodingSelecionar('${escAttr(l.id)}')">
      <div>
        <strong>${esc(nomeLocal(l))}</strong>
        <small>Zona ${esc(valor(l,['zona','ze'],'—'))} · Seções ${esc(valor(l,['secoes','secao','ns'],'—'))} · ${esc(valor(l,['eleitores','el','qt_eleitores'],0))} eleitores</small>
        <small>${esc(enderecoLocal(l))}</small>
      </div>
      <span class="geo-badge ${statusGeo(l)}">${labelStatus(statusGeo(l))}</span>
    </button>
  `).join('');
}

function selecionar(id){
  selecionado=locais.find(l=>String(l.id)===String(id));
  detalhe();
}

function detalhe(){
  const el=document.getElementById('geoDetalhe');
  if(!el||!selecionado)return;

  const l=selecionado;
  const lat=num(l.lat)||'';
  const lng=num(l.lng)||'';

  el.innerHTML=`
    <div class="geo-detail">
      <div class="camp-kicker">${esc(statusGeo(l))}</div>
      <div class="camp-title small">${esc(nomeLocal(l))}</div>
      <div class="camp-desc">
        Zona ${esc(valor(l,['zona','ze'],'—'))} · Seções ${esc(valor(l,['secoes','secao','ns'],'—'))} · ${esc(valor(l,['eleitores','el','qt_eleitores'],0))} eleitores<br>
        ${esc(enderecoLocal(l))}<br>
        ${esc(valor(l,['bairro','regiao','zona_bairro'],''))}
      </div>

      <div class="geo-map-placeholder">
        <div>🗺️</div>
        <strong>Mapa de revisão</strong>
        <small>Coordenada global do local. Prioridade/meta ficam no overlay da campanha.</small>
      </div>

      <div class="grid-form">
        <div class="field"><label>Latitude</label><input id="geoLat" type="number" step="0.000001" value="${esc(lat)}"></div>
        <div class="field"><label>Longitude</label><input id="geoLng" type="number" step="0.000001" value="${esc(lng)}"></div>
        <div class="field"><label>Fonte</label><select id="geoSource">
          <option value="manual">Manual</option>
          <option value="importado">Importado</option>
          <option value="cache">Cache</option>
          <option value="nominatim">Nominatim</option>
        </select></div>
        <div class="field"><label>Score</label><input id="geoScore" type="number" step="0.01" value="${esc(l.geoScore||1)}"></div>
      </div>

      <div class="geo-actions">
        <button class="btn btn-primary" onclick="geocodingConfirmar()">Confirmar coordenada</button>
        <button class="btn btn-ghost" onclick="geocodingMarcarErro()">Marcar erro</button>
      </div>

      <div id="geoMsg" class="camp-desc"></div>
    </div>
  `;
}

async function confirmar(){
  if(!selecionado)return;

  const lat=Number(document.getElementById('geoLat').value);
  const lng=Number(document.getElementById('geoLng').value);

  if(!Number.isFinite(lat)||!Number.isFinite(lng)){
    msg('Informe latitude e longitude válidas.','error');
    return;
  }

  await salvarGeo(selecionado.id,{
    lat,lng,
    geoStatus:'confirmado',
    geocodingStatus:'confirmado',
    geoSource:document.getElementById('geoSource').value||'manual',
    geoScore:Number(document.getElementById('geoScore').value||1),
    revisadoPor:'master',
    revisadoEm:Date.now()
  });

  msg('✅ Coordenada confirmada.','success');
  await carregar();
  selecionar(selecionado.id);
}

async function marcarErro(){
  if(!selecionado)return;

  await salvarGeo(selecionado.id,{
    geoStatus:'erro',
    geocodingStatus:'erro',
    geoSource:'manual',
    revisadoPor:'master',
    revisadoEm:Date.now()
  });

  msg('⚠️ Local marcado com erro.','error');
  await carregar();
}

async function salvarGeo(id,patch){
  const base=fonteAtual||`territorios/${territorio.uf}/${territorio.slug}/locais_votacao`;
  const path=`${base}/${id}`;

  if(global.WWMX?.db?.update){
    await WWMX.db.update(path,patch);
  }else if(global.WWMX?.db?.set){
    const atual=locais.find(l=>String(l.id)===String(id))||{};
    await WWMX.db.set(path,{...atual,...patch});
  }else{
    throw new Error('Firebase RTDB indisponível para salvar.');
  }

  const cacheKey=hashEndereco(enderecoLocal(selecionado)||id);
  const cachePath=(fonteTipo==='campanha_legacy')
    ? `campanhas/${campanhaId}/territorio/geo_cache/${cacheKey}`
    : `territorios/${territorio.uf}/${territorio.slug}/geo_cache/${cacheKey}`;

  if(global.WWMX?.db?.set){
    await WWMX.db.set(cachePath,{
      endereco:enderecoLocal(selecionado),
      localId:id,
      ...patch,
      atualizadoEm:Date.now()
    });
  }
}

function nomeLocal(l){return valor(l,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome')}
function enderecoLocal(l){return valor(l,['endereco','address','enderecoCompleto'],'Endereço não informado')}

function valor(obj, keys, fallback=''){
  for(const k of keys){
    if(obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function pick(obj, keys, fallback=''){return valor(obj,keys,fallback)}

function statusGeo(l){
  if(l.geoStatus)return String(l.geoStatus);
  if(l.geocodingStatus==='ok')return 'automatico';
  if(l.geocodingStatus)return String(l.geocodingStatus);
  if(num(l.lat)&&num(l.lng))return 'automatico';
  return 'pendente';
}

function labelStatus(s){
  return ({pendente:'Pendente',automatico:'Revisar',ok:'Revisar',revisao:'Revisar',confirmado:'Confirmado',erro:'Erro'})[s]||s;
}

function setStatus(text,type){
  const el=document.getElementById('geoLista');
  if(el)el.innerHTML=`<div class="empty ${type==='error'?'err':''}">${esc(text)}</div>`;
}

function msg(text,type){
  const el=document.getElementById('geoMsg');
  if(el){
    el.textContent=text;
    el.style.color=type==='error'?'var(--red)':'var(--angel-lime,var(--accent))';
  }
  global.WWMX?.UI?.showToast?.(text,type||'success');
}

function hashEndereco(v){return slug(String(v||'')).slice(0,80)||'sem-endereco'}
function slug(v){
  return String(v||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80)||'sem-id';
}

function num(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

function esc(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function escAttr(v){
  return esc(v).replace(/`/g,'');
}

function style(){
  if(document.getElementById('geoStyle'))return;
  const s=document.createElement('style');
  s.id='geoStyle';
  s.textContent=`
    .geo-source{display:flex;flex-direction:column;gap:4px;margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.03);color:var(--muted);font-size:12px;line-height:1.35}
    .geo-source strong{color:var(--text)}
    .geo-source small{font-family:ui-monospace,monospace;color:var(--muted);overflow-wrap:anywhere}
    .geo-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
    .geo-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
    .geo-tools{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px}
    .geo-list{display:flex;flex-direction:column;gap:8px;max-height:520px;overflow:auto}
    .geo-item{width:100%;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:10px;color:var(--text)}
    .geo-item strong{display:block;font-size:14px}
    .geo-item small{display:block;color:var(--muted);font-size:11px;margin-top:3px}
    .geo-badge{font-size:10px;border-radius:999px;padding:5px 8px;height:max-content;background:#1f2937;color:#fff}
    .geo-badge.confirmado{background:rgba(34,197,94,.18);color:#22c55e}
    .geo-badge.pendente,.geo-badge.automatico,.geo-badge.ok,.geo-badge.revisao{background:rgba(245,158,11,.18);color:#f59e0b}
    .geo-badge.erro{background:rgba(239,68,68,.18);color:#ef4444}
    .geo-map-placeholder{height:220px;border:1px dashed var(--border);border-radius:14px;background:linear-gradient(135deg,rgba(132,255,0,.08),rgba(59,130,246,.08));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;margin:14px 0;color:var(--muted)}
    .geo-map-placeholder div{font-size:36px}
    .geo-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media(max-width:720px){.geo-grid{grid-template-columns:1fr}.geo-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

global.geocodingEleitoralInit=init;
global.geocodingEleitoralDestroy=destroy;
global.geocodingSelecionar=selecionar;
global.geocodingConfirmar=confirmar;
global.geocodingMarcarErro=marcarErro;

})(window);
