/**
 * master/picoclaw-campaign-save.js
 * ANGEL · PicoClaw Campaign Pipeline
 * Ciclo 1: formulário Master -> campanha real no Firebase.
 */
(function (global) {
  'use strict';

  const REF_ID = 'angel-referencia-viamao';

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'campanha-sem-nome';
  }

  function val(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  function checked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function toast(msg, type) {
    if (global.WWMX?.UI?.showToast) WWMX.UI.showToast(msg, type || 'success');
    const el = document.getElementById('picoSaveStatus');
    if (el) {
      el.textContent = msg;
      el.style.color = type === 'error' ? 'var(--red)' : 'var(--angel-lime, var(--accent))';
    }
  }

  function modulosPorPlano(plano) {
    const base = [
      'mapa',
      'meucampo',
      'percursos',
      'meuinventario',
      'minhasrotas',
      'dash',
      'admindash',
      'adminmapa',
      'adminagentes',
      'adminequipe'
    ];

    if (plano === 'essencial') {
      return [...base, 'estoque'];
    }

    if (plano === 'operacao') {
      return [...base, 'crm', 'estoque', 'rotas', 'denuncias'];
    }

    if (plano === 'inteligencia') {
      return [...base, 'crm', 'estoque', 'rotas', 'denuncias', 'eleitoral', 'inteligencia-eleitoral'];
    }

    return [
      ...base,
      'crm',
      'estoque',
      'rotas',
      'denuncias',
      'eleitoral',
      'inteligencia-eleitoral',
      'agenda',
      'gamificacao',
      'automacoes'
    ];
  }

  function gerarPacote() {
    const candidato = val('candidato');
    const nomeUrna = val('nomeUrna') || candidato;
    const ano = val('ano') || '2026';
    const cidade = val('cidade') || 'cidade';
    const plano = val('plano') || 'essencial';
    const campanhaId = slug(`${nomeUrna}-${ano}-${cidade}`);

    const campaign = {
      campanhaId,
      candidato,
      nomeUrna,
      numero: val('numero'),
      partido: val('partido'),
      coligacao: val('coligacao'),
      cargo: val('cargo'),
      cidade,
      uf: val('uf'),
      ano,
      planoAssinatura: plano,
      tipo: campanhaId === REF_ID ? 'referencia_oficial' : 'cliente',
      status: 'criada',
      criadaEm: Date.now()
    };

    const senhas = {
      campo: val('senhaCampo') || '',
      coord: val('senhaCoord') || '',
      candidato: val('senhaCandidato') || '',
      master: val('senhaMaster') || ''
    };

    const historico = {
      jaFoiCandidato: val('jaFoiCandidato'),
      anoAnterior: val('historicoAno'),
      cargoAnterior: val('historicoCargo'),
      partidoAnterior: val('historicoPartido'),
      cidadeUfAnterior: val('historicoCidade'),
      numeroAnterior: val('historicoNumero'),
      observacoes: val('observacoesHistorico')
    };

    const automacoes = {
      analiseEleitoral: checked('autoAnaliseEleitoral'),
      territorio: checked('autoTerritorio'),
      geocoding: checked('autoGeocoding'),
      pins: checked('autoPins'),
      seed: checked('autoSeed'),
      pr: checked('autoPR'),
      compliance: checked('autoCompliance'),
      integracoes: checked('autoIntegracoes')
    };

    const skins = {
      'developerCampaign.skin': {
        active: true,
        finalidade: 'Gerar app de campanha, config, seed, branch, preview e PR.'
      },
      'subscriptionPlan.skin': {
        active: true,
        plano,
        modulos: modulosPorPlano(plano)
      },
      'electoralAnalysis.skin': {
        active: automacoes.analiseEleitoral,
        fontes: ['TSE', 'TRE', 'CSV oficial'],
        estrategiaHistorico:
          historico.jaFoiCandidato === 'sim'
            ? 'analisar_historico_do_candidato_e_partido'
            : 'analisar_partido_coligacao_e_candidatos_similares'
      },
      'territoryGeocoding.skin': {
        active: automacoes.territorio || automacoes.geocoding || automacoes.pins,
        pipeline: [
          'coletar_zonas_secoes_locais',
          'normalizar_enderecos',
          'geocodificar',
          'criar_cache_geo',
          'gerar_pins_eleitorais',
          'revisao_manual'
        ]
      },
      'fieldOps.skin': {
        active: ['operacao', 'inteligencia', 'full'].includes(plano),
        configura: ['estoque', 'rotas', 'crm', 'denuncias', 'evidencias_gps_foto']
      },
      'legalCompliance.skin': {
        active: automacoes.compliance
      }
    };

    const modules = {
      modulosAtivos: modulosPorPlano(plano),
      skinsAtivas: Object.keys(skins).filter((key) => skins[key].active)
    };

    const deploy = {
      githubRepo: val('githubRepo') || 'wwmotrix-collab/ANGEL',
      vercelProject: val('vercelProject') || 'angel-liart.vercel.app',
      branchBase: 'main',
      branchSugerida: `campaign/${campanhaId}`,
      previewEsperado: true
    };

    const prompt = [
      '# PicoClaw · Campaign Pipeline ANGEL',
      '',
      'Criar campanha real a partir deste pacote.',
      '',
      '## Campanha',
      '```json',
      JSON.stringify(campaign, null, 2),
      '```',
      '',
      '## Histórico',
      '```json',
      JSON.stringify(historico, null, 2),
      '```',
      '',
      '## Skins',
      '```json',
      JSON.stringify(skins, null, 2),
      '```',
      '',
      '## Módulos',
      '```json',
      JSON.stringify(modules, null, 2),
      '```',
      '',
      '## Instruções',
      '- Não commitar secrets.',
      '- Criar seed real no Firebase.',
      '- Importar TSE/TRE quando disponível.',
      '- Geocodificar locais de votação.',
      '- Gerar metas por território.',
      '- Abrir draft PR.'
    ].join('\n');

    return {
      generatedAt: new Date().toISOString(),
      campanhaId,
      campaign,
      senhas,
      historico,
      automacoes,
      skins,
      modules,
      deploy,
      prompt,
      status: {
        pipeline: 'created_by_master_form',
        territorio: 'pendente_importacao_tse',
        eleitoral: 'pendente_processamento_picoclaw'
      }
    };
  }

  async function salvarCampanha() {
    try {
      if (!global.WWMX?.db?.set) {
        throw new Error('Firebase/WWMX.db não está disponível.');
      }

      const pacote = gerarPacote();
      const id = pacote.campanhaId;

      if (!pacote.campaign.candidato || !pacote.campaign.nomeUrna) {
        throw new Error('Preencha candidato e nome de urna.');
      }

      if (!pacote.senhas.campo || !pacote.senhas.coord || !pacote.senhas.candidato) {
        throw new Error('Preencha as senhas de Campo, Coordenador e Candidato.');
      }

      toast('Criando campanha no Firebase...', 'info');

      await WWMX.db.set(`master_campanhas/${id}`, {
        ...pacote.campaign,
        pacote,
        atualizadoEm: Date.now()
      });

      await WWMX.db.set(`campanhas/${id}/config/main`, {
        ...pacote.campaign,
        modulosAtivos: pacote.modules.modulosAtivos,
        skinsAtivas: pacote.modules.skinsAtivas,
        deploy: pacote.deploy,
        atualizadoEm: Date.now()
      });

      await WWMX.db.set(`campanhas/${id}/config/senhas`, pacote.senhas);
      await WWMX.db.set(`campanhas/${id}/config/historico`, pacote.historico);
      await WWMX.db.set(`campanhas/${id}/config/automacoes`, pacote.automacoes);
      await WWMX.db.set(`campanhas/${id}/config/skins`, pacote.skins);
      await WWMX.db.set(`campanhas/${id}/config/picoclaw`, {
        prompt: pacote.prompt,
        generatedAt: pacote.generatedAt,
        status: 'pacote_gerado'
      });

      await WWMX.db.set(`campanhas/${id}/territorio/status`, {
        status: 'pendente_importacao_tse',
        ts: Date.now()
      });

      await WWMX.db.set(`campanhas/${id}/eleitoral/status`, {
        status: 'pendente_processamento_picoclaw',
        ts: Date.now()
      });

      await WWMX.db.set(`campanhas/${id}/seed/status`, {
        status: 'estrutura_inicial_criada',
        paths: [
          'pins',
          'crm_liderancas',
          'estoque_central',
          'rotas',
          'denuncias',
          'militantes',
          'territorio',
          'eleitoral'
        ],
        ts: Date.now()
      });

      try {
        localStorage.setItem('wwmx_campanha', id);
      } catch (_) {}

      const preview = document.getElementById('pacotePreview');
      if (preview) preview.textContent = JSON.stringify(pacote, null, 2);

      const promptBox = document.getElementById('promptPreview');
      if (promptBox) promptBox.value = pacote.prompt;

      toast(`✅ Campanha criada: ${id}. Abra com ?c=${id}`, 'success');
    } catch (err) {
      console.error('[PicoClaw Campaign Save]', err);
      toast('Erro: ' + (err.message || err), 'error');
    }
  }

  function instalar() {
    const actions = document.querySelector('.pico-actions');
    if (!actions || document.getElementById('btnSalvarCampanhaReal')) return;

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.id = 'btnSalvarCampanhaReal';
    btn.type = 'button';
    btn.textContent = 'Salvar e criar campanha';
    btn.onclick = salvarCampanha;

    actions.insertBefore(btn, actions.firstChild);

    const status = document.createElement('div');
    status.id = 'picoSaveStatus';
    status.style.fontSize = '12px';
    status.style.margin = '8px 0 14px';
    status.style.color = 'var(--muted)';
    status.textContent = 'Pipeline PicoClaw pronto para criar campanha real.';
    actions.parentNode.insertBefore(status, actions.nextSibling);
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.PicoCampaignSave = {
    instalar,
    salvarCampanha,
    gerarPacote
  };

  instalar();
})(window);
