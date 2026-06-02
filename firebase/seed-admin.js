#!/usr/bin/env node
/**
 * firebase/seed-admin.js
 *
 * Popula o Firebase do ANGEL com uma campanha demo mínima usando Firebase Admin SDK.
 *
 * Uso no Codespace/terminal:
 *   npm install
 *   export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
 *   npm run seed:demo
 *
 * Alternativa:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64="..." npm run seed:demo
 *
 * Modo simulação:
 *   npm run seed:demo:dry
 *
 * Segurança:
 *   - NÃO commite serviceAccountKey.json.
 *   - A chave fica ignorada no .gitignore.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || 'demo';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://angel-edd10-default-rtdb.firebaseio.com';

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }

  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    './serviceAccountKey.json',
    './firebase/serviceAccountKey.json',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const absolute = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(absolute)) {
      return require(absolute);
    }
  }

  throw new Error([
    'Service account não encontrada.',
    'Crie/baixe a chave no Firebase Console e salve como serviceAccountKey.json na raiz do Codespace,',
    'ou defina GOOGLE_APPLICATION_CREDENTIALS apontando para o arquivo.',
  ].join(' '));
}

function initFirebase() {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL,
  });
  return {
    firestore: admin.firestore(),
    rtdb: admin.database(),
  };
}

async function writeFirestore(db, refPath, data) {
  console.log(`Firestore set: ${refPath}`);
  if (DRY_RUN) return;
  await db.doc(refPath).set(data, { merge: true });
}

async function writeRtdb(db, refPath, data) {
  console.log(`RTDB set: ${refPath}`);
  if (DRY_RUN) return;
  await db.ref(refPath).set(data);
}

function now() {
  return Date.now();
}

async function seedDemo() {
  const { firestore, rtdb } = initFirebase();
  const cid = CAMPAIGN_ID;
  const ts = now();

  console.log(`🌱 Iniciando seed admin para campanha: ${cid}`);
  if (DRY_RUN) console.log('🧪 Modo dry-run ativo: nada será gravado.');

  const config = {
    id: cid,
    nomeExibicao: 'Dr. Carlos Mendes',
    numero: '40',
    cargo: 'dep_estadual',
    municipio: 'Viamão',
    uf: 'RS',
    ano: '2026',
    status: 'ativo',
    subTitulo: 'WWMX Campaign · Viamão 2026',
    modulosAtivos: ['crm', 'denuncias', 'inteligencia-eleitoral'],
    metaVotos: 49000,
    senhas: {
      campo: 'demo2026',
      coord: 'demo2026',
      candidato: 'admin2026',
      master: 'master2026',
    },
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };

  await writeFirestore(firestore, `campanhas/${cid}`, config);
  await writeFirestore(firestore, `campanhas/${cid}/config/main`, config);
  await writeFirestore(firestore, `master/campanhas/${cid}`, {
    id: cid,
    nomeExibicao: config.nomeExibicao,
    numero: config.numero,
    municipio: config.municipio,
    uf: config.uf,
    ano: config.ano,
    status: config.status,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  const liderancas = {
    lid_joao_silva: { id: 'lid_joao_silva', nome: 'João da Silva', bairro: 'Centro', status: 'confirmado', votos: 280, autor: 'Seed Admin', autorUid: 'seed', obs: '', interacoes: [], ts },
    lid_maria_aparecida: { id: 'lid_maria_aparecida', nome: 'Maria Aparecida', bairro: 'Viamópolis', status: 'confirmado', votos: 180, autor: 'Seed Admin', autorUid: 'seed', obs: '', interacoes: [], ts },
    lid_pedro_ferreira: { id: 'lid_pedro_ferreira', nome: 'Pedro Ferreira', bairro: 'Santa Luzia', status: 'provavel', votos: 120, autor: 'Seed Admin', autorUid: 'seed', obs: '', interacoes: [], ts },
    lid_ana_costa: { id: 'lid_ana_costa', nome: 'Ana Costa', bairro: 'Três Marias', status: 'provavel', votos: 95, autor: 'Seed Admin', autorUid: 'seed', obs: '', interacoes: [], ts },
    lid_lucia_pereira: { id: 'lid_lucia_pereira', nome: 'Lucia Pereira', bairro: 'Centro', status: 'confirmado', votos: 340, autor: 'Seed Admin', autorUid: 'seed', obs: '', interacoes: [], ts },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/crm_liderancas`, liderancas);

  const estoque = {
    panfleto_a5: { id: 'panfleto_a5', tipo: 'panfleto', label: 'Panfleto A5', tamanho: 'A5', qtdTotal: 5000, qtdDist: 1200, qtdDisp: 3800 },
    colinha_10x15: { id: 'colinha_10x15', tipo: 'colinha', label: 'Colinha 10x15cm', tamanho: '10x15', qtdTotal: 2000, qtdDist: 300, qtdDisp: 1700 },
    windbanner_80x200: { id: 'windbanner_80x200', tipo: 'windbanner', label: 'Windbanner 80x200cm', tamanho: '80x200', qtdTotal: 40, qtdDist: 12, qtdDisp: 28 },
    camiseta_m: { id: 'camiseta_m', tipo: 'camiseta', label: 'Camiseta M', tamanho: 'M', qtdTotal: 100, qtdDist: 30, qtdDisp: 70 },
    bone: { id: 'bone', tipo: 'bone', label: 'Boné', tamanho: '', qtdTotal: 80, qtdDist: 20, qtdDisp: 60 },
    adesivo_car_30x15: { id: 'adesivo_car_30x15', tipo: 'adesivo_car', label: 'Adesivo Carro 30x15cm', tamanho: '30x15', qtdTotal: 200, qtdDist: 0, qtdDisp: 200 },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/estoque_central`, estoque);

  const pins = {
    pin_feira_centro: { id: 'pin_feira_centro', tipo: 'panfleto', nome: 'Feira do Centro', lat: -30.0807, lng: -51.0258, qtd: 500, status: 'instalado', autor: 'João Demo', autorUid: 'seed', ts: ts - 86400000 },
    pin_dorival: { id: 'pin_dorival', tipo: 'windbanner', nome: 'Esquina Av. Dorival', lat: -30.0820, lng: -51.0290, qtd: 2, status: 'instalado', autor: 'João Demo', autorUid: 'seed', ts: ts - 172800000 },
    pin_mercado_sao_joao: { id: 'pin_mercado_sao_joao', tipo: 'colinha', nome: 'Mercado São João', lat: -30.0790, lng: -51.0230, qtd: 200, status: 'instalado', autor: 'João Demo', autorUid: 'seed', ts: ts - 259200000 },
    pin_bandeiraco_centro: { id: 'pin_bandeiraco_centro', tipo: 'bandeirico', nome: 'Bandeiraço Centro', lat: -30.0850, lng: -51.0270, qtd: null, status: 'instalado', autor: 'Equipe Demo', autorUid: 'seed', ts: ts - 345600000 },
    pin_visita_viamopolis: { id: 'pin_visita_viamopolis', tipo: 'corpoacorpo', nome: 'Visita Viamópolis', lat: -30.0760, lng: -51.0310, qtd: null, status: 'instalado', autor: 'Equipe Demo', autorUid: 'seed', ts: ts - 432000000 },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/pins`, pins);

  const percursos = {
    perc_demo_1: {
      id: 'perc_demo_1',
      tipo: 'caminhada',
      motorista: 'João Demo',
      autorUid: 'seed',
      veiculo: 'Caminhada',
      turno: 'manha',
      data: new Date(ts).toLocaleDateString('pt-BR'),
      dataTs: ts,
      km: 4.2,
      duracao: 3600,
      pontos: [],
    },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/percursos`, percursos);

  const denuncias = {
    den_demo_1: {
      id: 'den_demo_1',
      tipo: 'material_irregular',
      titulo: 'Material irregular próximo à feira',
      descricao: 'Registro de exemplo para validar o fluxo de denúncias.',
      status: 'aberta',
      prioridade: 'media',
      bairro: 'Centro',
      autor: 'Seed Admin',
      autorUid: 'seed',
      ts,
    },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/denuncias`, denuncias);

  const rotas = {
    rota_demo_1: {
      id: 'rota_demo_1',
      titulo: 'Roteiro Centro / Viamópolis',
      tipo: 'carrosom',
      status: 'planejada',
      responsavel: 'Equipe Demo',
      pontos: ['Feira do Centro', 'Av. Dorival', 'Viamópolis'],
      ts,
    },
  };
  await writeRtdb(rtdb, `campanhas/${cid}/rotas`, rotas);

  console.log('✅ Seed concluído com sucesso.');
  console.log(`Abra o app com: https://angel-liart.vercel.app/?c=${cid}`);
  console.log('Senhas: campo/coord=demo2026, candidato=admin2026, master=master2026');
}

seedDemo()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Seed falhou:', err.message);
    process.exit(1);
  });
