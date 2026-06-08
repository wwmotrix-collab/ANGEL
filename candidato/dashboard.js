/**
 * candidato/dashboard.js
 * ANGEL — Dashboard do candidato com identidade vinda da configuração da campanha.
 */
(function(global){
  'use strict';

  let _campanhaId = null;
  let _unsub = null;
  let _config = null;

  function init(campanhaId){
    _campanhaId = campanhaId;
    render();
    carregarConfig().then(assinar);
  }

  function destroy(){
    if (_unsub) _unsub();
    _unsub = null;
  }

  function render(){
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `<div class="dash-view"><div id="adminDashContent"></div></div>`;
  }

  async function carregarConfig(){
    try { _config = await WWMX.carregarConfigCampanha(_campanhaId) || {}; }
    catch(_) { _config = {}; }
  }

  function assinar(){
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}`, snap => {
      const data = snap.val() || {};
      renderDash(
        Object.values(data.pins || {}),
        Object.values(data.crm_liderancas || {}),
        Object.values(data.percursos || {}),
        Object.values(data.denuncias || {}).filter(d => d.status !== 'resolvida')
      );
    });
  }

  function identidade(){
    const c = _config || {};
    const nome = c.nomeExibicao || c.nomeUrna || c.candidato || c.nome || 'Campanha';
    const numero = c.numero ? ` ${c.numero}` : '';
    const cargo = c.cargoLabel || c.cargo || 'Candidato';
    const cidade = c.municipio || c.cidade || '';
    const uf = c.uf ? `-${c.uf}` : '';
    const ano = c.ano || '2026';
    return {
      nome,
      linha: `${nome}${numero} · ${cargo}${cidade ? ' · ' + cidade + uf : ''} ${ano}`.trim(),
      meta: Number(c.metaVotos || c.meta || WWMX.Config?.DEFAULT_CONFIG?.metaVotos || 49000),
    };
  }

  function renderDash(pins, lids, perc, denuncias){
    const container = document.getElementById('adminDashContent');
    if (!container) return;

    const id = identidade();

    let votosProj = 0;
    lids.forEach(l => {
      if (l.status === 'confirmado') votosProj += Number(l.votos || 0);
      else if (l.status === 'provavel') votosProj += Number(l.votos || 0) * 0.6;
      else if (l.status === 'indefinido') votosProj += Number(l.votos || 0) * 0.2;
    });

    const meta = Math.max(1, id.meta);
    const pctMeta = Math.min(100, Math.round(votosProj / meta * 100));

    const totalPins = pins.length;
    const totalMat = pins.filter(p => global.TIPO_MATERIAL?.[p.tipo]).length;
    const totalEv = pins.filter(p => global.TIPO_EVENTO?.[p.tipo]).length;
    const totalLids = lids.length;
    const totalKm = perc.reduce((a,p) => a + Number(p.km || 0), 0);
    const ativos24h = pins.filter(p => Date.now() - Number(p.ts || 0) < 24*60*60*1000).length;
    const perc24h = perc.filter(p => Date.now() - Number(p.dataTs || p.ts || 0) < 24*60*60*1000);
    const km24h = perc24h.reduce((a,p)=>a+Number(p.km||0),0);

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="font-size:26px;">👑</div>
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;">Painel do Candidato</div>
          <div style="font-size:12px;color:var(--muted);">${esc(id.linha)}</div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Termômetro de Votos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;">
          <div><div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--accent);">${Math.round(votosProj).toLocaleString('pt-BR')}</div><div>Projetados</div></div>
          <div><div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--green);">${meta.toLocaleString('pt-BR')}</div><div>Meta</div></div>
        </div>
        <div style="background:var(--border);border-radius:10px;height:12px;overflow:hidden;">
          <div style="width:${pctMeta}%;height:12px;background:linear-gradient(90deg,var(--accent),var(--green));"></div>
        </div>
        <div style="font-size:11px;margin-top:6px;">${pctMeta}% da meta alcançada</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        ${kpi(totalPins,'Pontos mapeados','accent')}
        ${kpi(totalKm.toFixed(0),'km percorridos','green')}
        ${kpi(totalLids,'Lideranças','purple')}
        ${kpi(totalMat,'Materiais','yellow')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px;">
        <div class="section-title" style="margin:0 0 10px 0;">Atividade 24h</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">
          ${mini(ativos24h,'pontos')}
          ${mini(totalEv,'eventos')}
          ${mini(km24h.toFixed(0),'km hoje')}
          ${mini(denuncias.length,'denúncias')}
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">
        <div class="section-title" style="margin:0 0 12px 0;">🏆 Top Militantes</div>
        <div id="topMilitantes"></div>
      </div>
    `;

    carregarTopMilitantes();
  }

  function kpi(valor,label,cor){
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
      <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--${cor});">${valor}</div>
      <div>${label}</div>
    </div>`;
  }

  function mini(valor,label){
    return `<div><div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">${valor}</div><div style="font-size:10px;color:var(--muted);">${label}</div></div>`;
  }

  async function carregarTopMilitantes(){
    try {
      const [milsSnap, pinsSnap, percSnap, lidsSnap] = await Promise.all([
        WWMX.db.val(`campanhas/${_campanhaId}/militantes`),
        WWMX.db.val(`campanhas/${_campanhaId}/pins`),
        WWMX.db.val(`campanhas/${_campanhaId}/percursos`),
        WWMX.db.val(`campanhas/${_campanhaId}/crm_liderancas`),
      ]);

      const mils = Object.values(milsSnap || {}).filter(m => m.nivel === 'campo');
      const pins = Object.values(pinsSnap || {});
      const perc = Object.values(percSnap || {});
      const lids = Object.values(lidsSnap || {});

      const comXP = mils.map(m => {
        let xp = 0;
        pins.filter(p => p.autorUid === m.uid).forEach(p => { xp += global.TIPO_MATERIAL?.[p.tipo] ? (p.tipo === 'windbanner' ? 8 * (p.qtd || 1) : 2) : 5; });
        perc.filter(p => p.autorUid === m.uid).forEach(p => { xp += 20 + Math.round(p.km || 0); });
        lids.filter(l => l.autorUid === m.uid).forEach(l => {
          const v = Number(l.votos || 0);
          const base = v >= 500 ? 400 : v >= 151 ? 200 : v >= 51 ? 80 : v >= 16 ? 30 : v >= 6 ? 12 : 5;
          const mult = l.status === 'confirmado' ? 1 : l.status === 'provavel' ? 0.6 : 0.4;
          xp += Math.round(base * mult);
        });
        return { nome: m.nome, xp };
      }).sort((a,b)=>b.xp-a.xp).slice(0,5);

      const el = document.getElementById('topMilitantes');
      if (!el) return;
      el.innerHTML = comXP.length ? comXP.map((m,i)=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:18px;">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
          <div style="flex:1;">${esc(m.nome)}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);">${m.xp} XP</div>
        </div>`).join('') : '<div class="empty">Sem militantes de campo ainda</div>';
    } catch(e) {
      console.warn('[candDash] top militantes:', e);
    }
  }

  function esc(v){ return String(v || '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  global.candDashInit = init;
  global.candDashDestroy = destroy;
})(window);
