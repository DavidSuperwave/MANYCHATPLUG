const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

class ManyChatClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.manychat.com';
  }

  async sendTextMessage(subscriberId, text) {
    try {
      const response = await axios.post(
        `${this.baseURL}/fb/sending/sendMessage`,
        {
          subscriber_id: subscriberId,
          message: { text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('ManyChat API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send audio/voice message from URL
  async sendAudioMessage(subscriberId, audioUrl) {
    try {
      const response = await axios.post(
        `${this.baseURL}/fb/sending/sendContent`,
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
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('ManyChat Audio API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Upload and send audio file
  async uploadAndSendAudio(subscriberId, filePath) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      
      // First upload the file to get URL
      const uploadResponse = await axios.post(
        `${this.baseURL}/fb/sending/uploadFile`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      const fileUrl = uploadResponse.data.data?.url;
      if (!fileUrl) {
        throw new Error('No se pudo obtener URL del archivo subido');
      }
      
      // Then send as audio
      return await this.sendAudioMessage(subscriberId, fileUrl);
    } catch (error) {
      console.error('ManyChat Upload Audio Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSubscriberInfo(subscriberId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/fb/subscriber/getInfo`,
        { subscriber_id: subscriberId },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('ManyChat API Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = ManyChatClient;