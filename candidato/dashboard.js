/**
 * candidato/dashboard.js
 * WWMX Campaign — Dashboard do candidato (KPIs, projeções, termômetro)
 */

(function (global) {
  'use strict';

  let _campanhaId = null;
  let _unsub = null;

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
        <div id="adminDashContent"></div>
      </div>
    `;
  }

  function _assinar() {
    // Atualizar sempre que pins, lideranças ou percursos mudarem
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}`, async (snap) => {
      const data = snap.val();
      if (!data) return;
      const pins = Object.values(data.pins || {});
      const lids = Object.values(data.crm_liderancas || {});
      const perc = Object.values(data.percursos || {});
      _renderizarDash(pins, lids, perc);
    });
  }

  function _renderizarDash(pins, lids, perc) {
    const container = document.getElementById('adminDashContent');
    if (!container) return;

    // Votos projetados
    let votosProj = 0;
    lids.forEach(l => {
      if (l.status === 'confirmado') votosProj += (l.votos || 0);
      else if (l.status === 'provavel') votosProj += (l.votos || 0) * 0.6;
      else if (l.status === 'indefinido') votosProj += (l.votos || 0) * 0.2;
    });
    const meta = 49000; // exemplo
    const pctMeta = Math.min(100, Math.round(votosProj / meta * 100));

    // Métricas
    const totalPins = pins.length;
    const totalMat = pins.filter(p => global.TIPO_MATERIAL[p.tipo]).length;
    const totalEv = pins.filter(p => global.TIPO_EVENTO[p.tipo]).length;
    const totalLids = lids.length;
    const totalKm = perc.reduce((a,p) => a + (p.km || 0), 0);

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="font-size:26px;">👑</div>
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;">Painel do Candidato</div>
          <div style="font-size:12px;color:var(--muted);">Dr. Carlos Mendes 40 · Dep. Estadual · Viamão 2026</div>
        </div>
      </div>

      <!-- Termômetro -->
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

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--accent);">${totalPins}</div>
          <div>Pontos mapeados</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--green);">${totalKm.toFixed(0)}</div>
          <div>km percorridos</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--purple);">${totalLids}</div>
          <div>Lideranças</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--yellow);">${totalMat}</div>
          <div>Materiais</div>
        </div>
      </div>

      <!-- Top 5 militantes -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">
        <div class="section-title" style="margin:0 0 12px 0;">🏆 Top Militantes</div>
        <div id="topMilitantes"></div>
      </div>
    `;

    // Preencher top militantes
    _carregarTopMilitantes();
  }

  async function _carregarTopMilitantes() {
    const milsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/militantes`);
    const mils = Object.values(milsSnap || {}).filter(m => m.nivel === 'campo');
    const comXP = await Promise.all(mils.map(async m => {
      let xp = 0;
      const pinsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/pins`);
      const pins = Object.values(pinsSnap || {}).filter(p => p.autorUid === m.uid);
      pins.forEach(p => {
        if (global.TIPO_MATERIAL[p.tipo]) {
          if (p.tipo === 'windbanner') xp += 8 * (p.qtd || 1);
          else xp += 2;
        } else xp += 5;
      });
      const percSnap = await WWMX.db.val(`campanhas/${_campanhaId}/percursos`);
      const perc = Object.values(percSnap || {}).filter(p => p.autorUid === m.uid);
      perc.forEach(p => xp += 20 + Math.round(p.km || 0));
      const lidsSnap = await WWMX.db.val(`campanhas/${_campanhaId}/crm_liderancas`);
      const lids = Object.values(lidsSnap || {}).filter(l => l.autorUid === m.uid);
      lids.forEach(l => {
        const base = (l.votos || 0) >= 500 ? 400 : (l.votos || 0) >= 151 ? 200 : (l.votos || 0) >= 51 ? 80 : (l.votos || 0) >= 16 ? 30 : (l.votos || 0) >= 6 ? 12 : 5;
        const mult = l.status === 'confirmado' ? 1 : l.status === 'provavel' ? 0.6 : 0.4;
        xp += Math.round(base * mult);
      });
      return { nome: m.nome, xp };
    }));
    comXP.sort((a,b) => b.xp - a.xp);
    const top = comXP.slice(0,5);
    const container = document.getElementById('topMilitantes');
    if (container) {
      container.innerHTML = top.map((m,i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:18px;">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
          <div style="flex:1;">${m.nome}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);">${m.xp} XP</div>
        </div>
      `).join('');
    }
  }

  global.candDashInit = init;
  global.candDashDestroy = destroy;
})(window);