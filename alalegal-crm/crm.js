const duckdb = require('duckdb');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'alalegal.db');
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://web-production-b08f3.up.railway.app';

class ALALegalCRM {
    constructor() {
        this.db = new duckdb.Database(DB_PATH);
        this.init();
    }

    init() {
        // Initialize schema
        const schema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        this.db.exec(schema);
    }

    // CLASSIFY MESSAGE
    classifyMessage(messageText) {
        const lowerText = messageText.toLowerCase();
        
        // 🔥 PRIORITY: Fallecimiento keywords
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
                    reason: `Detected fallecimiento keyword: "${keyword}"`,
                    action: 'reply_immediately'
                };
            }
        }
        
        // 🗑️ DISCARD: Compliments, spam, no service need
        const discardKeywords = [
            'me gusta', 'me gustan', 'videos', 'contenido', 'página', 'pagina',
            'excelente', 'gracias por', 'muy buena', 'muy bueno', 'sigan así',
            'sigan asi', 'felicidades', 'buen trabajo', 'me encanta', 'increíble',
            'increible', 'genial', 'saludos desde', 'saludos de', 'buenas noches'
        ];
        
        // Check if message is ONLY compliments (short + contains discard words)
        const isDiscard = discardKeywords.some(kw => lowerText.includes(kw)) && 
                         messageText.length < 100 &&
                         !lowerText.includes('necesito') &&
                         !lowerText.includes('ayuda') &&
                         !lowerText.includes('servicio') &&
                         !lowerText.includes('crédito') &&
                         !lowerText.includes('infonavit');
        
        if (isDiscard) {
            return {
                classification: 'discard',
                reason: 'Compliment/spam, no service need detected',
                action: 'no_reply'
            };
        }
        
        // ❓ NEUTRAL: Just greetings
        const greetingOnly = /^(hola|saludos|buenos días|buenos dias|buenas tardes|buenas noches|hey|hi)[\s!.]*$/i;
        if (greetingOnly.test(messageText.trim())) {
            return {
                classification: 'neutral',
                reason: 'Greeting only, needs qualification',
                action: 'reply_probe'
            };
        }
        
        // 👤 ENGAGE: Service inquiry (but no fallecimiento mentioned)
        const engageKeywords = [
            'servicios', 'información', 'informacion', 'ayuda', 'crédito', 'credito',
            'infonavit', 'consulta', 'necesito', 'quiero', 'pueden ayudarme',
            'problemas con', 'asesoría', 'asesoria', 'cita', 'agendar',
            'precio', 'honorarios', 'cotización', 'cotizacion'
        ];
        
        for (const keyword of engageKeywords) {
            if (lowerText.includes(keyword)) {
                return {
                    classification: 'engage',
                    reason: `Service inquiry detected: "${keyword}"`,
                    action: 'reply_probe_fallecimiento'
                };
            }
        }
        
        // Default: Neutral (unclear, probe)
        return {
            classification: 'neutral',
            reason: 'Unclear intent, needs qualification',
            action: 'reply_probe'
        };
    }

    // Get suggested response based on classification
    getSuggestedResponse(classification) {
        switch (classification) {
            case 'priority':
                return {
                    en: 'Fallecimiento detected',
                    es: 'Lamento mucho tu pérdida. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Podrías contarme: 1) ¿Quién falleció? 2) ¿Tenía crédito activo? 3) ¿Hay testamento?'
                };
            case 'engage':
                return {
                    en: 'Service inquiry - probe for fallecimiento',
                    es: 'Gracias por contactarnos. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit (sucesiones, seguros, transferencias). ¿Nos contactas por este tipo de caso?'
                };
            case 'neutral':
                return {
                    en: 'Greeting - immediate qualification',
                    es: 'Hola, bienvenido a ALA LEGAL. Nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Nos contactas por este tipo de caso?'
                };
            case 'discard':
                return {
                    en: 'No reply needed',
                    es: null
                };
            default:
                return {
                    en: 'Default probe',
                    es: 'Hola, ¿en qué puedo ayudarte?'
                };
        }
    }

    // Create or update lead
    async createOrUpdateLead(subscriberId, subscriberName, messageText, classification, source = 'messenger') {
        return new Promise((resolve, reject) => {
            // Check if exists
            this.db.get(
                'SELECT id, stage FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, row) => {
                    if (err) return reject(err);
                    
                    if (row) {
                        // Update existing
                        this.db.run(
                            `UPDATE leads 
                             SET subscriber_name = ?, last_message = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                             WHERE subscriber_id = ?`,
                            [subscriberName, messageText, subscriberId],
                            (err) => {
                                if (err) return reject(err);
                                resolve({ id: row.id, stage: row.stage, isNew: false, classification });
                            }
                        );
                    } else {
                        // Create new - set initial stage based on classification
                        let initialStage = 'inbound';
                        if (classification === 'discard') {
                            initialStage = 'discarded';
                        } else if (classification === 'priority') {
                            initialStage = 'inbound'; // Will be moved to qualified after reply
                        }
                        
                        this.db.run(
                            `INSERT INTO leads (subscriber_id, subscriber_name, last_message, source, stage, stage_changed_at)
                             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [subscriberId, subscriberName, messageText, source, initialStage],
                            function(err) {
                                if (err) return reject(err);
                                resolve({ id: this.lastID, stage: initialStage, isNew: true, classification });
                            }
                        );
                    }
                }
            );
        });
    }

    // Log message with classification
    async logMessage(subscriberId, direction, messageText, classification = null, intent = null, sentiment = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (subscriber_id, direction, message_text, classification, intent, sentiment)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [subscriberId, direction, messageText, classification, intent, sentiment],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    // Change stage
    async changeStage(subscriberId, newStage, changedBy = 'human', reason = '') {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT stage FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Lead not found'));
                    
                    const oldStage = row.stage;
                    
                    // Update lead
                    this.db.run(
                        `UPDATE leads SET stage = ?, stage_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                         WHERE subscriber_id = ?`,
                        [newStage, subscriberId],
                        (err) => {
                            if (err) return reject(err);
                            
                            // Log stage change
                            this.db.run(
                                `INSERT INTO stage_history (subscriber_id, from_stage, to_stage, changed_by, reason)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [subscriberId, oldStage, newStage, changedBy, reason],
                                (err) => {
                                    if (err) return reject(err);
                                    resolve({ oldStage, newStage });
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    // Save training data
    async saveTraining(triggerPhrase, context, response, category, classification) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO training_memory (trigger_phrase, context, your_response, category, classification)
                 VALUES (?, ?, ?, ?, ?)`,
                [triggerPhrase, context, response, category, classification],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    // Get lead by subscriber ID
    async getLead(subscriberId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    // Get conversation history
    async getConversation(subscriberId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM messages 
                 WHERE subscriber_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [subscriberId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.reverse());
                }
            );
        });
    }

    // Get pipeline view
    async getPipeline() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT stage, COUNT(*) as count 
                 FROM leads 
                 GROUP BY stage 
                 ORDER BY 
                    CASE stage 
                        WHEN 'inbound' THEN 1 
                        WHEN 'qualified' THEN 2 
                        WHEN 'document_pending' THEN 3
                        WHEN 'set' THEN 4 
                        WHEN 'intake_form' THEN 5 
                        WHEN 'closed_won' THEN 6 
                        WHEN 'closed_lost' THEN 7
                        WHEN 'discarded' THEN 8
                    END`,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Get leads by stage
    async getLeadsByStage(stage) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM leads 
                 WHERE stage = ? 
                 ORDER BY last_message_at DESC NULLS LAST`,
                [stage],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Get classification stats
    async getClassificationStats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT classification, COUNT(*) as count 
                 FROM messages 
                 WHERE classification IS NOT NULL
                 GROUP BY classification`,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Search training memory
    async searchTraining(triggerPhrase) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM training_memory 
                 WHERE trigger_phrase ILIKE ? 
                 ORDER BY times_used DESC, created_at DESC 
                 LIMIT 5`,
                [`%${triggerPhrase}%`],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Send message via bridge
    async sendMessage(subscriberId, text) {
        try {
            const response = await axios.post(`${BRIDGE_URL}/api/send/text`, {
                subscriber_id: subscriberId,
                text: text
            });
            
            // Log outbound
            await this.logMessage(subscriberId, 'outbound', text);
            
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.message);
            throw error;
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = ALALegalCRM;