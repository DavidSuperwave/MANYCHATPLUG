require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const path = require('path');

// Load CRM from parent directory
const ALALegalCRM = require('../crm');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://web-production-b08f3.up.railway.app';
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID; // Your personal chat ID
const CHECK_INTERVAL = 15000; // Check every 15 seconds

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set!');
    console.log('1. Talk to @BotFather on Telegram');
    console.log('2. Create a new bot');
    console.log('3. Copy the token');
    console.log('4. Set TELEGRAM_BOT_TOKEN in .env');
    process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const crm = new ALALegalCRM();

// Track processed messages
const processedMessages = new Set();

// Format classification with emoji
function formatClassification(cls) {
    const icons = {
        'priority': '🔥 PRIORITY',
        'engage': '👤 ENGAGE', 
        'neutral': '❓ NEUTRAL',
        'discard': '🗑️ DISCARD'
    };
    return icons[cls] || cls?.toUpperCase();
}

// Format stage with emoji
function formatStage(stage) {
    const icons = {
        'inbound': '📥 INBOUND',
        'qualified': '✅ QUALIFIED',
        'document_pending': '📄 DOCUMENT PENDING',
        'set': '📅 SET',
        'intake_form': '📝 INTAKE FORM',
        'closed_won': '💰 CLOSED WON',
        'closed_lost': '❌ CLOSED LOST',
        'discarded': '🗑️ DISCARDED'
    };
    return icons[stage] || stage?.toUpperCase();
}

// Check for new messages
async function checkNewMessages() {
    try {
        const response = await axios.get(`${BRIDGE_URL}/api/inbox`);
        const messages = response.data.messages || [];
        
        for (const msg of messages) {
            const messageId = `${msg.subscriber_id}_${msg.received_at}`;
            
            if (processedMessages.has(messageId)) continue;
            
            const text = msg.message?.text || '[media]';
            const name = msg.subscriber_name || 'Unknown';
            const id = msg.subscriber_id;
            
            // Classify the message
            const classification = crm.classifyMessage(text);
            
            // Create/update lead
            const lead = await crm.createOrUpdateLead(id, name, text, classification.classification);
            
            // Log message
            await crm.logMessage(id, 'inbound', text, classification.classification);
            
            // Mark as processed
            processedMessages.add(messageId);
            
            // Get suggested response
            const suggestion = crm.getSuggestedResponse(classification.classification);
            
            // Build notification message
            let notification = '';
            
            if (classification.classification === 'priority') {
                notification += `🔔🔔🔔 *FALLECIMIENTO DETECTADO* 🔔🔔🔔\n\n`;
            } else if (classification.classification === 'discard') {
                // Auto-discard, just log silently
                await crm.changeStage(id, 'discarded', 'ai', 'Auto-classified as discard');
                continue; // Don't notify for discards
            } else {
                notification += `🔔 *Nuevo mensaje de ManyChat*\n\n`;
            }
            
            notification += `*${formatClassification(classification.classification)}*\n`;
            notification += `${lead.isNew ? '🆕 NUEVO LEAD' : '📝 Existente'} | ${formatStage(lead.stage)}\n\n`;
            notification += `👤 *Nombre:* ${name}\n`;
            notification += `🆔 *ID:* \`${id}\`\n`;
            notification += `💬 *Mensaje:* "${text}"\n\n`;
            notification += `🧠 *Razón:* ${classification.reason}\n\n`;
            
            if (classification.action !== 'no_reply') {
                notification += `💡 *Respuesta sugerida:*\n`;
                notification += `${suggestion.es}\n\n`;
                notification += `📌 *Comandos:*\n`;
                notification += `• \/reply\_${id} [tu mensaje]\n`;
                notification += `• \/stage\_${id} [qualified/document\_pending/set/intake\_form]\n`;
                notification += `• \/discard\_${id} (marcar como no relevante)`;
            }
            
            // Send to admin
            if (ADMIN_CHAT_ID) {
                await bot.sendMessage(ADMIN_CHAT_ID, notification, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
            } else {
                // Broadcast to all chats that have interacted
                // (For now, we'll log that we need admin chat ID)
                console.log('⚠️  No ADMIN_CHAT_ID set. Message not sent to Telegram.');
            }
        }
        
    } catch (error) {
        console.error('Error checking messages:', error.message);
    }
}

// Command: /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId, 
        `🤖 *ALA LEGAL CRM Bot*\n\n` +
        `Bienvenido al canal de control del CRM.\n\n` +
        `*Comandos disponibles:*\n` +
        `• /check - Revisar mensajes nuevos\n` +
        `• /pipeline - Ver embudo de ventas\n` +
        `• /stats - Estadísticas de clasificación\n` +
        `• /leads [stage] - Ver leads por etapa\n` +
        `• /reply [id] [mensaje] - Responder a lead\n` +
        `• /stage [id] [etapa] - Mover etapa\n` +
        `• /help - Ayuda detallada\n\n` +
        `Tu chat ID: \`${chatId}\``,
        { parse_mode: 'Markdown' }
    );
});

// Command: /check
bot.onText(/\/check/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, '🔍 Revisando mensajes nuevos...');
    await checkNewMessages();
    await bot.sendMessage(chatId, '✅ Revisión completa');
});

