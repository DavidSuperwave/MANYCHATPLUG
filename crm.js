const duckdb = require('duckdb');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'data', 'alalegal.db');
const BRIDGE_URL = 'https://web-production-b08f3.up.railway.app';

class LocalCRM {
    constructor() {
        this.db = new duckdb.Database(DB_PATH);
        this.init();
    }

    init() {
        const schema = require('fs').readFileSync(
            path.join(__dirname, 'data', 'schema.sql'), 
            'utf8'
        );
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
                    reason: `Fallecimiento detectado: "${keyword}"`,
                    action: 'reply_immediately',
                    priority: 1
                };
            }
        }
        
        // 🗑️ DISCARD: Compliments, spam
        const discardKeywords = [
            'me gusta', 'me gustan', 'videos', 'contenido', 'página', 'pagina',
            'excelente', 'gracias por', 'muy buena', 'muy bueno', 'sigan así',
            'sigan asi', 'felicidades', 'buen trabajo', 'me encanta', 'increíble',
            'increible', 'genial', 'saludos desde', 'saludos de'
        ];
        
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
                reason: 'Mensaje de agradecimiento/spam, no requiere respuesta',
                action: 'no_reply',
                priority: 4
            };
        }
        
        // ❓ NEUTRAL: Just greetings
        const greetingOnly = /^(hola|saludos|buenos días|buenos dias|buenas tardes|buenas noches|hey|hi)[\s!.]*$/i;
        if (greetingOnly.test(messageText.trim())) {
            return {
                classification: 'neutral',
                reason: 'Solo saludo, necesita calificación',
                action: 'reply_probe',
                priority: 3
            };
        }
        
        // 👤 ENGAGE: Service inquiry
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
                    reason: `Interés en servicios: "${keyword}"`,
                    action: 'reply_probe_fallecimiento',
                    priority: 2
                };
            }
        }
        
        return {
            classification: 'neutral',
            reason: 'Intención no clara, necesita calificación',
            action: 'reply_probe',
            priority: 3
        };
    }

    // Get suggested response
    getSuggestedResponse(classification) {
        const responses = {
            priority: {
                es: 'Lamento mucho tu pérdida. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Podrías contarme: 1) ¿Quién falleció? 2) ¿Tenía crédito activo? 3) ¿Hay testamento?',
                context: 'Mostrar empatía, especialización, solicitar información clave'
            },
            engage: {
                es: 'Gracias por contactarnos. En ALA LEGAL nos especializamos en casos de fallecimiento con crédito Infonavit (sucesiones, seguros, transferencias). ¿Nos contactas por este tipo de caso?',
                context: 'Filtrar para fallecimiento inmediatamente'
            },
            neutral: {
                es: 'Hola, bienvenido a ALA LEGAL. Nos especializamos en casos de fallecimiento con crédito Infonavit. ¿Nos contactas por este tipo de caso?',
                context: 'Pregunta de calificación directa'
            },
            discard: {
                es: null,
                context: 'No responder'
            }
        };
        
        return responses[classification] || responses.neutral;
    }

    // Create or update lead
    async createOrUpdateLead(subscriberId, name, message, classification) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT stage, classification FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    const row = rows && rows[0];
                    
                    if (row) {
                        // Update
                        this.db.run(
                            `UPDATE leads 
                             SET subscriber_name = ?, last_message = ?, 
                                 last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                             WHERE subscriber_id = ?`,
                            [name, message, subscriberId],
                            (err) => {
                                if (err) return reject(err);
                                resolve({ 
                                    id: subscriberId, 
                                    stage: row.stage, 
                                    isNew: false,
                                    classification: row.classification
                                });
                            }
                        );
                    } else {
                        // Create new
                        let initialStage = classification === 'discard' ? 'discarded' : 'inbound';
                        
                        this.db.run(
                            `INSERT INTO leads (subscriber_id, subscriber_name, last_message, 
                                              stage, classification)
                             VALUES (?, ?, ?, ?, ?)`,
                            [subscriberId, name, message, initialStage, classification],
                            function(err) {
                                if (err) return reject(err);
                                resolve({ 
                                    id: this.lastID, 
                                    stage: initialStage, 
                                    isNew: true,
                                    classification: classification
                                });
                            }
                        );
                    }
                }
            );
        });
    }

    // Log message
    async logMessage(subscriberId, direction, text, classification) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (subscriber_id, direction, message_text, classification)
                 VALUES (?, ?, ?, ?)`,
                [subscriberId, direction, text, classification],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    // Save to supermemory
    async saveMemory(subscriberId, type, key, value, importance = 1) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO supermemory (subscriber_id, memory_type, key, value, importance)
                 VALUES (?, ?, ?, ?, ?)`,
                [subscriberId, type, key, value, importance],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    // Get lead
    async getLead(subscriberId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows && rows[0]);
                }
            );
        });
    }

    // Get all leads by stage
    async getLeadsByStage(stage) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM leads WHERE stage = ? ORDER BY last_message_at DESC',
                [stage],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Get pipeline
    async getPipeline() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT stage, classification, COUNT(*) as count 
                 FROM leads 
                 GROUP BY stage, classification
                 ORDER BY stage`,
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
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

    // Move stage
    async moveStage(subscriberId, newStage, reason = '') {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT stage FROM leads WHERE subscriber_id = ?',
                [subscriberId],
                (err, rows) => {
                    if (err) return reject(err);
                    if (!rows || !rows[0]) return reject(new Error('Lead not found'));
                    
                    const oldStage = rows[0].stage;
                    
                    this.db.run(
                        `UPDATE leads 
                         SET stage = ?, updated_at = CURRENT_TIMESTAMP
                         WHERE subscriber_id = ?`,
                        [newStage, subscriberId],
                        (err) => {
                            if (err) return reject(err);
                            
                            this.db.run(
                                `INSERT INTO stage_history (subscriber_id, from_stage, to_stage, changed_by, reason)
                                 VALUES (?, ?, ?, 'ironclaw', ?)`,
                                [subscriberId, oldStage, newStage, reason],
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

    // Send message via bridge
    async sendMessage(subscriberId, text) {
        try {
            const response = await axios.post(`${BRIDGE_URL}/api/send/text`, {
                subscriber_id: subscriberId,
                text: text
            });
            
            await this.logMessage(subscriberId, 'outbound', text, null);
            
            return response.data;
        } catch (error) {
            console.error('Error sending:', error.message);
            throw error;
        }
    }

    // Check inbox from bridge
    async checkInbox() {
        try {
            const response = await axios.get(`${BRIDGE_URL}/api/inbox`);
            return response.data.messages || [];
        } catch (error) {
            console.error('Error checking inbox:', error.message);
            return [];
        }
    }

    // Save training
    async saveTraining(trigger, context, response, classification) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO training_memory (trigger_pattern, context, response_template, classification)
                 VALUES (?, ?, ?, ?)`,
                [trigger, context, response, classification],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = LocalCRM;