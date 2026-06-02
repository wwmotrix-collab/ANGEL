/**
 * candidato/dashboard.js
 * WWMX Campaign — Dashboard do candidato.
 * Consolida trabalho dos coordenadores/campo: materiais, rotas, lideranças, denúncias e XP.
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

  function destroy() { if (_unsub) _unsub(); }

  function _renderizar() {
    const container = document.getElementById('appView');
    if (!container) return;
    container.innerHTML = `<div class="dash-view"><div id="adminDashContent"></div></div>`;
  }

  function _assinar() {
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}`, (snap) => {
      const data = snap.val() || {};
      _renderizarDash(data);
    });
  }

  function _calcVotos(lids) {
    return lids.reduce((acc, l) => {
      const v = Number(l.votos || 0);
      if (l.status === 'confirmado') return acc + v;
      if (l.status === 'provavel') return acc + v * 0.6;
      if (l.status === 'indefinido') return acc + v * 0.2;
      return acc;
    }, 0);
  }

  function _xpDeMilitante(uid, pins, perc, lids) {
    let xp = 0;
    pins.filter(p => p.autorUid === uid).forEach(p => {
      if (global.TIPO_MATERIAL?.[p.tipo]) xp += p.tipo === 'windbanner' ? 8 * Number(p.qtd || 1) : 2 * Number(p.qtd || 1);
      else xp += 5;
    });
    perc.filter(p => p.autorUid === uid || p.motoristaUid === uid).forEach(p => xp += 20 + Math.round(Number(p.km || 0)));
    lids.filter(l => l.autorUid === uid).forEach(l => {
      const votos = Number(l.votos || 0);
      const base = votos >= 500 ? 400 : votos >= 151 ? 200 : votos >= 51 ? 80 : votos >= 16 ? 30 : votos >= 6 ? 12 : 5;
      const mult = l.status === 'confirmado' ? 1 : l.status === 'provavel' ? 0.6 : 0.4;
      xp += Math.round(base * mult);
    });
    return xp;
  }

  function _renderizarDash(data) {
    const container = document.getElementById('adminDashContent');
    if (!container) return;

    const pins = Object.values(data.pins || {});
    const lids = Object.values(data.crm_liderancas || {});
    const perc = Object.values(data.percursos || {});
    const rotas = Object.values(data.rotas || {});
    const den = Object.values(data.denuncias || {});
    const militantes = Object.values(data.militantes || {});
    const estoque = Object.values(data.estoque_central || {});

    const meta = 49000;
    const votosProj = _calcVotos(lids);
    const pctMeta = Math.min(100, Math.round(votosProj / meta * 100));
    const materiais = pins.filter(p => global.TIPO_MATERIAL?.[p.tipo]);
    const eventos = pins.filter(p => global.TIPO_EVENTO?.[p.tipo]);
    const totalKm = perc.reduce((a, p) => a + Number(p.km || 0), 0);
    const pendencias = den.filter(d => d.status !== 'resolvida').length;
    const estoqueDisp = estoque.reduce((a, i) => a + Number(i.qtdDisp ?? Math.max(0, Number(i.qtdTotal || 0) - Number(i.qtdDist || 0))), 0);

    const agentes = militantes
      .filter(m => ['campo','coord'].includes(m.nivel))
      .map(m => ({ ...m, xp: _xpDeMilitante(m.uid, pins, perc, lids) }))
      .sort((a,b) => b.xp - a.xp);
    const coords = agentes.filter(a => a.nivel === 'coord');
    const campos = agentes.filter(a => a.nivel === 'campo');

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="font-size:30px;">👑</div>
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;">Painel do Candidato</div>
          <div style="font-size:12px;color:var(--muted);">Visão consolidada do trabalho dos coordenadores e da equipe de campo</div>
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Termômetro de Votos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;">
          <div><div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--accent);">${Math.round(votosProj).toLocaleString('pt-BR')}</div><div style="font-size:12px;color:var(--muted);">Projetados</div></div>
          <div><div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:var(--green);">${meta.toLocaleString('pt-BR')}</div><div style="font-size:12px;color:var(--muted);">Meta</div></div>
        </div>
        <div style="background:var(--border);border-radius:10px;height:12px;overflow:hidden;"><div style="width:${pctMeta}%;height:12px;background:linear-gradient(90deg,var(--accent),var(--green));"></div></div>
        <div style="font-size:11px;margin-top:6px;color:var(--muted);">${pctMeta}% da meta alcançada</div>
      </div>

      <div class="dash-stats" style="margin-bottom:14px;">
        ${_stat('📍', pins.length, 'Pontos')}
        ${_stat('📦', materiais.length, 'Materiais')}
        ${_stat('🎯', eventos.length, 'Eventos')}
        ${_stat('🚗', totalKm.toFixed(0), 'Km')}
        ${_stat('👥', lids.length, 'Lideranças')}
        ${_stat('🚨', pendencias, 'Pendências')}
      </div>

      <div class="section-title">Coordenação e operação</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        ${_miniCard('🎯 Coordenadores', coords.length, 'perfis coord ativos')}
        ${_miniCard('⚔️ Campo', campos.length, 'agentes de rua')}
        ${_miniCard('📦 Estoque livre', estoqueDisp.toLocaleString('pt-BR'), 'unidades disponíveis')}
        ${_miniCard('🧭 Rotas', rotas.length, 'planejadas / missões')}
      </div>

      <div class="section-title">Top agentes por entrega</div>
      <div class="banner-list">${agentes.slice(0, 8).map((m, i) => _agenteCard(m, i)).join('') || '<div class="empty">Sem agentes ainda</div>'}</div>

      <div class="section-title">Rotas recentes</div>
      <div class="banner-list">${rotas.slice(-5).reverse().map(_rotaCard).join('') || '<div class="empty">Nenhuma rota planejada</div>'}</div>
    `;
  }

  function _stat(icon, num, label) {
    return `<div class="stat-card total"><div style="font-size:20px;margin-bottom:4px;">${icon}</div><div class="stat-num accent" style="font-size:28px;">${num}</div><div class="stat-label">${label}</div></div>`;
  }
  function _miniCard(title, num, sub) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-size:11px;color:var(--muted);">${title}</div><div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--accent);">${num}</div><div style="font-size:11px;color:var(--muted);">${sub}</div></div>`;
  }
  function _agenteCard(m, i) {
    const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
    const rank = global.getGuildaRank ? global.getGuildaRank(m.xp || 0) : { icone:'⭐', titulo:'Agente' };
    return `<div class="banner-item"><div style="font-size:22px;width:34px;">${medalha}</div><div class="banner-info"><div class="banner-name">${m.nome || 'Sem nome'} · ${rank.icone} ${rank.titulo}</div><div class="banner-meta">${m.nivel === 'coord' ? 'Coordenador' : 'Campo'} · último acesso ${m.ultimoAcesso ? new Date(m.ultimoAcesso).toLocaleDateString('pt-BR') : '—'}</div></div><div class="banner-qty">${m.xp || 0} XP</div></div>`;
  }
  function _rotaCard(r) {
    return `<div class="banner-item"><div style="font-size:22px;">${r.tipo === 'carrosom' ? '📢' : '🚶'}</div><div class="banner-info"><div class="banner-name">${r.nome || r.titulo || 'Rota sem nome'}</div><div class="banner-meta">${r.status || 'planejada'} · ${(r.pontos || []).length} pontos · ${r.responsavel || r.motoristaNome || 'sem responsável'}</div></div></div>`;
  }

  global.candDashInit = init;
  global.candDashDestroy = destroy;
})(window);
