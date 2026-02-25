const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://web-production-b08f3.up.railway.app';
const POLL_INTERVAL = 10000; // 10 seconds
const SEEN_MESSAGES_FILE = path.join(__dirname, 'seen_messages.json');

// Load seen messages
function loadSeenMessages() {
    try {
        if (fs.existsSync(SEEN_MESSAGES_FILE)) {
            return new Set(JSON.parse(fs.readFileSync(SEEN_MESSAGES_FILE, 'utf8')));
        }
    } catch (e) {}
    return new Set();
}

// Save seen messages
function saveSeenMessages(seen) {
    fs.writeFileSync(SEEN_MESSAGES_FILE, JSON.stringify([...seen], null, 2));
}

// Check inbox for new messages
async function checkInbox() {
    try {
        const response = await axios.get(`${BRIDGE_URL}/api/inbox`);
        const messages = response.data.messages || [];
        const seen = loadSeenMessages();
        
        const newMessages = messages.filter(msg => {
            const msgId = `${msg.subscriber_id}_${msg.received_at}`;
            return !seen.has(msgId);
        });
        
        if (newMessages.length > 0) {
            console.log('\n' + '='.repeat(60));
            console.log('🔔 NUEVOS MENSAJES DE MANYCHAT');
            console.log('='.repeat(60));
            
            newMessages.forEach(msg => {
                const msgId = `${msg.subscriber_id}_${msg.received_at}`;
                seen.add(msgId);
                
                console.log(`\n👤 ${msg.subscriber_name || 'Unknown'} (ID: ${msg.subscriber_id})`);
                console.log(`💬 "${msg.message?.text || '[media]'}"`);
                console.log(`⏰ ${new Date(msg.received_at).toLocaleString()}`);
                console.log(`\n📋 Para responder:`);
                console.log(`   "Reply to ${msg.subscriber_id}: [tu mensaje]"`);
                console.log(`   "Stage ${msg.subscriber_id} to qualified"`);
                console.log('');
            });
            
            console.log('='.repeat(60));
            console.log('💡 Comandos disponibles:');
            console.log('   • "Reply to [ID]: [mensaje]" - Responder al lead');
            console.log('   • "Stage [ID] to [stage]" - Mover de etapa');
            console.log('   • "Show pipeline" - Ver embudo');
            console.log('   • "Show lead [ID]" - Ver detalles del lead');
            console.log('='.repeat(60) + '\n');
        }
        
        saveSeenMessages(seen);
        return newMessages;
        
    } catch (error) {
        console.error('Error checking inbox:', error.message);
    }
}

// Start polling
console.log('🤖 ALA LEGAL CRM Monitor started');
console.log(`📡 Bridge: ${BRIDGE_URL}`);
console.log(`⏱️  Checking every ${POLL_INTERVAL/1000} seconds`);
console.log('');

// Initial check
checkInbox();

// Poll every 10 seconds
setInterval(checkInbox, POLL_INTERVAL);

// Keep alive
process.on('SIGINT', () => {
    console.log('\n👋 Monitor stopped');
    process.exit(0);
});