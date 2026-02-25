# ALA LEGAL CRM 🤖

Manual CRM system for ALA LEGAL lead qualification through ManyChat Messenger.

## 🎯 How It Works

**You are the trainer.** I notify you of every message, you tell me how to respond, and I learn your patterns.

### Flow:
1. **Lead messages** → Saved to inbox
2. **I notify you** → Show message + context
3. **You train me** → Tell me exactly what to say
4. **I send it** → Via ManyChat bridge
5. **I remember** → Save pattern for next time

---

## 📁 Structure

```
alalegal-crm/
├── schema.sql          # Database schema
├── crm.js             # CRM class (leads, messages, stages)
├── cli.js             # Interactive CLI for manual mode
├── monitor.js         # Auto-polling monitor
├── telegram/          # 📱 Telegram bot (dedicated channel)
│   ├── bot.js
│   ├── package.json
│   └── README.md
├── TRAINING.md        # Your training patterns & guardrails
├── alalegal.db        # DuckDB database (created on first run)
└── package.json
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
cd alalegal-crm
npm install
```

### 2. The bridge is already running at:
```
https://web-production-b08f3.up.railway.app
```

---

## 💬 Usage

### Option A: Interactive CLI (Terminal)
```bash
npm run cli
```

Commands:
- `check` - Check inbox and respond manually
- `pipeline` - View all stages
- `lead [id]` - View lead details
- `reply [id] [message]` - Quick reply
- `stage [id] [stage]` - Move lead stage

### Option B: Telegram Bot (📱 Recommended)

Dedicated Telegram channel for mobile notifications:

```bash
npm run telegram
```

**Features:**
- 🔥 **Instant notifications** when fallecimiento detected
- 📱 **Mobile-optimized** messages
- ⚡ **Quick reply buttons** from notifications
- 📊 **View pipeline** on-the-go

**Setup:**
1. Talk to @BotFather, create bot, copy token
2. Get your chat ID
3. Configure `.env` in `telegram/` folder
4. Run `npm run telegram`

See `telegram/README.md` for detailed setup.

### Option C: Monitor Mode (Auto-notify to terminal)
```bash
npm run monitor
```

This polls every 10 seconds and prints new messages to terminal.

---

## 📋 Lead Stages

| Stage | Description |
|-------|-------------|
| **inbound** | New lead, first message |
| **qualified** | Confirmed fallecimiento case |
| **document_pending** | Waiting for documents |
| **set** | Appointment scheduled |
| **intake_form** | Client completed intake |
| **closed_won** | Became paying client |
| **closed_lost** | Unqualified or no conversion |
| **discarded** | Auto-filtered (compliments, spam) |

---

## 🏷️ Message Classification

Every message gets automatically classified:

| Class | Icon | Description | Action |
|-------|------|-------------|--------|
| **🔥 PRIORITY** | Red | Fallecimiento mentioned | Reply immediately |
| **👤 ENGAGE** | Yellow | Service inquiry, general | Probe: "¿Es por fallecimiento?" |
| **❓ NEUTRAL** | Gray | Just greetings | Ask qualifying question |
| **🗑️ DISCARD** | Black | Compliments, spam | No reply, auto-discarded |

---

## 🎓 Training Me

### When a message arrives:

**I show you:**
```
🔥 PRIORITY | 🆕 NEW LEAD | Stage: INBOUND
👤 Maria Gonzalez
🆔 ID: 26132504589699601
💬 "Mi esposo falleció y tenía Infonavit"
🧠 Reason: Detected fallecimiento keyword: "falleció"

💡 Suggested response:
Lamento mucho tu pérdida. En ALA LEGAL nos especializamos...
```

**You respond:**
> "Reply to 26132504589699601: Hola Maria, lamento mucho tu pérdida. Para ayudarte necesito saber si hay testamento..."

**Or in Telegram:**
```
/reply_26132504589699601 Hola Maria, lamento mucho tu pérdida...
```

### Save training pattern:
After I send, say: **"Save that pattern for fallecimiento responses"**

I store it in `TRAINING.md` and use it next time.

---

## 🔗 Integration with Your ManyChat Bridge

