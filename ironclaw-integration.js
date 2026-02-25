// Ironclaw Integration for ALA LEGAL CRM
// This module allows the AI (me) to interact with the local CRM

const LocalCRM = require('./crm');

class IronclawCRMIntegration {
    constructor() {
        this.crm = new LocalCRM();
    }

    // Format lead for display
    formatLead(lead) {
        const icons = {
            'priority': '🔥',
            'engage': '👤',
            'neutral': '❓',
            'discard': '🗑️'
        };
        
        const stageIcons = {
            'inbound': '📥',
            'qualified': '✅',
            'document_pending': '📄',
            'set': '📅',
            'intake_form': '📝',
            'closed_won': '💰',
            'closed_lost': '❌',
            'discarded': '🗑️'
        };

        return {
            icon: icons[lead.classification] || '•',
            stageIcon: stageIcons[lead.stage] || '•',
            display: `${icons[lead.classification] || '•'} **${lead.classification?.toUpperCase()}** | ${stageIcons[lead.stage] || '•'} ${lead.stage?.toUpperCase()}\n` +
                    `👤 **${lead.subscriber_name || 'Unknown'}** (ID: \`${lead.subscriber_id}\`)\n` +
                    `💬 "${lead.last_message?.substring(0, 100)}${lead.last_message?.length > 100 ? '...' : ''}"\n` +
                    `📅 Último contacto: ${lead.last_message_at ? new Date(lead.last_message_at).toLocaleString() : 'Nunca'}`
        };
    }

    // Check inbox and return formatted for AI
    async checkAndProcessInbox() {
        const messages = await this.crm.checkInbox();
        
        if (messages.length === 0) {
            return {
                hasMessages: false,
                summary: "No hay mensajes nuevos en el inbox.",
                leads: []
            };
        }

        const results = [];
        const processedIds = new Set();

        for (const msg of messages.slice(-10)) { // Last 10
            const id = msg.subscriber_id;
            
            if (processedIds.has(id)) continue;
            processedIds.add(id);

            const text = msg.message?.text || '[media]';
            const name = msg.subscriber_name || 'Unknown';
            
            // Classify
            const classification = this.crm.classifyMessage(text);
            
            // Create/update lead
            const lead = await this.crm.createOrUpdateLead(id, name, text, classification.classification);
            
            // Log inbound
            await this.crm.logMessage(id, 'inbound', text, classification.classification);

            // Auto-handle discard
            if (classification.classification === 'discard') {
                await this.crm.moveStage(id, 'discarded', 'Auto-classified as discard');
                continue;
            }

            results.push({
                subscriberId: id,
                name: name,
                message: text,
                classification: classification,
                lead: lead,
                timestamp: msg.received_at
            });
        }

        // Count by classification
        const priority = results.filter(r => r.classification.classification === 'priority').length;
        const engage = results.filter(r => r.classification.classification === 'engage').length;
        const neutral = results.filter(r => r.classification.classification === 'neutral').length;

        let summary = `📥 **${results.length} mensajes nuevos**\n\n`;
        if (priority > 0) summary += `🔥 ${priority} PRIORITY (fallecimiento)\n`;
        if (engage > 0) summary += `👤 ${engage} ENGAGE (interesados)\n`;
        if (neutral > 0) summary += `❓ ${neutral} NEUTRAL (saludos)\n`;

        return {
            hasMessages: true,
            summary: summary,
            leads: results,
            counts: { priority, engage, neutral, total: results.length }
        };
    }

    // Get formatted lead details
    async getLeadDetails(subscriberId) {
        const lead = await this.crm.getLead(subscriberId);
        if (!lead) {
            return { found: false, message: `Lead ${subscriberId} no encontrado.` };
        }

        const formatted = this.formatLead(lead);
        
        // Get conversation
        const conversation = await this.crm.getConversation(subscriberId, 10);
        
        let conversationText = '';
        if (conversation.length > 0) {
            conversationText = '\n🗨️ **Conversación reciente:**\n';
            conversation.forEach(msg => {
                const dir = msg.direction === 'inbound' ? '👤' : '🤖';
                conversationText += `${dir} ${msg.message_text}\n`;
            });
        }

        return {
            found: true,
            display: formatted.display + conversationText,
            lead: lead,
            conversation: conversation
        };
    }

    // Send reply and log
    async replyToLead(subscriberId, message) {
        try {
            // Send via bridge
            await this.crm.sendMessage(subscriberId, message);
            
            // Get lead for context
            const lead = await this.crm.getLead(subscriberId);
            
            // Save training
            if (lead) {
                await this.crm.saveTraining(
                    lead.last_message,
                    `Stage: ${lead.stage}, Classification: ${lead.classification}`,
                    message,
                    lead.classification
                );
            }

            return {
                success: true,
                message: `✅ Mensaje enviado a ${subscriberId}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    // Move lead to stage
    async updateStage(subscriberId, newStage, reason = '') {
        try {
            const result = await this.crm.moveStage(subscriberId, newStage, reason);
            return {
                success: true,
                message: `✅ Lead movido: ${result.oldStage} → ${newStage}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    // Get pipeline summary
    async getPipelineSummary() {
        const pipeline = await this.crm.getPipeline();
        
        let summary = '📊 **PIPELINE ALA LEGAL**\n\n';
        
        const stageOrder = ['inbound', 'qualified', 'document_pending', 'set', 'intake_form', 'closed_won', 'closed_lost', 'discarded'];
        
        stageOrder.forEach(stage => {
            const items = pipeline.filter(p => p.stage === stage);
            const total = items.reduce((sum, i) => sum + i.count, 0);
            
            if (total > 0) {
                const icons = {
                    'inbound': '📥',
                    'qualified': '✅',
                    'document_pending': '📄',
                    'set': '📅',
                    'intake_form': '📝',
                    'closed_won': '💰',
                    'closed_lost': '❌',
                    'discarded': '🗑️'
                };
                
                summary += `${icons[stage]} **${stage.toUpperCase()}**: ${total} leads\n`;
                
                items.forEach(item => {
                    if (item.classification) {
                        summary += `   ${item.classification}: ${item.count}\n`;
                    }
                });
                summary += '\n';
            }
        });

        return summary;
    }

    // Get suggested response
    getSuggestedResponse(classification) {
        return this.crm.getSuggestedResponse(classification);
    }

    close() {
        this.crm.close();
    }
}

module.exports = IronclawCRMIntegration;