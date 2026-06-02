/**
 * master/gerador-picoclaw.js
 * ANGEL — Terminal Master para gerar briefing/pacote PicoClaw de nova campanha.
 *
 * Esta primeira versão não executa o PicoClaw diretamente. Ela gera o pacote
 * estruturado que o PicoClaw precisa consumir: JSONs, prompt, checklist e seed.
 */
(function (global) {
  'use strict';

  const state = { pacote: null };

  const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

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
      <div class="dash-view">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="font-size:30px;">🧠</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;">Gerador PicoClaw</div>
            <div style="font-size:12px;color:var(--muted);">Terminal Master para transformar briefing comercial em campanha ANGEL implantável.</div>
          </div>
        </div>

        <div style="background:linear-gradient(135deg,rgba(59,130,246,.14),rgba(139,92,246,.10));border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px;">
          <div style="font-family:'Syne',sans-serif;font-weight:800;margin-bottom:6px;">Saída esperada</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.45;">O formulário gera <strong>campaign.config.json</strong>, <strong>branding.config.json</strong>, <strong>firebase.config.json</strong>, <strong>seed.config.json</strong>, <strong>modules.config.json</strong> e <strong>picoclaw.prompt.md</strong>. Secrets/chaves admin ficam fora do pacote.</div>
        </div>

        <div class="section-title">1 · Identidade da campanha</div>
        <div class="grid-form">
          ${field('campanhaId','ID / slug da campanha','carlos-mendes-2026-viamao')}
          ${field('nomeExibicao','Nome de exibição','Dr. Carlos Mendes')}
          ${field('nomeUrna','Nome de urna','Carlos Mendes')}
          ${field('numero','Número','40','text','numeric')}
          ${select('cargo','Cargo',[['vereador','Vereador'],['prefeito','Prefeito'],['dep_estadual','Deputado Estadual'],['dep_federal','Deputado Federal'],['senador','Senador'],['governador','Governador']], 'dep_estadual')}
          ${field('partido','Partido','PSB')}
          ${field('coligacao','Coligação / Federação','Frente Democrática')}
          ${field('municipio','Município-base','Viamão')}
          ${select('uf','UF',UF_OPTIONS.map(u => [u,u]), 'RS')}
          ${field('ano','Ano eleitoral','2026','text','numeric')}
          ${field('slogan','Slogan','Gestão, presença e resultado')}
          ${field('metaVotos','Meta de votos','49000','number','numeric')}
        </div>

        <div class="section-title">2 · Identidade visual</div>
        <div class="grid-form">
          ${field('brandNome','Marca do sistema','ANGEL')}
          ${field('brandDescricao','Descrição da marca','Agente Núcleo de Gestão Eleitoral')}
          ${field('corPrimaria','Cor primária','#1e4db7')}
          ${field('corSecundaria','Cor secundária','#c0392b')}
          ${field('corFundo','Cor de fundo','#0d1117')}
          ${field('logoPath','Logo ANGEL','assets/brand/angel-logo.svg')}
        </div>

        <div class="section-title">3 · Módulos contratados</div>
        <div id="modulosGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"></div>

        <div class="section-title">4 · Perfis e acessos</div>
        <div class="grid-form">
          ${field('senhaCampo','Senha Campo','demo2026')}
          ${field('senhaCoord','Senha Coordenador','demo2026')}
          ${field('senhaCandidato','Senha Candidato','admin2026')}
          ${field('senhaMaster','Senha Master','master2026')}
          ${field('qtdCoords','Coordenadores iniciais','3','number','numeric')}
          ${field('qtdCampo','Agentes de campo iniciais','20','number','numeric')}
        </div>

        <div class="section-title">5 · Território e operação</div>
        <div class="grid-form">
          ${textarea('bairrosPrioritarios','Bairros prioritários','Centro\nViamópolis\nSanta Luzia\nTrês Marias')}
          ${textarea('zonasEleitorais','Zonas eleitorais','59\n72')}
          ${textarea('adversarios','Adversários principais','Adversário A\nAdversário B')}
          ${textarea('materiaisIniciais','Materiais iniciais','Panfleto A5:5000\nColinha 10x15:2000\nWindbanner 80x200:40\nCamiseta M:100\nBoné:80')}
          ${textarea('rotasPadrao','Rotas/ações padrão','Carro de Som\nCaminhada\nPanfletagem\nCorpo a Corpo\nPorta a Porta')}
          ${textarea('camposLideranca','Campos de liderança','Nome\nWhatsApp\nBairro\nZona eleitoral\nVotos estimados\nStatus de confiança\nResponsável interno')}
        </div>

        <div class="section-title">6 · Firebase / Deploy</div>
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
        <div style="font-size:11px;color:var(--muted);margin:-6px 0 16px;">Não cole service account aqui. A chave admin deve entrar como secret local/GitHub/Codespace.</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <button class="btn btn-primary" id="btnGerarPacote">Gerar pacote</button>
          <button class="btn btn-ghost" id="btnCopiarPrompt">Copiar prompt</button>
          <button class="btn btn-ghost" id="btnBaixarJson">Baixar pacote JSON</button>
          <button class="btn btn-ghost" id="btnBaixarPrompt">Baixar prompt .md</button>
        </div>

        <div class="section-title">Preview do pacote</div>
        <pre id="pacotePreview" style="white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:11px;line-height:1.4;max-height:360px;overflow:auto;"></pre>

        <div class="section-title" style="margin-top:16px;">Prompt PicoClaw</div>
        <textarea id="promptPreview" readonly style="width:100%;height:260px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;color:var(--text);font-size:12px;line-height:1.4;font-family:ui-monospace,monospace;"></textarea>
        <div style="height:80px;"></div>
      </div>
    `;

    injectLocalStyles();
    renderModulos();
  }

  function bind() {
    document.querySelectorAll('[data-pico-field], #modulosGrid input').forEach(el => {
      el.addEventListener('input', gerarPacote);
      el.addEventListener('change', gerarPacote);
    });
    document.getElementById('btnGerarPacote')?.addEventListener('click', gerarPacote);
    document.getElementById('btnCopiarPrompt')?.addEventListener('click', copiarPrompt);
    document.getElementById('btnBaixarJson')?.addEventListener('click', () => baixar('angel-picoclaw-package.json', JSON.stringify(state.pacote, null, 2), 'application/json'));
    document.getElementById('btnBaixarPrompt')?.addEventListener('click', () => baixar('picoclaw.prompt.md', state.pacote?.prompt || '', 'text/markdown'));
  }

  function renderModulos() {
    const mods = [
      ['crm','👥 CRM Lideranças'], ['denuncias','🚨 Denúncias'], ['estoque','📦 Estoque/Materiais'], ['rotas','🚗 Rotas/Carro de Som'],
      ['agenda','📅 Agenda/Eventos'], ['inteligencia-eleitoral','🗳️ Inteligência Eleitoral'], ['gamificacao','🌟 Gamificação'], ['dashboard-candidato','👑 Dashboard Candidato']
    ];
    const grid = document.getElementById('modulosGrid');
    if (!grid) return;
    grid.innerHTML = mods.map(([id,label]) => `<label class="pico-check"><input type="checkbox" data-modulo="${id}" ${id !== 'agenda' ? 'checked' : ''}> <span>${label}</span></label>`).join('');
  }

  function gerarPacote() {
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const linhas = id => v(id).split('\n').map(s => s.trim()).filter(Boolean);
    const modulosAtivos = Array.from(document.querySelectorAll('[data-modulo]:checked')).map(i => i.dataset.modulo);
    const campanhaId = slug(v('campanhaId') || `${v('nomeUrna')}-${v('ano')}-${v('municipio')}`);

    const campaign = {
      campanhaId,
      nomeExibicao: v('nomeExibicao'), nomeUrna: v('nomeUrna'), numero: v('numero'), cargo: v('cargo'), partido: v('partido'),
      coligacao: v('coligacao'), municipio: v('municipio'), uf: v('uf'), ano: v('ano'), slogan: v('slogan'),
      metaVotos: Number(v('metaVotos') || 0), status: 'ativo', subTitulo: `ANGEL · ${v('municipio')} ${v('ano')}`,
    };
    const branding = { brand: { nome: v('brandNome'), descricao: v('brandDescricao'), logo: v('logoPath'), corPrimaria: v('corPrimaria'), corSecundaria: v('corSecundaria'), corFundo: v('corFundo'), fonteTitulo: 'Syne', fonteTexto: 'DM Sans' } };
    const firebase = { projectId: v('firebaseProjectId'), authDomain: v('authDomain'), databaseURL: v('databaseURL'), storageBucket: v('storageBucket'), messagingSenderId: v('messagingSenderId'), appId: v('appId') };
    const modules = { modulosAtivos, regras: { campo: ['mapa','meucampo','percursos','meuinventario','minhasrotas'], coord: ['dash','mapa','crm','estoque','rotas','denuncias','eleitoral'], candidato: ['admindash','adminmapa','adminagentes','adminequipe','dash','crm','denuncias'], master: ['master-gerador','master-campanhas','master-planos','master-banco','master-clientes'] } };
    const seed = {
      senhas: { campo: v('senhaCampo'), coord: v('senhaCoord'), candidato: v('senhaCandidato'), master: v('senhaMaster') },
      estruturaInicial: { qtdCoords: Number(v('qtdCoords') || 0), qtdCampo: Number(v('qtdCampo') || 0), bairrosPrioritarios: linhas('bairrosPrioritarios'), zonasEleitorais: linhas('zonasEleitorais'), adversarios: linhas('adversarios'), materiaisIniciais: parseMateriais(linhas('materiaisIniciais')), rotasPadrao: linhas('rotasPadrao'), camposLideranca: linhas('camposLideranca') }
    };
    const deploy = { githubRepo: v('githubRepo'), branchBase: 'main', branchSugerida: `campaign/${campanhaId}`, vercelProject: v('vercelProject'), previewEsperado: true };
    const prompt = gerarPrompt({ campaign, branding, firebase, modules, seed, deploy });

    state.pacote = {
      generatedAt: new Date().toISOString(),
      files: {
        'campaign.config.json': campaign,
        'branding.config.json': branding,
        'firebase.config.json': firebase,
        'modules.config.json': modules,
        'seed.config.json': seed,
        'deploy.config.json': deploy,
        'picoclaw.prompt.md': prompt,
      },
      prompt,
      checklist: [
        'Validar Email/Password no Firebase Auth', 'Nunca commitar serviceAccountKey.json', 'Atualizar core/firebase.js com firebase.config.json',
        'Rodar seed admin para campaign.config.campanhaId', 'Validar login de Campo, Coordenador, Candidato e Master', 'Abrir draft PR e preview Vercel'
      ]
    };

    const pacoteEl = document.getElementById('pacotePreview');
    const promptEl = document.getElementById('promptPreview');
    if (pacoteEl) pacoteEl.textContent = JSON.stringify(state.pacote.files, null, 2);
    if (promptEl) promptEl.value = prompt;
  }

  function gerarPrompt(ctx) {
    return `# PicoClaw · Gerar campanha ANGEL\n\nVocê está trabalhando no repositório ${ctx.deploy.githubRepo}.\n\n## Objetivo\nCriar/configurar uma nova campanha ANGEL pronta para preview, sem alterar diretamente a main.\n\n## Campanha\n\n\`\`\`json\n${JSON.stringify(ctx.campaign, null, 2)}\n\`\`\`\n\n## Branding\n\n\`\`\`json\n${JSON.stringify(ctx.branding, null, 2)}\n\`\`\`\n\n## Firebase público\n\n\`\`\`json\n${JSON.stringify(ctx.firebase, null, 2)}\n\`\`\`\n\n## Módulos e permissões\n\n\`\`\`json\n${JSON.stringify(ctx.modules, null, 2)}\n\`\`\`\n\n## Seed inicial\n\n\`\`\`json\n${JSON.stringify(ctx.seed, null, 2)}\n\`\`\`\n\n## Instruções obrigatórias\n1. Criar branch \`${ctx.deploy.branchSugerida}\` a partir de \`${ctx.deploy.branchBase}\`.\n2. Não commitar secrets, service accounts ou .env.\n3. Atualizar a identidade da campanha sem substituir a marca principal ANGEL.\n4. Configurar módulos ativos conforme modules.config.json.\n5. Preparar seed para Firestore e Realtime Database usando campaign.config.campanhaId.\n6. Garantir que Campo, Coordenador, Candidato e Master tenham navegação coerente.\n7. O candidato deve ver o trabalho dos coordenadores/campo no dashboard.\n8. Rodar validações estáticas possíveis e abrir draft PR.\n9. Informar arquivos alterados e pendências manuais.\n\n## Critério de aceite\n- App abre com \`?c=${ctx.campaign.campanhaId}\`.\n- Login de perfis funciona após Firebase Auth Email/Password ativado.\n- Dashboard candidato mostra materiais, rotas, lideranças e ranking operacional.\n- Master continua com acesso ao gerador.\n`;
  }

  function parseMateriais(items) {
    return items.map((raw) => {
      const [nome, qtd] = raw.split(':');
      return { nome: (nome || raw).trim(), qtdInicial: Number((qtd || '0').replace(/\D/g,'')) || 0 };
    });
  }

  function field(id, label, value = '', type = 'text', inputmode = '') {
    return `<div class="field"><label>${label}</label><input data-pico-field id="${id}" type="${type}" inputmode="${inputmode}" value="${esc(value)}" placeholder="${esc(value)}"></div>`;
  }
  function textarea(id, label, value = '') {
    return `<div class="field"><label>${label}</label><textarea data-pico-field id="${id}" style="height:110px;">${esc(value)}</textarea></div>`;
  }
  function select(id, label, options, selected) {
    return `<div class="field"><label>${label}</label><select data-pico-field id="${id}">${options.map(([v,l]) => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
  }
  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'campanha-demo';
  }
  function esc(s) { return String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copiarPrompt() {
    try { await navigator.clipboard.writeText(state.pacote?.prompt || ''); WWMX.UI?.showToast?.('Prompt copiado', 'success'); }
    catch (_) { WWMX.UI?.showToast?.('Não foi possível copiar', 'error'); }
  }
  function injectLocalStyles() {
    if (document.getElementById('picoGeneratorStyles')) return;
    const s = document.createElement('style');
    s.id = 'picoGeneratorStyles';
    s.textContent = `.grid-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}.pico-check{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;cursor:pointer}.pico-check input{width:auto}@media(max-width:720px){.grid-form,#modulosGrid{grid-template-columns:1fr!important}}`;
    document.head.appendChild(s);
  }

  global.geradorPicoclawInit = init;
  global.geradorPicoclawDestroy = destroy;
})(window);
