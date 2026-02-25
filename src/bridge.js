const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INBOX_FILE = path.join(DATA_DIR, 'manychat-inbox.jsonl');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.jsonl');

const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;
const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://api.manychat.com';

// Headers for ManyChat API
const headers = {
  'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
  'Content-Type': 'application/json'
};

// ============================================
// MANYCHAT API CLIENT
// ============================================

class ManyChatAPI {
  // Get subscriber info including last interaction
  async getSubscriber(subscriberId) {
    try {
      const res = await axios.post(
        `${BASE_URL}/fb/subscriber/getInfo`,
        { subscriber_id: subscriberId },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error getting subscriber:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send text message
  async sendText(subscriberId, text) {
    try {
      const res = await axios.post(
        `${BASE_URL}/fb/sending/sendContent`,
        {
          subscriber_id: subscriberId,
          message: {
            type: 'text',
            text
          }
        },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error sending text:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send image
  async sendImage(subscriberId, imageUrl, caption = '') {
    try {
      const res = await axios.post(
        `${BASE_URL}/fb/sending/sendContent`,
        {
          subscriber_id: subscriberId,
          message: {
            type: 'image',
            url: imageUrl,
            caption
          }
        },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error sending image:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send audio/voice message
  async sendAudio(subscriberId, audioUrl) {
    try {
      const res = await axios.post(
        `${BASE_URL}/fb/sending/sendContent`,
        {
          subscriber_id: subscriberId,
          message: {
            attachment: {
              type: 'audio',
              payload: {
                url: audioUrl
              }
            }
          }
        },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error sending audio:', error.response?.data || error.message);
      throw error;
    }
  }

  // Trigger a flow
  async sendFlow(subscriberId, flowNs) {
    try {
      const res = await axios.post(
        `${BASE_URL}/fb/sending/sendFlow`,
        {
          subscriber_id: subscriberId,
          flow_ns: flowNs
        },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error sending flow:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get page info
  async getPageInfo() {
    try {
      const res = await axios.get(
        `${BASE_URL}/fb/page/getInfo`,
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('Error getting page info:', error.response?.data || error.message);
      throw error;
    }
  }
}

const manychat = new ManyChatAPI();

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bridge: 'ALA LEGAL - ManyChat Bridge',
    timestamp: new Date().toISOString()
  });
});

// Main webhook - receives from ManyChat
app.post('/api/webhooks/manychat', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('📩 Webhook received:', { 
      event, 
      timestamp: new Date().toISOString() 
    });
    
    // Acknowledge immediately (ManyChat needs fast response)
    res.status(200).json({ received: true, bridge: 'alalegal' });
    
    // Store the event
    const logEntry = {
      ...req.body,
      received_at: new Date().toISOString()
    };
    
    fs.appendFileSync(INBOX_FILE, JSON.stringify(logEntry) + '\n');
    
    // Handle specific events
    if (event === 'message.received' || event === 'message_received') {
      const { subscriber_id, subscriber_name, message } = data || req.body;
      console.log(`💬 Message from ${subscriber_name || subscriber_id}: "${message?.text || '[media]'}"`);
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    // Already sent 200, just log
  }
});

// ============================================
// AGENT RESPONSE ENDPOINTS
// ============================================

// Send text response to subscriber
app.post('/api/send/text', async (req, res) => {
  try {
    const { subscriber_id, text } = req.body;
    
    if (!subscriber_id || !text) {
      return res.status(400).json({ error: 'subscriber_id and text required' });
    }
    
    const result = await manychat.sendText(subscriber_id, text);
    
    // Log response
    fs.appendFileSync(RESPONSES_FILE, JSON.stringify({
      type: 'text',
      subscriber_id,
      text,
      sent_at: new Date().toISOString()
    }) + '\n');
    
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send image response
app.post('/api/send/image', async (req, res) => {
  try {
    const { subscriber_id, image_url, caption } = req.body;
    
    if (!subscriber_id || !image_url) {
      return res.status(400).json({ error: 'subscriber_id and image_url required' });
    }
    
    const result = await manychat.sendImage(subscriber_id, image_url, caption);
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('Send image error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send audio response
app.post('/api/send/audio', async (req, res) => {
  try {
    const { subscriber_id, audio_url } = req.body;
    
    if (!subscriber_id || !audio_url) {
      return res.status(400).json({ error: 'subscriber_id and audio_url required' });
    }
    
    const result = await manychat.sendAudio(subscriber_id, audio_url);
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('Send audio error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger a flow
app.post('/api/send/flow', async (req, res) => {
  try {
    const { subscriber_id, flow_ns } = req.body;
    
    if (!subscriber_id || !flow_ns) {
      return res.status(400).json({ error: 'subscriber_id and flow_ns required' });
    }
    
    const result = await manychat.sendFlow(subscriber_id, flow_ns);
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('Send flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INBOX / MESSAGE RETRIEVAL
// ============================================

// Get all messages from inbox
app.get('/api/inbox', (req, res) => {
  try {
    if (!fs.existsSync(INBOX_FILE)) {
      return res.json({ messages: [] });
    }
    
    const content = fs.readFileSync(INBOX_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const messages = lines.slice(-100).map(line => JSON.parse(line)); // Last 100
    
    res.json({ 
      count: messages.length,
      messages 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for specific subscriber
app.get('/api/inbox/:subscriberId', (req, res) => {
  try {
    const subscriberId = req.params.subscriberId;
    
    if (!fs.existsSync(INBOX_FILE)) {
      return res.json({ subscriber_id: subscriberId, messages: [] });
    }
    
    const content = fs.readFileSync(INBOX_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    const messages = lines
      .map(line => JSON.parse(line))
      .filter(msg => {
        const id = msg.data?.subscriber_id || msg.subscriber_id;
        return id === subscriberId || id === parseInt(subscriberId);
      });
    
    res.json({ 
      subscriber_id: subscriberId,
      count: messages.length,
      messages 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subscriber info
app.get('/api/subscriber/:subscriberId', async (req, res) => {
  try {
    const subscriberId = parseInt(req.params.subscriberId);
    const info = await manychat.getSubscriber(subscriberId);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear inbox
app.post('/api/inbox/clear', (req, res) => {
  try {
    fs.writeFileSync(INBOX_FILE, '');
    res.json({ cleared: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAGE INFO
// ============================================

app.get('/api/page', async (req, res) => {
  try {
    const info = await manychat.getPageInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         ALA LEGAL - ManyChat Bridge                        ║
╠═══════════════════════════════════════════════════════════╣
║  Status: Running on port ${PORT}                            ║
╠═══════════════════════════════════════════════════════════╣
║  ENDPOINTS:                                               ║
║                                                           ║
║  📥 RECEIVE (Configure in ManyChat):                      ║
║     POST /api/webhooks/manychat                           ║
║                                                           ║
║  📤 SEND (You use these to respond):                      ║
║     POST /api/send/text      {subscriber_id, text}        ║
║     POST /api/send/image     {subscriber_id, image_url}   ║
║     POST /api/send/audio     {subscriber_id, audio_url}   ║
║     POST /api/send/flow      {subscriber_id, flow_ns}     ║
║                                                           ║
║  📋 INBOX (View messages):                                ║
║     GET  /api/inbox              (All messages)           ║
║     GET  /api/inbox/:id          (Specific user)          ║
║                                                           ║
║  ℹ️  INFO:                                                 ║
║     GET  /api/health             (Health check)           ║
║     GET  /api/page               (Page info)              ║
║     GET  /api/subscriber/:id     (User info)              ║
╚═══════════════════════════════════════════════════════════╝
  `);
});