The CRM talks to your bridge at:
```
https://web-production-b08f3.up.railway.app/api/send/text
```

When you tell me to reply, I:
1. Send via bridge API
2. Log to database
3. Track in pipeline

---

## 📊 Database Schema

### Tables:
- **leads** - All prospects with current stage
- **messages** - Full conversation history with classification
- **stage_history** - Audit log of stage changes
- **training_memory** - Your response patterns

### Views:
- `v_pipeline` - Stage counts
- `v_recent_leads` - Recent activity
- `v_classification_stats` - Classification breakdown

---

## 📝 Example Session

```bash
$ npm run cli

🤖 ALA LEGAL - Fallecimientos CRM Training Mode

crm> check

📥 Checking inbox...

🔥 PRIORITY | 🆕 NEW LEAD | Stage: INBOUND
============================================================
👤 Maria Gonzalez
🆔 ID: 26132504589699601
💬 "Mi esposo falleció y tenía Infonavit"
🧠 Reason: Detected fallecimiento keyword: "falleció"
============================================================

💡 SUGGESTED RESPONSE:
   Lamento mucho tu pérdida. En ALA LEGAL nos especializamos...

💬 Your response (or press Enter to use suggested, "skip" to ignore):
   > Hola Maria, lamento mucho tu pérdida. ¿Podrías contarme si hay testamento?

📤 Sending...
✅ Sent and saved to training memory!

📋 Move to new stage? (suggested: qualified, or type other/n):
   > qualified
✅ Moved to QUALIFIED

crm> pipeline

📊 PIPELINE

  📥 INBOUND          : 1 leads
  ✅ QUALIFIED        : 1 leads
  📄 DOCUMENT PENDING : 0 leads
  📅 SET              : 0 leads
  📝 INTAKE FORM      : 0 leads

crm> exit
👋 Goodbye!
```

---

## 📱 Telegram Bot Example

When a fallecimiento comes in:

```
🔔🔔🔔 FALLECIMIENTO DETECTADO 🔔🔔🔔

🔥 PRIORITY
🆕 NUEVO LEAD | 📥 INBOUND

👤 Nombre: Maria Gonzalez
🆔 ID: `26132504589699601`
💬 Mensaje: "Mi esposo falleció y tenía Infonavit"

🧠 Razón: Detected fallecimiento keyword: "falleció"

💡 Respuesta sugerida:
Lamento mucho tu pérdida. En ALA LEGAL nos especializamos...

📌 Comandos:
• /reply_26132504589699601 [tu mensaje]
• /stage_26132504589699601 qualified
• /discard_26132504589699601
```

Tap to reply:
```
/reply_26132504589699601 Hola Maria, lamento mucho tu pérdida...
```

---

## 🎨 Your Training File

Edit `TRAINING.md` to define:
- Classification rules
- Response patterns by category
- Tone/voice guidelines
- Qualification criteria
- Escalation triggers

I read this file to learn your style.

---

## ⚡ Quick Commands

| What you want | CLI | Telegram |
|--------------|-----|----------|
| Check messages | `check` | `/check` |
| Quick reply | `reply [id] [msg]` | `/reply [id] [msg]` |
| Move stage | `stage [id] qualified` | `/stage [id] qualified` |
| View pipeline | `pipeline` | `/pipeline` |
| View lead | `lead [id]` | `/leads [stage]` |
| Discard | `stage [id] discarded` | `/discard [id]` |

---

## 🔒 Data Storage

Everything is local in:
- `alalegal.db` - SQLite/DuckDB database
- `TRAINING.md` - Your training rules
- `seen_messages.json` - Message tracking

No external database needed.

---

## 🚀 Recommended Setup

**For daily use:**
1. **Telegram bot** running 24/7 (Railway or local)
2. **Bridge** already deployed on Railway
3. **ManyChat** webhook configured

**Workflow:**
1. Lead messages on Facebook
2. **Telegram pings you** instantly
3. **You reply** from your phone
4. **I learn** your patterns
5. **Pipeline updates** automatically

---

Ready? Choose your interface:
- 💻 `npm run cli` (terminal)
- 📱 `npm run telegram` (mobile notifications)

🚀