// Command: /pipeline
bot.onText(/\/pipeline/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const stages = await crm.getPipeline();
        
        let response = '📊 *PIPELINE ALA LEGAL*\n\n';
        
        stages.forEach(row => {
            response += `${formatStage(row.stage)}: *${row.count}* leads\n`;
        });
        
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Command: /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const stats = await crm.getClassificationStats();
        
        let response = '📈 *ESTADÍSTICAS DE CLASIFICACIÓN*\n\n';
        
        stats.forEach(row => {
            response += `${formatClassification(row.classification)}: *${row.message_count}* mensajes\n`;
            response += `   📥 Entrantes: ${row.inbound}\n`;
            response += `   📤 Salientes: ${row.outbound}\n\n`;
        });
        
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Command: /leads [stage]
bot.onText(/\/leads(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const stage = match[1];
    
    try {
        if (!stage) {
            await bot.sendMessage(chatId, 
                '📋 *Ver leads por etapa*\n\n' +
                'Uso: /leads [etapa]\n\n' +
                'Etapas disponibles:\n' +
                '• inbound\n' +
                '• qualified\n' +
                '• document_pending\n' +
                '• set\n' +
                '• intake_form\n' +
                '• discarded',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        const leads = await crm.getLeadsByStage(stage);
        
        if (leads.length === 0) {
            await bot.sendMessage(chatId, `No hay leads en etapa *${stage}*`, { parse_mode: 'Markdown' });
            return;
        }
        
        let response = `📋 *Leads en ${stage.toUpperCase()}* (${leads.length})\n\n`;
        
        leads.slice(0, 10).forEach((lead, i) => {
            response += `${i + 1}. *${lead.subscriber_name || 'Unknown'}*\n`;
            response += `   🆔 \`${lead.subscriber_id}\`\n`;
            response += `   💬 ${lead.last_message?.substring(0, 50) || 'Sin mensaje'}...\n\n`;
        });
        
        if (leads.length > 10) {
            response += `... y ${leads.length - 10} más\n`;
        }
        
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Command: /reply [id] [message]
bot.onText(/\/reply\s+(\d+)\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const subscriberId = match[1];
    const message = match[2];
    
    try {
        await bot.sendMessage(chatId, `📤 Enviando mensaje a ${subscriberId}...`);
        
        await crm.sendMessage(subscriberId, message);
        
        // Save training
        const lead = await crm.getLead(subscriberId);
        if (lead) {
            await crm.saveTraining(
                lead.last_message,
                `Stage: ${lead.stage}`,
                message,
                'telegram_reply',
                lead.classification
            );
        }
        
        await bot.sendMessage(chatId, '✅ Mensaje enviado correctamente');
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error enviando mensaje: ${error.message}`);
    }
});

// Command: /stage [id] [new_stage]
bot.onText(/\/stage\s+(\d+)\s+(\w+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const subscriberId = match[1];
    const newStage = match[2];
    
    try {
        const result = await crm.changeStage(subscriberId, newStage, 'telegram', 'Manual move from Telegram');
        
        await bot.sendMessage(chatId, 
            `✅ Lead movido de etapa\n\n` +
            `🆔 ID: ${subscriberId}\n` +
            `📍 ${formatStage(result.oldStage)} → ${formatStage(result.newStage)}`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Command: /discard [id]
bot.onText(/\/discard\s+(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const subscriberId = match[1];
    
    try {
        await crm.changeStage(subscriberId, 'discarded', 'telegram', 'Marked as not relevant');
        await bot.sendMessage(chatId, `🗑️ Lead ${subscriberId} marcado como no relevante`);
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Quick reply buttons (reply_to_id pattern)
bot.onText(/\/reply_(\d+)\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const subscriberId = match[1];
    const message = match[2];
    
    try {
        await crm.sendMessage(subscriberId, message);
        await bot.sendMessage(chatId, `✅ Respuesta enviada a ${subscriberId}`);
        
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Command: /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId,
        `🤖 *ALA LEGAL CRM Bot - Ayuda*\n\n` +
        
        `*Sistema de Clasificación:*\n` +
        `🔥 PRIORITY - Fallecimiento detectado\n` +
        `👤 ENGAGE - Interesado en servicios\n` +
        `❓ NEUTRAL - Mensaje sin contexto\n` +
        `🗑️ DISCARD - No relevante\n\n` +
        
        `*Comandos:*\n` +
        `• /check - Revisar mensajes nuevos\n` +
        `• /pipeline - Embudo de ventas\n` +
        `• /stats - Estadísticas\n` +
        `• /leads [etapa] - Ver leads\n` +
        `• /reply [id] [mensaje] - Responder\n` +
        `• /stage [id] [etapa] - Mover etapa\n` +
        `• /discard [id] - Descartar lead\n\n` +
        
        `*Etapas disponibles:*\n` +
        `inbound → qualified → document_pending → set → intake_form → closed_won/lost\n\n` +
        
        `*Ejemplos:*\n` +
        '`/reply 123456 Hola, gracias por contactarnos`\n' +
        '`/stage 123456 qualified`\n' +
        '`/leads priority`',
        { parse_mode: 'Markdown' }
    );
});

// Handle errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Start polling for new messages
console.log('🤖 ALA LEGAL Telegram Bot starting...');
console.log(`📡 Bridge: ${BRIDGE_URL}`);
console.log(`⏱️  Checking every ${CHECK_INTERVAL/1000}s for new messages`);

// Initial check
checkNewMessages();

// Poll for new messages
setInterval(checkNewMessages, CHECK_INTERVAL);

console.log('✅ Bot is running. Press Ctrl+C to stop.');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Stopping bot...');
    crm.close();
    bot.stopPolling();
    process.exit(0);
});