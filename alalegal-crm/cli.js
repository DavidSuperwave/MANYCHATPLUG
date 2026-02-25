const ALALegalCRM = require('./crm');
const axios = require('axios');
const readline = require('readline');

const BRIDGE_URL = 'https://web-production-b08f3.up.railway.app';
const crm = new ALALegalCRM();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper to ask questions
function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

// Check inbox manually
async function checkInbox() {
    console.log('\n📥 Checking inbox...\n');
    
    try {
        const response = await axios.get(`${BRIDGE_URL}/api/inbox`);
        const messages = response.data.messages || [];
        
        if (messages.length === 0) {
            console.log('No messages yet.');
            return;
        }
        
        // Show last 5 messages
        const recent = messages.slice(-5);
        
        for (const msg of recent) {
            const text = msg.message?.text || '[media]';
            const name = msg.subscriber_name || 'Unknown';
            const id = msg.subscriber_id;
            
            // Create/update lead in CRM
            const lead = await crm.createOrUpdateLead(id, name, text);
            
            // Log inbound message
            await crm.logMessage(id, 'inbound', text);
            
            // Determine if new or existing
            const status = lead.isNew ? '🆕 NEW LEAD' : '📝 Existing';
            const stage = lead.stage;
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`${status} | Stage: ${stage.toUpperCase()}`);
            console.log(`${'='.repeat(60)}`);
            console.log(`👤 ${name}`);
            console.log(`🆔 ID: ${id}`);
            console.log(`💬 "${text}"`);
            console.log(`⏰ ${new Date(msg.received_at).toLocaleString()}`);
            console.log(`${'='.repeat(60)}\n`);
            
            // Training mode - ask for response
            const response = await ask('💡 How should I respond? (or press Enter to skip): ');
            
            if (response.trim()) {
                // Send the message
                console.log('📤 Sending...');
                await crm.sendMessage(id, response.trim());
                
                // Save training
                await crm.saveTraining(text, `Stage: ${stage}`, response.trim(), 'manual_training');
                console.log('✅ Sent and saved to training memory!\n');
                
                // Ask about stage movement
                const moveStage = await ask('📋 Move to new stage? (qualified/set/intake_form/n): ');
                if (moveStage !== 'n' && moveStage.trim()) {
                    await crm.changeStage(id, moveStage.trim(), 'human', 'Manual qualification');
                    console.log(`✅ Moved to ${moveStage}\n`);
                }
            } else {
                console.log('⏩ Skipped\n');
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Show pipeline
async function showPipeline() {
    console.log('\n📊 PIPELINE\n');
    const stages = await crm.getPipeline();
    
    stages.forEach(row => {
        console.log(`  ${row.stage.toUpperCase().padEnd(15)}: ${row.count} leads`);
    });
    console.log('');
}

// Show lead details
async function showLead(subscriberId) {
    const lead = await crm.getLead(subscriberId);
    if (!lead) {
        console.log('Lead not found.');
        return;
    }
    
    console.log(`\n👤 ${lead.subscriber_name || 'Unknown'}`);
    console.log(`🆔 ID: ${lead.subscriber_id}`);
    console.log(`📍 Stage: ${lead.stage}`);
    console.log(`📅 Created: ${lead.created_at}`);
    console.log(`💬 Last message: ${lead.last_message || 'None'}`);
    console.log('');
    
    // Show conversation
    const convo = await crm.getConversation(subscriberId, 10);
    if (convo.length > 0) {
        console.log('🗨️  Recent conversation:');
        convo.forEach(msg => {
            const dir = msg.direction === 'inbound' ? '👤' : '🤖';
            console.log(`   ${dir} ${msg.message_text}`);
        });
        console.log('');
    }
}

// Main menu
async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🤖 ALA LEGAL - Manual CRM Training Mode           ║
╚═══════════════════════════════════════════════════════════╝

Commands:
  1. check     - Check inbox for new messages
  2. pipeline  - View pipeline stages
  3. lead [id] - View lead details
  4. reply [id] [msg] - Quick reply to lead
  5. stage [id] [stage] - Move lead to stage
  6. exit      - Quit

Stages: inbound → qualified → set → intake_form → closed_won/lost
`);

    while (true) {
        const command = await ask('crm> ');
        const parts = command.trim().split(' ');
        const cmd = parts[0];
        
        switch (cmd) {
            case '1':
            case 'check':
                await checkInbox();
                break;
                
            case '2':
            case 'pipeline':
                await showPipeline();
                break;
                
            case '3':
            case 'lead':
                if (parts[1]) {
                    await showLead(parts[1]);
                } else {
                    console.log('Usage: lead [subscriber_id]');
                }
                break;
                
            case '4':
            case 'reply':
                if (parts.length >= 3) {
                    const id = parts[1];
                    const msg = parts.slice(2).join(' ');
                    await crm.sendMessage(id, msg);
                    console.log('✅ Sent!');
                } else {
                    console.log('Usage: reply [id] [message]');
                }
                break;
                
            case '5':
            case 'stage':
                if (parts.length >= 3) {
                    const id = parts[1];
                    const stage = parts[2];
                    await crm.changeStage(id, stage, 'human', 'Manual move');
                    console.log(`✅ Moved to ${stage}`);
                } else {
                    console.log('Usage: stage [id] [new_stage]');
                }
                break;
                
            case '6':
            case 'exit':
            case 'quit':
                console.log('👋 Goodbye!');
                crm.close();
                rl.close();
                process.exit(0);
                
            default:
                if (cmd) {
                    console.log('Unknown command. Type a number (1-6) or command name.');
                }
        }
    }
}

main().catch(console.error);