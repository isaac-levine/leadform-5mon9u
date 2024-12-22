// mongodb driver v7.0.0
const { MongoClient } = require('mongodb');

// Collection names
const MESSAGES_COLLECTION = 'messages';
const CONVERSATIONS_COLLECTION = 'conversations';

// Index creation options with background processing to minimize impact
const INDEX_OPTIONS = { background: true };

/**
 * Creates optimized indexes for messages and conversations collections
 * Indexes are created in background to minimize performance impact during creation
 * 
 * @param {MongoClient} db - MongoDB database instance
 * @returns {Promise<void>} Resolves when all indexes are created
 */
async function up(db) {
  console.log('Starting index creation...');
  const startTime = Date.now();

  try {
    // Create indexes for messages collection
    await db.collection(MESSAGES_COLLECTION).createIndexes([
      {
        // Optimizes message retrieval by conversation with time-based sorting
        key: { conversationId: 1, createdAt: -1 },
        name: 'idx_messages_conversation_time',
        ...INDEX_OPTIONS
      },
      {
        // Supports AI confidence filtering and analytics
        key: { aiConfidence: 1 },
        name: 'idx_messages_ai_confidence',
        ...INDEX_OPTIONS
      },
      {
        // Optimizes message filtering by direction and status
        key: { direction: 1, status: 1 },
        name: 'idx_messages_direction_status',
        ...INDEX_OPTIONS
      }
    ]);

    // Create indexes for conversations collection
    await db.collection(CONVERSATIONS_COLLECTION).createIndexes([
      {
        // Optimizes lead-based conversation retrieval with activity sorting
        key: { leadId: 1, lastActivity: -1 },
        name: 'idx_conversations_lead_activity',
        ...INDEX_OPTIONS
      },
      {
        // Supports conversation status filtering
        key: { status: 1 },
        name: 'idx_conversations_status',
        ...INDEX_OPTIONS
      },
      {
        // Optimizes agent-based conversation queries
        key: { assignedAgent: 1 },
        name: 'idx_conversations_agent',
        ...INDEX_OPTIONS
      }
    ]);

    const duration = Date.now() - startTime;
    console.log(`Successfully created all indexes in ${duration}ms`);
  } catch (error) {
    console.error('Error creating indexes:', error);
    // Attempt to rollback created indexes
    await down(db).catch(rollbackError => {
      console.error('Error during index rollback:', rollbackError);
    });
    throw error;
  }
}

/**
 * Drops all created indexes from messages and conversations collections
 * 
 * @param {MongoClient} db - MongoDB database instance
 * @returns {Promise<void>} Resolves when all indexes are dropped
 */
async function down(db) {
  console.log('Starting index removal...');
  const startTime = Date.now();

  try {
    // Drop indexes from messages collection
    await db.collection(MESSAGES_COLLECTION).dropIndexes([
      'idx_messages_conversation_time',
      'idx_messages_ai_confidence',
      'idx_messages_direction_status'
    ]);

    // Drop indexes from conversations collection
    await db.collection(CONVERSATIONS_COLLECTION).dropIndexes([
      'idx_conversations_lead_activity',
      'idx_conversations_status',
      'idx_conversations_agent'
    ]);

    const duration = Date.now() - startTime;
    console.log(`Successfully removed all indexes in ${duration}ms`);
  } catch (error) {
    console.error('Error dropping indexes:', error);
    throw error;
  }
}

module.exports = {
  up,
  down
};