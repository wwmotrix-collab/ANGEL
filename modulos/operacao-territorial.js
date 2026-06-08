(function(global){'use strict';

let campanhaId=null;
let nivel='candidato';
let territorio={uf:'RS',municipio:'Viamão',slug:'viamao'};
let fonteAtual=null;
let locais=[];
let operacao={};
let filtrados=[];
let selecionado=null;

const PRIORIDADES=['Alta','Média','Baixa'];
const STATUS=['Pendente','Em andamento','Concluído','Bloqueado'];

function init(camp){
  campanhaId=camp||localStorage.getItem('wwmx_campanha')||new URLSearchParams(location.search).get('c')||'angel-referencia-viamao';
  nivel=localStorage.getItem('wwmx_nivel')||'candidato';
  detectarTerritorio();
  render();
  carregar();
}

function destroy(){}

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
    <div class="dash-view operacao-territorial-view">
      <div class="camp-hero">
        <div class="camp-kicker">Campanha · Operação territorial</div>
        <div class="camp-title">Operação Territorial</div>
        <div class="camp-desc">
          Transforme locais de votação em pontos de ação: prioridade, responsável, meta, status e observação operacional.
        </div>
      </div>

      <div id="opFonte" class="op-source-card"></div>
      <div id="opStats" class="dash-stats"></div>

      <section class="op-panel">
        <div class="section-title">Filtros operacionais</div>
        <div class="op-filters">
          <input id="opBusca" placeholder="Buscar local, bairro, zona, responsável..." />
          <select id="opPrioridade">
            <option value="">Todas prioridades</option>
            ${PRIORIDADES.map(p=>`<option value="${p}">${p}</option>`).join('')}
          </select>
          <select id="opStatus">
            <option value="">Todos status</option>
            ${STATUS.map(s=>`<option value="${s}">${s}</option>`).join('')}
          </select>
          <select id="opZona"><option value="">Todas zonas</option></select>
          <button class="btn btn-ghost" id="opRecarregar">Recarregar</button>
        </div>
      </section>

      <section class="op-panel">
        <div class="section-title">Locais operacionais</div>
        <div id="opLista" class="op-list"></div>
      </section>

      <section class="op-panel">
        <div class="section-title">Gestão do local</div>
        <div id="opDetalhe" class="empty">
          <div class="empty-icon">🧩</div>
          Selecione um local para definir prioridade, responsável, meta, status e observação.
        </div>
      </section>

      <div style="height:90px"></div>
    </div>
  `;

  style();

  document.getElementById('opBusca').oninput=aplicarFiltros;
  document.getElementById('opPrioridade').onchange=aplicarFiltros;
  document.getElementById('opStatus').onchange=aplicarFiltros;
  document.getElementById('opZona').onchange=aplicarFiltros;
  document.getElementById('opRecarregar').onclick=carregar;
}

async function carregar(){
  try{
    setLoading('Carregando operação territorial...');
    const fonte=await lerLocais();
    fonteAtual=fonte;
    locais=normalizarLocais(fonte.data);
    operacao=await dbGet(`campanhas/${campanhaId}/operacao/locais`)||{};
    preencherZonas();
    aplicarFiltros();
  }catch(e){
    console.error('[operacao-territorial]',e);
    const msg=esc(e.message||e);
    document.getElementById('opLista').innerHTML=`<div class="empty err">Erro ao carregar operação: ${msg}</div>`;
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
  return resultados[0]||{tipo:caminhos[0].tipo,path:caminhos[0].path,data:{},count:0};
}

async function dbGet(path){
  if(global.WWMX?.db?.val) return await WWMX.db.val(path)||{};
  if(global.WWMX?.db?.get){
    const snap=await WWMX.db.get(path);
    return snap&&typeof snap.val==='function'?(snap.val()||{}):(snap||{});
  }
  throw new Error('Firebase RTDB indisponível.');
}

async function dbSet(path,value){
  if(global.WWMX?.db?.set) return await WWMX.db.set(path,value);
  if(global.WWMX?.fs?.setDoc){
    const parts=path.split('/').filter(Boolean);
    return await WWMX.fs.setDoc(value,...parts);
  }
  throw new Error('Escrita no Firebase indisponível.');
}

function normalizarLocais(data){
  const arr=Array.isArray(data)
    ? data.map((v,i)=>normLocal(v,v.id||String(i)))
    : Object.entries(data||{}).map(([id,v])=>normLocal(v||{},id));

  return arr.sort((a,b)=>{
    const za=Number(a.zona)||9999;
    const zb=Number(b.zona)||9999;
    if(za!==zb) return za-zb;
    return a.nome.localeCompare(b.nome,'pt-BR');
  });
}

function normLocal(v,id){
  const eleitoresRaw=pick(v,['eleitores','el','qt_eleitores'],'');
  const eleitores=Number(eleitoresRaw);

  return {
    raw:v,
    id,
    nome:pick(v,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome'),
    bairro:pick(v,['bairro','regiao','zona_bairro'],''),
    endereco:pick(v,['endereco','address','enderecoCompleto'],'Endereço não informado'),
    zona:pick(v,['zona','ze'],'—'),
    secoes:pick(v,['secoes','secao','ns'],'—'),
    eleitores:Number.isFinite(eleitores)&&eleitores>0?eleitores:null,
    lat:numOuNull(pick(v,['lat','latitude'],'')),
    lng:numOuNull(pick(v,['lng','lon','longitude'],''))
  };
}

function opDo(localId){
  return operacao?.[localId]||{};
}

function aplicarFiltros(){
  const busca=(document.getElementById('opBusca')?.value||'').toLowerCase();
  const prioridade=document.getElementById('opPrioridade')?.value||'';
  const status=document.getElementById('opStatus')?.value||'';
  const zona=document.getElementById('opZona')?.value||'';

  filtrados=locais.filter(l=>{
    const op=opDo(l.id);
    const hay=`${l.nome} ${l.bairro} ${l.endereco} ${l.zona} ${op.responsavel||''}`.toLowerCase();
    if(busca&&!hay.includes(busca)) return false;
    if(prioridade&&(op.prioridade||'')!==prioridade) return false;
    if(status&&(op.status||'Pendente')!==status) return false;
    if(zona&&String(l.zona)!==String(zona)) return false;
    return true;
  });

  renderFonte();
  stats();
  renderLista();
  if(selecionado) detalhe();
}

function preencherZonas(){
  const select=document.getElementById('opZona');
  if(!select) return;
  const zonas=[...new Set(locais.map(l=>l.zona).filter(z=>z&&z!=='—'))].sort((a,b)=>Number(a)-Number(b));
  select.innerHTML='<option value="">Todas zonas</option>'+zonas.map(z=>`<option value="${escAttr(z)}">Zona ${esc(z)}</option>`).join('');
}

function renderFonte(){
  const el=document.getElementById('opFonte');
  if(!el||!fonteAtual) return;

  el.innerHTML=`
    <div><span>Campanha:</span> <strong>${esc(campanhaId)}</strong></div>
    <div><span>Território:</span> <strong>${esc(territorio.uf)} / ${esc(territorio.slug)}</strong></div>
    <div><span>Fonte dos locais:</span> <strong>${esc(fonteAtual.tipo)}</strong></div>
    <div><span>Operação salva em:</span> <strong>campanhas/${esc(campanhaId)}/operacao/locais</strong></div>
    <code>${esc(fonteAtual.path)}</code>
  `;
}

function stats(){
  const total=locais.length;
  const configurados=locais.filter(l=>Object.keys(opDo(l.id)).length).length;
  const alta=locais.filter(l=>opDo(l.id).prioridade==='Alta').length;
  const andamento=locais.filter(l=>opDo(l.id).status==='Em andamento').length;
  const concluidos=locais.filter(l=>opDo(l.id).status==='Concluído').length;
  const meta=locais.reduce((acc,l)=>acc+(Number(opDo(l.id).metaVotos)||0),0);

  const el=document.getElementById('opStats');
  if(!el) return;

  el.innerHTML=`
    <div class="stat-card total"><div class="stat-num accent">${total}</div><div class="stat-label">Locais</div></div>
    <div class="stat-card inst"><div class="stat-num green">${configurados}</div><div class="stat-label">Configurados</div></div>
    <div class="stat-card ret"><div class="stat-num red">${alta}</div><div class="stat-label">Alta prioridade</div></div>
    <div class="stat-card total"><div class="stat-num yellow">${andamento}</div><div class="stat-label">Em andamento</div></div>
    <div class="stat-card inst"><div class="stat-num green">${concluidos}</div><div class="stat-label">Concluídos</div></div>
    <div class="stat-card total"><div class="stat-num accent">${fmt(meta)}</div><div class="stat-label">Meta votos</div></div>
  `;
}

function renderLista(){
  const el=document.getElementById('opLista');
  if(!el) return;

  if(!filtrados.length){
    el.innerHTML='<div class="empty">Nenhum local encontrado para os filtros.</div>';
    return;
  }

  el.innerHTML=filtrados.map(l=>{
    const op=opDo(l.id);
    const prioridade=op.prioridade||'Sem prioridade';
    const status=op.status||'Pendente';
    return `
      <button class="op-item" onclick="operacaoTerritorialSelecionar('${escAttr(l.id)}')">
        <div class="op-item-main">
          <strong>${esc(l.nome)}</strong>
          <small>Zona ${esc(l.zona)} · Seções ${esc(l.secoes)} · ${eleitoresLabel(l)}</small>
          <small>${esc(l.endereco)}</small>
          ${op.responsavel?`<small>Responsável: ${esc(op.responsavel)}</small>`:''}
        </div>
        <div class="op-item-tags">
          <span class="op-badge pri-${slug(prioridade)}">${esc(prioridade)}</span>
          <span class="op-badge st-${slug(status)}">${esc(status)}</span>
        </div>
      </button>
    `;
  }).join('');
}

function selecionar(id){
  selecionado=locais.find(l=>String(l.id)===String(id));
  detalhe();
}

function detalhe(){
  const el=document.getElementById('opDetalhe');
  if(!el||!selecionado) return;

  const l=selecionado;
  const op=opDo(l.id);

  el.innerHTML=`
    <div class="op-detail">
      <div class="camp-kicker">Local operacional</div>
      <div class="camp-title small">${esc(l.nome)}</div>
      <div class="camp-desc">
        ${esc(l.endereco)}<br>
        Zona ${esc(l.zona)} · Seções ${esc(l.secoes)} · ${eleitoresLabel(l)}
      </div>

      <div class="op-form">
        <label>Prioridade
          <select id="opEditPrioridade">
            <option value="">Sem prioridade</option>
            ${PRIORIDADES.map(p=>`<option value="${p}" ${op.prioridade===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </label>

        <label>Status
          <select id="opEditStatus">
            ${STATUS.map(s=>`<option value="${s}" ${(op.status||'Pendente')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </label>

        <label>Responsável
          <input id="opEditResponsavel" value="${escAttr(op.responsavel||'')}" placeholder="Nome do coordenador/liderança" />
        </label>

        <label>Meta de votos
          <input id="opEditMeta" type="number" value="${escAttr(op.metaVotos||'')}" placeholder="Ex: 350" />
        </label>

        <label class="wide">Ação recomendada
          <input id="opEditAcao" value="${escAttr(op.acao||'')}" placeholder="Ex: visita, material, liderança, carro de som..." />
        </label>

        <label class="wide">Observação operacional
          <textarea id="opEditObs" placeholder="Registro de campo, risco, oportunidade, pedido local...">${esc(op.observacao||'')}</textarea>
        </label>
      </div>

      <div class="op-actions">
        <button class="btn btn-primary" id="opSalvar">Salvar operação do local</button>
        <button class="btn btn-ghost" id="opLimpar">Limpar local</button>
      </div>

      <div class="op-hint">
        Salva em <code>campanhas/${esc(campanhaId)}/operacao/locais/${esc(l.id)}</code>
      </div>
    </div>
  `;

  document.getElementById('opSalvar').onclick=salvarSelecionado;
  document.getElementById('opLimpar').onclick=limparSelecionado;
}

async function salvarSelecionado(){
  if(!selecionado) return;

  const id=selecionado.id;
  const payload={
    localId:id,
    nome:selecionado.nome,
    zona:selecionado.zona,
    prioridade:document.getElementById('opEditPrioridade').value,
    status:document.getElementById('opEditStatus').value||'Pendente',
    responsavel:document.getElementById('opEditResponsavel').value.trim(),
    metaVotos:Number(document.getElementById('opEditMeta').value||0),
    acao:document.getElementById('opEditAcao').value.trim(),
    observacao:document.getElementById('opEditObs').value.trim(),
    atualizadoEm:Date.now()
  };

  await dbSet(`campanhas/${campanhaId}/operacao/locais/${id}`,payload);
  operacao[id]=payload;
  aplicarFiltros();
  toast('✅ Operação salva.');
}

async function limparSelecionado(){
  if(!selecionado) return;

  const id=selecionado.id;
  const payload={
    localId:id,
    nome:selecionado.nome,
    zona:selecionado.zona,
    prioridade:'',
    status:'Pendente',
    responsavel:'',
    metaVotos:0,
    acao:'',
    observacao:'',
    atualizadoEm:Date.now(),
    limpo:true
  };

  await dbSet(`campanhas/${campanhaId}/operacao/locais/${id}`,payload);
  operacao[id]=payload;
  aplicarFiltros();
  toast('🧹 Local limpo.');
}

function setLoading(msg){
  const lista=document.getElementById('opLista');
  if(lista) lista.innerHTML=`<div class="empty">${esc(msg)}</div>`;
}

function eleitoresLabel(l){
  return l.eleitores?`${fmt(l.eleitores)} eleitores`:'eleitores pendentes';
}

function pick(obj,keys,fallback=''){
  for(const k of keys){
    if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=='') return obj[k];
  }
  return fallback;
}

function contar(data){
  if(!data) return 0;
  if(Array.isArray(data)) return data.length;
  if(typeof data==='object') return Object.keys(data).length;
  return 0;
}

function numOuNull(v){
  const n=Number(String(v??'').replace(',','.'));
  return Number.isFinite(n)?n:null;
}

function fmt(v){
  const n=Number(v||0);
  return Number.isFinite(n)?n.toLocaleString('pt-BR'):'0';
}

function slug(value){
  return String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    || 'vazio';
}

function esc(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function escAttr(v){
  return esc(v).replace(/`/g,'');
}

function toast(msg){
  let el=document.getElementById('opToast');
  if(!el){
    el=document.createElement('div');
    el.id='opToast';
    el.className='op-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2600);
}

function style(){
  if(document.getElementById('operacaoTerritorialStyle')) return;

  const s=document.createElement('style');
  s.id='operacaoTerritorialStyle';
  s.textContent=`
    .op-source-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px;color:var(--muted);font-size:13px}
    .op-source-card div{margin-bottom:6px}.op-source-card strong{color:var(--text)}.op-source-card code{display:block;color:var(--muted);font-size:11px;overflow:auto}
    .op-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px}
    .op-filters{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:10px}
    .op-list{display:flex;flex-direction:column;gap:8px;max-height:620px;overflow:auto}
    .op-item{width:100%;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:10px;color:var(--text)}
    .op-item-main strong{display:block;font-size:14px}.op-item-main small{display:block;color:var(--muted);font-size:11px;margin-top:4px}
    .op-item-tags{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
    .op-badge{font-size:10px;border-radius:999px;padding:5px 8px;background:rgba(148,163,184,.16);color:var(--muted);white-space:nowrap}
    .pri-alta{background:rgba(239,68,68,.18);color:#ef4444}.pri-media{background:rgba(245,158,11,.18);color:#f59e0b}.pri-baixa{background:rgba(34,197,94,.18);color:#22c55e}
    .st-concluido{background:rgba(34,197,94,.18);color:#22c55e}.st-em-andamento{background:rgba(59,130,246,.18);color:#3b82f6}.st-bloqueado{background:rgba(239,68,68,.18);color:#ef4444}
    .op-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
    .op-form label{display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .op-form .wide{grid-column:1/-1}.op-form textarea{min-height:110px;resize:vertical}
    .op-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
    .op-hint{color:var(--muted);font-size:12px;margin-top:12px}.op-hint code{font-size:11px}
    .op-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:10px 16px;color:var(--text);opacity:0;pointer-events:none;transition:.2s;z-index:9999}
    .op-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    @media(max-width:760px){.op-filters,.op-form{grid-template-columns:1fr}.op-item{flex-direction:column}.op-item-tags{align-items:flex-start;flex-direction:row;flex-wrap:wrap}}
  `;
  document.head.appendChild(s);
}

global.operacaoTerritorialInit=init;
global.operacaoTerritorialDestroy=destroy;
global.operacaoTerritorialSelecionar=selecionar;

})(window);
