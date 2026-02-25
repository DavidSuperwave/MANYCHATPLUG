require('dotenv').config();
const express = require('express');
const ManyChatClient = require('./manychat');
const ConversationMemory = require('./memory');
const MessageProcessor = require('./processor');

const app = express();
app.use(express.json());

// Initialize services
const memory = new ConversationMemory('./data/conversations.db');
const manychat = new ManyChatClient(process.env.MANYCHAT_API_KEY);
const processor = new MessageProcessor(memory, manychat);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ManyChat webhook endpoint
app.post('/api/webhooks/manychat', async (req, res) => {
  try {
    const { event, subscriber_id, message_text, channel, message } = req.body;
    
    console.log('Webhook recibido:', { event, subscriber_id, channel, hasAudio: !!message?.audio });
    
    // Acknowledge immediately (ManyChat needs fast response)
    res.status(200).json({ received: true });
    
    // Process based on event type
    if (event === 'message_received') {
      // Handle voice/audio messages
      if (message?.audio) {
        await processor.processIncomingVoice({
          subscriber_id,
          audio_url: message.audio.url,
          audio_duration: message.audio.duration,
          channel
        });
      }
      // Handle text messages
      else if (message_text) {
        await processor.processIncomingMessage({
          subscriber_id,
          message_text,
          channel
        });
      }
    }
    
  } catch (error) {
    console.error('Error procesando webhook:', error);
    // Already sent 200, log error
  }
});

// Get conversation history (for admin/debug)
app.get('/api/conversations/:subscriberId', async (req, res) => {
  try {
    const history = await memory.getConversationHistory(req.params.subscriberId, 50);
    res.json({ subscriber_id: req.params.subscriberId, messages: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats (for admin/debug)
app.get('/api/users/:subscriberId/stats', async (req, res) => {
  try {
    const context = await memory.getUserContext(req.params.subscriberId);
    const intents = await memory.getCommonIntents(req.params.subscriberId);
    res.json({ subscriber_id: req.params.subscriberId, context, intents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual send text (for testing)
app.post('/api/send', async (req, res) => {
  try {
    const { subscriber_id, message } = req.body;
    const result = await manychat.sendTextMessage(subscriber_id, message);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual send audio (for testing)
app.post('/api/send-audio', async (req, res) => {
  try {
    const { subscriber_id, audio_url } = req.body;
    const result = await manychat.sendAudioMessage(subscriber_id, audio_url);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  memory.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor webhook corriendo en puerto ${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/api/webhooks/manychat`);
});