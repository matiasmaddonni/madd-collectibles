# WhatsApp Bot — Twilio Sandbox setup

End-to-end onboarding for the MADD. WhatsApp assistant. The bot lives in a local n8n instance, exposed to Twilio via `localtunnel`.

## Prerequisites

- A free [Twilio](https://www.twilio.com/try-twilio) account.
- `n8n` and `localtunnel` installed globally:
  ```bash
  npm install -g n8n localtunnel
  ```
- This repo cloned, `.env.local` editable.

## 1. Create the Twilio account

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio). Free trial credit is enough for sandbox testing.
2. Verify your phone number when prompted.
3. From the Console home, copy your **Account SID** and **Auth Token** (Account Info card on the right).

## 2. Activate the WhatsApp Sandbox

1. Console → **Messaging** → **Try it out** → **Send a WhatsApp message**.
2. Twilio shows the sandbox number (`+1 415 523 8886`) and a unique join code shaped `join <two-words>`.
3. From your personal WhatsApp, send the join code to the sandbox number. WhatsApp will reply confirming you've joined.

## 3. Start n8n + tunnel

In this repo:

```bash
npm run n8n
```

Expected output:

```
Starting n8n...
Tunnel running at https://madd-n8n.loca.lt
... n8n logs ...
Editor is now accessible via:
http://localhost:5678/
```

If `madd-n8n.loca.lt` was taken (loca.lt subdomains are best-effort), `lt` will print a different URL — copy it and use that everywhere `madd-n8n.loca.lt` appears in this doc.

## 4. Dismiss the localtunnel gate

Open `https://madd-n8n.loca.lt` in any browser **once**. Loca.lt shows a one-time "Click to continue" page; clicking past it whitelists your IP for the session. Without this, Twilio's webhook calls get the gate page instead of n8n.

## 5. Wire the Twilio webhook

1. Console → **Messaging** → **Try it out** → **Send a WhatsApp message** → tab **Sandbox settings**.
2. **When a message comes in** → set to:
   ```
   https://madd-n8n.loca.lt/webhook/whatsapp
   ```
   Method: **HTTP POST**.
3. Leave **Status callback URL** empty.
4. Click **Save**.

## 6. Build the workflow in n8n

Follow [n8n-workflow.md](./n8n-workflow.md). Save and **Activate** the workflow when done.

## 7. End-to-end test

From your paired WhatsApp, send:

- `hola` → bot replies with the greeting menu.
- `precio Ginyu` → bot looks Ginyu up in Supabase, replies with name / line / price / condition.
- `xyz nonsense` → bot replies with the unknown-fallback message.

If nothing happens:

- n8n editor → **Executions** → look for the failed run, click into it to see which node errored.
- Check the loca.lt window is still open and not paused.
- Re-confirm the Twilio sandbox webhook URL matches the one printed by `npm run n8n`.

## Credentials → `.env.local`

Paste the values you copied earlier:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
N8N_WEBHOOK_URL=https://madd-n8n.loca.lt/webhook/whatsapp
```

`.env.local` is git-ignored. n8n picks these up via `$env.TWILIO_ACCOUNT_SID` etc. when launched from `npm run n8n`.

## Caveats

- **Sandbox 72h expiry** — Twilio drops the device pairing after 72 hours of inactivity. Re-send the join code to reconnect.
- **Sandbox is shared** — anyone who joined the same sandbox sees nothing of your account, but you can't customize the sender display name. Production needs an approved WhatsApp Business number.
- **Loca.lt is best-effort** — if the tunnel disconnects, the webhook 502s. For anything beyond dev, swap to a hosted n8n (Railway, Render, self-host with HTTPS).
- **Anon key only** — the bot reads Supabase with the anon key. Do not give it the service role key; the bot has no need to write.
