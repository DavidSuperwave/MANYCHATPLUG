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

    // Create or update lead
    async createOrUpdateLead(subscriberId, subscriberName, messageText, source = 'messenger') {
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
                                resolve({ id: row.id, stage: row.stage, isNew: false });
                            }
                        );
                    } else {
                        // Create new
                        this.db.run(
                            `INSERT INTO leads (subscriber_id, subscriber_name, last_message, source, stage_changed_at)
                             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [subscriberId, subscriberName, messageText, source],
                            function(err) {
                                if (err) return reject(err);
                                resolve({ id: this.lastID, stage: 'inbound', isNew: true });
                            }
                        );
                    }
                }
            );
        });
    }

    // Log message
    async logMessage(subscriberId, direction, messageText, intent = null, sentiment = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (subscriber_id, direction, message_text, intent, sentiment)
                 VALUES (?, ?, ?, ?, ?)`,
                [subscriberId, direction, messageText, intent, sentiment],
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
    async saveTraining(triggerPhrase, context, response, category) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO training_memory (trigger_phrase, context, your_response, category)
                 VALUES (?, ?, ?, ?)`,
                [triggerPhrase, context, response, category],
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
                        WHEN 'set' THEN 3 
                        WHEN 'intake_form' THEN 4 
                        WHEN 'closed_won' THEN 5 
                        WHEN 'closed_lost' THEN 6 
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