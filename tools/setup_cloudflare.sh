#!/usr/bin/env bash
# Cria o banco D1, aplica o schema e publica o CaloriQuest no Cloudflare Pages.
# Roda tudo que dá para automatizar e para para pedir ajuda só quando precisa
# de você (login no navegador).
#
#   bash tools/setup_cloudflare.sh
#
# Pode rodar de novo quantas vezes quiser: se o banco já existir, ele reaproveita.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="caloriquest-db"
PROJECT="caloriquest"
WR="npx --yes wrangler@latest"

echo "==> 1/5  Conferindo login no Cloudflare"
if ! $WR whoami >/dev/null 2>&1; then
  echo "    Você ainda não está logado. Vai abrir o navegador para autorizar."
  $WR login
fi
echo "    Logado como: $($WR whoami 2>/dev/null | grep -i 'email' || echo 'ok')"

echo "==> 2/5  Banco de dados D1"
if $WR d1 info "$DB_NAME" >/dev/null 2>&1; then
  echo "    '$DB_NAME' já existe, reaproveitando."
else
  echo "    Criando '$DB_NAME'..."
  $WR d1 create "$DB_NAME"
fi

# pega o database_id e escreve no wrangler.toml sozinho
DB_ID=$($WR d1 info "$DB_NAME" --json 2>/dev/null | grep -o '"uuid"[^,]*' | head -1 | cut -d'"' -f4)
if [ -z "$DB_ID" ]; then
  echo "    !! Não consegui ler o database_id automaticamente."
  echo "       Rode: $WR d1 info $DB_NAME"
  echo "       e cole o valor de 'uuid' no campo database_id do wrangler.toml"
  exit 1
fi
echo "    database_id: $DB_ID"
python3 - "$DB_ID" <<'PY'
import io, re, sys
db_id = sys.argv[1]
p = "wrangler.toml"
s = io.open(p, encoding="utf-8").read()
s = re.sub(r'database_id = "[^"]*"', f'database_id = "{db_id}"', s)
io.open(p, "w", encoding="utf-8").write(s)
print("    wrangler.toml atualizado")
PY

echo "==> 3/5  Criando as tabelas (usuários, sessões e dados)"
$WR d1 execute "$DB_NAME" --remote --file=schema.sql --yes >/dev/null
echo "    tabelas prontas"

echo "==> 4/5  Publicando o site"
$WR pages deploy . --project-name "$PROJECT" --commit-dirty=true

echo "==> 5/5  Ligando o banco ao site"
echo "    Falta um clique no painel (o Wrangler não faz esse por linha de comando):"
echo
echo "    1. Abra https://dash.cloudflare.com  →  Workers & Pages  →  $PROJECT"
echo "    2. Settings  →  Bindings  →  Add  →  D1 database"
echo "    3. Variable name: DB      Database: $DB_NAME"
echo "    4. Save, e então Deployments →  ⋯  no último deploy  →  Retry deployment"
echo
echo "Pronto! O app fica em https://$PROJECT.pages.dev"
echo "Para publicar de novo depois de qualquer mudança: $WR pages deploy ."
