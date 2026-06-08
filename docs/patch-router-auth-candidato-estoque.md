# Patch estrutural ANGEL

Este PR draft registra a primeira correção estrutural proposta para o ANGEL.

## Objetivo

Consolidar a base técnica antes de importar melhorias do ANGEL-v2.

## Alterações preparadas

1. **Roteador único**
   - `index.html` deve carregar `core/router.js`.
   - `core/router-ops.js` deve ser aposentado/removido.
   - `core/router.js` passa a ser o manifesto oficial de módulos.

2. **Inteligência eleitoral oficial**
   - `eleitoral` deve apontar para `modulos/inteligencia-eleitoral-firebase.js`.
   - `modulos/inteligencia-eleitoral.js` fica apenas como compatibilidade/deprecated.

3. **Painel do candidato sem hardcode**
   - Remover textos fixos como `Dr. Carlos Mendes 40`.
   - Ler identidade de `campanhas/{id}/config/main`.
   - Usar campos como `nomeExibicao`, `nomeUrna`, `candidato`, `numero`, `cargo`, `municipio`, `uf`, `ano`, `metaVotos`.

4. **Fallback demo restrito**
   - `demo2026`, `admin2026`, `master2026` devem funcionar só em modo dev.
   - Produção deve exigir senhas em `campanhas/{id}/config/main`.

5. **Garantia de módulos faltantes**
   - Validar se cada módulo do roteador existe e exporta a função esperada.
   - Corrigir `coordenador/estoque.js`, que existia mas não exportava `estoqueInit`.

## Arquivos do patch preparado

- `index.html`
- `core/router.js`
- `core/auth.js`
- `candidato/dashboard.js`
- `coordenador/estoque.js`
- `modulos/inteligencia-eleitoral.js`

## Observação operacional

A ferramenta de escrita direta bloqueou commits contendo alguns arquivos JS/HTML completos. Por isso este PR fica como draft rastreável, e os arquivos finais devem ser aplicados pelo ZIP `angel_primeira_correcao_estrutural.zip` ou por commit manual no branch `fix/router-auth-candidato-estoque`.

## Próxima etapa

Depois dessa base estrutural, importar do ANGEL-v2:

- dashboard extra
- CRM com perfil completo
- validação TSE da liderança
- estoque/inventário operacional
- denúncia mais completa
- mapa consolidado coordenador/candidato
