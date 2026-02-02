/*import mongoose from 'mongoose'
import { User } from './User.model'
import dotenv from 'dotenv'
dotenv.config()


async function seed() {
  await mongoose.connect(process.env.MONGO_URI!) // adjust URI

  const exists = await User.findOne({ username: 'ritvik' })
  if (!exists) {
    await User.create({ username: 'ritvik', passwordHash: 'ritvik123' })
    console.log('Test user created')
  } else {
    console.log('Test user already exists')
  }

  process.exit(0)
}

seed()*/
