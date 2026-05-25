// Import the Express framework to create HTTP route handlers and middleware.
// `express` is a widely-used Node.js web framework; here we use its Router.
import express from 'express';

// Import `ObjectId` from the MongoDB driver so we can validate and create ObjectId values.
// ObjectId is used for MongoDB document _id fields.
import { ObjectId } from 'mongodb';

// Import a helper that returns the connected MongoDB database instance.
// `getDB()` is defined in ../mongoConnect.js and centralizes DB access for the app.
import { getDB } from '../mongoConnect.js';

// Import a realtime helper to emit socket/notification events to users.
// This ties the HTTP layer to the realtime subsystem (e.g., websockets via `realtime.js`).
import { emitAlertToUsers } from '../realtime.js';

// Import security utilities and middleware:
// - `isAdminRole(role)` checks whether a role string grants admin privileges.
// - `publicUser(user)` sanitizes/normalizes the user object for public usage (removes secrets).
// - `requireAuth` is Express middleware that ensures the incoming request is authenticated.
import { isAdminRole, publicUser, requireAuth } from '../security.js';

// Create a new router instance where we'll register all messages-related routes.
// This router is exported at the bottom and mounted by the main server (e.g., in server.js).
const router = express.Router();

// Utility: parseProviderId attempts to interpret `id` as either a numeric provider id
// or a MongoDB ObjectId. It returns a query object suitable for MongoDB lookups,
// or `null` if the id cannot be parsed.
const parseProviderId = (id) => {
  // Convert the incoming id to a Number; if it's a numeric string this yields a number.
  const numericId = Number(id);
  // If the numeric conversion produced an integer, treat the provider key as numeric.
  if (Number.isInteger(numericId)) return { id: numericId };
  // If the string is a valid MongoDB ObjectId, return a query matching `_id`.
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  // If neither numeric nor ObjectId-like, return null to indicate invalid input.
  return null;
};

// Utility: canAccessConversation checks whether `user` is allowed to access the `conversation`.
// Access is granted if the user is an admin or if their user id is one of the conversation participants.
const canAccessConversation = (user, conversation) => (
  // `isAdminRole` inspects the user's role string and returns true for admin-like roles.
  isAdminRole(user.role) || (conversation.participantIds || []).includes(String(user._id))
);

// Route: GET /conversations
// Returns a list of conversations visible to the authenticated user.
// - Admins see all conversations.
// - Regular users see only conversations where they are a participant.
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    // Build a MongoDB query depending on whether the requester is an admin.
    // If admin, empty query => all conversations; otherwise filter by participantIds.
    const query = isAdminRole(req.user.role)
      ? {}
      : { participantIds: String(req.user._id) };

    // Query the `conversations` collection with the computed filter, sort by most recent update.
    const conversations = await getDB().collection('conversations').find(query).sort({ updatedAt: -1 }).toArray();
    // Return the conversation list as JSON to the frontend.
    res.json(conversations);
  } catch (error) {
    // On error, return HTTP 500 with the error message for debugging (frontend can display it).
    res.status(500).json({ error: error.message });
  }
});

// Route: POST /conversations
// Creates (or returns existing) a conversation between the authenticated customer and a provider.
router.post('/conversations', requireAuth, async (req, res) => {
  try {
    // Extract the provider identifier and optional status from the request body.
    const { providerId, status } = req.body;

    // Validate required input: providerId must be present.
    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required' });
    }

    // Convert providerId to a MongoDB query using parseProviderId helper.
    const providerQuery = parseProviderId(providerId);
    if (!providerQuery) return res.status(400).json({ error: 'Invalid provider ID' });

    // Look up the provider document by numeric id or ObjectId depending on input.
    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    // Prepare canonical participant IDs (strings) for the conversation.
    const customerUserId = String(req.user._id);
    const providerUserId = provider.userId ? String(provider.userId) : null;
    // Use a Set to ensure participantIds are unique and filter out nulls.
    const participantIds = [...new Set([customerUserId, providerUserId].filter(Boolean))];

    // If a conversation already exists for this provider and these participants, return it.
    const existing = await getDB().collection('conversations').findOne({
      providerKey: String(provider.id || provider._id),
      participantIds: { $all: participantIds },
    });

    if (existing) return res.json(existing);

    // Build the conversation object to insert into the DB.
    // This includes denormalized customer and provider info to make frontend rendering simpler.
    const conversation = {
      providerKey: String(provider.id || provider._id),
      providerId: provider.id ?? null,
      providerObjectId: provider._id ? String(provider._id) : null,
      providerUserId,
      customerUserId,
      participantIds,
      customer: {
        id: customerUserId,
        // Prefer a full `name` field if available, otherwise build from fname/lname.
        name: req.user.name || [req.user.fname, req.user.lname].filter(Boolean).join(' '),
        email: req.user.email,
        avatar: req.user.avatar || '',
      },
      provider: {
        id: String(provider.id || provider._id),
        name: provider.name || 'Provider',
        avatar: provider.avatar || '',
        service: provider.service || 'Service',
        available: Boolean(provider.available),
      },
      status: status || 'Inquiry', // Conversation status (e.g., Inquiry, Booked, Completed)
      // `unreadBy` initially contains the provider user id so provider sees the new conversation.
      unreadBy: providerUserId ? [providerUserId] : [],
      lastMessage: '',
      lastMessageAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert the new conversation document into the DB.
    const result = await getDB().collection('conversations').insertOne(conversation);
    // Attach the generated `_id` to the returned object for the frontend.
    const created = { ...conversation, _id: result.insertedId };
    // Notify connected participants via realtime layer that a conversation was created.
    emitAlertToUsers(participantIds, 'conversation:created', created);
    // Respond with HTTP 201 (created) and the conversation payload.
    res.status(201).json(created);
  } catch (error) {
    // Generic error handling: 500 and the message.
    res.status(500).json({ error: error.message });
  }
});

