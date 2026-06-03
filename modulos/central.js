/**
 * modulos/central.js
 * ANGEL — Visão geral em cards estratégicos por perfil.
 */
(function (global) {
  'use strict';
  let _campanhaId = null;
  let _unsub = null;

  const PERFIL_META = {
    campo: { titulo: 'Central do Campo', subtitulo: 'Missões, localização, inventário e evidências em uma visão curta.', foco: 'Executar roteiro sem perder prova de campo', cards: [ ['🗺️','Mapa vivo','Registrar ponto, foto, status e material direto do território.','mapa'], ['🚗','Percursos','Gravar rota de carro de som, caminhada ou deslocamento com km.','percursos'], ['📦','Inventário','Conferir material recebido e usado antes de sair para rua.','meuinventario'], ['🎯','Missões','Ver rotas atribuídas pelo coordenador e fechar execução.','minhasrotas'] ] },
    coord: { titulo: 'Central de Coordenação', subtitulo: 'Gestão de equipe, rotas, materiais, CRM e ocorrências no mesmo painel.', foco: 'Transformar operação dispersa em execução rastreável', cards: [ ['📊','Dashboard operacional','Acompanhar pontos, eventos, equipe ativa e pendências.','dash'], ['👥','CRM de lideranças','Projetar votos por liderança e status de confiança.','crm'], ['🚗','Rotas e eventos','Planejar roteiro de carro de som, caminhada e agenda de rua.','rotas'], ['📦','Materiais','Gerenciar estoque central, repasses e itens críticos.','estoque'], ['🚨','Denúncias','Receber e tratar ocorrências registradas pelo campo.','denuncias'], ['🗳️','Inteligência eleitoral','Cruzar histórico eleitoral, zonas e locais prioritários.','eleitoral'] ] },
    candidato: { titulo: 'Central do Candidato', subtitulo: 'Leitura executiva da campanha: votos, equipe, território e risco.', foco: 'Decidir onde colocar tempo, equipe e material', cards: [ ['👑','Painel executivo','Termômetro de votos, meta e indicadores consolidados.','admindash'], ['🗺️','Mapa consolidado','Visualizar cobertura territorial e concentração de ações.','adminmapa'], ['⭐','Agentes e lideranças','Entender quem realmente move voto e engajamento.','adminagentes'], ['👥','CRM e lideranças','Consultar funil de lideranças e projeção de votos.','crm'], ['📊','Dashboard operacional','Ver o trabalho de coordenadores e equipe.','dash'], ['🚨','Risco eleitoral','Monitorar denúncias e ocorrências sensíveis.','denuncias'] ] },
    master: { titulo: 'Central Master', subtitulo: 'Onboarding, planos, clientes e banco global para vender e replicar campanhas.', foco: 'Padronizar implantação e acelerar entrega ao cliente', cards: [ ['🧠','Gerador PicoClaw','Criar pacote técnico de campanha com skins, seed e prompt.','master-gerador'], ['🏗️','Campanhas','Criar e configurar novas campanhas por candidato/município.','master-campanhas'], ['💰','Planos','Pacotes comerciais por módulos e nível de operação.','master-planos'], ['🤝','Clientes','Acompanhar contratos, status e implantação.','master-clientes'], ['🗄️','Banco global','Base reutilizável de locais, parâmetros e dados eleitorais.','master-banco'] ] },
  };

  function init(campanhaId) { _campanhaId = campanhaId; _renderizarBase(); _assinarResumo(); }
  function destroy() { if (_unsub) _unsub(); _unsub = null; }

  function _renderizarBase() {
    const container = document.getElementById('appView');
    if (!container) return;
    const session = WWMX.Auth?.sessaoAtual?.() || { nivel: 'campo', nome: '' };
    const meta = PERFIL_META[session.nivel] || PERFIL_META.campo;
    container.innerHTML = `
      <div class="angel-home">
        <section class="angel-hero"><div class="angel-kicker">ANGEL · WWMX Campaign</div><h1>${_esc(meta.titulo)}</h1><p>${_esc(meta.subtitulo)}</p><div class="angel-hero-row"><span class="angel-focus">${_esc(meta.foco)}</span><span class="angel-user">${_esc(session.nome || 'Usuário')}</span></div></section>
        <section class="angel-strip" id="angelResumoStrip">${_metricCard('📍','Pontos','—')}${_metricCard('👥','Lideranças','—')}${_metricCard('🚗','Km','—')}${_metricCard('🚨','Pendências','—')}</section>
        <section><div class="section-title">Módulos principais</div><div class="angel-card-grid">${meta.cards.filter(c => WWMX.Router?.moduloPermitido?.(c[3]) !== false).map(c => _moduleCard(...c)).join('')}</div></section>
        <section class="angel-flow"><div class="section-title">Fluxo de inteligência</div><div class="angel-flow-track">${_flowStep('1','Campo registra','GPS, foto, material, rota e ocorrência')}${_flowStep('2','Coordenação organiza','Equipe, estoque, missões e CRM')}${_flowStep('3','Candidato decide','Votos projetados, risco e prioridade')}</div></section>
      </div>`;
  }

  function _assinarResumo() {
    if (!WWMX.db?.on || !_campanhaId) return;
    _unsub = WWMX.db.on(`campanhas/${_campanhaId}`, (snap) => {
      const data = snap.val() || {};
      const pins = Object.values(data.pins || {});
      const lids = Object.values(data.crm_liderancas || {});
      const perc = Object.values(data.percursos || {});
      const denuncias = Object.values(data.denuncias || {}).filter(d => d.status !== 'resolvida');
      const km = perc.reduce((a, p) => a + Number(p.km || 0), 0);
      const strip = document.getElementById('angelResumoStrip');
      if (!strip) return;
      strip.innerHTML = `${_metricCard('📍','Pontos',pins.length.toLocaleString('pt-BR'))}${_metricCard('👥','Lideranças',lids.length.toLocaleString('pt-BR'))}${_metricCard('🚗','Km',km.toFixed(0))}${_metricCard('🚨','Pendências',denuncias.length.toLocaleString('pt-BR'))}`;
    });
  }
  function _metricCard(icon, label, value) { return `<div class="angel-metric"><div class="angel-metric-icon">${icon}</div><div><strong>${value}</strong><span>${label}</span></div></div>`; }
  function _moduleCard(icon, title, desc, target) { return `<button class="angel-module-card" type="button" onclick="WWMX.Router.carregarModulo('${target}'); location.hash='${target}'"><div class="angel-module-icon">${icon}</div><div><strong>${_esc(title)}</strong><span>${_esc(desc)}</span></div><em>abrir</em></button>`; }
  function _flowStep(num, title, desc) { return `<div class="angel-flow-step"><b>${num}</b><strong>${_esc(title)}</strong><span>${_esc(desc)}</span></div>`; }
  function _esc(value) { return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  global.centralInit = init;
  global.centralDestroy = destroy;
})(window);
