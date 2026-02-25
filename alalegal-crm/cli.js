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

// Format classification for display
function formatClassification(classification) {
    const icons = {
        'priority': '🔥 PRIORITY',
        'engage': '👤 ENGAGE',
        'neutral': '❓ NEUTRAL',
        'discard': '🗑️ DISCARD'
    };
    return icons[classification] || classification?.toUpperCase();
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
            
            // Classify the message
            const classification = crm.classifyMessage(text);
            
            // Create/update lead in CRM with classification
            const lead = await crm.createOrUpdateLead(id, name, text, classification.classification);
            
            // Log inbound message with classification
            await crm.logMessage(id, 'inbound', text, classification.classification);
            
            // Determine if new or existing
            const status = lead.isNew ? '🆕 NEW LEAD' : '📝 Existing';
            const stage = lead.stage;
            
            // Show classification banner
            console.log(`\n${'='.repeat(70)}`);
            console.log(`${formatClassification(classification.classification)} | ${status} | Stage: ${stage.toUpperCase()}`);
            console.log(`${'='.repeat(70)}`);
            console.log(`👤 ${name}`);
            console.log(`🆔 ID: ${id}`);
            console.log(`💬 "${text}"`);
            console.log(`🧠 Reason: ${classification.reason}`);
            console.log(`⏰ ${new Date(msg.received_at || Date.now()).toLocaleString()}`);
            console.log(`${'='.repeat(70)}\n`);
            
            // Get suggested response
            const suggestion = crm.getSuggestedResponse(classification.classification);
            
            if (classification.action === 'no_reply') {
                console.log('🗑️  CLASSIFIED AS DISCARD - No reply needed.');
                console.log('   (Logged to CRM but will not engage)\n');
                
                // Auto-move to discarded stage
                if (stage !== 'discarded') {
                    await crm.changeStage(id, 'discarded', 'ai', 'Auto-classified as discard');
                    console.log('✅ Auto-moved to DISCARDED stage\n');
                }
                continue; // Skip to next message
            }
            
            // Show suggested response
            console.log('💡 SUGGESTED RESPONSE:');
            console.log(`   ${suggestion.es}`);
            console.log(`   (Classification: ${suggestion.en})\n`);
            
            // Training mode - ask for response
            const userResponse = await ask('💬 Your response (or press Enter to use suggested, "skip" to ignore): ');
            
            let finalResponse = userResponse.trim();
            
            if (finalResponse.toLowerCase() === 'skip') {
                console.log('⏩ Skipped\n');
                continue;
            }
            
            if (!finalResponse) {
                // Use suggested response
                finalResponse = suggestion.es;
                console.log(`✅ Using suggested response...\n`);
            }
            
            // Send the message
            console.log('📤 Sending...');
            await crm.sendMessage(id, finalResponse);
            
            // Save training
            await crm.saveTraining(
                text, 
                `Stage: ${stage}, Classification: ${classification.classification}`, 
                finalResponse, 
                'manual_training',
                classification.classification
            );
            console.log('✅ Sent and saved to training memory!\n');
            
            // Ask about stage movement based on classification
            let suggestedStage = null;
            if (classification.classification === 'priority') {
                suggestedStage = 'qualified';
                console.log('🔥 This is a PRIORITY (fallecimiento) case.');
            }
            
            const stagePrompt = suggestedStage 
                ? `📋 Move to new stage? (suggested: ${suggestedStage}, or type other/n): `
                : '📋 Move to new stage? (qualified/document_pending/set/n): ';
            
            const moveStage = await ask(stagePrompt);
            
            if (moveStage.toLowerCase() !== 'n' && moveStage.trim()) {
                const targetStage = moveStage === 's' ? suggestedStage : moveStage.trim();
                if (targetStage) {
                    await crm.changeStage(id, targetStage, 'human', `Manual move after ${classification.classification} classification`);
                    console.log(`✅ Moved to ${targetStage.toUpperCase()}\n`);
                }
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
        const icon = {
            'inbound': '📥',
            'qualified': '✅',
            'document_pending': '📄',
            'set': '📅',
            'intake_form': '📝',
            'closed_won': '💰',
            'closed_lost': '❌',
            'discarded': '🗑️'
        }[row.stage] || '•';
        
        console.log(`  ${icon} ${row.stage.toUpperCase().padEnd(18)}: ${row.count} leads`);
    });
    console.log('');
}

// Show classification stats
async function showClassificationStats() {
    console.log('\n📈 CLASSIFICATION STATS\n');
    const stats = await crm.getClassificationStats();
    
    stats.forEach(row => {
        const icon = {
            'priority': '🔥',
            'engage': '👤',
            'neutral': '❓',
            'discard': '🗑️'
        }[row.classification] || '•';
        
        console.log(`  ${icon} ${row.classification.toUpperCase().padEnd(12)}: ${row.message_count} messages (${row.inbound} in, ${row.outbound} out)`);
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
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👤 ${lead.subscriber_name || 'Unknown'}`);
    console.log(`🆔 ID: ${lead.subscriber_id}`);
    console.log(`📍 Stage: ${lead.stage?.toUpperCase()}`);
    console.log(`🏷️  Classification: ${formatClassification(lead.classification)}`);
    console.log(`📅 Created: ${new Date(lead.created_at).toLocaleDateString()}`);
    console.log(`💬 Last message: ${lead.last_message || 'None'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Show conversation
    const convo = await crm.getConversation(subscriberId, 10);
    if (convo.length > 0) {
        console.log('🗨️  Recent conversation:');
        convo.forEach(msg => {
            const dir = msg.direction === 'inbound' ? '👤' : '🤖';
            const cls = msg.classification ? `(${msg.classification})` : '';
            console.log(`   ${dir} ${msg.message_text} ${cls}`);
        });
        console.log('');
    }
}

// Main menu
async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     🤖 ALA LEGAL - Fallecimientos CRM Training Mode       ║
║              (Manual Classification System)               ║
╠═══════════════════════════════════════════════════════════╣
║  Specialty: Fallecimientos con crédito Infonavit          ║
║  Mission: Filter for death-related cases only             ║
╚═══════════════════════════════════════════════════════════╝

Classification System:
  🔥 PRIORITY  = Fallecimiento mentioned → Reply immediately
  👤 ENGAGE    = Service inquiry → Probe for fallecimiento
  ❓ NEUTRAL   = Unclear → Ask qualifying question
  🗑️ DISCARD   = Compliments/spam → No reply

Commands:
  1. check      - Check inbox & classify new messages
  2. pipeline   - View pipeline stages
  3. stats      - View classification statistics
  4. lead [id]  - View lead details
  5. reply [id] [msg] - Quick reply to lead
  6. stage [id] [stage] - Move lead to stage
  7. exit       - Quit

Stages: inbound → qualified → document_pending → set → intake_form → closed
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
            case 'stats':
                await showClassificationStats();
                break;
                
            case '4':
            case 'lead':
                if (parts[1]) {
                    await showLead(parts[1]);
                } else {
                    console.log('Usage: lead [subscriber_id]');
                }
                break;
                
            case '5':
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
                
            case '6':
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
                
            case '7':
            case 'exit':
            case 'quit':
                console.log('👋 Goodbye!');
                crm.close();
                rl.close();
                process.exit(0);
                
            default:
                if (cmd) {
                    console.log('Unknown command. Type a number (1-7) or command name.');
                }
        }
    }
}

main().catch(console.error);