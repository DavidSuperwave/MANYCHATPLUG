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

### Option A: Interactive CLI (Recommended)
```bash
npm run cli
```

Commands:
- `check` - Check inbox and respond manually
- `pipeline` - View all stages
- `lead [id]` - View lead details
- `reply [id] [message]` - Quick reply
- `stage [id] [stage]` - Move lead stage

### Option B: Monitor Mode (Auto-notify)
```bash
npm run monitor
```

This polls every 10 seconds and prints new messages to terminal.

---

## 📋 Lead Stages

| Stage | Description |
|-------|-------------|
| **inbound** | New lead, first message |
| **qualified** | Has CURP, passed initial check |
| **set** | Appointment scheduled |
| **intake_form** | Client completed intake |
| **closed_won** | Became paying client |
| **closed_lost** | Unqualified or no conversion |

---

## 🎓 Training Me

### When a message arrives:

**I show you:**
```
🆕 NEW LEAD | Stage: INBOUND
👤 Christopher
🆔 ID: 26132504589699601
💬 "Saludos"
```

**You respond:**
> "Reply to 26132504589699601: Hola Christopher, gracias por contactar a ALA LEGAL. ¿En qué puedo ayudarte con tu crédito Infonavit?"

**Or tell me via CLI:**
```
crm> reply 26132504589699601 Hola Christopher, ¿en qué puedo ayudarte?
```

### Save training pattern:
After I send, say: **"Save that pattern for greetings"**

I store it in `TRAINING.md` and use it next time someone says "Hola".

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
- **messages** - Full conversation history
- **stage_history** - Audit log of stage changes
- **training_memory** - Your response patterns

### Views:
- `v_pipeline` - Stage counts
- `v_recent_leads` - Recent activity

---

## 📝 Example Session

```bash
$ npm run cli

🤖 ALA LEGAL - Manual CRM Training Mode

crm> check

📥 Checking inbox...

🆕 NEW LEAD | Stage: INBOUND
============================================================
👤 Christopher
🆔 ID: 26132504589699601
💬 "Necesito de sus servicios"
⏰ 2/24/2026, 6:46:17 PM
============================================================

💡 How should I respond? 
> Hola Christopher, soy el asistente de ALA LEGAL. Claro que podemos ayudarte con tu crédito Infonavit. ¿Me podrías compartir tu CURP para hacer una precalificación rápida?

📤 Sending...
✅ Sent and saved to training memory!

📋 Move to new stage? (qualified/set/intake_form/n): n
⏩ Staying in inbound

crm> pipeline

📊 PIPELINE

  INBOUND        : 1 leads
  QUALIFIED      : 0 leads
  SET            : 0 leads
  INTAKE_FORM    : 0 leads

crm> exit
👋 Goodbye!
```

---

## 🎨 Your Training File

Edit `TRAINING.md` to define:
- Response patterns
- Tone/voice guidelines
- Qualification criteria
- Escalation triggers

I read this file to learn your style.

---

## ⚡ Quick Commands

| What you want | What to type |
|--------------|--------------|
| Check messages | `npm run cli` → `check` |
| Quick reply | `reply [id] [message]` |
| Move stage | `stage [id] qualified` |
| View pipeline | `pipeline` |
| View lead | `lead [id]` |

---

## 🔒 Data Storage

Everything is local in:
- `alalegal.db` - SQLite/DuckDB database
- `TRAINING.md` - Your training rules
- `seen_messages.json` - Message tracking

No external database needed.

---

Ready? Run `npm run cli` and let's train me! 🚀