// Route: GET /conversations/:id/messages
// Returns all messages for a conversation, ordered chronologically.
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    // Validate that the :id parameter is a valid MongoDB ObjectId string.
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Convert the param into an ObjectId instance for DB queries.
    const conversationId = new ObjectId(req.params.id);
    // Fetch the conversation to validate existence and permissions.
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    // Ensure the requesting user has access to the conversation.
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    // Query messages referenced by the conversationId and sort by creation time ascending.
    const messages = await getDB()
      .collection('messages')
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();

    // Return messages array to frontend; frontend can render the thread chronologically.
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: POST /conversations/:id/messages
// Adds a new message to the given conversation and notifies participants.
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    // Validate the conversation id param.
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const text = String(req.body?.text || '').trim();
    const attachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (!text && attachments.length === 0) {
      return res.status(400).json({ error: 'Message text or attachment is required' });
    }

    // Convert conversation id and validate conversation existence and access.
    const conversationId = new ObjectId(req.params.id);
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    // Build a sanitized sender object for storing with the message (publicUser removes secrets).
    const sender = publicUser(req.user);
    const now = new Date();
    // Create the message document. Note: `conversationId` is stored as an ObjectId reference.
    const message = {
      conversationId,
      senderId: sender.id,
      senderName: sender.name || sender.email,
      senderRole: sender.role || 'customer',
      text: text.trim(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      readBy: [sender.id],
      createdAt: now,
    };

    // Insert message into `messages` collection.
    const result = await getDB().collection('messages').insertOne(message);
    // Compute which participants should be marked as having unread messages (everyone except sender).
    const unreadBy = (conversation.participantIds || []).filter((participantId) => participantId !== sender.id);

    // Update the parent conversation metadata: last message text, id, timestamps, and unread list.
    await getDB().collection('conversations').updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage: message.text || (message.attachments.length > 0 ? '[Image]' : ''),
          lastMessageId: String(result.insertedId),
          lastMessageAt: now,
          updatedAt: now,
          unreadBy,
        },
      }
    );

    // Prepare the created message payload (include the inserted _id) and notify participants.
    const createdMessage = { ...message, _id: result.insertedId };
    emitAlertToUsers(
      conversation.participantIds || [],
      'message:new',
      { ...createdMessage, conversationId: String(conversationId) }
    );
    // Respond with 201 Created and the message object so frontend can display it immediately.
    res.status(201).json(createdMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: PATCH /conversations/:id/messages/read
// Marks all unread messages in the conversation as read by the authenticated user.
router.patch('/conversations/:id/messages/read', requireAuth, async (req, res) => {
  try {
    // Validate param is a MongoDB ObjectId.
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Build identifiers and ensure user has access to the conversation.
    const conversationId = new ObjectId(req.params.id);
    const userId = String(req.user._id);
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    // Mark all messages in this conversation that don't already include the user in `readBy`.
    // Using `$push` for `readBy` and `$set` to set `readAt` timestamp.
    await getDB().collection('messages').updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $push: { readBy: userId }, $set: { readAt: new Date() } }
    );
    // Also remove the user's id from the conversation `unreadBy` array and update timestamp.
    await getDB().collection('conversations').updateOne(
      { _id: conversationId },
      { $pull: { unreadBy: userId }, $set: { updatedAt: new Date() } }
    );

    // Notify participants via realtime layer that the user has read messages in this conversation.
    const payload = { conversationId: req.params.id, userId, readAt: new Date() };
    emitAlertToUsers(conversation.participantIds || [], 'message:read', payload);
    // Return a success response; frontend can use this to update local UI state.
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export the configured router as the default export so the server can mount it.
export default router;
