# ANGEL — WWMX Campaign Platform

Sistema de gestão de campanhas eleitorais com hierarquia de acesso, gamificação, mapa em tempo real e automação via n8n + Claude AI.

---

## Estrutura do projeto

```
wwmx/
├── index.html              ← Entrada única do app
├── core/
│   ├── design.css          ← Design system dark (tokens, componentes)
│   ├── config.js           ← Catálogos e constantes globais
│   ├── xp.js               ← Cálculo de XP centralizado
│   ├── ui.js               ← Toast, loading, modais
│   ├── firebase.js         ← Wrapper RTDB + Firestore
│   ├── auth.js             ← Firebase Auth, sessão, níveis
│   └── router.js           ← Roteamento dinâmico por perfil
├── campo/
│   ├── mapa.js             ← Mapa Leaflet + FAB + GPS
│   ├── meucampo.js         ← Visão consolidada do militante
│   ├── percursos.js        ← Rastreamento GPS de rotas
│   ├── inventario.js       ← Inventário pessoal
│   └── rotas.js            ← Missões atribuídas
├── coordenador/
│   ├── dash.js             ← Dashboard operacional
│   ├── estoque.js          ← Controle de materiais e repasse
│   ├── equipe.js           ← Ranking e presença de militantes
│   └── rotas.js            ← Planejamento de rotas
├── candidato/
│   ├── dashboard.js        ← KPIs, termômetro de votos
│   ├── mapa.js             ← Mapa consolidado + heatmap
│   ├── agentes.js          ← Lideranças com ranking de estrelas
│   ├── equipe.js           ← Equipe de campo detalhada
│   └── logs.js             ← Relatório de auditoria
├── modulos/
│   ├── crm.js              ← CRM de lideranças
│   ├── denuncias.js        ← Canal de denúncias eleitorais
│   └── inteligencia-eleitoral.js ← Dados TSE + projeção
└── master/
│   ├── campanhas.js        ← Criação e gestão de campanhas
│   ├── planos.js           ← Planos de venda
│   ├── clientes.js         ← Gestão de clientes/contratos
│   └── banco-global.js     ← Banco de dados central
└── motores/
    ├── coordenadas.js      ← Cloud Function: TSE → Firestore
    ├── n8n-webhook.js      ← Cloud Function: recebe n8n
    └── claude-builder.js   ← Cloud Function: Claude AI constrói campanha
```

## Firebase

- **Firestore**: dados permanentes (campanhas, config, locais, logs, histórico)
- **Realtime Database**: dados ao vivo (pins, presença, inventário, percursos)

## Perfis de acesso

| Perfil | Senha (demo) | Acesso |
|--------|-------------|--------|
| Campo | `demo2026` | Mapa, percursos, inventário, rotas |
| Coordenador | `demo2026` | Dashboard, estoque, equipe, rotas, CRM |
| Candidato | `admin2026` | Painel, KPIs, logs, agentes |
| Master | `master2026` | Campanhas, planos, clientes, banco |

## Como rodar localmente

```bash
# Qualquer servidor HTTP simples:
npx serve .

# Ou Python:
python -m http.server 8080
```

Abrir: `http://localhost:8080/?c=demo`

## Pipeline de automação

```
Pagamento confirmado
    ↓
n8n (orquestrador)
    ↓               ↓                    ↓
Gemini           Firebase Function     Claude API
(coleta dados)   (coordenadas TSE)    (constrói campanha)
    ↓               ↓                    ↓
                Firebase
         (Firestore + Realtime DB)
                    ↓
          App publicado / entregue
```

## Configurar Firebase Functions

```bash
firebase functions:config:set anthropic.key="sua-chave" wwmx.secret="seu-secret"
firebase deploy --only functions
```

---

Desenvolvido com Claude (Anthropic) · WWMX 2026
