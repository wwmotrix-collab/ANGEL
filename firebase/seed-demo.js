/**
 * firebase/seed-demo.js
 * Popula o banco com dados de demonstração.
 * 
 * Rodar UMA VEZ no console do navegador após fazer login como Master:
 *   1. Abra o app: http://localhost:3000/?c=demo
 *   2. Abra o DevTools (F12) → Console
 *   3. Cole e execute este script
 */

async function seedDemo() {
  if (!window.WWMX?.fs || !window.WWMX?.db) {
    console.error('WWMX não inicializado. Faça login primeiro.');
    return;
  }

  console.log('🌱 Iniciando seed...');

  const campanhaId = 'demo';

  // 1. Campanha no Firestore
  await WWMX.fs.setDoc({
    id: campanhaId,
    nomeExibicao: 'Dr. Carlos Mendes',
    numero: '40',
    cargo: 'dep_estadual',
    municipio: 'Viamão',
    uf: 'RS',
    ano: '2026',
    status: 'ativo',
    modulosAtivos: ['crm','denuncias','inteligencia-eleitoral'],
    subTitulo: 'WWMX Campaign · Viamão 2026',
  }, 'campanhas', campanhaId);

  // 2. Config com senhas
  await WWMX.fs.setDoc({
    municipio: 'Viamão', uf: 'RS', ano: '2026',
    nomeExibicao: 'Dr. Carlos Mendes', numero: '40',
    modulosAtivos: ['crm','denuncias','inteligencia-eleitoral'],
    senhas: { campo:'demo2026', coord:'demo2026', candidato:'admin2026', master:'master2026' },
  }, 'campanhas', campanhaId, 'config');

  // 3. Lideranças de demonstração no RTDB
  const liderancas = [
    { nome:'João da Silva',    bairro:'Centro',     status:'confirmado', votos:280, tel:'51999990001' },
    { nome:'Maria Aparecida',  bairro:'Viamópolis', status:'confirmado', votos:180, tel:'51999990002' },
    { nome:'Pedro Ferreira',   bairro:'Santa Luzia',status:'provavel',   votos:120, tel:'51999990003' },
    { nome:'Ana Costa',        bairro:'Três Marias',status:'provavel',   votos:95,  tel:'51999990004' },
    { nome:'Carlos Ramos',     bairro:'Fontana',    status:'indefinido', votos:60,  tel:'51999990005' },
    { nome:'Lucia Pereira',    bairro:'Centro',     status:'confirmado', votos:340, tel:'51999990006' },
    { nome:'Roberto Alves',    bairro:'São Lucas',  status:'provavel',   votos:75,  tel:'51999990007' },
    { nome:'Fernanda Lima',    bairro:'Viamópolis', status:'contra',     votos:0,   tel:'51999990008' },
  ];
  for (const l of liderancas) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2,6);
    await WWMX.db.set(`campanhas/${campanhaId}/crm_liderancas/${id}`, {
      ...l, id, ts: Date.now(), autor:'Seed Demo', autorUid:'seed',
      interacoes: [], obs: '',
    });
    await new Promise(r => setTimeout(r, 50));
  }

  // 4. Estoque central no RTDB
  const estoque = [
    { tipo:'panfleto',   label:'Panfleto A5',      tamanho:'A5',  qtdTotal:5000, qtdDist:1200 },
    { tipo:'colinha',    label:'Colinha 10x15cm',  tamanho:'10x15', qtdTotal:2000, qtdDist:300 },
    { tipo:'windbanner', label:'Windbanner 80x200', tamanho:'80x200', qtdTotal:40,  qtdDist:12  },
    { tipo:'camiseta',   label:'Camiseta M',       tamanho:'M',   qtdTotal:100, qtdDist:30   },
    { tipo:'bone',       label:'Boné',             tamanho:'',    qtdTotal:80,  qtdDist:20   },
    { tipo:'adesivo_car',label:'Adesivo Carro 30x15', tamanho:'30x15', qtdTotal:200, qtdDist:0 },
  ];
  for (const item of estoque) {
    const id = item.tipo + (item.tamanho ? '_' + item.tamanho.replace(/[^a-z0-9]/gi,'') : '');
    await WWMX.db.set(`campanhas/${campanhaId}/estoque_central/${id}`, {
      ...item, qtdDisp: item.qtdTotal - item.qtdDist,
    });
  }

  console.log('✅ Seed concluído! Recarregue a página.');
  if (window.showToast) showToast('✅ Dados demo criados!', 'success');
}

seedDemo();
