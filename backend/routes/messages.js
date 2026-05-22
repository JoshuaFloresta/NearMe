import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../mongoConnect.js';
import { emitAlert } from '../realtime.js';

const router = express.Router();

router.get('/conversations', async (req, res) => {
  try {
    const conversations = await getDB().collection('conversations').find().sort({ updatedAt: -1 }).toArray();
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const { providerId, providerName, customerEmail, status } = req.body;

    if (!providerId) {
      return res.status(400).json({ error: 'providerId is required' });
    }

    const conversation = {
      providerId: Number(providerId),
      providerName: providerName || '',
      customerEmail: customerEmail?.toLowerCase() || '',
      status: status || 'Inquiry',
      unread: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getDB().collection('conversations').insertOne(conversation);
    res.status(201).json({ ...conversation, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const messages = await getDB()
      .collection('messages')
      .find({ conversationId: new ObjectId(req.params.id) })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const { from, text } = req.body;
    if (!from || !text?.trim()) {
      return res.status(400).json({ error: 'from and text are required' });
    }

    const conversationId = new ObjectId(req.params.id);
    const message = {
      conversationId,
      from,
      text: text.trim(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      readBy: [],
      createdAt: new Date(),
    };

    const result = await getDB().collection('messages').insertOne(message);
    await getDB().collection('conversations').updateOne(
      { _id: conversationId },
      { $set: { updatedAt: new Date() } }
    );
    const createdMessage = { ...message, _id: result.insertedId };
    emitAlert('message:new', createdMessage);
    res.status(201).json(createdMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/conversations/:id/messages/read', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await getDB().collection('messages').updateMany(
      { conversationId: new ObjectId(req.params.id), readBy: { $ne: userId } },
      { $push: { readBy: userId }, $set: { readAt: new Date() } }
    );

    const payload = { conversationId: req.params.id, userId, readAt: new Date() };
    emitAlert('message:read', payload);
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
