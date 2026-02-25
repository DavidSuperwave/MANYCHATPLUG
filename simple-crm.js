// Simple JSON-based CRM for demo
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'crm-demo.json');

class SimpleCRM {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }
        } catch (e) {}
        return { leads: [], messages: [], stageHistory: [] };
    }

    save() {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    }

    classifyMessage(messageText) {
        const lowerText = messageText.toLowerCase();
        
        const priorityKeywords = [
            'falleció', 'fallecimiento', 'fallecio', 'muerte', 'murió', 'murio',
            'difunto', 'difunta', 'finado', 'finada', 'sucesión', 'sucesion', 
            'herencia', 'acreditado fallecido', 'fallecido', 'fallecida',
            'crédito por fallecimiento', 'seguro de vida', 'cambio de acreditado',
            'cancelación por muerte', 'cancelacion por muerte', 'venta por fallecimiento',
            'deudo', 'deuda por muerte', 'heredero', 'herederos', 'testamento',
            'notaria', 'sucesión intestamentaria', 'intestado'
        ];
        
        for (const keyword of priorityKeywords) {
            if (lowerText.includes(keyword)) {
                return {
                    classification: 'priority',
                    reason: `Fallecimiento detectado: "${keyword}"`,
                    action: 'reply_immediately'
                };
            }
        }
        
        const discardKeywords = [
            'me gusta', 'me gustan', 'videos', 'contenido', 'página', 'pagina',
            'excelente', 'gracias por', 'muy buena', 'muy bueno', 'sigan así',
            'sigan asi', 'felicidades', 'buen trabajo', 'me encanta', 'increíble',
            'increible', 'genial', 'saludos desde', 'saludos de'
        ];
        
        const isDiscard = discardKeywords.some(kw => lowerText.includes(kw)) && 
                         messageText.length < 100;
        
        if (isDiscard) {
            return {
                classification: 'discard',
                reason: 'Mensaje de agradecimiento/spam',
                action: 'no_reply'
            };
        }
        
        const greetingOnly = /^(hola|saludos|buenos días|buenos dias|buenas tardes|buenas noches|hey|hi)[\s!.]*$/i;
        if (greetingOnly.test(messageText.trim())) {
            return {
                classification: 'neutral',
                reason: 'Solo saludo',
                action: 'reply_probe'
            };
        }
        
        return {
            classification: 'engage',
            reason: 'Interés en servicios',
            action: 'reply_probe_fallecimiento'
        };
    }

    getSuggestedResponse(classification) {
        const responses = {
            priority: {
                es: 'Lamento mucho tu pérdida. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Podrías contarme: 1) ¿Quién falleció? 2) ¿Tenía crédito activo? 3) ¿Hay testamento?'
            },
            engage: {
                es: 'Gracias por contactarnos. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Nos contactas por este tipo de caso?'
            },
            neutral: {
                es: 'Hola, bienvenido a ALA LEGAL. Nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Nos contactas por este tipo de caso?'
            },
            discard: {
                es: null
            }
        };
        return responses[classification] || responses.neutral;
    }

    addLead(subscriberId, name, message, classification) {
        const existing = this.data.leads.find(l => l.subscriber_id === subscriberId);
        
        if (existing) {
            existing.last_message = message;
            existing.last_message_at = new Date().toISOString();
            existing.updated_at = new Date().toISOString();
        } else {
            this.data.leads.push({
                id: this.data.leads.length + 1,
                subscriber_id: subscriberId,
                subscriber_name: name,
                last_message: message,
                classification: classification,
                stage: classification === 'discard' ? 'discarded' : 'inbound',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_message_at: new Date().toISOString()
            });
        }
        
        this.save();
    }

    logMessage(subscriberId, direction, text, classification) {
        this.data.messages.push({
            id: this.data.messages.length + 1,
            subscriber_id: subscriberId,
            direction,
            message_text: text,
            classification,
            created_at: new Date().toISOString()
        });
        this.save();
    }

    moveStage(subscriberId, newStage, reason) {
        const lead = this.data.leads.find(l => l.subscriber_id === subscriberId);
        if (lead) {
            const oldStage = lead.stage;
            lead.stage = newStage;
            lead.updated_at = new Date().toISOString();
            
            this.data.stageHistory.push({
                id: this.data.stageHistory.length + 1,
                subscriber_id: subscriberId,
                from_stage: oldStage,
                to_stage: newStage,
                reason,
                created_at: new Date().toISOString()
            });
            
            this.save();
            return { oldStage, newStage };
        }
        return null;
    }

    getPipeline() {
        const stages = {};
        this.data.leads.forEach(lead => {
            const key = `${lead.stage}_${lead.classification}`;
            stages[key] = (stages[key] || 0) + 1;
        });
        
        return Object.entries(stages).map(([key, count]) => {
            const [stage, classification] = key.split('_');
            return { stage, classification, count };
        });
    }

    getLeadsByStage(stage) {
        return this.data.leads
            .filter(l => l.stage === stage)
            .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    }

    getLead(subscriberId) {
        return this.data.leads.find(l => l.subscriber_id === subscriberId);
    }

    getConversation(subscriberId) {
        return this.data.messages
            .filter(m => m.subscriber_id === subscriberId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
}

module.exports = SimpleCRM;