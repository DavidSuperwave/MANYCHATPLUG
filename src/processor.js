class MessageProcessor {
  constructor(memory, manychatClient) {
    this.memory = memory;
    this.manychat = manychatClient;
  }

  // Simple intent detection - expand this based on your needs
  detectIntent(text) {
    const lowerText = text.toLowerCase();
    
    if (/hola|buenos|saludos|hey/i.test(lowerText)) return 'greeting';
    if (/precio|costo|cuanto|cuesta|barato|caro/i.test(lowerText)) return 'pricing';
    if (/ayuda|ayudar|soporte|problema|error/i.test(lowerText)) return 'support';
    if (/comprar|ordenar|pedir|producto/i.test(lowerText)) return 'purchase';
    if (/horario|abierto|cerrado|hora/i.test(lowerText)) return 'hours';
    if (/gracias|agradezco|thanks/i.test(lowerText)) return 'thanks';
    if (/adios|chao|hasta luego|bye/i.test(lowerText)) return 'goodbye';
    
    return 'general';
  }

  // Generate response based on intent and context
  async generateResponse(messageText, subscriberId, history = []) {
    const intent = this.detectIntent(messageText);
    const userContext = await this.memory.getUserContext(subscriberId);
    
    // Build context-aware response
    let response = '';
    
    switch (intent) {
      case 'greeting':
        if (userContext && userContext.total_messages > 1) {
          response = '¡Hola de nuevo! 👋 ¿En qué puedo ayudarte hoy?';
        } else {
          response = '¡Hola! 👋 Bienvenido. Soy tu asistente virtual. ¿En qué puedo ayudarte?';
        }
        break;
        
      case 'pricing':
        response = 'Para darte información sobre precios, necesito saber un poco más sobre lo que buscas. ¿Podrías contarme qué producto o servicio te interesa?';
        break;
        
      case 'support':
        response = 'Entiendo que necesitas ayuda. Voy a conectarte con un agente humano que podrá asistirte mejor. Por favor, describe tu problema brevemente.';
        break;
        
      case 'purchase':
        response = '¡Excelente elección! 🛒 Para ayudarte con tu compra, ¿podrías decirme qué producto te interesa?';
        break;
        
      case 'hours':
        response = 'Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00 hrs. ¿Hay algo más en lo que pueda ayudarte?';
        break;
        
      case 'thanks':
        response = '¡De nada! 😊 Estoy aquí para lo que necesites. ¿Hay algo más en lo que pueda ayudarte?';
        break;
        
      case 'goodbye':
        response = '¡Hasta luego! 👋 Que tengas un excelente día. ¡Vuelve pronto!';
        break;
        
      default:
        response = 'Entiendo. ¿Podrías darme más detalles para poder ayudarte mejor?';
    }

    return {
      text: response,
      intent,
      context: {
        messageCount: userContext ? userContext.total_messages + 1 : 1,
        previousIntent: history.length > 0 ? history[history.length - 1].intent : null
      }
    };
  }

  async processIncomingMessage(webhookData) {
    const { subscriber_id, message_text, channel = 'messenger' } = webhookData;
    
    console.log(`📩 Mensaje recibido de ${subscriber_id}: "${message_text}"`);
    
    // Get conversation history for context
    const history = await this.memory.getConversationHistory(subscriber_id, 5);
    
    // Generate AI response
    const response = await this.generateResponse(message_text, subscriber_id, history);
    
    // Save incoming message
    await this.memory.saveMessage(
      subscriber_id,
      'incoming',
      message_text,
      null,
      { intent: response.intent }
    );
    
    // Send response via ManyChat
    try {
      await this.manychat.sendTextMessage(subscriber_id, response.text);
      console.log(`📤 Respuesta enviada a ${subscriber_id}: "${response.text}"`);
      
      // Save outgoing message
      await this.memory.saveMessage(
        subscriber_id,
        'outgoing',
        response.text,
        response.text,
        response.context
      );
      
      return { success: true, response: response.text };
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  }

  // Process incoming voice/audio messages
  async processIncomingVoice(webhookData) {
    const { subscriber_id, audio_url, audio_duration, channel = 'messenger' } = webhookData;
    
    console.log(`🎤 Audio recibido de ${subscriber_id}: ${audio_duration}s`);
    console.log(`   URL: ${audio_url}`);
    
    // Save voice message to memory
    await this.memory.saveMessage(
      subscriber_id,
      'incoming',
      `[🎤 Audio: ${audio_duration}s]`,
      null,
      { 
        type: 'voice',
        audio_url,
        duration: audio_duration,
        channel
      }
    );

    // For voice processing, you have 2 options:
    
    // OPTION 1: Ask user to send text (current behavior)
    const responseText = 'Recibí tu mensaje de voz 🎤. Por ahora solo puedo procesar mensajes de texto. ¿Podrías escribirme tu consulta?';
    
    // OPTION 2: Transcribe with Whisper (requires OpenAI API)
    // const transcript = await this.transcribeAudio(audio_url);
    // const response = await this.generateResponse(transcript, subscriber_id);
    // const responseText = response.text;
    
    try {
      await this.manychat.sendTextMessage(subscriber_id, responseText);
      console.log(`📤 Respuesta enviada a ${subscriber_id}: "${responseText}"`);
      
      await this.memory.saveMessage(
        subscriber_id,
        'outgoing',
        responseText,
        responseText,
        { type: 'voice_response' }
      );
      
      return { success: true, response: responseText };
    } catch (error) {
      console.error('Error enviando respuesta a audio:', error);
      throw error;
    }
  }

  // Optional: Transcribe audio using OpenAI Whisper
  // async transcribeAudio(audioUrl) {
  //   const { OpenAI } = require('openai');
  //   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  //   
  //   // Download audio and transcribe
  //   const response = await fetch(audioUrl);
  //   const audioBuffer = await response.arrayBuffer();
  //   
  //   const transcription = await openai.audio.transcriptions.create({
  //     file: audioBuffer,
  //     model: 'whisper-1',
  //     language: 'es'
  //   });
  //   
  //   return transcription.text;
  // }

  // Send voice message back to user (TTS)
  async sendVoiceResponse(subscriberId, text) {
    // To send voice, you need to:
    // 1. Generate TTS audio (ElevenLabs, OpenAI, etc.)
    // 2. Upload to CDN/storage
    // 3. Send URL via ManyChat
    
    // Placeholder: For now, send text
    console.log('Nota: Para enviar audio, integra TTS (ElevenLabs/OpenAI) + CDN');
    return await this.manychat.sendTextMessage(subscriberId, text);
  }
}

module.exports = MessageProcessor;