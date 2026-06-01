/**
 * master/planos.js — WWMX Campaign
 * Configuração de planos de venda por módulos, locais e usuários.
 */
(function (global) {
  'use strict';

  const PLANOS_DEFAULT = [
    {
      id: 'starter', nome: 'Starter', preco: 1490,
      locaisVotacao: 20, usuariosSimultaneos: 15, modulos: ['crm','denuncias'],
      desc: 'Ideal para vereadores e municípios pequenos',
    },
    {
      id: 'pro', nome: 'Pro', preco: 3490,
      locaisVotacao: 80, usuariosSimultaneos: 60, modulos: ['crm','denuncias','agenda','estreleiro'],
      desc: 'Deputado estadual, municípios médios',
    },
    {
      id: 'elite', nome: 'Elite', preco: 7490,
      locaisVotacao: 300, usuariosSimultaneos: 200, modulos: ['crm','denuncias','agenda','estreleiro','inteligencia-eleitoral','pre-campanha'],
      desc: 'Deputado federal, governador, campanhas de grande porte',
    },
    {
      id: 'custom', nome: 'Personalizado', preco: null,
      locaisVotacao: null, usuariosSimultaneos: null, modulos: [],
      desc: 'Configuração sob medida — contato comercial',
    },
  ];

  let _planos = [];

  function init() {
    _renderizar();
    _assinar();
  }

  function destroy() {}

  function _renderizar() {
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view">
        <div class="section-title">Planos disponíveis</div>
        <div id="planosList"></div>
        <div class="section-title" style="margin-top:20px;">Planos personalizados por campanha</div>
        <div id="planosCustomList"></div>
        <button id="btnNovoPlano" class="btn btn-primary w-full" style="margin-top:12px;">+ Plano personalizado</button>
      </div>`;
    document.getElementById('btnNovoPlano').onclick = () =>
      WWMX.UI.showToast('Em breve: configuração de plano personalizado', 'info');
    _renderizarPlanosDefault();
  }

  function _renderizarPlanosDefault() {
    const el = document.getElementById('planosList');
    if (!el) return;
    const mods = global.WWMX?.Config?.MODULOS_DISPONIVEIS || [];
    el.innerHTML = PLANOS_DEFAULT.map(p => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;">${p.nome}</div>
            <div style="font-size:12px;color:var(--muted);">${p.desc}</div>
          </div>
          <div style="text-align:right;">
            ${p.preco
              ? `<div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">R$&nbsp;${p.preco.toLocaleString('pt-BR')}</div><div style="font-size:10px;color:var(--muted);">/campanha</div>`
              : `<div style="font-size:14px;color:var(--muted);">Sob consulta</div>`}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--blue);">${p.locaisVotacao ?? '∞'}</div>
            <div style="font-size:10px;color:var(--muted);">Locais de votação</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--green);">${p.usuariosSimultaneos ?? '∞'}</div>
            <div style="font-size:10px;color:var(--muted);">Usuários simultâneos</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Módulos incluídos:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${mods.map(m => {
            const ativo = p.modulos.includes(m.id);
            return `<span style="padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;
              background:${ativo ? 'rgba(34,197,94,0.12)' : 'var(--surface2)'};
              color:${ativo ? 'var(--green)' : 'var(--muted)'};
              border:1px solid ${ativo ? 'rgba(34,197,94,0.3)' : 'var(--border)'};">
              ${m.icon} ${m.label}
            </span>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  function _assinar() {
    WWMX.fs.getCol('master/planos/custom').then(custom => {
      const el = document.getElementById('planosCustomList');
      if (!el) return;
      if (!custom.length) {
        el.innerHTML = '<div class="empty">Nenhum plano personalizado criado</div>';
        return;
      }
      el.innerHTML = custom.map(p => `
        <div class="banner-item">
          <div class="banner-info">
            <div class="banner-name">${p.nome}</div>
            <div class="banner-meta">R$ ${(p.preco||0).toLocaleString('pt-BR')} · ${p.locaisVotacao} locais · ${p.usuariosSimultaneos} usuários</div>
          </div>
        </div>`).join('');
    }).catch(() => {});
  }

  global.planosInit    = init;
  global.planosDestroy = destroy;
}(window));
