#!/usr/bin/env bash
set -euo pipefail

# Rode este script na raiz do repositório ANGEL.
# Ele copia os arquivos corrigidos e aposenta o router-ops antigo.

ROOT="$(pwd)"

mkdir -p "$ROOT/core" "$ROOT/candidato" "$ROOT/coordenador" "$ROOT/modulos"

cp index.html "$ROOT/index.html"
cp core/router.js "$ROOT/core/router.js"
cp core/auth.js "$ROOT/core/auth.js"
cp candidato/dashboard.js "$ROOT/candidato/dashboard.js"
cp coordenador/estoque.js "$ROOT/coordenador/estoque.js"
cp modulos/inteligencia-eleitoral.js "$ROOT/modulos/inteligencia-eleitoral.js"

if [ -f "$ROOT/core/router-ops.js" ]; then
  rm "$ROOT/core/router-ops.js"
fi

git status --short
echo
echo "Patch ANGEL aplicado. Confira, teste login/mapa e faça commit."
