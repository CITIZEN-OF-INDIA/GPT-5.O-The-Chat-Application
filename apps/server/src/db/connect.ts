import mongoose from 'mongoose'
import 'dotenv/config';   // ✅ MUST be first


export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp')
    console.log('🟢 MongoDB connected')
  } catch (error) {
    console.error('🔴 MongoDB connection failed', error)
    process.exit(1)
  }
}
