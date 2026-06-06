/**
 * core/config.js — WWMX Campaign
 */
(function (global) {
  'use strict';

  const TIPO_MATERIAL = {
    colinha:      { icon:'📋', label:'Colinha',             cor:'#3b82f6', campos:['tamanho'] },
    panfleto:     { icon:'📄', label:'Panfleto',            cor:'#0ea5e9', campos:['tamanho'] },
    windbanner:   { icon:'🪧', label:'Windbanner/Banner',   cor:'#6366f1', campos:['tamanho'] },
    adesivo_car:  { icon:'🚗', label:'Adesivo de Carro',    cor:'#f59e0b', campos:['tamanho'] },
    adesivo_res:  { icon:'🏠', label:'Adesivo Residencial', cor:'#ec4899', campos:['tamanho'] },
    camiseta:     { icon:'👕', label:'Camiseta',            cor:'#22c55e', campos:['tamanho'] },
    bone:         { icon:'🧢', label:'Boné',                cor:'#8b5cf6', campos:[]          },
    bandeira_mao: { icon:'🏳️', label:'Bandeira de Mão',     cor:'#f97316', campos:[]          },
    kit_completo: { icon:'📦', label:'Kit Completo',        cor:'#0891b2', campos:[], vinculaLider:true },
  };

  const TIPO_EVENTO = {
    bandeirico:  { icon:'🚩', label:'Bandeiraço',    cor:'#f59e0b', percurso:false },
    caminhada:   { icon:'🚶', label:'Caminhada',     cor:'#8b5cf6', percurso:true  },
    carrosom:    { icon:'📢', label:'Carro de Som',  cor:'#f97316', percurso:true  },
    panfletagem: { icon:'📄', label:'Panfletagem',   cor:'#06b6d4', percurso:false },
    corpoacorpo: { icon:'🤝', label:'Corpo a Corpo', cor:'#ec4899', percurso:false },
    comicio:     { icon:'🎤', label:'Comício',       cor:'#f97316', percurso:false },
    gazebo:      { icon:'⛺', label:'Gazebo / Apoio',cor:'#16a34a', percurso:false },
    portaaporta: { icon:'🏠', label:'Porta a Porta', cor:'#b45309', percurso:false },
  };

  const TIPO_CONFIG = { ...TIPO_MATERIAL, ...TIPO_EVENTO };
  const NIVEL      = { MASTER:'master', CANDIDATO:'candidato', COORDENADOR:'coord', CAMPO:'campo' };
  const NIVEL_RANK = { campo:1, coord:2, candidato:3, master:4 };

  const NAV_LABELS = {
    central:'✨ Visão Geral',
    mapa:'🗺️  Mapa', meucampo:'📍 Meu Campo', percursos:'🚗 Percursos',
    meuinventario:'📦 Meu Inventário', minhasrotas:'🎯 Minhas Rotas',
    dash:'📊 Dashboard', eleitoral:'🗳️  Eleitoral', crm:'👥 CRM Lideranças',
    militantes:'⚔️  Gestão de Equipe', estoque:'📦 Estoque Central', rotas:'🚗 Planejamento de Rotas', denuncias:'🚨 Denúncias',
    admindash:'👑 Painel do Candidato', adminmapa:'🗺️  Mapa Consolidado', adminagentes:'⭐ Agentes/Lideranças',
    adminequipe:'⚔️  Equipe de Campo', logs:'📋 Logs',
    'master-gerador':'🧠 Gerador PicoClaw',
    'master-mapa-eleitoral':'🗺️ Mapa Eleitoral',
    'master-campanhas':'🏗️  Campanhas','master-planos':'💰 Planos',
    'master-banco':'🗄️  Banco','master-clientes':'🤝 Clientes',
  };

  const MODULOS_DISPONIVEIS = [
    { id:'crm', label:'CRM Lideranças', icon:'👥' },
    { id:'agenda', label:'Agenda de Eventos', icon:'📅' },
    { id:'denuncias', label:'Canal de Denúncias', icon:'🚨' },
    { id:'estoque', label:'Estoque e Materiais', icon:'📦' },
    { id:'rotas', label:'Planejamento de Rotas', icon:'🚗' },
    { id:'estreleiro', label:'Estreleiro', icon:'🌟' },
    { id:'pre-campanha', label:'Pré-Campanha', icon:'🌱' },
    { id:'inteligencia-eleitoral', label:'Inteligência Eleitoral', icon:'🗳️' },
  ];

  const GUILDA_RANKS = [
    { rank:'F', xpMin:0,    titulo:'Viajante',   icone:'🧳', cor:'#7d8590' },
    { rank:'E', xpMin:50,   titulo:'Escudeiro',  icone:'🛡️', cor:'#78716c' },
    { rank:'D', xpMin:150,  titulo:'Explorador', icone:'🗺️', cor:'#059669' },
    { rank:'C', xpMin:400,  titulo:'Guardião',   icone:'⚔️', cor:'#2563eb' },
    { rank:'B', xpMin:1000, titulo:'Cavaleiro',  icone:'🏇', cor:'#7c3aed' },
    { rank:'A', xpMin:2500, titulo:'Paladino',   icone:'🌟', cor:'#d97706' },
    { rank:'S', xpMin:5000, titulo:'Lendário',   icone:'👑', cor:'#dc2626' },
  ];

  function getGuildaRank(xp) {
    for (let i = GUILDA_RANKS.length - 1; i >= 0; i--) if (xp >= GUILDA_RANKS[i].xpMin) return GUILDA_RANKS[i];
    return GUILDA_RANKS[0];
  }

  const DEFAULT_CONFIG = {
    alertaEstoqueMinimo: 10,
    xpPorMissao:20, xpPorKm:1, xpPorEvento:5,
    mapaTileLayer:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapaAttribution:'&copy; OpenStreetMap contributors',
    cacheTTL: 5 * 60 * 1000,
    metaVotos: 49000,
  };

  global.WWMX = global.WWMX || {};
  global.WWMX.Config = { TIPO_MATERIAL, TIPO_EVENTO, TIPO_CONFIG, NIVEL, NIVEL_RANK, NAV_LABELS, MODULOS_DISPONIVEIS, GUILDA_RANKS, DEFAULT_CONFIG, getGuildaRank };
  global.TIPO_MATERIAL = TIPO_MATERIAL;
  global.TIPO_EVENTO   = TIPO_EVENTO;
  global.TIPO_CONFIG   = TIPO_CONFIG;
  global.NIVEL         = NIVEL;
  global.NIVEL_RANK    = NIVEL_RANK;
  global.GUILDA_RANKS  = GUILDA_RANKS;
  global.getGuildaRank = getGuildaRank;
}(window));
