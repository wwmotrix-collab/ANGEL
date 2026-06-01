/**
 * motores/claude-builder.js — WWMX Campaign
 * Chama a API Anthropic (Claude) para construir estrutura inicial da campanha.
 * Roda como Firebase Cloud Function Node.js.
 */
const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const axios     = require('axios');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered quando uma nova campanha é criada no Firestore.
 * Claude recebe os dados da campanha e retorna:
 * - mensagem de boas-vindas personalizada
 * - sugestão de senhas fortes
 * - checklist de primeiros passos
 * - sugestões de módulos baseadas no cargo/município
 */
exports.buildCampanha = functions.firestore
  .document('campanhas/{campanhaId}')
  .onCreate(async (snap, context) => {
    const campanhaId = context.params.campanhaId;
    const dados = snap.data();

    const prompt = `
Você é o assistente de configuração do sistema WWMX Campaign, uma plataforma de gestão de campanhas eleitorais.

Uma nova campanha foi criada com os seguintes dados:
- Candidato: ${dados.nomeExibicao}
- Número: ${dados.numero}
- Cargo: ${dados.cargo}
- Município: ${dados.municipio}-${dados.uf}
- Ano: ${dados.ano}
- Plano: ${dados.plano}
- Módulos ativos: ${(dados.modulosAtivos || []).join(', ')}

Gere um JSON com a seguinte estrutura (responda APENAS o JSON, sem markdown):
{
  "boasVindas": "mensagem personalizada de até 2 linhas",
  "checklistPrimeirosPassos": ["passo 1", "passo 2", "passo 3", "passo 4", "passo 5"],
  "dicaEstrategica": "uma dica estratégica específica para o cargo e município informados",
  "modulosRecomendados": ["lista de módulos adicionais recomendados além dos já ativos"],
  "metaVotosEstimada": número_inteiro
}`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key':         functions.config().anthropic?.key,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
        }
      );

      const texto = response.data.content?.[0]?.text || '{}';
      let resultado;
      try {
        resultado = JSON.parse(texto.replace(/```json|```/g, '').trim());
      } catch (_) {
        resultado = { boasVindas: 'Campanha configurada com sucesso!', checklistPrimeirosPassos: [] };
      }

      // Salvar resultado no Firestore
      await db.collection('campanhas').doc(campanhaId)
        .collection('config').doc('ia').set({
          boasVindas:             resultado.boasVindas || '',
          checklistPrimeirosPassos: resultado.checklistPrimeirosPassos || [],
          dicaEstrategica:        resultado.dicaEstrategica || '',
          modulosRecomendados:    resultado.modulosRecomendados || [],
          metaVotosEstimada:      resultado.metaVotosEstimada || 0,
          geradoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`[claude-builder] Campanha ${campanhaId} configurada pelo Claude.`);
    } catch (err) {
      console.error('[claude-builder] Erro ao chamar Claude API:', err.message);
    }

    return null;
  });
