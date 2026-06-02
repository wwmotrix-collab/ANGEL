# ANGEL PicoClaw Skins Engine

Este módulo transforma o pacote gerado pelo **Master > Gerador PicoClaw** em um plano técnico executável.

## Fluxo

1. Master preenche coleta simples no app.
2. App gera `angel-picoclaw-package.json`.
3. Operador coloca o arquivo na raiz do Codespace.
4. Roda:

```bash
npm run picoclaw:plan
```

5. O motor gera:

```text
out/picoclaw/picoclaw.technical-plan.json
out/picoclaw/picoclaw.technical-plan.md
```

## Rodar exemplo

```bash
npm run picoclaw:plan:sample
```

## Skins implementadas

- `developerCampaign.skin`
- `subscriptionPlan.skin`
- `electoralAnalysis.skin`
- `territoryGeocoding.skin`
- `fieldOps.skin`
- `brandingExperience.skin`
- `legalCompliance.skin`
- `automationIntegrations.skin`

## Importante

A engine ainda não executa coleta externa TSE/TRE, geocoding real ou PR automático. Ela cria o contrato técnico e o plano de execução seguro.

Secrets como service account, tokens de geocoder, GitHub, Vercel, n8n e WhatsApp não entram no pacote e não devem ser versionados.

## Próximos passos naturais

- Conectar adapters reais de TSE/TRE ou upload CSV.
- Implementar geocoding com cache e revisão manual.
- Transformar plano técnico em patches de arquivos.
- Rodar seed específico por campanha.
- Abrir draft PR automaticamente quando o ambiente tiver token seguro.
