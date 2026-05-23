import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';
import { isAdminRole, publicUser, requireAuth } from '../security.js';

const router = express.Router();

const parseProviderId = (id) => {
  const numericId = Number(id);
  if (Number.isInteger(numericId)) return { id: numericId };
  if (ObjectId.isValid(id)) return { _id: new ObjectId(id) };
  return null;
};

const canAccessConversation = (user, conversation) => (
  isAdminRole(user.role) || (conversation.participantIds || []).includes(String(user._id))
);

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const query = isAdminRole(req.user.role)
      ? {}
      : { participantIds: String(req.user._id) };

    const conversations = await getDB().collection('conversations').find(query).sort({ updatedAt: -1 }).toArray();
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const { providerId, status } = req.body;

    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required' });
    }

    const providerQuery = parseProviderId(providerId);
    if (!providerQuery) return res.status(400).json({ error: 'Invalid provider ID' });

    const provider = await getDB().collection('providers').findOne(providerQuery);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const customerUserId = String(req.user._id);
    const providerUserId = provider.userId ? String(provider.userId) : null;
    const participantIds = [...new Set([customerUserId, providerUserId].filter(Boolean))];

    const existing = await getDB().collection('conversations').findOne({
      providerKey: String(provider.id || provider._id),
      participantIds: { $all: participantIds },
    });

    if (existing) return res.json(existing);

    const conversation = {
      providerKey: String(provider.id || provider._id),
      providerId: provider.id ?? null,
      providerObjectId: provider._id ? String(provider._id) : null,
      providerUserId,
      customerUserId,
      participantIds,
      customer: {
        id: customerUserId,
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
      status: status || 'Inquiry',
      unreadBy: providerUserId ? [providerUserId] : [],
      lastMessage: '',
      lastMessageAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('conversations').insertOne(conversation);
    const created = { ...conversation, _id: result.insertedId };
    emitAlert('conversation:created', created);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const conversationId = new ObjectId(req.params.id);
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    const messages = await getDB()
      .collection('messages')
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const conversationId = new ObjectId(req.params.id);
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    const sender = publicUser(req.user);
    const now = new Date();
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

    const result = await getDB().collection('messages').insertOne(message);
    const unreadBy = (conversation.participantIds || []).filter((participantId) => participantId !== sender.id);

    await getDB().collection('conversations').updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage: message.text,
          lastMessageAt: now,
          updatedAt: now,
          unreadBy,
        },
      }
    );

    const createdMessage = { ...message, _id: result.insertedId };
    emitAlert('message:new', { ...createdMessage, conversationId: String(conversationId) });
    res.status(201).json(createdMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/conversations/:id/messages/read', requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const conversationId = new ObjectId(req.params.id);
    const userId = String(req.user._id);
    const conversation = await getDB().collection('conversations').findOne({ _id: conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!canAccessConversation(req.user, conversation)) return res.status(403).json({ error: 'Conversation access denied' });

    await getDB().collection('messages').updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $push: { readBy: userId }, $set: { readAt: new Date() } }
    );
    await getDB().collection('conversations').updateOne(
      { _id: conversationId },
      { $pull: { unreadBy: userId }, $set: { updatedAt: new Date() } }
    );

    const payload = { conversationId: req.params.id, userId, readAt: new Date() };
    emitAlert('message:read', payload);
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
