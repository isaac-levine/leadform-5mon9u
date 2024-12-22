// mongodb v7.0.0
const MESSAGES_COLLECTION = 'messages';
const CONVERSATIONS_COLLECTION = 'conversations';
const SCHEMA_VERSION = 2;

/**
 * Applies schema validation rules and updates for messages and conversations collections
 * @param {MongoClient} db - MongoDB database instance
 * @returns {Promise<void>} Resolves when schema updates are complete
 */
async function up(db) {
  try {
    // Message Collection Schema
    await db.command({
      collMod: MESSAGES_COLLECTION,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["id", "conversationId", "content", "direction", "aiConfidence", "createdAt", "updatedAt"],
          properties: {
            id: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
              description: "UUID v4 for message identification"
            },
            conversationId: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
              description: "UUID v4 reference to parent conversation"
            },
            content: {
              bsonType: "string",
              minLength: 1,
              maxLength: 1600,
              description: "Message content with SMS length restrictions"
            },
            direction: {
              enum: ["INBOUND", "OUTBOUND"],
              description: "Message direction indicator"
            },
            aiConfidence: {
              bsonType: "double",
              minimum: 0,
              maximum: 100,
              description: "AI confidence score percentage"
            },
            metadata: {
              bsonType: "object",
              properties: {
                provider: { bsonType: "string" },
                deliveryStatus: { enum: ["PENDING", "SENT", "DELIVERED", "FAILED"] },
                retryCount: { bsonType: "int" },
                errorCode: { bsonType: "string" }
              }
            },
            createdAt: {
              bsonType: "date",
              description: "Timestamp of message creation"
            },
            updatedAt: {
              bsonType: "date",
              description: "Timestamp of last message update"
            }
          }
        }
      },
      validationLevel: "strict",
      validationAction: "error"
    });

    // Conversation Collection Schema
    await db.command({
      collMod: CONVERSATIONS_COLLECTION,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["id", "leadId", "status", "lastActivity", "createdAt", "updatedAt"],
          properties: {
            id: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
              description: "UUID v4 for conversation identification"
            },
            leadId: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
              description: "UUID v4 reference to lead"
            },
            status: {
              enum: ["ACTIVE", "PENDING", "CLOSED"],
              description: "Current conversation status"
            },
            assignedAgent: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
              description: "UUID v4 of assigned agent (optional)"
            },
            metadata: {
              bsonType: "object",
              properties: {
                source: { bsonType: "string" },
                tags: { bsonType: "array", items: { bsonType: "string" } },
                priority: { enum: ["LOW", "MEDIUM", "HIGH"] },
                customData: { bsonType: "object" }
              }
            },
            lastActivity: {
              bsonType: "date",
              description: "Timestamp of last conversation activity"
            },
            createdAt: {
              bsonType: "date",
              description: "Timestamp of conversation creation"
            },
            updatedAt: {
              bsonType: "date",
              description: "Timestamp of last conversation update"
            }
          }
        }
      },
      validationLevel: "strict",
      validationAction: "error"
    });

    // Create indexes for performance optimization
    await db.collection(MESSAGES_COLLECTION).createIndexes([
      { key: { conversationId: 1 }, name: "idx_conversation_id" },
      { key: { createdAt: -1 }, name: "idx_created_at" },
      { key: { direction: 1, createdAt: -1 }, name: "idx_direction_created" }
    ]);

    await db.collection(CONVERSATIONS_COLLECTION).createIndexes([
      { key: { leadId: 1 }, name: "idx_lead_id" },
      { key: { status: 1, lastActivity: -1 }, name: "idx_status_activity" },
      { key: { assignedAgent: 1 }, name: "idx_assigned_agent" },
      { key: { "metadata.tags": 1 }, name: "idx_tags" }
    ]);

    // Update schema version metadata
    await db.collection('migrations').updateOne(
      { name: '002_message_schema' },
      { 
        $set: { 
          version: SCHEMA_VERSION,
          appliedAt: new Date()
        }
      },
      { upsert: true }
    );

  } catch (error) {
    console.error('Migration 002 up failed:', error);
    throw error;
  }
}

/**
 * Reverts schema validation rules while preserving existing data
 * @param {MongoClient} db - MongoDB database instance
 * @returns {Promise<void>} Resolves when schema is reverted successfully
 */
async function down(db) {
  try {
    // Remove validation rules while preserving data
    await db.command({
      collMod: MESSAGES_COLLECTION,
      validator: {},
      validationLevel: "off",
      validationAction: "warn"
    });

    await db.command({
      collMod: CONVERSATIONS_COLLECTION,
      validator: {},
      validationLevel: "off",
      validationAction: "warn"
    });

    // Preserve indexes for data integrity
    // Remove schema version record
    await db.collection('migrations').deleteOne({ name: '002_message_schema' });

  } catch (error) {
    console.error('Migration 002 down failed:', error);
    throw error;
  }
}

module.exports = {
  up,
  down
};