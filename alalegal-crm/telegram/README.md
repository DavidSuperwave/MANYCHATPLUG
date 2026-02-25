# ALA LEGAL - Telegram Bot

Dedicated Telegram channel for ALA LEGAL CRM notifications and control.

## 🚀 Setup

### 1. Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Start a chat and send `/newbot`
3. Follow prompts to name your bot (e.g., "ALA LEGAL CRM Bot")
4. **Copy the bot token** (looks like: `123456789:ABCdefGHIjklMNOpqrSTUvwxyz`)

### 2. Get Your Chat ID

1. Send a message to your new bot
2. Open in browser: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Look for `"chat":{"id":12345678` - that number is your chat ID

### 3. Configure Environment

```bash
cd alalegal-crm/telegram
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxyz
TELEGRAM_ADMIN_CHAT_ID=12345678
BRIDGE_URL=https://web-production-b08f3.up.railway.app
```

### 4. Install & Run

```bash
npm install
npm start
```

---

## 📱 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and commands |
| `/check` | Manually check for new messages |
| `/pipeline` | View sales funnel |
| `/stats` | Classification statistics |
| `/leads [stage]` | View leads by stage |
| `/reply [id] [msg]` | Reply to a lead |
| `/stage [id] [stage]` | Move lead to new stage |
| `/discard [id]` | Mark lead as not relevant |
| `/help` | Detailed help |

---

## 🔔 Automatic Notifications

The bot automatically checks for new messages every **15 seconds** and sends you:

### 🔥 PRIORITY (Fallecimiento)
```
🔔🔔🔔 FALLECIMIENTO DETECTADO 🔔🔔🔔

🔥 PRIORITY
🆕 NUEVO LEAD | 📥 INBOUND

👤 Nombre: Maria Gonzalez
🆔 ID: 26132504589699601
💬 Mensaje: "Mi esposo falleció y tenía Infonavit"

🧠 Razón: Detected fallecimiento keyword: "falleció"

💡 Respuesta sugerida:
Lamento mucho tu pérdida. En ALA LEGAL nos especializamos...

📌 Comandos:
• /reply_26132504589699601 [tu mensaje]
• /stage_26132504589699601 qualified
• /discard_26132504589699601
```

### 👤 ENGAGE (Service Inquiry)
```
🔔 Nuevo mensaje de ManyChat

👤 ENGAGE
📝 Existente | ✅ QUALIFIED

👤 Nombre: Juan Perez
🆔 ID: 123456789
💬 Mensaje: "Necesito información sobre sus servicios"

🧠 Razón: Service inquiry detected

💡 Respuesta sugerida:
Gracias por contactarnos. En ALA LEGAL nos especializamos en casos de fallecimiento...
```

### 🗑️ DISCARD (Auto-ignored)
Compliments and spam are automatically logged but **not sent to Telegram**.

---

## 💬 Quick Reply Examples

From the notification, you can reply:

```
/reply_26132504589699601 Hola Maria, lamento mucho tu pérdida. Para ayudarte necesito saber si hay testamento...
```

Or use the full command:
```
/reply 26132504589699601 Hola Maria, lamento mucho tu pérdida...
```

---

## 📊 Pipeline Stages

```
inbound → qualified → document_pending → set → intake_form → closed_won/lost
```

Move leads with:
```
/stage 26132504589699601 qualified
```

---

## 🎯 Use Case Workflow

1. **Lead sends message** on Facebook Messenger
2. **Bot classifies** it (priority/engage/neutral/discard)
3. **You receive notification** on Telegram
4. **You reply** directly from Telegram
5. **You move stage** when qualified
6. **Pattern is saved** for future similar messages

---

## 🚀 Deploy to Railway (Optional)

For 24/7 operation:

```bash
# Add to your main railway project
cd alalegal-crm/telegram
railway init
railway up

# Set environment variables in Railway dashboard
railway variables set TELEGRAM_BOT_TOKEN="your_token"
railway variables set TELEGRAM_ADMIN_CHAT_ID="your_chat_id"
```

---

## 📱 Mobile Friendly

All notifications are optimized for mobile viewing with:
- Clear emojis for quick visual recognition
- Copy-paste friendly IDs (monospace)
- One-tap command suggestions
- Markdown formatting

---

**Start the bot and you'll never miss a fallecimiento lead again!** 🔔