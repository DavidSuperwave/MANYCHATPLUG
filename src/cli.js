const fs = require('fs');
const path = require('path');
const axios = require('axios');

const INBOX_FILE = path.join(__dirname, '..', 'data', 'manychat-inbox.jsonl');
const BASE_URL = 'http://localhost:3000';

// Helper to read inbox
function readInbox() {
  if (!fs.existsSync(INBOX_FILE)) {
    return [];
  }
  const content = fs.readFileSync(INBOX_FILE, 'utf8');
  return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// Show recent messages
function showRecent(limit = 10) {
  const messages = readInbox();
  const recent = messages.slice(-limit);
  
  console.log(`\n📩 Last ${recent.length} messages:\n`);
  
  recent.forEach((msg, i) => {
    const event = msg.event || 'unknown';
    const data = msg.data || msg;
    const subscriber = data.subscriber_name || data.subscriber_id;
    const text = data.message?.text || '[media]';
    const time = new Date(msg.received_at || msg.timestamp).toLocaleTimeString();
    
    console.log(`${i + 1}. [${time}] ${subscriber}: "${text}"`);
    console.log(`   Subscriber ID: ${data.subscriber_id}`);
    console.log('');
  });
  
  return recent;
}

// Send response
async function sendResponse(subscriberId, text) {
  try {
    const res = await axios.post(`${BASE_URL}/api/send/text`, {
      subscriber_id: subscriberId,
      text
    });
    console.log('✅ Sent:', res.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// CLI
const command = process.argv[2];

switch (command) {
  case 'inbox':
    showRecent(process.argv[3] || 10);
    break;
    
  case 'send':
    const subscriberId = process.argv[3];
    const message = process.argv.slice(4).join(' ');
    if (!subscriberId || !message) {
      console.log('Usage: node cli.js send <subscriber_id> <message>');
      process.exit(1);
    }
    sendResponse(subscriberId, message);
    break;
    
  default:
    console.log(`
ALA LEGAL - Messenger CLI

Usage:
  node cli.js inbox [limit]     Show recent messages
  node cli.js send <id> <msg>   Send message to subscriber

Examples:
  node cli.js inbox 5
  node cli.js send 123456789 "Hola, gracias por contactarnos"
    `);
}