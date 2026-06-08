# ANGEL PicoClaw · Plano técnico

Campanha: **Dr. Carlos Mendes**
Cargo: **dep_estadual**
Território: **Viamão-RS**
Plano: **inteligencia**
Branch sugerida: `campaign/carlos-mendes-2026-viamao`

## Skins ativas
- developerCampaign.skin
- subscriptionPlan.skin
- electoralAnalysis.skin
- territoryGeocoding.skin
- fieldOps.skin
- brandingExperience.skin
- legalCompliance.skin

## Ordem de implementação
- 1. Criar branch da campanha
- 2. Aplicar configuração pública Firebase e campanhaId
- 3. Atualizar módulos/permissões conforme plano
- 4. Rodar/coletar análise eleitoral quando ativa
- 5. Importar território e geocodificar locais quando ativo
- 6. Gerar pins eleitorais e fila de revisão manual
- 7. Gerar seed operacional
- 8. Validar login e navegação por perfil
- 9. Abrir draft PR e preview

## Resultados por skin
### developerCampaign.skin
Configura app, campanha, branch, PR, módulos, permissões e seed.

```json
{
  "branch": "campaign/carlos-mendes-2026-viamao",
  "arquivosCriticos": [
    "core/config.js",
    "core/router.js",
    "core/firebase.js",
    "firebase/seed-admin.js"
  ],
  "firebasePaths": [
    "campanhas/{id}",
    "campanhas/{id}/config/main",
    "master_campanhas/{id}",
    "campanhas/{id}/pins",
    "campanhas/{id}/crm_liderancas",
    "campanhas/{id}/estoque_central",
    "campanhas/{id}/rotas",
    "campanhas/{id}/denuncias",
    "campanhas/{id}/militantes"
  ],
  "acceptance": [
    "App abre com ?c=carlos-mendes-2026-viamao",
    "Perfis Campo/Coord/Candidato/Master funcionam",
    "Nenhum segredo versionado",
    "Draft PR aberto para revisão"
  ]
}
```

### subscriptionPlan.skin
Traduz plano comercial em módulos, limites e profundidade de automação.

```json
{
  "plano": "inteligencia",
  "modulosAtivos": [
    "mapa",
    "crm",
    "estoque",
    "rotas",
    "denuncias",
    "eleitoral",
    "inteligencia-eleitoral"
  ],
  "limites": {
    "coords": 10,
    "campo": 200,
    "geocoding": true,
    "automacoes": false
  },
  "upgradePath": [
    "inteligencia",
    "full"
  ]
}
```

### electoralAnalysis.skin
Define coleta/análise TSE/TRE/histórico do candidato ou partido.

```json
{
  "fontes": [
    "TSE",
    "TRE",
    "CSV manual opcional"
  ],
  "chavesBusca": {
    "candidato": "Dr. Carlos Mendes",
    "nomeUrna": "Carlos Mendes",
    "partido": "PSB",
    "coligacao": "Frente Democrática",
    "cargo": "dep_estadual",
    "municipio": "Viamão",
    "uf": "RS",
    "ano": "2026"
  },
  "estrategia": "buscar desempenho anterior do candidato e comparar com partido/coligação",
  "datasetsEsperados": [
    "candidaturas anteriores",
    "resultados por município/zona/seção quando disponível",
    "locais de votação",
    "eleitorado por local/seção quando disponível"
  ],
  "saidas": [
    "ranking_zonas",
    "ranking_locais",
    "metas_por_territorio",
    "hipoteses_prioridade"
  ]
}
```

### territoryGeocoding.skin
Converte locais oficiais/endereço em coordenadas e PINs eleitorais revisáveis.

```json
{
  "territorio": {
    "cidade": "Viamão",
    "uf": "RS",
    "cargo": "dep_estadual"
  },
  "pipeline": [
    "importar locais de votação oficiais",
    "agrupar seções por local",
    "normalizar endereços",
    "geocodificar endereço completo",
    "cachear resultado",
    "marcar baixa confiança para revisão",
    "gerar pins_eleitorais",
    "alimentar camadas do mapa"
  ],
  "geocoding": {
    "providerPreferido": "google_or_mapbox",
    "fallback": "nominatim_or_manual",
    "minConfidence": 0.75,
    "cachePath": "campanhas/carlos-mendes-2026-viamao/geo_cache",
    "reviewPath": "campanhas/carlos-mendes-2026-viamao/revisao_geo"
  },
  "pins": {
    "path": "campanhas/carlos-mendes-2026-viamao/pins_eleitorais",
    "tipo": "local_votacao",
    "schema": [
      "id",
      "nome",
      "endereco",
      "bairro",
      "zona",
      "secoes",
      "eleitores",
      "lat",
      "lng",
      "geoStatus",
      "geoConfidence"
    ]
  }
}
```

### fieldOps.skin
Transforma inteligência em operação: materiais, rotas, CRM, denúncias e evidências.

```json
{
  "paths": {
    "estoque": "campanhas/carlos-mendes-2026-viamao/estoque_central",
    "rotas": "campanhas/carlos-mendes-2026-viamao/rotas",
    "crm": "campanhas/carlos-mendes-2026-viamao/crm_liderancas",
    "denuncias": "campanhas/carlos-mendes-2026-viamao/denuncias",
    "pins": "campanhas/carlos-mendes-2026-viamao/pins",
    "percursos": "campanhas/carlos-mendes-2026-viamao/percursos"
  },
  "evidencias": [
    "gps",
    "foto",
    "timestamp",
    "autorUid",
    "status"
  ],
  "dashboards": [
    "coord.dash",
    "candidato.dash"
  ],
  "integraComTerritorio": true
}
```

### brandingExperience.skin
Aplica ANGEL como marca principal e candidato como campanha ativa.

```json
{
  "marcaPrincipal": "ANGEL",
  "descriptor": "Agente Núcleo de Gestão Eleitoral",
  "regra": "produto ANGEL em primeiro plano; candidato em card/campanha ativa",
  "arquivos": [
    "index.html",
    "core/design.css",
    "core/config.js"
  ],
  "pendenciaDesigner": "substituir banner demo por logomarca ANGEL na fase visual/gamificação"
}
```

### legalCompliance.skin
Configura trilha de auditoria, logs, denúncias e revisão manual.

```json
{
  "logsPath": "campanhas/carlos-mendes-2026-viamao/logs",
  "denunciasPath": "campanhas/carlos-mendes-2026-viamao/denuncias",
  "revisaoPath": "campanhas/carlos-mendes-2026-viamao/revisoes",
  "eventosAuditaveis": [
    "login",
    "logout",
    "pin_criado",
    "rota_criada",
    "material_repassado",
    "denuncia_criada",
    "geo_revisado"
  ]
}
```

## Secrets manuais
- GOOGLE_APPLICATION_CREDENTIALS / service account local
- GEOCODING_API_KEY quando provider privado for usado
- GITHUB_TOKEN se PR automático for executado fora do conector
- VERCEL_TOKEN se preview/deploy for automatizado
- N8N_WEBHOOK_URL se integração for ativada
