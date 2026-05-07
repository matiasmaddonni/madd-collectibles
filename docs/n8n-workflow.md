# n8n workflow — MADD. WhatsApp Bot

Manual build instructions. After completing the Twilio + n8n setup in [whatsapp-bot-setup.md](./whatsapp-bot-setup.md), build this workflow in the n8n UI at `http://localhost:5678/`.

## Workflow name

`MADD. WhatsApp Bot`

## Required env vars (read by n8n nodes)

| Var | Source |
|---|---|
| `SUPABASE_URL` | Same value as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` |
| `SUPABASE_ANON_KEY` | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+14155238886` (sandbox) |

`npm run n8n` exports the contents of `.env.local` to the n8n process. Either copy the `NEXT_PUBLIC_SUPABASE_*` keys under `SUPABASE_*` aliases, or reference the `NEXT_PUBLIC_` keys directly inside expressions (e.g. `{{$env.NEXT_PUBLIC_SUPABASE_URL}}`).

## Nodes

### Node 1 — Webhook (trigger)

| Field | Value |
|---|---|
| HTTP Method | `POST` |
| Path | `whatsapp` |
| Authentication | None (Twilio sandbox doesn't sign webhooks by default — add HMAC verification before going to prod) |
| Response Mode | `Last Node` |
| Response Code | `200` |
| Response Data | `First Entry JSON` |

Twilio posts `application/x-www-form-urlencoded`. n8n parses it into `$json.body`.

### Node 2 — Set (extract message)

n8n built-in **Set** node. Output mode: **Keep Only Set**.

| Name | Value (expression) |
|---|---|
| `message` | `={{$json.body.Body}}` |
| `sender` | `={{$json.body.From}}` |
| `messageLower` | `={{$json.body.Body.toLowerCase()}}` |
| `searchTerm` | `={{$json.body.Body.toLowerCase().replace(/^\s*(precio|price|disponible|stock)\s*/, '').trim()}}` |

`searchTerm` strips the leading keyword so the user can write `precio Ginyu` and we query `Ginyu`.

### Node 3 — IF (keyword router)

Use the **Switch** node (multi-output IF). Mode: **Rules**, three rules + fallback:

| Output | Condition (string Contains, case-insensitive) |
|---|---|
| `0` (precio) | `{{$json.messageLower}}` contains `precio` OR `price` |
| `1` (disponible) | `{{$json.messageLower}}` contains `disponible` OR `stock` |
| `2` (greeting) | `{{$json.messageLower}}` contains `hola` OR `info` OR `catalogo` |
| `3` (fallback) | (default — uncheck "stop after first match" not needed) |

The Switch node's "OR" within a single output is set via two rules feeding the same output index, or via a Function pre-step. Easiest: use a single **IF** node chain — but the Switch with regex mode is cleaner:

```
mode: "expression"
output 0: ={{ /precio|price/.test($json.messageLower) }}
output 1: ={{ /disponible|stock/.test($json.messageLower) }}
output 2: ={{ /hola|info|catalogo/.test($json.messageLower) }}
fallback output: 3
```

### Node 4a — HTTP Request (Supabase search)

Wired from outputs `0` and `1` of Node 3. Both outputs point at this same HTTP Request node (n8n allows multiple inputs).

| Field | Value |
|---|---|
| Method | `GET` |
| URL | `={{$env.NEXT_PUBLIC_SUPABASE_URL}}/rest/v1/products` |
| Authentication | None (we set headers manually) |
| Send Query Parameters | On |
| Query Parameters | `name` = `=ilike.*{{$json.searchTerm}}*` |
|  | `status` = `eq.available` |
|  | `select` = `name,price,currency,condition,status,product_lines(name)` |
|  | `limit` = `5` |
| Send Headers | On |
| Headers | `apikey` = `={{$env.NEXT_PUBLIC_SUPABASE_ANON_KEY}}` |
|  | `Authorization` = `=Bearer {{$env.NEXT_PUBLIC_SUPABASE_ANON_KEY}}` |
|  | `Accept` = `application/json` |

The response is an array of product rows. PostgREST's `*` wildcard inside `ilike` matches partial names — same shape catalog page uses.

### Node 4b — Set (greeting reply)

Wired from output `2` of Node 3.

| Name | Value |
|---|---|
| `reply` | (multi-line string below) |
| `sender` | `={{$json.sender}}` |

```
Hola! Soy el asistente de MADD. 🔥
Podés preguntarme:
• *precio [figura]* — te digo el precio actual
• *disponible [figura]* — te confirmo si está en stock
• *catalogo* — te mando el link
¿En qué te puedo ayudar?
```

### Node 4c — Set (fallback reply)

Wired from output `3` of Node 3.

| Name | Value |
|---|---|
| `reply` | (multi-line string below) |
| `sender` | `={{$json.sender}}` |

```
No entendí bien tu consulta.
Escribí *precio [nombre de la figura]*
o visitá el catálogo: madd-collectibles.vercel.app
```

### Node 5 — Function (format Supabase response)

Wired from Node 4a only. **Function** node (single-item code).

```javascript
const items = $input.all().map((i) => i.json).flat();
const sender = $('Set — extract message').first().json.sender;

if (!items.length) {
  return [
    {
      json: {
        sender,
        reply:
          "No encontré esa figura en stock.\n" +
          "Revisá el catálogo completo:\n" +
          "madd-collectibles.vercel.app",
      },
    },
  ];
}

const STATUS_LABEL = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
};

const CONDITION_LABEL = {
  mint_sealed: "Sellado",
  mint_open: "Como Nuevo",
  near_mint: "Loose",
  good: "Used",
  fair: "Detalles",
};

const cards = items.slice(0, 3).map((p) => {
  const line = (p.product_lines && p.product_lines.name) || "—";
  const cond = CONDITION_LABEL[p.condition] || p.condition;
  const stat = STATUS_LABEL[p.status] || p.status;
  return [
    `✅ *${p.name}* — ${line}`,
    `💰 Precio: ${p.price} ${p.currency}`,
    `📦 Condición: ${cond}`,
    `Estado: ${stat}`,
  ].join("\n");
});

const reply =
  cards.join("\n\n") +
  "\n\nPara comprar escribí al vendedor directo 👇";

return [{ json: { sender, reply } }];
```

Replace `'Set — extract message'` with the actual name you gave Node 2 if different.

### Node 6 — HTTP Request (Twilio reply)

Wired from Node 5, Node 4b, and Node 4c (all converge here).

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `=https://api.twilio.com/2010-04-01/Accounts/{{$env.TWILIO_ACCOUNT_SID}}/Messages.json` |
| Authentication | **Generic Credential Type** → **Basic Auth** |
| Username | `={{$env.TWILIO_ACCOUNT_SID}}` |
| Password | `={{$env.TWILIO_AUTH_TOKEN}}` |
| Send Body | On |
| Body Content Type | `Form Urlencoded` |
| Body Parameters | `From` = `={{$env.TWILIO_WHATSAPP_NUMBER}}` |
|  | `To` = `={{$json.sender}}` |
|  | `Body` = `={{$json.reply}}` |

n8n form-encodes automatically — do not URL-encode the body manually.

## Wiring summary

```
Webhook  →  Set (extract)  →  Switch
                                  ├─ 0 precio ─────┐
                                  ├─ 1 disponible ─┤→  HTTP Supabase  →  Function format  ─┐
                                  ├─ 2 greeting ──── Set greeting ───────────────────────────┤
                                  └─ 3 fallback ──── Set fallback ───────────────────────────┤
                                                                                              ↓
                                                                                  HTTP Twilio reply
```

## Save & activate

1. **Save** (Ctrl+S).
2. Toggle **Active** on the top-right of the workflow editor.
3. The webhook is now live at `https://madd-n8n.loca.lt/webhook/whatsapp` (production path). The test path `/webhook-test/whatsapp` only fires while the editor's "Listen for test event" is open — Twilio should hit the production path.

## Local testing without Twilio

Hit the webhook directly from any terminal:

```bash
curl -X POST https://madd-n8n.loca.lt/webhook/whatsapp \
  -d 'From=whatsapp:+5491100000000&Body=precio Ginyu'
```

Watch the **Executions** tab in n8n to see the run. The Twilio reply step will fail (`To` is a fake number) — that's expected; the rest of the chain confirms routing + Supabase lookup + formatting.

For a fully-passing end-to-end test, use a real WhatsApp message from your sandbox-paired phone.
