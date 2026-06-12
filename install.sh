#!/usr/bin/env bash
# deals.dev for Codex — installer
# Usage: ./install.sh dd_live_yourkey
set -euo pipefail

KEY="${1:-}"
if [[ ! "$KEY" == dd_* ]]; then
  echo "Usage: ./install.sh dd_live_yourkey"
  echo "Get your key at https://deals.dev/dashboard"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$HOME/.deals-dev"
# Pass the key through the environment (never interpolated into the script
# body) so a crafted key string can't break out and execute code.
DEALS_DEV_KEY="$KEY" node -e '
const fs = require("fs");
const file = process.env.HOME + "/.deals-dev/config.json";
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
cfg.apiKey = process.env.DEALS_DEV_KEY;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
'

CONFIG="$HOME/.codex/config.toml"
mkdir -p "$HOME/.codex"
touch "$CONFIG"

if grep -q "deals-dev" "$CONFIG" 2>/dev/null || grep -q "notify.js" "$CONFIG" 2>/dev/null; then
  echo "✓ notify hook already present in $CONFIG"
else
  printf '\nnotify = ["node", "%s/notify.js"]\n' "$SCRIPT_DIR" >> "$CONFIG"
  echo "✓ added notify hook to $CONFIG"
fi

echo "✓ deals.dev installed for Codex."
echo "  Balance: https://deals.dev/dashboard"
