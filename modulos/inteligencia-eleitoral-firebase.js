(function(global){'use strict';

let campanhaId=null;
let territorio={uf:'RS',municipio:'Viamão',slug:'viamao'};
let locais=[];
let operacao={};
let resultados={};
let configIntel={};
let diagnostico=null;
let filtro='todos';

const CARGOS_EQUIVALENTES={
  deputado_estadual:['deputado_estadual'],
  deputado_federal:['deputado_federal'],
  senador:['senador'],
  governador:['governador'],
  presidente:['presidente'],
  vereador:['vereador'],
  prefeito:['prefeito']
};

function init(id){
  campanhaId=id||localStorage.getItem('wwmx_campanha')||new URLSearchParams(location.search).get('c')||'angel-referencia-viamao';
  detectarTerritorio();
  style();
  renderShell('Carregando inteligência eleitoral...');
  carregar().then(render).catch(err=>{
    console.error('[intel-eleitoral]',err);
    renderErro(err);
  });
}

function destroy(){}

function detectarTerritorio(){
  const qs=new URLSearchParams(location.search);
  const uf=qs.get('uf')||localStorage.getItem('wwmx_uf')||'RS';
  const municipio=qs.get('municipio')||localStorage.getItem('wwmx_municipio')||'Viamão';
  territorio={uf,municipio,slug:slug(municipio)};
}

async function carregar(){
  const fonteLocais=await lerLocais();
  locais=normalizarLocais(fonteLocais.data);

  operacao=await dbGet(`campanhas/${campanhaId}/operacao/locais`)||{};

  configIntel=await dbGet(`campanhas/${campanhaId}/inteligencia/config`)||configPadrao();

  resultados=await carregarResultados(configIntel);

  diagnostico=gerarDiagnostico();
}

function configPadrao(){
  return {
    anoCampanha:2026,
    cargoPretendido:'deputado_estadual',
    uf:territorio.uf,
    municipio:territorio.municipio,
    candidato:{
      nome:'Candidato',
      numero:'',
      partido:'',
      temHistorico:false
    },
    historicos:[]
  };
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

async function carregarResultados(cfg){
  const principal=definirFontePrincipal(cfg);

  const caminhos=[
    `territorios/${territorio.uf}/${territorio.slug}/resultados/${principal.ano}/${principal.cargo}`,
    `resultados/${territorio.uf}/${territorio.slug}/${principal.ano}/${principal.cargo}`,
    `campanhas/${campanhaId}/inteligencia/resultados/${principal.ano}/${principal.cargo}`
  ];

  const encontrados=[];
  for(const path of caminhos){
    const data=await dbGet(path);
    encontrados.push({path,data:data||{},count:contar(data)});
  }

  encontrados.sort((a,b)=>b.count-a.count);
  return {
    fontePrincipal:principal,
    path:encontrados[0]?.path||caminhos[0],
    data:encontrados[0]?.data||{},
    count:encontrados[0]?.count||0
  };
}

function definirFontePrincipal(cfg){
  const cargo=cfg.cargoPretendido||'deputado_estadual';
  const historicos=Array.isArray(cfg.historicos)?cfg.historicos:[];
  const equivalentes=CARGOS_EQUIVALENTES[cargo]||[cargo];

  const historicoCompativel=historicos
    .filter(h=>equivalentes.includes(h.cargo))
    .sort((a,b)=>Number(b.ano||0)-Number(a.ano||0))[0];

  if(historicoCompativel){
    return {
      tipo:'historico_candidato_compativel',
      label:'Histórico do próprio candidato no mesmo cargo/cargo compatível',
      ano:Number(historicoCompativel.ano),
      cargo:historicoCompativel.cargo,
      candidato:historicoCompativel.candidato||cfg.candidato?.nome||'Candidato',
      partido:historicoCompativel.partido||cfg.candidato?.partido||''
    };
  }

  const historicoComplementar=historicos
    .filter(h=>!equivalentes.includes(h.cargo))
    .sort((a,b)=>Number(b.ano||0)-Number(a.ano||0))[0];

  return {
    tipo:'ultima_eleicao_mesmo_cargo',
    label:'Última eleição do mesmo cargo pretendido',
    ano:anoBasePorCargo(cargo,cfg.anoCampanha),
    cargo,
    candidato:null,
    partido:cfg.candidato?.partido||'',
    complementar:historicoComplementar?{
      label:'Histórico pessoal em cargo diferente usado apenas como presença territorial',
      ano:Number(historicoComplementar.ano),
      cargo:historicoComplementar.cargo,
      candidato:historicoComplementar.candidato||cfg.candidato?.nome||'Candidato',
      partido:historicoComplementar.partido||cfg.candidato?.partido||''
    }:null
  };
}

function anoBasePorCargo(cargo,anoCampanha){
  const ano=Number(anoCampanha||2026);

  if(['deputado_estadual','deputado_federal','senador','governador','presidente'].includes(cargo)){
    return ano>=2026?2022:ano-4;
  }

  if(['vereador','prefeito'].includes(cargo)){
    return ano>=2024?2024:ano-4;
  }

  return ano-4;
}

function gerarDiagnostico(){
  const fonte=resultados.fontePrincipal;
  const comEleitores=locais.filter(l=>l.eleitores).length;
  const semEleitores=locais.length-comEleitores;
  const resultadoDisponivel=resultados.count>0;

  const totalEleitores=locais.reduce((a,l)=>a+(l.eleitores||0),0);
  const totalMeta=locais.reduce((a,l)=>a+(Number(opDo(l.id).metaVotos)||0),0);

  const ranking=locais.map(l=>{
    const op=opDo(l.id);
    const r=resultadoLocal(l);
    const score=scoreLocal(l,op,r);
    return {local:l,op,r,score};
  }).sort((a,b)=>b.score-a.score);

  return {
    fonte,
    resultadoDisponivel,
    pathResultados:resultados.path,
    totalLocais:locais.length,
    comEleitores,
    semEleitores,
    totalEleitores,
    totalMeta,
    ranking,
    recomendacoes:recomendar(ranking,fonte,resultadoDisponivel)
  };
}

function resultadoLocal(local){
  const data=resultados.data||{};
  const porId=data[local.id];
  if(porId) return normalizarResultado(porId);

  const entries=Object.entries(data);
  const match=entries.find(([,v])=>{
    const nome=String(v.nome||v.local||'').toLowerCase();
    return nome&&nome===String(local.nome||'').toLowerCase();
  });

  return match?normalizarResultado(match[1]):null;
}

function normalizarResultado(v){
  return {
    votosCandidato:num(pick(v,['votos_candidato','votosCandidato','votos_proprio','votos'],0)),
    votosPartido:num(pick(v,['votos_partido','votosPartido'],0)),
    votosTotal:num(pick(v,['votos_total','votosTotal','total_votos'],0)),
    pctCandidato:num(pick(v,['pct_candidato','pctCandidato','percentual_candidato'],0)),
    abstencao:num(pick(v,['abstencao','pct_abstencao'],0))
  };
}

function scoreLocal(local,op,r){
  let score=0;

  if(local.eleitores) score+=Math.min(local.eleitores/100,80);

  if(op.prioridade==='Alta') score+=50;
  if(op.prioridade==='Média') score+=30;
  if(op.prioridade==='Baixa') score+=15;

  if(op.status==='Em andamento') score+=15;
  if(op.status==='Concluído') score-=10;
  if(op.status==='Bloqueado') score+=25;

  if(op.metaVotos) score+=Math.min(Number(op.metaVotos)/10,40);

  if(r?.pctCandidato) score+=r.pctCandidato*1.5;
  if(r?.votosPartido) score+=Math.min(r.votosPartido/50,40);

  if(!local.eleitores) score-=20;

  return Math.round(score);
}

function recomendar(ranking,fonte,temResultado){
  const top=ranking.slice(0,5).map(x=>x.local.nome);
  const semMeta=ranking.filter(x=>!x.op.metaVotos).slice(0,5).map(x=>x.local.nome);
  const altaSemResponsavel=ranking.filter(x=>x.op.prioridade==='Alta'&&!x.op.responsavel).slice(0,5).map(x=>x.local.nome);

  const rec=[];

  rec.push(`Fonte principal: ${fonte.label}.`);

  if(fonte.complementar){
    rec.push(`${fonte.complementar.label}: ${fonte.complementar.ano} · ${fonte.complementar.cargo}.`);
  }

  if(!temResultado){
    rec.push('Resultados oficiais ainda não importados. A análise usa território, eleitores e operação como base provisória.');
  }

  if(top.length){
    rec.push(`Priorizar leitura estratégica dos locais: ${top.join(', ')}.`);
  }

  if(semMeta.length){
    rec.push(`Definir meta de votos para: ${semMeta.join(', ')}.`);
  }

  if(altaSemResponsavel.length){
    rec.push(`Alta prioridade sem responsável: ${altaSemResponsavel.join(', ')}.`);
  }

  return rec;
}

function renderShell(msg){
  const c=document.getElementById('appView');
  if(!c) return;

  c.innerHTML=`
    <div class="dash-view intel-view">
      <div class="intel-hero">
        <div class="intel-kicker">PicoClaw · Inteligência eleitoral</div>
        <div class="intel-title">Inteligência Eleitoral</div>
        <div class="intel-desc">${esc(msg)}</div>
      </div>
    </div>
  `;
}

function renderErro(err){
  const c=document.getElementById('appView');
  if(!c) return;

  c.innerHTML=`
    <div class="dash-view intel-view">
      <div class="intel-hero">
        <div class="intel-kicker">Erro</div>
        <div class="intel-title">Inteligência Eleitoral</div>
        <div class="intel-desc">${esc(err.message||err)}</div>
      </div>
    </div>
  `;
}

function render(){
  const c=document.getElementById('appView');
  if(!c) return;

  if(!locais.length){
    c.innerHTML=`
      <div class="dash-view intel-view">
        <div class="intel-hero">
          <div class="intel-kicker">PicoClaw · Inteligência eleitoral</div>
          <div class="intel-title">Território pendente</div>
          <div class="intel-desc">Ainda não há locais de votação disponíveis para esta campanha.</div>
        </div>
      </div>
    `;
    return;
  }

  const fonte=diagnostico.fonte;

  c.innerHTML=`
    <div class="dash-view intel-view">
      <div class="intel-hero">
        <div class="intel-kicker">PicoClaw · Inteligência eleitoral</div>
        <div class="intel-title">Inteligência Eleitoral</div>
        <div class="intel-desc">
          Base principal: ${esc(fonte.ano)} · ${esc(labelCargo(fonte.cargo))} · ${esc(fonte.label)}
        </div>
      </div>

      <section class="intel-card">
        <div class="section-title">Regra de análise aplicada</div>
        <div class="intel-rule">
          <strong>${esc(fonte.label)}</strong>
          <span>Ano base: ${esc(fonte.ano)}</span>
          <span>Cargo base: ${esc(labelCargo(fonte.cargo))}</span>
          <span>Resultados: ${diagnostico.resultadoDisponivel?'disponíveis':'pendentes'}</span>
          ${fonte.complementar?`<span>Camada complementar: ${esc(fonte.complementar.ano)} · ${esc(labelCargo(fonte.complementar.cargo))}</span>`:''}
        </div>
        <code>${esc(diagnostico.pathResultados)}</code>
      </section>

      <div class="dash-stats">
        ${stat('Locais',diagnostico.totalLocais,'accent')}
        ${stat('Eleitores conhecidos',fmt(diagnostico.totalEleitores),'green')}
        ${stat('Eleitores pendentes',diagnostico.semEleitores,'red')}
        ${stat('Meta operacional',fmt(diagnostico.totalMeta),'yellow')}
        ${stat('Resultados',diagnostico.resultadoDisponivel?'OK':'Pendente',diagnostico.resultadoDisponivel?'green':'red')}
      </div>

      <section class="intel-card">
        <div class="section-title">Recomendações PicoClaw</div>
        <div class="intel-rec-list">
          ${diagnostico.recomendacoes.map(r=>`<div class="intel-rec">🧠 ${esc(r)}</div>`).join('')}
        </div>
      </section>

      <section class="intel-card">
        <div class="section-title">Filtros</div>
        <div class="intel-filters">
          <button class="chip ${filtro==='todos'?'active':''}" data-filtro="todos">Todos</button>
          <button class="chip ${filtro==='alta'?'active':''}" data-filtro="alta">Alta prioridade</button>
          <button class="chip ${filtro==='sem_meta'?'active':''}" data-filtro="sem_meta">Sem meta</button>
          <button class="chip ${filtro==='sem_resp'?'active':''}" data-filtro="sem_resp">Sem responsável</button>
          <button class="chip ${filtro==='sem_resultado'?'active':''}" data-filtro="sem_resultado">Sem resultado</button>
        </div>
      </section>

      <section>
        <div class="section-title">Ranking territorial</div>
        <div id="intelRanking"></div>
      </section>

      <div style="height:90px"></div>
    </div>
  `;

  document.querySelectorAll('[data-filtro]').forEach(btn=>{
    btn.onclick=()=>{
      filtro=btn.dataset.filtro;
      render();
    };
  });

  renderRanking();
}

function renderRanking(){
  const el=document.getElementById('intelRanking');
  if(!el) return;

  let lista=diagnostico.ranking;

  if(filtro==='alta') lista=lista.filter(x=>x.op.prioridade==='Alta');
  if(filtro==='sem_meta') lista=lista.filter(x=>!x.op.metaVotos);
  if(filtro==='sem_resp') lista=lista.filter(x=>!x.op.responsavel);
  if(filtro==='sem_resultado') lista=lista.filter(x=>!x.r);

  el.innerHTML=lista.map(cardRanking).join('')||'<div class="empty">Nenhum local para este filtro.</div>';
}

function cardRanking(item){
  const l=item.local;
  const op=item.op||{};
  const r=item.r;
  const prioridade=op.prioridade||'Sem prioridade';
  const status=op.status||'Pendente';

  return `
    <div class="intel-local">
      <div class="intel-score">${item.score}</div>
      <div class="intel-local-info">
        <strong>${esc(l.nome)}</strong>
        <small>Zona ${esc(l.zona)} · Seções ${esc(l.secoes)} · ${eleitoresLabel(l)}</small>
        <small>Prioridade: ${esc(prioridade)} · Status: ${esc(status)} · Responsável: ${esc(op.responsavel||'—')}</small>
        <small>Meta: ${fmt(op.metaVotos||0)} votos · Resultado: ${r?`${fmt(r.votosCandidato)} votos candidato / ${fmt(r.votosPartido)} partido`:'pendente'}</small>
      </div>
      <div class="intel-local-badges">
        <span class="intel-badge pri-${slug(prioridade)}">${esc(prioridade)}</span>
        <span class="intel-badge">${esc(status)}</span>
      </div>
    </div>
  `;
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
  const eleitores=Number(pick(v,['eleitores','el','qt_eleitores'],0));
  return {
    id,
    nome:pick(v,['nome','local','nome_local','nomeLocal','local_votacao'],'Local sem nome'),
    zona:pick(v,['zona','ze'],'—'),
    secoes:pick(v,['secoes','secao','ns'],'—'),
    eleitores:Number.isFinite(eleitores)&&eleitores>0?eleitores:null,
    bairro:pick(v,['bairro','regiao','zona_bairro'],''),
    endereco:pick(v,['endereco','address','enderecoCompleto'],'')
  };
}

async function dbGet(path){
  if(global.WWMX?.db?.val) return await WWMX.db.val(path)||{};
  if(global.WWMX?.db?.get){
    const snap=await WWMX.db.get(path);
    return snap&&typeof snap.val==='function'?(snap.val()||{}):(snap||{});
  }
  return {};
}

function opDo(id){return operacao?.[id]||{};}

function stat(label,value,color){
  return `<div class="stat-card total"><div class="stat-num ${color||'accent'}">${value}</div><div class="stat-label">${label}</div></div>`;
}

function labelCargo(cargo){
  return {
    deputado_estadual:'Deputado Estadual',
    deputado_federal:'Deputado Federal',
    senador:'Senador',
    governador:'Governador',
    presidente:'Presidente',
    vereador:'Vereador',
    prefeito:'Prefeito'
  }[cargo]||cargo;
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

function num(v){
  const n=Number(String(v??'').replace(',','.'));
  return Number.isFinite(n)?n:0;
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

function style(){
  if(document.getElementById('intelEleitoralStyle')) return;

  const s=document.createElement('style');
  s.id='intelEleitoralStyle';
  s.textContent=`
    .intel-hero{background:linear-gradient(135deg,rgba(132,255,0,.14),rgba(59,130,246,.10));border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px}
    .intel-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800}
    .intel-title{font-size:26px;font-weight:900;margin-top:4px}
    .intel-desc{color:var(--muted);margin-top:6px;line-height:1.45}
    .intel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px}
    .intel-rule{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .intel-rule span,.intel-rule strong{background:var(--surface2);border:1px solid var(--border);border-radius:999px;padding:8px 10px;font-size:12px}
    .intel-card code{display:block;color:var(--muted);font-size:11px;overflow:auto;margin-top:8px}
    .intel-rec-list{display:flex;flex-direction:column;gap:8px}
    .intel-rec{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px;color:var(--text)}
    .intel-filters{display:flex;gap:8px;flex-wrap:wrap}
    .chip.active{background:rgba(132,255,0,.18);border-color:rgba(132,255,0,.45)}
    .intel-local{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:8px;display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:12px;align-items:center}
    .intel-score{width:44px;height:44px;border-radius:999px;background:rgba(132,255,0,.16);display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--text)}
    .intel-local-info strong{display:block}.intel-local-info small{display:block;color:var(--muted);font-size:11px;margin-top:4px}
    .intel-local-badges{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
    .intel-badge{font-size:10px;border-radius:999px;padding:5px 8px;background:rgba(148,163,184,.16);color:var(--muted);white-space:nowrap}
    .pri-alta{background:rgba(239,68,68,.18);color:#ef4444}.pri-media{background:rgba(245,158,11,.18);color:#f59e0b}.pri-baixa{background:rgba(34,197,94,.18);color:#22c55e}
    @media(max-width:760px){.intel-local{grid-template-columns:44px 1fr}.intel-local-badges{grid-column:1/-1;align-items:flex-start;flex-direction:row;flex-wrap:wrap}}
  `;

  document.head.appendChild(s);
}

global.intelInit=init;
global.intelDestroy=destroy;

})(window);
