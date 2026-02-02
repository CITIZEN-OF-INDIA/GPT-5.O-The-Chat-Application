/*import 'dotenv/config';   // ✅ MUST be first
import mongoose from 'mongoose';
import { User } from './User.model';
import { Chat } from './Chat.model';
import { Message } from './Message.model';
import { Media } from './Media.model';

async function testDatabase() {
  try {
    // 🔌 Connect DB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/testdb');
    console.log('✅ MongoDB connected');

    // 🧹 Clean old test data
    await Promise.all([
      User.deleteMany({}),
      Chat.deleteMany({}),
      Message.deleteMany({}),
      Media.deleteMany({})
    ]);
    console.log('🧹 Old data cleared');

    // 👤 Create users
    const user1 = await User.create({
      username: 'naitik',
      password: '123456'
    });

    const user2 = await User.create({
      username: 'soldier',
      password: 'abcdef'
    });

    console.log('👤 Users created');

    // 💬 Create chat
    const chat = await Chat.create({
      participants: [user1._id, user2._id]
    });

    console.log('💬 Chat created');

    // 📝 Create message
    const message = await Message.create({
      chatId: chat._id,
      senderId: user1._id,
      content: 'Hello from test script!'
    });

    console.log('📝 Message created');

    // 📎 Attach media
    const media = await Media.create({
      messageId: message._id,
      url: 'https://example.com/image.png',
      type: 'image'
    });

    console.log('📎 Media attached');

    // 🔍 Query test
    const messages = await Message.find({ chatId: chat._id })
      .populate('senderId', 'username')
      .sort({ createdAt: -1 });

    console.log('📨 Messages fetched:', messages.length);

    // 🔐 Password test
    const passwordCheck = await user1.comparePassword('123456');
    console.log('🔐 Password valid:', passwordCheck);

    console.log('\n🎉 ALL MODELS WORKING PERFECTLY');

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

testDatabase();
*/