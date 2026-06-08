/**
 * coordenador/estoque.js
 * ANGEL — Estoque central mínimo funcional.
 *
 * Garante estoqueInit/estoqueDestroy para o roteador oficial.
 * Próxima etapa: portar fluxo completo do ANGEL-v2.
 */
(function(global){
  'use strict';

  let _campanhaId = null;
  let _unsubEstoque = null;
  let _unsubMilitantes = null;
  let _estoque = {};
  let _militantes = {};

  function init(campanhaId){
    _campanhaId = campanhaId;
    render();
    assinar();
  }

  function destroy(){
    if (_unsubEstoque) _unsubEstoque();
    if (_unsubMilitantes) _unsubMilitantes();
    _unsubEstoque = null;
    _unsubMilitantes = null;
  }

  function render(){
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button id="btnNovoMaterial" class="btn btn-primary" style="flex:1;">+ Novo Material</button>
          <button id="btnAtualizarEstoque" class="btn btn-ghost" style="flex:0 0 auto;">Atualizar</button>
        </div>
        <div id="estoqueResumo"></div>
        <div class="section-title">Materiais</div>
        <div id="estoqueMaterialList"></div>
        <div class="section-title" style="margin-top:16px;">Militantes</div>
        <div id="estoqueMilitantesList"></div>
        <div style="height:90px"></div>
      </div>
    `;
    document.getElementById('btnNovoMaterial').onclick = abrirModalMaterial;
    document.getElementById('btnAtualizarEstoque').onclick = renderDados;
  }

  function assinar(){
    _unsubEstoque = WWMX.db.on(`campanhas/${_campanhaId}/estoque_central`, snap => {
      _estoque = snap.val() || {};
      renderDados();
    });
    _unsubMilitantes = WWMX.db.on(`campanhas/${_campanhaId}/militantes`, snap => {
      _militantes = snap.val() || {};
      renderDados();
    });
  }

  function renderDados(){
    const itens = Object.values(_estoque || {});
    const total = itens.reduce((a,i)=>a+Number(i.qtdTotal||0),0);
    const disp = itens.reduce((a,i)=>a+Number(i.qtdDisp ?? i.qtdTotal ?? 0),0);
    const dist = itens.reduce((a,i)=>a+Number(i.qtdDist||0),0);

    const resumo = document.getElementById('estoqueResumo');
    if (resumo) resumo.innerHTML = `
      <div class="dash-stats">
        <div class="stat-card total"><div class="stat-num accent">${total.toLocaleString('pt-BR')}</div><div class="stat-label">Total</div></div>
        <div class="stat-card inst"><div class="stat-num green">${disp.toLocaleString('pt-BR')}</div><div class="stat-label">Disponível</div></div>
        <div class="stat-card dan"><div class="stat-num yellow">${dist.toLocaleString('pt-BR')}</div><div class="stat-label">Distribuído</div></div>
      </div>
    `;

    const lista = document.getElementById('estoqueMaterialList');
    if (lista) {
      lista.innerHTML = itens.length ? itens.sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''))).map(item => {
        const cfg = global.TIPO_MATERIAL?.[item.tipo] || { icon:'📦', label:item.label || item.tipo || 'Material', cor:'var(--accent)' };
        const qtdDisp = Number(item.qtdDisp ?? item.qtdTotal ?? 0);
        return `<div class="banner-item">
          <div style="font-size:24px;">${cfg.icon}</div>
          <div class="banner-info">
            <div class="banner-name">${esc(item.label || cfg.label)}${item.tamanho ? ' · '+esc(item.tamanho) : ''}</div>
            <div class="banner-meta">Total ${Number(item.qtdTotal||0).toLocaleString('pt-BR')} · Distribuído ${Number(item.qtdDist||0).toLocaleString('pt-BR')}</div>
          </div>
          <div style="text-align:right;">
            <div class="banner-qty">${qtdDisp.toLocaleString('pt-BR')}</div>
            <div style="font-size:10px;color:var(--muted);">disp.</div>
          </div>
        </div>`;
      }).join('') : '<div class="empty">Nenhum material no estoque central</div>';
    }

    const milList = document.getElementById('estoqueMilitantesList');
    if (milList) {
      const mils = Object.values(_militantes || {}).filter(m => m.nivel === 'campo');
      milList.innerHTML = mils.length ? mils.map(m => `<div class="banner-item"><div>👤</div><div class="banner-info"><div class="banner-name">${esc(m.nome)}</div><div class="banner-meta">${esc(m.uid || '')}</div></div></div>`).join('') : '<div class="empty">Nenhum militante de campo registrado</div>';
    }
  }

  function abrirModalMaterial(){
    const tipos = global.TIPO_MATERIAL || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">📦 Novo Material</div>
        <div class="field"><label>Tipo</label><select id="estTipo">${Object.entries(tipos).map(([k,v])=>`<option value="${k}">${v.icon} ${esc(v.label)}</option>`).join('')}</select></div>
        <div class="field"><label>Tamanho / Variante</label><input id="estTam" placeholder="Ex: P, M, G, 2x1m"></div>
        <div class="field"><label>Quantidade</label><input id="estQtd" type="number" min="1" value="1"></div>
        <div style="display:flex;gap:8px;"><button class="btn btn-ghost" data-fechar>Cancelar</button><button class="btn btn-primary" data-salvar>Salvar</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-fechar]').onclick = () => overlay.remove();
    overlay.querySelector('[data-salvar]').onclick = async () => {
      const tipo = overlay.querySelector('#estTipo').value;
      const tam = overlay.querySelector('#estTam').value.trim();
      const qtd = Number(overlay.querySelector('#estQtd').value || 0);
      if (qtd < 1) { WWMX.UI?.showToast?.('Informe a quantidade','error'); return; }
      const cfg = tipos[tipo] || { label: tipo };
      const id = `${tipo}_${tam || 'padrao'}`.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
      const atual = _estoque[id] || {};
      const qtdTotal = Number(atual.qtdTotal || 0) + qtd;
      const qtdDist = Number(atual.qtdDist || 0);
      await WWMX.db.set(`campanhas/${_campanhaId}/estoque_central/${id}`, {
        id, tipo, tamanho: tam, label: cfg.label, qtdTotal, qtdDist, qtdDisp: Math.max(0, qtdTotal - qtdDist), atualizadoEm: Date.now()
      });
      overlay.remove();
      WWMX.UI?.showToast?.('Material salvo','success');
    };
  }

  function esc(v){return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  global.estoqueInit = init;
  global.estoqueDestroy = destroy;
})(window);
