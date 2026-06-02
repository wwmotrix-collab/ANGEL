/**
 * master/gerador-picoclaw.js
 * ANGEL — Terminal Master para gerar briefing/pacote PicoClaw de nova campanha.
 *
 * v2: coleta simples na superfície e skins técnicas nos bastidores.
 */
(function (global) {
  'use strict';

  const state = { pacote: null };
  const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const CARGOS_2026 = [
    ['presidente','Presidente'],
    ['governador','Governador'],
    ['senador','Senador'],
    ['dep_federal','Deputado Federal'],
    ['dep_estadual','Deputado Estadual'],
    ['dep_distrital','Deputado Distrital']
  ];
  const PLANOS = [
    ['essencial','Essencial · operação básica'],
    ['operacao','Operação · campo, materiais, CRM e rotas'],
    ['inteligencia','Inteligência · análise eleitoral e geocoding'],
    ['full','Full · implantação completa com automações']
  ];

  function init() {
    render();
    bind();
    gerarPacote();
  }
  function destroy() {}

  function render() {
    const c = document.getElementById('appView');
    if (!c) return;
    c.innerHTML = `
      <div class="dash-view pico-terminal">
        <div class="pico-head">
          <div class="pico-head-icon">🧠</div>
          <div>
            <div class="pico-title">Gerador PicoClaw</div>
            <div class="pico-sub">Coleta simples para o Master. O pacote desdobra as skins técnicas da campanha automaticamente.</div>
          </div>
        </div>

        <div class="pico-note">
          <strong>Fluxo:</strong> candidato + partido/coligação + cargo + histórico + cidade + plano → skins PicoClaw → app ANGEL configurado, seed, território, análise, PR e preview.
        </div>

        <div class="section-title">1 · Coleta essencial</div>
        <div class="grid-form">
          ${field('candidato','Candidato','Dr. Carlos Mendes')}
          ${field('nomeUrna','Nome de urna','Carlos Mendes')}
          ${field('numero','Número','40','text','numeric')}
          ${field('partido','Partido','PSB')}
          ${field('coligacao','Coligação / Federação','Frente Democrática')}
          ${select('cargo','Cargo 2026',CARGOS_2026,'dep_estadual')}
          ${field('cidade','Cidade-base','Viamão')}
          ${select('uf','UF',UF_OPTIONS.map(u => [u,u]), 'RS')}
          ${field('ano','Ano eleitoral','2026','text','numeric')}
          ${select('plano','Plano de assinatura',PLANOS,'inteligencia')}
        </div>

        <div class="section-title">2 · Histórico político</div>
        <div class="grid-form">
          ${select('jaFoiCandidato','Já foi candidato?',[['nao','Não'],['sim','Sim'],['nao_informado','Não informado']], 'sim')}
          ${field('historicoAno','Ano anterior','2022','text','numeric')}
          ${field('historicoCargo','Cargo anterior','Deputado Estadual')}
          ${field('historicoPartido','Partido anterior','PSB')}
          ${field('historicoCidade','Cidade/UF anterior','Viamão/RS')}
          ${field('historicoNumero','Número anterior','40','text','numeric')}
        </div>
        ${textarea('observacoesHistorico','Observações para análise eleitoral','Buscar histórico próprio do candidato. Se não houver histórico, analisar partido/coligação no município e cargo relacionado.')}

        <div class="section-title">3 · Escopo e automações</div>
        <div class="pico-check-grid" id="automacoesGrid">
          ${check('autoAnaliseEleitoral','Análise eleitoral automática',true)}
          ${check('autoTerritorio','Importar território eleitoral',true)}
          ${check('autoGeocoding','Georreferenciar locais de votação',true)}
          ${check('autoPins','Gerar PINs eleitorais no mapa',true)}
          ${check('autoSeed','Gerar seed operacional',true)}
          ${check('autoPR','Abrir branch/draft PR',true)}
          ${check('autoCompliance','Ativar trilha de auditoria/conformidade',true)}
          ${check('autoIntegracoes','Preparar integração n8n/WhatsApp',false)}
        </div>

        <div class="section-title">4 · Skins PicoClaw</div>
        <div class="pico-skins" id="skinsPreview"></div>

        <div class="section-title">5 · Configuração técnica pública</div>
        <div class="grid-form">
          ${field('firebaseProjectId','Firebase projectId','angel-edd10')}
          ${field('authDomain','Auth domain','angel-edd10.firebaseapp.com')}
          ${field('databaseURL','Realtime Database URL','https://angel-edd10-default-rtdb.firebaseio.com')}
          ${field('storageBucket','Storage bucket','angel-edd10.firebasestorage.app')}
          ${field('messagingSenderId','Messaging sender ID','468748352830')}
          ${field('appId','App ID','1:468748352830:web:75e9dd534710a85401406f')}
          ${field('githubRepo','GitHub repo destino','wwmotrix-collab/ANGEL')}
          ${field('vercelProject','Projeto Vercel / URL','angel-liart.vercel.app')}
        </div>
        <div class="pico-alert">Não cole service account aqui. Chave privada fica em Codespace/GitHub Secrets/ambiente protegido.</div>

        <div class="pico-actions">
          <button class="btn btn-primary" id="btnGerarPacote">Gerar pacote</button>
          <button class="btn btn-ghost" id="btnCopiarPrompt">Copiar prompt</button>
          <button class="btn btn-ghost" id="btnBaixarJson">Baixar pacote JSON</button>
          <button class="btn btn-ghost" id="btnBaixarPrompt">Baixar prompt .md</button>
        </div>

        <div class="section-title">Preview do pacote</div>
        <pre id="pacotePreview" class="pico-pre"></pre>

        <div class="section-title" style="margin-top:16px;">Prompt PicoClaw</div>
        <textarea id="promptPreview" readonly class="pico-prompt"></textarea>
        <div style="height:80px;"></div>
      </div>
    `;
    injectLocalStyles();
  }

  function bind() {
    document.querySelectorAll('[data-pico-field], [data-auto]').forEach(el => {
      el.addEventListener('input', gerarPacote);
      el.addEventListener('change', gerarPacote);
    });
    document.getElementById('btnGerarPacote')?.addEventListener('click', gerarPacote);
    document.getElementById('btnCopiarPrompt')?.addEventListener('click', copiarPrompt);
    document.getElementById('btnBaixarJson')?.addEventListener('click', () => baixar('angel-picoclaw-package.json', JSON.stringify(state.pacote, null, 2), 'application/json'));
    document.getElementById('btnBaixarPrompt')?.addEventListener('click', () => baixar('picoclaw.prompt.md', state.pacote?.prompt || '', 'text/markdown'));
  }

  function gerarPacote() {
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const on = id => !!document.getElementById(id)?.checked;
    const campanhaId = slug(`${v('nomeUrna') || v('candidato')}-${v('ano')}-${v('cidade')}`);
    const plano = v('plano') || 'essencial';

    const campaignInput = {
      campanhaId,
      candidato: v('candidato'),
      nomeUrna: v('nomeUrna'),
      numero: v('numero'),
      partido: v('partido'),
      coligacao: v('coligacao'),
      cargo: v('cargo'),
      cidade: v('cidade'),
      uf: v('uf'),
      ano: v('ano'),
      planoAssinatura: plano
    };

    const historyInput = {
      jaFoiCandidato: v('jaFoiCandidato'),
      anoAnterior: v('historicoAno'),
      cargoAnterior: v('historicoCargo'),
      partidoAnterior: v('historicoPartido'),
      cidadeUfAnterior: v('historicoCidade'),
      numeroAnterior: v('historicoNumero'),
      observacoes: v('observacoesHistorico')
    };

    const automationInput = {
      autoAnaliseEleitoral: on('autoAnaliseEleitoral'),
      autoTerritorio: on('autoTerritorio'),
      autoGeocoding: on('autoGeocoding'),
      autoPins: on('autoPins'),
      autoSeed: on('autoSeed'),
      autoPR: on('autoPR'),
      autoCompliance: on('autoCompliance'),
      autoIntegracoes: on('autoIntegracoes')
    };

    const skins = buildSkins(campaignInput, historyInput, automationInput);
    const firebase = {
      projectId: v('firebaseProjectId'), authDomain: v('authDomain'), databaseURL: v('databaseURL'),
      storageBucket: v('storageBucket'), messagingSenderId: v('messagingSenderId'), appId: v('appId')
    };
    const deploy = { githubRepo: v('githubRepo'), branchBase: 'main', branchSugerida: `campaign/${campanhaId}`, vercelProject: v('vercelProject'), previewEsperado: true };
    const modules = modulesByPlan(plano, skins);
    const seed = seedByPlan(campaignInput, historyInput, modules, skins);
    const prompt = gerarPrompt({ campaignInput, historyInput, automationInput, skins, firebase, modules, seed, deploy });

    state.pacote = {
      generatedAt: new Date().toISOString(),
      files: {
        'campaign.input.json': campaignInput,
        'history.input.json': historyInput,
        'automation.input.json': automationInput,
        'skins.config.json': skins,
        'modules.config.json': modules,
        'firebase.config.json': firebase,
        'seed.config.json': seed,
        'deploy.config.json': deploy,
        'picoclaw.prompt.md': prompt
      },
      prompt,
      checklist: buildChecklist(skins)
    };

    renderSkins(skins);
    const pacoteEl = document.getElementById('pacotePreview');
    const promptEl = document.getElementById('promptPreview');
    if (pacoteEl) pacoteEl.textContent = JSON.stringify(state.pacote.files, null, 2);
    if (promptEl) promptEl.value = prompt;
  }

  function buildSkins(campaign, history, automation) {
    const plano = campaign.planoAssinatura;
    const temHistorico = history.jaFoiCandidato === 'sim';
    return {
      'developerCampaign.skin': {
        active: true,
        finalidade: 'Construir/configurar campanha ANGEL em branch própria, com seed, módulos, permissões, PR e preview.',
        outputs: ['app_configurado','branch','draft_pr','preview_vercel','seed_admin']
      },
      'subscriptionPlan.skin': {
        active: true,
        plano,
        limites: limitsByPlan(plano),
        modulos: moduleListByPlan(plano)
      },
      'electoralAnalysis.skin': {
        active: automation.autoAnaliseEleitoral,
        fontes: ['TSE','TRE','bases_publicas_eleitorais','upload_csv_opcional'],
        alvo: { cargo: campaign.cargo, cidade: campaign.cidade, uf: campaign.uf, partido: campaign.partido, coligacao: campaign.coligacao },
        estrategiaHistorico: temHistorico ? 'analisar_historico_do_candidato_e_comparar_com_partido' : 'analisar_partido_coligacao_e_candidatos_similares',
        outputs: ['historico_candidato','historico_partido','zonas_prioritarias','locais_prioritarios','meta_sugerida','ranking_territorial']
      },
      'territoryGeocoding.skin': {
        active: automation.autoTerritorio || automation.autoGeocoding || automation.autoPins,
        pipeline: ['coletar_zonas_secoes_locais','normalizar_enderecos','geocodificar_enderecos','validar_confianca','criar_cache_geo','gerar_pins_eleitorais','criar_fila_revisao_manual'],
        geocoding: { required: automation.autoGeocoding, providerPreferido: 'google_or_mapbox', fallback: 'nominatim_or_manual', minConfidence: 0.75, cache: true },
        pins: { locaisVotacao: automation.autoPins, secoesAgrupadasPorLocal: true, bairros: true, zonas: true }
      },
      'fieldOps.skin': {
        active: ['operacao','inteligencia','full'].includes(plano),
        configura: ['estoque_materiais','rotas_carro_som','missoes_campo','crm_liderancas','denuncias','evidencias_gps_foto_hora'],
        outputs: ['paths_rtdb_operacionais','dashboard_coord','dashboard_candidato','rotas_priorizadas']
      },
      'brandingExperience.skin': {
        active: true,
        marcaSistema: 'ANGEL · Agente Núcleo de Gestão Eleitoral',
        regra: 'ANGEL é marca principal; candidato aparece como campanha ativa.',
        outputs: ['branding_config','login_header_angel','campanha_ativa_card']
      },
      'legalCompliance.skin': {
        active: automation.autoCompliance,
        foco: ['auditoria','logs','denuncias','trilha_de_acao','revisao_manual_de_ocorrencias'],
        outputs: ['logs_operacionais','fila_denuncias','relatorio_auditoria']
      },
      'automationIntegrations.skin': {
        active: automation.autoIntegracoes || plano === 'full',
        integra: ['n8n','whatsapp','vercel','github','firebase_functions'],
        outputs: ['webhook_config','prompt_automacao','checklist_integracoes']
      }
    };
  }

  function modulesByPlan(plano, skins) {
    const modulosAtivos = moduleListByPlan(plano);
    return {
      modulosAtivos,
      skinsAtivas: Object.entries(skins).filter(([,v]) => v.active).map(([k]) => k),
      regras: {
        campo: ['mapa','meucampo','percursos','meuinventario','minhasrotas','denuncias'].filter(m => modulosAtivos.includes(m) || ['mapa','meucampo','percursos','meuinventario','minhasrotas'].includes(m)),
        coord: ['dash','mapa','crm','estoque','rotas','denuncias','eleitoral'].filter(m => modulosAtivos.includes(m) || ['dash','mapa'].includes(m)),
        candidato: ['admindash','adminmapa','adminagentes','adminequipe','dash','crm','denuncias','eleitoral'].filter(m => modulosAtivos.includes(m) || m.startsWith('admin')),
        master: ['master-gerador','master-campanhas','master-planos','master-banco','master-clientes']
      }
    };
  }

  function seedByPlan(campaign, history, modules, skins) {
    return {
      campanhaId: campaign.campanhaId,
      senhasDefault: { campo: 'gerar_ou_definir_no_master', coord: 'gerar_ou_definir_no_master', candidato: 'gerar_ou_definir_no_master', master: 'secret_protegido' },
      firestore: ['campanhas/{id}','campanhas/{id}/config/main','master_campanhas/{id}'],
      rtdb: ['campanhas/{id}/pins','campanhas/{id}/crm_liderancas','campanhas/{id}/estoque_central','campanhas/{id}/rotas','campanhas/{id}/denuncias','campanhas/{id}/militantes'],
      territorio: skins['territoryGeocoding.skin'].active ? ['locais_votacao','secoes_eleitorais','zonas_eleitorais','pins_eleitorais','geo_cache','revisao_geo'] : [],
      analise: skins['electoralAnalysis.skin'].active ? ['historico_candidato','historico_partido','ranking_zonas','ranking_locais','metas_por_territorio'] : [],
      historicoInput: history,
      modulosAtivos: modules.modulosAtivos
    };
  }

  function gerarPrompt(ctx) {
    return `# PicoClaw · Skin desenvolvedora de campanha ANGEL\n\nVocê está trabalhando no repositório ${ctx.deploy.githubRepo}.\n\n## Coleta simples do Master\n\n\`\`\`json\n${JSON.stringify(ctx.campaignInput, null, 2)}\n\`\`\`\n\n## Histórico político informado\n\n\`\`\`json\n${JSON.stringify(ctx.historyInput, null, 2)}\n\`\`\`\n\n## Skins ativadas\n\n\`\`\`json\n${JSON.stringify(ctx.skins, null, 2)}\n\`\`\`\n\n## Módulos e permissões\n\n\`\`\`json\n${JSON.stringify(ctx.modules, null, 2)}\n\`\`\`\n\n## Seed e banco esperado\n\n\`\`\`json\n${JSON.stringify(ctx.seed, null, 2)}\n\`\`\`\n\n## Firebase público\n\n\`\`\`json\n${JSON.stringify(ctx.firebase, null, 2)}\n\`\`\`\n\n## Instruções obrigatórias\n1. Criar branch \`${ctx.deploy.branchSugerida}\` a partir de \`${ctx.deploy.branchBase}\`.\n2. Não commitar secrets, serviceAccountKey.json, .env ou chaves privadas.\n3. Usar ANGEL como marca principal: \"Agente Núcleo de Gestão Eleitoral\". O candidato é campanha ativa, não marca do produto.\n4. Implementar a developerCampaign.skin para configurar app, módulos, rotas, permissões, seed e PR.\n5. Implementar a electoralAnalysis.skin quando ativa: coletar/normalizar dados TSE/TRE ou preparar conectores/upload CSV.\n6. Implementar a territoryGeocoding.skin quando ativa: importar locais de votação, normalizar endereço, geocodificar, cachear, validar confiança, gerar PINs eleitorais e fila de revisão manual.\n7. Implementar a fieldOps.skin quando ativa: estoque, rotas, missões, CRM, denúncias e evidências de campo.\n8. Implementar dashboards para coordenador e candidato; candidato deve ver trabalho dos coordenadores/campo.\n9. Preparar seed admin para \`${ctx.campaignInput.campanhaId}\`.\n10. Rodar validações possíveis e abrir draft PR com checklist de pendências.\n\n## Critério de aceite\n- App abre com \`?c=${ctx.campaignInput.campanhaId}\`.\n- Perfis Campo, Coordenador, Candidato e Master têm navegação coerente.\n- Locais oficiais, se importados, viram coordenadas e PINs revisáveis.\n- Dashboard candidato mostra materiais, rotas, lideranças, território e ranking operacional.\n- Nenhum segredo é versionado.\n`;
  }

  function renderSkins(skins) {
    const el = document.getElementById('skinsPreview');
    if (!el) return;
    el.innerHTML = Object.entries(skins).map(([name, cfg]) => `
      <div class="skin-card ${cfg.active ? 'on' : 'off'}">
        <div><strong>${name}</strong><span>${cfg.active ? 'ativa' : 'inativa'}</span></div>
        <small>${esc(cfg.finalidade || cfg.foco || cfg.regra || cfg.pipeline?.join(' → ') || cfg.plano || '')}</small>
      </div>`).join('');
  }

  function moduleListByPlan(plano) {
    const base = ['mapa','meucampo','percursos','meuinventario','minhasrotas','dash','admindash','adminmapa','adminagentes','adminequipe'];
    if (plano === 'essencial') return [...base, 'estoque'];
    if (plano === 'operacao') return [...base, 'crm','estoque','rotas','denuncias'];
    if (plano === 'inteligencia') return [...base, 'crm','estoque','rotas','denuncias','eleitoral','inteligencia-eleitoral'];
    return [...base, 'crm','estoque','rotas','denuncias','eleitoral','inteligencia-eleitoral','agenda','gamificacao','automacoes'];
  }
  function limitsByPlan(plano) {
    return {
      essencial: { coords: 2, campo: 20, geocoding: false, automacoes: false },
      operacao: { coords: 5, campo: 80, geocoding: false, automacoes: false },
      inteligencia: { coords: 10, campo: 200, geocoding: true, automacoes: false },
      full: { coords: 999, campo: 9999, geocoding: true, automacoes: true }
    }[plano] || {};
  }
  function buildChecklist(skins) {
    const items = ['Ativar Email/Password no Firebase Auth', 'Não versionar chaves privadas', 'Criar branch e draft PR', 'Rodar seed admin da campanha', 'Validar login dos perfis'];
    if (skins['electoralAnalysis.skin'].active) items.push('Validar fonte TSE/TRE ou CSV de dados eleitorais');
    if (skins['territoryGeocoding.skin'].active) items.push('Validar geocoding, cache e fila de revisão manual');
    if (skins['automationIntegrations.skin'].active) items.push('Configurar secrets e webhooks de integrações');
    return items;
  }

  function field(id, label, value = '', type = 'text', inputmode = '') {
    return `<div class="field"><label>${label}</label><input data-pico-field id="${id}" type="${type}" inputmode="${inputmode}" value="${esc(value)}" placeholder="${esc(value)}"></div>`;
  }
  function textarea(id, label, value = '') {
    return `<div class="field" style="grid-column:1/-1;"><label>${label}</label><textarea data-pico-field id="${id}" style="height:88px;">${esc(value)}</textarea></div>`;
  }
  function select(id, label, options, selected) {
    return `<div class="field"><label>${label}</label><select data-pico-field id="${id}">${options.map(([v,l]) => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
  }
  function check(id, label, checked) {
    return `<label class="pico-check"><input data-auto id="${id}" type="checkbox" ${checked ? 'checked' : ''}> <span>${label}</span></label>`;
  }
  function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'campanha-demo'; }
  function esc(s) { return String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function baixar(nome, conteudo, tipo) { const blob = new Blob([conteudo], { type: tipo }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function copiarPrompt() { try { await navigator.clipboard.writeText(state.pacote?.prompt || ''); WWMX.UI?.showToast?.('Prompt copiado', 'success'); } catch (_) { WWMX.UI?.showToast?.('Não foi possível copiar', 'error'); } }
  function injectLocalStyles() {
    if (document.getElementById('picoGeneratorStyles')) return;
    const s = document.createElement('style');
    s.id = 'picoGeneratorStyles';
    s.textContent = `.pico-terminal{padding-bottom:80px}.pico-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}.pico-head-icon{font-size:30px}.pico-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:800}.pico-sub,.pico-alert{font-size:12px;color:var(--muted)}.pico-note{background:linear-gradient(135deg,rgba(59,130,246,.14),rgba(139,92,246,.10));border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px;font-size:12px;line-height:1.45}.grid-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}.pico-check-grid,.pico-skins{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}.pico-check,.skin-card{display:flex;align-items:flex-start;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px}.pico-check input{width:auto;margin-top:2px}.skin-card{display:block}.skin-card strong,.skin-card span,.skin-card small{display:block}.skin-card span{font-size:10px;text-transform:uppercase;color:var(--muted);margin-top:2px}.skin-card small{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.35}.skin-card.on{border-color:rgba(34,197,94,.45)}.skin-card.off{opacity:.55}.pico-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.pico-pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:11px;line-height:1.4;max-height:360px;overflow:auto}.pico-prompt{width:100%;height:280px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;color:var(--text);font-size:12px;line-height:1.4;font-family:ui-monospace,monospace}@media(max-width:720px){.grid-form,.pico-check-grid,.pico-skins,.pico-actions{grid-template-columns:1fr!important}}`;
    document.head.appendChild(s);
  }

  global.geradorPicoclawInit = init;
  global.geradorPicoclawDestroy = destroy;
})(window);
