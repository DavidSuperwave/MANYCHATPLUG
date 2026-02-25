const duckdb = require('duckdb');
const path = require('path');

class ConversationMemory {
  constructor(dbPath = './conversations.db') {
    this.db = new duckdb.Database(dbPath);
    this.init();
  }

  init() {
    // Create conversations table
    this.db.exec(`
      CREATE SEQUENCE IF NOT EXISTS message_id_seq;
      
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY DEFAULT nextval('message_id_seq'),
        subscriber_id VARCHAR NOT NULL,
        platform VARCHAR DEFAULT 'messenger',
        direction VARCHAR NOT NULL, -- 'incoming' or 'outgoing'
        message_text TEXT,
        agent_response TEXT,
        intent VARCHAR,
        sentiment VARCHAR,
        context JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_subscriber ON conversations(subscriber_id);
      CREATE INDEX IF NOT EXISTS idx_created ON conversations(created_at);
    `);
  }

  async saveMessage(subscriberId, direction, messageText, agentResponse = null, context = {}) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO conversations (subscriber_id, direction, message_text, agent_response, context)
         VALUES (?, ?, ?, ?, ?)`,
        [subscriberId, direction, messageText, agentResponse, JSON.stringify(context)],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getConversationHistory(subscriberId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM conversations 
         WHERE subscriber_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [subscriberId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.reverse()); // Oldest first
        }
      );
    });
  }

  async getUserContext(subscriberId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
          COUNT(*) as total_messages,
          MAX(created_at) as last_interaction,
          intent,
          context
         FROM conversations 
         WHERE subscriber_id = ?
         GROUP BY subscriber_id`,
        [subscriberId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || null);
        }
      );
    });
  }

  async getCommonIntents(subscriberId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT intent, COUNT(*) as count 
         FROM conversations 
         WHERE subscriber_id = ? AND intent IS NOT NULL
         GROUP BY intent 
         ORDER BY count DESC 
         LIMIT 5`,
        [subscriberId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = ConversationMemory;