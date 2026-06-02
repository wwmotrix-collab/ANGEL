#!/usr/bin/env node
/**
 * motores/picoclaw/engine.js
 * ANGEL PicoClaw — motor de skins.
 *
 * Entrada: pacote JSON gerado pelo Master em master/gerador-picoclaw.js
 * Saída: plano técnico em JSON e Markdown para orientar implantação/execução.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { SKIN_REGISTRY, getActiveSkins } = require('./skins');

function loadPackage(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) throw new Error(`Pacote não encontrado: ${absolute}`);
  const raw = fs.readFileSync(absolute, 'utf8');
  return JSON.parse(raw);
}

function normalizePackage(pkg) {
  const files = pkg.files || pkg;
  const campaign = files['campaign.input.json'] || files['campaign.config.json'] || {};
  const history = files['history.input.json'] || {};
  const automation = files['automation.input.json'] || {};
  const skins = files['skins.config.json'] || {};
  const modules = files['modules.config.json'] || {};
  const firebase = files['firebase.config.json'] || {};
  const seed = files['seed.config.json'] || {};
  const deploy = files['deploy.config.json'] || {};
  return { pkg, files, campaign, history, automation, skins, modules, firebase, seed, deploy };
}

function runSkins(ctx) {
  const active = getActiveSkins(ctx.skins);
  const results = {};
  const warnings = [];

  for (const skinName of active) {
    const skin = SKIN_REGISTRY[skinName];
    if (!skin) {
      warnings.push(`Skin ativa sem implementação: ${skinName}`);
      continue;
    }
    try {
      results[skinName] = {
        descricao: skin.descricao,
        outputs: skin.outputs,
        result: skin.run(ctx)
      };
    } catch (err) {
      warnings.push(`Falha na skin ${skinName}: ${err.message}`);
    }
  }

  return { active, results, warnings };
}

function buildTechnicalPlan(ctx, skinRun) {
  const c = ctx.campaign;
  const plan = {
    generatedAt: new Date().toISOString(),
    campanhaId: c.campanhaId,
    candidato: c.candidato,
    cargo: c.cargo,
    cidade: c.cidade,
    uf: c.uf,
    plano: c.planoAssinatura,
    branch: ctx.deploy.branchSugerida || `campaign/${c.campanhaId}`,
    activeSkins: skinRun.active,
    skins: skinRun.results,
    warnings: skinRun.warnings,
    implementationOrder: [
      '1. Criar branch da campanha',
      '2. Aplicar configuração pública Firebase e campanhaId',
      '3. Atualizar módulos/permissões conforme plano',
      '4. Rodar/coletar análise eleitoral quando ativa',
      '5. Importar território e geocodificar locais quando ativo',
      '6. Gerar pins eleitorais e fila de revisão manual',
      '7. Gerar seed operacional',
      '8. Validar login e navegação por perfil',
      '9. Abrir draft PR e preview'
    ],
    manualSecrets: [
      'GOOGLE_APPLICATION_CREDENTIALS / service account local',
      'GEOCODING_API_KEY quando provider privado for usado',
      'GITHUB_TOKEN se PR automático for executado fora do conector',
      'VERCEL_TOKEN se preview/deploy for automatizado',
      'N8N_WEBHOOK_URL se integração for ativada'
    ]
  };
  return plan;
}

function toMarkdown(plan) {
  const lines = [];
  lines.push(`# ANGEL PicoClaw · Plano técnico`);
  lines.push('');
  lines.push(`Campanha: **${plan.candidato || plan.campanhaId}**`);
  lines.push(`Cargo: **${plan.cargo || '—'}**`);
  lines.push(`Território: **${plan.cidade || '—'}-${plan.uf || '—'}**`);
  lines.push(`Plano: **${plan.plano || '—'}**`);
  lines.push(`Branch sugerida: \`${plan.branch}\``);
  lines.push('');
  lines.push(`## Skins ativas`);
  plan.activeSkins.forEach(s => lines.push(`- ${s}`));
  lines.push('');
  lines.push(`## Ordem de implementação`);
  plan.implementationOrder.forEach(s => lines.push(`- ${s}`));
  lines.push('');
  lines.push(`## Resultados por skin`);
  for (const [name, data] of Object.entries(plan.skins)) {
    lines.push(`### ${name}`);
    lines.push(data.descricao || '');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(data.result, null, 2));
    lines.push('```');
    lines.push('');
  }
  if (plan.warnings.length) {
    lines.push(`## Avisos`);
    plan.warnings.forEach(w => lines.push(`- ${w}`));
    lines.push('');
  }
  lines.push(`## Secrets manuais`);
  plan.manualSecrets.forEach(s => lines.push(`- ${s}`));
  lines.push('');
  return lines.join('\n');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main(argv = process.argv.slice(2)) {
  const inputIdx = argv.findIndex(a => a === '--input' || a === '-i');
  const outIdx = argv.findIndex(a => a === '--out' || a === '-o');
  const input = inputIdx >= 0 ? argv[inputIdx + 1] : 'angel-picoclaw-package.json';
  const outDir = outIdx >= 0 ? argv[outIdx + 1] : 'out/picoclaw';

  const pkg = loadPackage(input);
  const ctx = normalizePackage(pkg);
  const skinRun = runSkins(ctx);
  const plan = buildTechnicalPlan(ctx, skinRun);
  const md = toMarkdown(plan);

  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'picoclaw.technical-plan.json'), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(outDir, 'picoclaw.technical-plan.md'), md);

  console.log(`✅ PicoClaw skins processadas: ${skinRun.active.length}`);
  console.log(`📦 Saída: ${outDir}`);
  if (skinRun.warnings.length) {
    console.log('⚠️ Avisos:');
    skinRun.warnings.forEach(w => console.log(`- ${w}`));
  }
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error(`❌ ${err.message}`); process.exit(1); }
}

module.exports = { loadPackage, normalizePackage, runSkins, buildTechnicalPlan, toMarkdown };
