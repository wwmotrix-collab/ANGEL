/**
 * master/picoclaw-campaign-save.js
 * ANGEL · PicoClaw Campaign Pipeline
 * Salva campanha real evitando chaves inválidas no Firebase RTDB.
 */
(function (global) {
  'use strict';

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'campanha-sem-nome';
  }

  function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
  function checked(id) { return !!document.getElementById(id)?.checked; }

  function toast(msg, type) {
    if (global.WWMX?.UI?.showToast) WWMX.UI.showToast(msg, type || 'success');
    const el = document.getElementById('picoSaveStatus');
    if (el) {
      el.textContent = msg;
      el.style.color = type === 'error' ? 'var(--red)' : 'var(--angel-lime, var(--accent))';
    }
  }

  function safeKey(key) {
    return String(key || 'key')
      .replace(/[.#$\/\[\]]/g, '_')
      .replace(/^_+|_+$/g, '') || 'key';
  }

  function safeObject(value) {
    if (Array.isArray(value)) return value.map(safeObject);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [safeKey(k), safeObject(v)]));
  }

  function modulosPorPlano(plano) {
    const base = ['mapa','meucampo','percursos','meuinventario','minhasrotas','dash','admindash','adminmapa','adminagentes','adminequipe'];
    if (plano === 'starter') return [...base, 'crm', 'denuncias'];
    if (plano === 'pro') return [...base, 'crm', 'denuncias', 'estoque', 'rotas', 'agenda'];
    if (plano === 'elite') return [...base, 'crm', 'denuncias', 'estoque', 'rotas', 'agenda', 'estreleiro', 'pre-campanha', 'eleitoral', 'inteligencia-eleitoral', 'fontes-reais'];
    return [...base, 'crm', 'denuncias', 'estoque', 'rotas', 'agenda', 'estreleiro', 'pre-campanha', 'eleitoral', 'inteligencia-eleitoral', 'fontes-reais', 'gamificacao', 'automacoes'];
  }

  function limitesPorPlano(plano) {
    const defaults = {
      starter: { coordenadores: 2, campo: 15 },
      pro: { coordenadores: 5, campo: 60 },
      elite: { coordenadores: 10, campo: 200, geocoding: true },
      personalizado: { coordenadores: 999, campo: 9999, geocoding: true, automacoes: true }
    };
    return defaults[plano] || defaults.pro;
  }

  function fontesReaisConfig(campaign, historico, automacoes) {
    return {
      enabled: !!(automacoes.analiseEleitoral || automacoes.territorio || automacoes.geocoding || automacoes.pins),
      municipio: campaign.municipio,
      uf: campaign.uf,
      ano: campaign.ano,
      candidato: campaign.candidato,
      nomeUrna: campaign.nomeUrna,
      partido: campaign.partido,
      cargo: campaign.cargo,
      historico,
      sources: {
        tse: {
          label: 'Tribunal Superior Eleitoral',
          trustLevel: 'primary',
          mode: 'download_import_normalize',
          datasets: ['locais_votacao','eleitorado','resultados_por_secao_zona_municipio','candidaturas','partidos_coligacoes'],
          outputs: ['territorio/locais_votacao','eleitoral/historico','eleitoral/status']
        },
        tre: {
          label: 'Tribunal Regional Eleitoral',
          trustLevel: 'complementary',
          mode: 'uf_specific_connector_or_manual_import',
          datasets: ['enderecos_atualizados','zonas_eleitorais','comunicados_logisticos'],
          outputs: ['territorio/fontes_tre','territorio/revisao_geo']
        },
        geocoding: {
          label: 'Maps Geocoding',
          trustLevel: 'derived',
          mode: 'provider_with_secret',
          providers: ['google_maps','mapbox','nominatim_manual_fallback'],
          requiredSecrets: ['GEOCODING_PROVIDER','GOOGLE_MAPS_API_KEY','MAPBOX_TOKEN'],
          cachePath: `campanhas/${campaign.id}/territorio/geo_cache`,
          reviewPath: `campanhas/${campaign.id}/territorio/revisao_geo`,
          outputs: ['lat','lng','geoProvider','geoConfidence','placeId','geoStatus']
        }
      },
      pipeline: ['collect_tse_files','normalize_electoral_schema','merge_tre_complements','geocode_voting_places','cache_geocoding_results','flag_low_confidence_for_review','generate_electoral_pins','generate_territory_goals'],
      minimumSchema: ['id','nome','endereco','bairro','municipio','uf','zona','secoes','eleitores','lat','lng','geoStatus','geoConfidence','source','sourceUpdatedAt']
    };
  }

  function gerarPacote() {
    const candidato = val('candidato');
    const nomeUrna = val('nomeUrna') || candidato;
    const ano = val('ano') || '2026';
    const cidade = val('cidade') || 'cidade';
    const plano = val('plano') || 'pro';
    const campanhaId = slug(`${nomeUrna}-${ano}-${cidade}`);
    const limitesPadrao = limitesPorPlano(plano);

    const campaign = {
      campanhaId,
      id: campanhaId,
      candidato,
      nomeUrna,
      nomeExibicao: nomeUrna,
      numero: val('numero'),
      partido: val('partido'),
      coligacao: val('coligacao'),
      cargo: val('cargo'),
      cidade,
      municipio: cidade,
      uf: val('uf'),
      ano,
      planoAssinatura: plano,
      status: 'ativo',
      limites: {
        coordenadores: Number(val('limiteCoords') || limitesPadrao.coordenadores || 0),
        campo: Number(val('limiteCampo') || limitesPadrao.campo || 0)
      },
      criadaEm: Date.now()
    };

    const senhas = {
      campo: val('senhaCampo') || '',
      coord: val('senhaCoord') || '',
      candidato: val('senhaCandidato') || '',
      master: val('senhaMaster') || 'master2026'
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

    const fontesReais = fontesReaisConfig(campaign, historico, automacoes);

    const skins = {
      developerCampaign_skin: {
        originalKey: 'developerCampaign.skin',
        active: true,
        finalidade: 'Gerar app de campanha, config, seed, branch, preview e PR.'
      },
      subscriptionPlan_skin: {
        originalKey: 'subscriptionPlan.skin',
        active: true,
        plano,
        modulos: modulosPorPlano(plano)
      },
      electoralAnalysis_skin: {
        originalKey: 'electoralAnalysis.skin',
        active: automacoes.analiseEleitoral,
        fontes: ['TSE oficial', 'TRE complementar', 'CSV oficial importado'],
        fontesReais: fontesReais.sources,
        estrategiaHistorico: historico.jaFoiCandidato === 'sim' ? 'analisar_historico_do_candidato_e_partido' : 'analisar_partido_coligacao_e_candidatos_similares'
      },
      territoryGeocoding_skin: {
        originalKey: 'territoryGeocoding.skin',
        active: automacoes.territorio || automacoes.geocoding || automacoes.pins,
        fontesReais,
        pipeline: fontesReais.pipeline
      },
      fieldOps_skin: {
        originalKey: 'fieldOps.skin',
        active: ['pro', 'elite', 'personalizado'].includes(plano),
        configura: ['estoque', 'rotas', 'crm', 'denuncias', 'evidencias_gps_foto']
      },
      legalCompliance_skin: {
        originalKey: 'legalCompliance.skin',
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
      '## Fontes reais',
      '```json',
      JSON.stringify(fontesReais, null, 2),
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
      '- Importar TSE como fonte primária.',
      '- Usar TRE como complemento por UF quando houver fonte estadual.',
      '- Geocodificar locais de votação com provider configurado por segredo.',
      '- Gravar cache e enviar baixa confiança para revisão manual.',
      '- Gerar PINs eleitorais e metas por território.',
      '- Abrir draft PR.'
    ].join('\n');

    return {
      generatedAt: new Date().toISOString(),
      campanhaId,
      campaign,
      senhas,
      historico,
      automacoes,
      fontesReais,
      skins,
      modules,
      deploy,
      prompt,
      status: {
        pipeline: 'created_by_master_form',
        territorio: fontesReais.enabled ? 'pendente_importacao_tse' : 'nao_solicitado',
        eleitoral: fontesReais.enabled ? 'pendente_processamento_picoclaw' : 'nao_solicitado',
        geocoding: automacoes.geocoding ? 'pendente_provider_secret' : 'nao_solicitado'
      }
    };
  }

  async function salvarCampanha() {
    try {
      if (!global.WWMX?.db?.set) throw new Error('Firebase/WWMX.db não está disponível.');

      const pacote = gerarPacote();
      const id = pacote.campanhaId;

      if (!pacote.campaign.candidato || !pacote.campaign.nomeUrna) throw new Error('Preencha candidato e nome de urna.');
      if (!pacote.senhas.campo || !pacote.senhas.coord || !pacote.senhas.candidato) throw new Error('Preencha as senhas de Campo, Coordenador e Candidato.');

      toast('Criando campanha no Firebase...', 'info');

      const pacoteSeguro = safeObject(pacote);

      const campanhaPublica = safeObject({
        ...pacote.campaign,
        id,
        campanhaId: id,
        modulosAtivos: pacote.modules.modulosAtivos,
        skinsAtivas: pacote.modules.skinsAtivas,
        fontesReaisAtivas: pacote.fontesReais.enabled,
        picoclawStatus: 'gerado',
        atualizadoEm: Date.now()
      });

      const configMain = safeObject({
        ...pacote.campaign,
        modulosAtivos: pacote.modules.modulosAtivos,
        skinsAtivas: pacote.modules.skinsAtivas,
        senhas: pacote.senhas,
        historico: pacote.historico,
        automacoes: pacote.automacoes,
        fontesReais: pacote.fontesReais,
        deploy: pacote.deploy,
        atualizadoEm: Date.now()
      });

      if (global.WWMX?.fs?.setDoc) {
        await WWMX.fs.setDoc(campanhaPublica, 'campanhas', id);
        await WWMX.fs.setDoc(configMain, 'campanhas', id, 'config', 'main');
      }

      await WWMX.db.set(`master_campanhas/${id}`, {
        ...safeObject(pacote.campaign),
        pacote: pacoteSeguro,
        atualizadoEm: Date.now()
      });

      await WWMX.db.set(`campanhas/${id}/config/main`, safeObject({
        ...pacote.campaign,
        modulosAtivos: pacote.modules.modulosAtivos,
        skinsAtivas: pacote.modules.skinsAtivas,
        fontesReaisAtivas: pacote.fontesReais.enabled,
        deploy: pacote.deploy,
        atualizadoEm: Date.now()
      }));

      await WWMX.db.set(`campanhas/${id}/config/senhas`, safeObject(pacote.senhas));
      await WWMX.db.set(`campanhas/${id}/config/historico`, safeObject(pacote.historico));
      await WWMX.db.set(`campanhas/${id}/config/automacoes`, safeObject(pacote.automacoes));
      await WWMX.db.set(`campanhas/${id}/config/skins`, safeObject(pacote.skins));
      await WWMX.db.set(`campanhas/${id}/config/fontes_reais`, safeObject(pacote.fontesReais));
      await WWMX.db.set(`campanhas/${id}/config/picoclaw`, safeObject({
        prompt: pacote.prompt,
        generatedAt: pacote.generatedAt,
        status: 'pacote_gerado'
      }));

      await WWMX.db.set(`campanhas/${id}/territorio/status`, { status: pacote.status.territorio, fontePrimaria: 'tse', ts: Date.now() });
      await WWMX.db.set(`campanhas/${id}/territorio/fontes/status`, safeObject(pacote.fontesReais.sources));
      await WWMX.db.set(`campanhas/${id}/eleitoral/status`, { status: pacote.status.eleitoral, fontePrimaria: 'tse', ts: Date.now() });
      await WWMX.db.set(`campanhas/${id}/geocoding/status`, { status: pacote.status.geocoding, secrets: pacote.fontesReais.sources.geocoding.requiredSecrets, ts: Date.now() });
      await WWMX.db.set(`campanhas/${id}/seed/status`, { status: 'estrutura_inicial_criada', paths: ['pins','crm_liderancas','estoque_central','rotas','denuncias','militantes','territorio','eleitoral','geocoding'], ts: Date.now() });

      try { localStorage.setItem('wwmx_campanha', id); } catch (_) {}

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

    if (!document.getElementById('picoSaveStatus')) {
      const status = document.createElement('div');
      status.id = 'picoSaveStatus';
      status.style.fontSize = '12px';
      status.style.margin = '8px 0 14px';
      status.style.color = 'var(--muted)';
      status.textContent = 'Pipeline PicoClaw pronto para criar campanha real com fontes oficiais configuradas.';
      actions.parentNode.insertBefore(status, actions.nextSibling);
    }
  }

  global.WWMX = global.WWMX || {};
  global.WWMX.PicoCampaignSave = { instalar, salvarCampanha, gerarPacote, fontesReaisConfig };
  instalar();
})(window);
