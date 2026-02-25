const axios = require('axios');
const ALALegalCRM = require('./crm');

// Bridge URL
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://web-production-b08f3.up.railway.app';

// Simple client for AI integration
class AICRMClient {
    constructor() {
        this.crm = new ALALegalCRM();
        this.lastCheckTime = null;
    }

    // Check inbox and return formatted results for AI
    async checkInbox(limit = 5) {
        try {
            const response = await axios.get(`${BRIDGE_URL}/api/inbox`);
            const messages = response.data.messages || [];
            
            if (messages.length === 0) {
                return { hasNew: false, message: "No hay mensajes nuevos en el inbox." };
            }

            const recent = messages.slice(-limit);
            const results = [];

            for (const msg of recent) {
                const text = msg.message?.text || '[media]';
                const name = msg.subscriber_name || 'Unknown';
                const id = msg.subscriber_id;
                
                // Classify
                const classification = this.crm.classifyMessage(text);
                
                // Create/update lead
                const lead = await this.crm.createOrUpdateLead(id, name, text, classification.classification);
                
                // Log message
                await this.crm.logMessage(id, 'inbound', text, classification.classification);
                
                results.push({
                    subscriberId: id,
                    name: name,
                    message: text,
                    classification: classification.classification,
                    classificationReason: classification.reason,
                    stage: lead.stage,
                    isNew: lead.isNew,
                    timestamp: msg.received_at
                });
            }

            return {
                hasNew: true,
                count: results.length,
                messages: results
            };

        } catch (error) {
            return { hasNew: false, error: error.message };
        }
    }

    // Send reply
    async sendReply(subscriberId, message) {
        try {
            await this.crm.sendMessage(subscriberId, message);
            
            // Get lead info for training context
            const lead = await this.crm.getLead(subscriberId);
            
            // Save training
            await this.crm.saveTraining(
                lead?.last_message || '',
                `Stage: ${lead?.stage || 'unknown'}`,
                message,
                'ai_response',
                lead?.classification
            );
            
            return { success: true, message: "Mensaje enviado correctamente" };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Move stage
    async moveStage(subscriberId, newStage, reason = '') {
        try {
            const result = await this.crm.changeStage(subscriberId, newStage, 'ai', reason);
            return { 
                success: true, 
                oldStage: result.oldStage,
                newStage: result.newStage
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get lead details
    async getLead(subscriberId) {
        return await this.crm.getLead(subscriberId);
    }

    // Get pipeline
    async getPipeline() {
        return await this.crm.getPipeline();
    }

    // Get conversation
    async getConversation(subscriberId) {
        return await this.crm.getConversation(subscriberId);
    }

    // Format message for display
    formatMessage(msg) {
        const icons = {
            'priority': '🔥',
            'engage': '👤',
            'neutral': '❓',
            'discard': '🗑️'
        };

        let output = '';
        output += `${icons[msg.classification] || '•'} **${msg.classification.toUpperCase()}** `;
        output += `| ${msg.isNew ? '🆕 NUEVO' : '📝 Existente'} `;
        output += `| Stage: ${msg.stage.toUpperCase()}\n\n`;
        output += `👤 **Nombre:** ${msg.name}\n`;
        output += `🆔 **ID:** ${msg.subscriberId}\n`;
        output += `💬 **Mensaje:** "${msg.message}"\n\n`;
        output += `🧠 **Clasificación:** ${msg.classificationReason}\n`;
        
        if (msg.classification !== 'discard') {
            const suggestion = this.crm.getSuggestedResponse(msg.classification);
            output += `\n💡 **Respuesta sugerida:**\n${suggestion.es}\n`;
        }
        
        return output;
    }

    close() {
        this.crm.close();
    }
}

module.exports = AICRMClient;