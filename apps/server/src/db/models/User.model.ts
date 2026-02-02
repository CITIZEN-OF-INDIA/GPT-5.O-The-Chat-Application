import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcrypt'

export interface IUser extends Document {
  username: string
  passwordHash: string
  tokenVersion: number
  createdAt: Date
  lastSeen: Date | null
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // 🔐 Store ONLY hashed password
  passwordHash: {
    type: String,
    required: true,
    select: false
  },

  // 🔁 Used to invalidate refresh tokens
  tokenVersion: {
    type: Number,
    default: 0
  },

  // 🕒 Presence: last seen timestamp
  lastSeen: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
})

/**
 * Hash password before save
 */
UserSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return

  const salt = await bcrypt.genSalt(10)
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
})

/**
 * Compare plain password with hash
 */
UserSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.passwordHash)
}

export const User = mongoose.model<IUser>('User', UserSchema)
