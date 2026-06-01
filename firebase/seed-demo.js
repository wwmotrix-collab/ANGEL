/**
 * firebase/seed-demo.js
 * Popula o banco com dados de demonstração.
 *
 * Como usar:
 *   1. Rode o app: npx serve . → http://localhost:3000/?c=demo
 *   2. Abra DevTools (F12) → Console
 *   3. Execute: await seedDemo()
 */

async function seedDemo() {
  if (!window.WWMX?.fs || !window.WWMX?.db) {
    console.error('❌ WWMX não inicializado. Faça login primeiro.');
    return;
  }
  console.log('🌱 Iniciando seed de demonstração...');
  const cid = 'demo';

  // ── 1. Campanha principal (Firestore) ───────────────────
  await WWMX.fs.setDoc({
    id: cid,
    nomeExibicao: 'Dr. Carlos Mendes',
    numero: '40',
    cargo: 'dep_estadual',
    municipio: 'Viamão',
    uf: 'RS',
    ano: '2026',
    status: 'ativo',
    modulosAtivos: ['crm','denuncias','inteligencia-eleitoral'],
    subTitulo: 'WWMX Campaign · Viamão 2026',
  }, 'campanhas', cid);
  console.log('✅ Campanha criada');

  // ── 2. Config com senhas (Firestore subcoleção) ─────────
  await WWMX.fs.setDoc({
    municipio: 'Viamão', uf: 'RS', ano: '2026',
    nomeExibicao: 'Dr. Carlos Mendes', numero: '40',
    modulosAtivos: ['crm','denuncias','inteligencia-eleitoral'],
    metaVotos: 49000,
    senhas: {
      campo:     'demo2026',
      coord:     'demo2026',
      candidato: 'admin2026',
      master:    'master2026',
    },
  }, 'campanhas', cid, 'config', 'main');
  console.log('✅ Config criada');

  // ── 3. Lideranças (RTDB) ────────────────────────────────
  const liderancas = [
    { nome:'João da Silva',   bairro:'Centro',      status:'confirmado', votos:280 },
    { nome:'Maria Aparecida', bairro:'Viamópolis',  status:'confirmado', votos:180 },
    { nome:'Pedro Ferreira',  bairro:'Santa Luzia', status:'provavel',   votos:120 },
    { nome:'Ana Costa',       bairro:'Três Marias', status:'provavel',   votos:95  },
    { nome:'Carlos Ramos',    bairro:'Fontana',      status:'indefinido', votos:60  },
    { nome:'Lucia Pereira',   bairro:'Centro',       status:'confirmado', votos:340 },
    { nome:'Roberto Alves',   bairro:'São Lucas',    status:'provavel',   votos:75  },
    { nome:'Fernanda Lima',   bairro:'Viamópolis',   status:'contra',     votos:0   },
  ];
  for (const l of liderancas) {
    const id = `lid_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await WWMX.db.set(`campanhas/${cid}/crm_liderancas/${id}`, {
      ...l, id, ts: Date.now(),
      autor: 'Seed Demo', autorUid: 'seed', obs: '', interacoes: [],
    });
    await new Promise(r => setTimeout(r, 60));
  }
  console.log('✅ Lideranças criadas');

  // ── 4. Estoque central (RTDB) ───────────────────────────
  const estoque = [
    { tipo:'panfleto',    label:'Panfleto A5',          tamanho:'A5',     qtdTotal:5000, qtdDist:1200 },
    { tipo:'colinha',     label:'Colinha 10x15cm',      tamanho:'10x15',  qtdTotal:2000, qtdDist:300  },
    { tipo:'windbanner',  label:'Windbanner 80x200cm',  tamanho:'80x200', qtdTotal:40,   qtdDist:12   },
    { tipo:'camiseta',    label:'Camiseta M',           tamanho:'M',      qtdTotal:100,  qtdDist:30   },
    { tipo:'bone',        label:'Boné',                 tamanho:'',       qtdTotal:80,   qtdDist:20   },
    { tipo:'adesivo_car', label:'Adesivo Carro 30x15cm',tamanho:'30x15',  qtdTotal:200,  qtdDist:0    },
  ];
  for (const item of estoque) {
    const id = item.tipo + (item.tamanho ? '_' + item.tamanho.replace(/[^a-z0-9]/gi,'').toLowerCase() : '');
    await WWMX.db.set(`campanhas/${cid}/estoque_central/${id}`, {
      ...item, qtdDisp: item.qtdTotal - item.qtdDist,
    });
  }
  console.log('✅ Estoque criado');

  // ── 5. Pins de demonstração (RTDB) ──────────────────────
  const pins = [
    { tipo:'panfleto',   nome:'Feira do Centro',    lat:-30.0807, lng:-51.0258, qtd:500,  status:'instalado' },
    { tipo:'windbanner', nome:'Esquina Av. Dorival', lat:-30.0820, lng:-51.0290, qtd:2,    status:'instalado' },
    { tipo:'colinha',    nome:'Mercado São João',   lat:-30.0790, lng:-51.0230, qtd:200,  status:'instalado' },
    { tipo:'bandeirico', nome:'Bandeiraço Centro',  lat:-30.0850, lng:-51.0270, qtd:null, status:'instalado' },
    { tipo:'corpoacorpo',nome:'Visita Viamópolis',  lat:-30.0760, lng:-51.0310, qtd:null, status:'instalado' },
  ];
  for (const p of pins) {
    const id = `pin_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await WWMX.db.set(`campanhas/${cid}/pins/${id}`, {
      ...p, id, ts: Date.now() - Math.round(Math.random() * 7 * 86400000),
      autor: 'João Demo', autorUid: 'seed',
    });
    await new Promise(r => setTimeout(r, 40));
  }
  console.log('✅ Pins criados');

  // ── 6. Percurso de demonstração (RTDB) ──────────────────
  await WWMX.db.set(`campanhas/${cid}/percursos/perc_demo_1`, {
    id: 'perc_demo_1', tipo: 'caminhada',
    motorista: 'João Demo', autorUid: 'seed',
    veiculo: 'Caminhada', turno: 'manha',
    data: new Date().toLocaleDateString('pt-BR'),
    dataTs: Date.now(), km: 4.2,
    duracao: 3600, pontos: [],
  });
  console.log('✅ Percurso criado');

  console.log('\n🎉 Seed concluído! Recarregue a página para ver os dados.');
  if (window.showToast) showToast('🎉 Dados demo criados com sucesso!', 'success');
}
