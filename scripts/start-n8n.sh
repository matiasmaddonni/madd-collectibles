#!/bin/bash
set -e

echo "Starting n8n + cloudflared tunnel..."

# Allow workflow expressions to read process env vars via $env.NAME.
# Disabled by default in n8n for safety. We need it for Supabase + Twilio.
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false

# Start cloudflared in the background. Logs go to .cloudflared.log so we
# can grep the public *.trycloudflare.com URL once the tunnel is up.
LOG=.cloudflared.log
: > "$LOG"
cloudflared tunnel --url http://localhost:5678 --no-autoupdate \
  --logfile "$LOG" --loglevel info >/dev/null 2>&1 &
TUNNEL_PID=$!

# Make sure cloudflared dies when n8n stops or this script is interrupted.
trap "kill $TUNNEL_PID 2>/dev/null || true; rm -f $LOG" EXIT INT TERM

# Wait up to 30s for cloudflared to print its public URL, then export it
# so n8n advertises the right webhook URL to the editor / Twilio.
PUBLIC_URL=""
for _ in $(seq 1 60); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -n1 || true)
  [ -n "$PUBLIC_URL" ] && break
  sleep 0.5
done

if [ -z "$PUBLIC_URL" ]; then
  echo "cloudflared did not produce a tunnel URL within 30s. Check $LOG."
  exit 1
fi

HOST=${PUBLIC_URL#https://}
export WEBHOOK_URL="$PUBLIC_URL/"
export N8N_HOST="$HOST"
export N8N_PROTOCOL=https
export N8N_PROXY_HOPS=1

echo ""
echo "================================================================"
echo "Public webhook URL: $PUBLIC_URL/webhook/whatsapp"
echo "Paste that into Twilio sandbox 'When a message comes in'."
echo "Editor (local): http://localhost:5678"
echo "================================================================"
echo ""

# Use dotenv-cli to load .env.local (handles quoted values, special chars,
# multi-word tokens that plain `source` chokes on). npx auto-installs on first run.
npx --yes dotenv-cli -e .env.local -- n8n start

kill $TUNNEL_PID 2>/dev/null || true
