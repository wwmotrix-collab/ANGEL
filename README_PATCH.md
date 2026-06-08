# Patch ANGEL — primeira correção estrutural

Arquivos corrigidos:

- `index.html`
  - passa a carregar `core/router.js`
  - deixa de carregar `core/router-ops.js`

- `core/router.js`
  - vira o roteador oficial único
  - consolida o mapeamento que estava em `router-ops.js`
  - usa `modulos/inteligencia-eleitoral-firebase.js` como eleitoral oficial
  - inclui manifesto de validação em `WWMX.Router.validarManifesto()`
  - trata módulo ausente ou init ausente com mensagem amigável

- `core/auth.js`
  - fallback demo (`demo2026`, `admin2026`, `master2026`) só funciona em modo dev
  - modo dev: `localhost`, `127.0.0.1`, `file://`, `?dev=1` ou `localStorage.wwmx_dev_mode=1`
  - em produção, exige senhas configuradas em `campanhas/{id}/config/main`

- `candidato/dashboard.js`
  - remove hardcode “Dr. Carlos Mendes 40”
  - usa `WWMX.carregarConfigCampanha(campanhaId)`
  - usa `nomeExibicao`, `nomeUrna`, `candidato`, `numero`, `cargo`, `municipio/cidade`, `uf`, `ano`, `metaVotos`

- `coordenador/estoque.js`
  - substitui arquivo quebrado que não exportava `estoqueInit`
  - entrega módulo mínimo funcional de estoque central

- `modulos/inteligencia-eleitoral.js`
  - aposentado como implementação principal
  - vira wrapper de compatibilidade para `inteligencia-eleitoral-firebase.js`

Pendente para próxima etapa:
- importar do `ANGEL-v2` o CRM com perfil completo
- validação TSE avançada de liderança
- denúncias completas
- mapa consolidado coordenador/candidato mais rico
- estoque/inventário operacional completo
