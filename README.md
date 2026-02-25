# ALA LEGAL - ManyChat Messenger Bridge

Bridge server that connects ManyChat webhooks to your AI agent (OpenClaw/Ironclaw) for ALA LEGAL Facebook Messenger bot.

## 📋 ENDPOINTS

### Incoming (ManyChat → Bridge)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/manychat` | POST | Receives messages from ManyChat. Configure this in ManyChat dashboard. |

**Webhook Payload Format:**
```json
{
  "event": "message.received",
  "data": {
    "subscriber_id": 123456789,
    "subscriber_name": "Juan Perez",
    "message": {
      "type": "text",
      "text": "Hola, quiero información sobre crédito"
    }
  }
}
```

### Outgoing (You → ManyChat → User)

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/send/text` | POST | `{subscriber_id, text}` | Send text message |
| `/api/send/image` | POST | `{subscriber_id, image_url, caption?}` | Send image |
| `/api/send/audio` | POST | `{subscriber_id, audio_url}` | Send audio/voice |
| `/api/send/flow` | POST | `{subscriber_id, flow_ns}` | Trigger ManyChat flow |

**Example - Send Text:**
```bash
curl -X POST http://localhost:3000/api/send/text \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_id": 123456789,
    "text": "¡Hola! Soy tu asistente de ALA LEGAL. ¿En qué puedo ayudarte?"
  }'
```

### Inbox (View Messages)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inbox` | GET | All messages (last 100) |
| `/api/inbox/:subscriberId` | GET | Messages from specific user |
| `/api/inbox/clear` | POST | Clear inbox file |

### Info

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/page` | GET | ManyChat page info |
| `/api/subscriber/:id` | GET | Subscriber details |

## 🚀 SETUP

### 1. Install dependencies
```bash
cd manychat-messenger-bot
npm install
```

### 2. Environment variables already configured in `.env`:
```
MANYCHAT_API_KEY=416263294908731:439fac70ed0bca6edeb1956172e1beab
PORT=3000
```

### 3. Start the bridge
```bash
npm run bridge
```

### 4. Expose with ngrok (for ManyChat to reach you)
```bash
npx ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 5. Configure in ManyChat
1. Go to **Settings → API → Webhooks**
2. Add webhook URL: `https://abc123.ngrok.io/api/webhooks/manychat`
3. Select event: `message.received`
4. Save

## 💬 HOW IT WORKS

### Message Flow:
```
User (Messenger)
    ↓
ManyChat
    ↓ (webhook)
Bridge Server (/api/webhooks/manychat)
    ↓ (saved to data/manychat-inbox.jsonl)
You (OpenClaw) polls/reads inbox
    ↓
You craft response
    ↓
Bridge Server (/api/send/text)
    ↓ (ManyChat API)
ManyChat
    ↓
User receives message
```

### Your workflow:
1. **Check inbox**: Ask me "any new messages?" or "show inbox"
2. **I read**: `GET /api/inbox` and show you the messages
3. **You tell me how to respond**: "Reply to subscriber 123: ..."
4. **I send**: `POST /api/send/text` with your response

## 🔧 MANYCHAT API REFERENCE

### Send Message Types

**Text:**
```json
POST /api/send/text
{
  "subscriber_id": 123456789,
  "text": "Tu mensaje aquí"
}
```

**Image:**
```json
POST /api/send/image
{
  "subscriber_id": 123456789,
  "image_url": "https://alalegal.mx/images/banner.jpg",
  "caption": "Nuestras oficinas"
}
```

**Audio/Voice:**
```json
POST /api/send/audio
{
  "subscriber_id": 123456789,
  "audio_url": "https://your-cdn.com/message.mp3"
}
```

**Trigger Flow:**
```json
POST /api/send/flow
{
  "subscriber_id": 123456789,
  "flow_ns": "bienvenida"
}
```

### Get Subscriber Info
```bash
GET /api/subscriber/123456789
```

Response includes:
- `name`, `first_name`, `last_name`
- `profile_pic`
- `status` (active, etc.)
- `last_interaction` - when they last messaged
- `tags` - assigned tags
- `custom_fields` - CURP, phone, etc.

## ⚠️ IMPORTANT NOTES

| Limitation | Solution |
|------------|----------|
| **Can't fetch history** | Store all webhooks in `data/manychat-inbox.jsonl` |
| **24-hour rule** | Can only message users after they message you first |
| **Webhook must respond fast** | Bridge sends 200 OK immediately, then processes |

## 📁 FILE STORAGE

Messages stored in:
- `data/manychat-inbox.jsonl` - Incoming messages from webhooks
- `data/responses.jsonl` - Outgoing messages you sent

## 🎯 ALA LEGAL USE CASE

For lead qualification:
1. User messages on Facebook Messenger
2. Webhook saves message to inbox
3. You (agent) reads and analyzes
4. You request CURP if needed
5. You validate via Infonavit API (separate integration)
6. You tag as "precalificado" or "no_califica"
7. You send appropriate response

## 📞 SUPPORT

- **Page**: ALA LEGAL
- **Contact**: contacto@alalegal.mx  
- **Phone**: 81 1249 1200
- **Timezone**: America/Monterrey