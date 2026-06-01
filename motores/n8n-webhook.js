/**
 * motores/n8n-webhook.js — WWMX Campaign
 * Recebe webhooks do n8n e dispara o pipeline de criação de campanha.
 * Este arquivo roda como Firebase Cloud Function (Node.js).
 */
const functions = require('firebase-functions');
const admin     = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Webhook principal — chamado pelo n8n após confirmação de pagamento.
 * Payload esperado:
 * {
 *   candidato: "Dr. Carlos Mendes",
 *   numero: "40",
 *   cargo: "dep_estadual",
 *   municipio: "Viamão",
 *   uf: "RS",
 *   ano: "2026",
 *   email: "contato@email.com",
 *   plano: "pro",
 *   modulos: ["crm","denuncias","agenda"],
 *   senhaCampo: "...",
 *   senhaCoord: "...",
 *   senhaCandidato: "...",
 *   pagamentoId: "pay_xxx"
 * }
 */
exports.onboardingCampanha = functions.https.onRequest(async (req, res) => {
  // Apenas POST
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  // Verificar secret header (configurar no n8n como header X-WWMX-Secret)
  const secret = req.headers['x-wwmx-secret'];
  if (secret !== functions.config().wwmx?.secret) {
    res.status(401).send('Unauthorized');
    return;
  }

  const {
    candidato, numero, cargo, municipio, uf, ano,
    email, plano, modulos, senhaCampo, senhaCoord, senhaCandidato, pagamentoId,
  } = req.body;

  if (!candidato || !municipio || !uf) {
    res.status(400).json({ error: 'Campos obrigatórios faltando: candidato, municipio, uf' });
    return;
  }

  // Gerar campanhaId a partir do nome + ano
  const slug = candidato
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  const campanhaId = `${slug}${ano || '2026'}`;

  try {
    const batch = db.batch();

    // 1. Documento principal da campanha
    batch.set(db.collection('campanhas').doc(campanhaId), {
      id: campanhaId,
      nomeExibicao: candidato,
      numero: numero || '',
      cargo:  cargo  || 'dep_estadual',
      municipio,
      uf,
      ano: ano || '2026',
      email,
      plano:  plano  || 'pro',
      status: 'ativo',
      pagamentoId: pagamentoId || null,
      modulosAtivos: modulos || [],
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      subTitulo: `WWMX Campaign · ${municipio} ${ano || '2026'}`,
    });

    // 2. Config com senhas
    batch.set(db.collection('campanhas').doc(campanhaId).collection('config').doc('main'), {
      municipio, uf, ano: ano || '2026',
      nomeExibicao: candidato, numero, cargo,
      modulosAtivos: modulos || [],
      senhas: {
        campo:     senhaCampo     || 'demo2026',
        coord:     senhaCoord     || 'demo2026',
        candidato: senhaCandidato || 'admin2026',
        master:    'master2026',
      },
    });

    // 3. Log de criação
    batch.set(db.collection('campanhas').doc(campanhaId).collection('logs').doc(), {
      acao: 'campanha_criada_automatica',
      fonte: 'n8n_webhook',
      municipio, plano,
      pagamentoId,
      tsLocal: Date.now(),
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 4. Disparar importação de locais de votação (trigger separado)
    await db.collection('importacoes').add({
      municipio: municipio.toLowerCase(),
      uf,
      campanhaId,
      solicitadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      ok: true,
      campanhaId,
      url: `https://app.wwmx.com/?c=${campanhaId}`,
      message: `Campanha ${candidato} criada com sucesso.`,
    });

  } catch (err) {
    console.error('[n8n-webhook] Erro:', err);
    res.status(500).json({ error: err.message });
  }
});
