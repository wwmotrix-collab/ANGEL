/**
 * motores/picoclaw/skins.js
 * ANGEL PicoClaw — registry das skins de campanha.
 */
'use strict';

const SKIN_REGISTRY = {
  'developerCampaign.skin': {
    ordem: 10,
    descricao: 'Configura app, campanha, branch, PR, módulos, permissões e seed.',
    outputs: ['implementation.plan.json', 'branch.plan.json', 'seed.plan.json'],
    run(ctx) {
      const c = ctx.campaign;
      return {
        branch: ctx.deploy.branchSugerida || `campaign/${c.campanhaId}`,
        arquivosCriticos: ['core/config.js', 'core/router.js', 'core/firebase.js', 'firebase/seed-admin.js'],
        firebasePaths: ctx.seed.firestore.concat(ctx.seed.rtdb),
        acceptance: [
          `App abre com ?c=${c.campanhaId}`,
          'Perfis Campo/Coord/Candidato/Master funcionam',
          'Nenhum segredo versionado',
          'Draft PR aberto para revisão'
        ]
      };
    }
  },

  'subscriptionPlan.skin': {
    ordem: 20,
    descricao: 'Traduz plano comercial em módulos, limites e profundidade de automação.',
    outputs: ['plan.entitlements.json'],
    run(ctx) {
      const plano = ctx.campaign.planoAssinatura || 'essencial';
      return {
        plano,
        modulosAtivos: ctx.modules.modulosAtivos || [],
        limites: ctx.skins['subscriptionPlan.skin']?.limites || {},
        upgradePath: plano === 'full' ? [] : ['inteligencia', 'full']
      };
    }
  },

  'electoralAnalysis.skin': {
    ordem: 30,
    descricao: 'Define coleta/análise TSE/TRE/histórico do candidato ou partido.',
    outputs: ['electoral.collection.plan.json', 'electoral.analysis.plan.json'],
    run(ctx) {
      const c = ctx.campaign;
      const h = ctx.history;
      const historicoCandidato = h.jaFoiCandidato === 'sim';
      return {
        fontes: ['TSE', 'TRE', 'CSV manual opcional'],
        chavesBusca: {
          candidato: c.candidato,
          nomeUrna: c.nomeUrna,
          partido: c.partido,
          coligacao: c.coligacao,
          cargo: c.cargo,
          municipio: c.cidade,
          uf: c.uf,
          ano: c.ano
        },
        estrategia: historicoCandidato
          ? 'buscar desempenho anterior do candidato e comparar com partido/coligação'
          : 'buscar desempenho partidário/coligação e candidatos similares no território',
        datasetsEsperados: [
          'candidaturas anteriores',
          'resultados por município/zona/seção quando disponível',
          'locais de votação',
          'eleitorado por local/seção quando disponível'
        ],
        saidas: ['ranking_zonas', 'ranking_locais', 'metas_por_territorio', 'hipoteses_prioridade']
      };
    }
  },

  'territoryGeocoding.skin': {
    ordem: 40,
    descricao: 'Converte locais oficiais/endereço em coordenadas e PINs eleitorais revisáveis.',
    outputs: ['territory.pipeline.json', 'geocoding.plan.json', 'pins.eleitorais.plan.json'],
    run(ctx) {
      const c = ctx.campaign;
      return {
        territorio: { cidade: c.cidade, uf: c.uf, cargo: c.cargo },
        pipeline: [
          'importar locais de votação oficiais',
          'agrupar seções por local',
          'normalizar endereços',
          'geocodificar endereço completo',
          'cachear resultado',
          'marcar baixa confiança para revisão',
          'gerar pins_eleitorais',
          'alimentar camadas do mapa'
        ],
        geocoding: {
          providerPreferido: 'google_or_mapbox',
          fallback: 'nominatim_or_manual',
          minConfidence: 0.75,
          cachePath: `campanhas/${c.campanhaId}/geo_cache`,
          reviewPath: `campanhas/${c.campanhaId}/revisao_geo`
        },
        pins: {
          path: `campanhas/${c.campanhaId}/pins_eleitorais`,
          tipo: 'local_votacao',
          schema: ['id','nome','endereco','bairro','zona','secoes','eleitores','lat','lng','geoStatus','geoConfidence']
        }
      };
    }
  },

  'fieldOps.skin': {
    ordem: 50,
    descricao: 'Transforma inteligência em operação: materiais, rotas, CRM, denúncias e evidências.',
    outputs: ['field.ops.plan.json'],
    run(ctx) {
      const c = ctx.campaign;
      return {
        paths: {
          estoque: `campanhas/${c.campanhaId}/estoque_central`,
          rotas: `campanhas/${c.campanhaId}/rotas`,
          crm: `campanhas/${c.campanhaId}/crm_liderancas`,
          denuncias: `campanhas/${c.campanhaId}/denuncias`,
          pins: `campanhas/${c.campanhaId}/pins`,
          percursos: `campanhas/${c.campanhaId}/percursos`
        },
        evidencias: ['gps', 'foto', 'timestamp', 'autorUid', 'status'],
        dashboards: ['coord.dash', 'candidato.dash'],
        integraComTerritorio: true
      };
    }
  },

  'brandingExperience.skin': {
    ordem: 60,
    descricao: 'Aplica ANGEL como marca principal e candidato como campanha ativa.',
    outputs: ['branding.plan.json'],
    run(ctx) {
      return {
        marcaPrincipal: 'ANGEL',
        descriptor: 'Agente Núcleo de Gestão Eleitoral',
        regra: 'produto ANGEL em primeiro plano; candidato em card/campanha ativa',
        arquivos: ['index.html', 'core/design.css', 'core/config.js'],
        pendenciaDesigner: 'substituir banner demo por logomarca ANGEL na fase visual/gamificação'
      };
    }
  },

  'legalCompliance.skin': {
    ordem: 70,
    descricao: 'Configura trilha de auditoria, logs, denúncias e revisão manual.',
    outputs: ['compliance.plan.json'],
    run(ctx) {
      const c = ctx.campaign;
      return {
        logsPath: `campanhas/${c.campanhaId}/logs`,
        denunciasPath: `campanhas/${c.campanhaId}/denuncias`,
        revisaoPath: `campanhas/${c.campanhaId}/revisoes`,
        eventosAuditaveis: ['login','logout','pin_criado','rota_criada','material_repassado','denuncia_criada','geo_revisado']
      };
    }
  },

  'automationIntegrations.skin': {
    ordem: 80,
    descricao: 'Prepara integrações com n8n, WhatsApp, Vercel, GitHub e Firebase Functions.',
    outputs: ['integrations.plan.json'],
    run(ctx) {
      return {
        integracoes: ['n8n', 'whatsapp', 'vercel', 'github', 'firebase_functions'],
        secretsNecessarios: ['N8N_WEBHOOK_URL', 'WHATSAPP_TOKEN', 'VERCEL_TOKEN', 'GITHUB_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS'],
        regra: 'não armazenar secrets no pacote; usar ambiente protegido'
      };
    }
  }
};

function getActiveSkins(skinsConfig) {
  return Object.entries(skinsConfig || {})
    .filter(([, cfg]) => cfg && cfg.active)
    .map(([name]) => name)
    .sort((a, b) => (SKIN_REGISTRY[a]?.ordem || 999) - (SKIN_REGISTRY[b]?.ordem || 999));
}

module.exports = { SKIN_REGISTRY, getActiveSkins };
