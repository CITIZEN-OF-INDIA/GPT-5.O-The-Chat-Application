import { User } from '../../db/models/User.model'
import { signTokens } from './auth.tokens'

export async function validateUser(
  username: string,
  password: string
) {
  const user = await User.findOne({ username }).select('+passwordHash')
  if (!user) return null

  const ok = await user.comparePassword(password)
  if (!ok) return null

  return user
}

export async function issueTokens(userId: string) {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  return signTokens({
    sub: user.id,
    tv: user.tokenVersion
  })
}

export async function rotateTokens(userId: string) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { new: true }
  )

  if (!user) throw new Error('User not found')

  return signTokens({
    sub: user.id,
    tv: user.tokenVersion
  })
}
