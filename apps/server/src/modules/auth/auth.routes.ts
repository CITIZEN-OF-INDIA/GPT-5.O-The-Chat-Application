import { Router } from 'express'
import { validateUser, rotateTokens } from './auth.service'
import { verifyRefreshToken } from './auth.tokens'
import { User } from '../../db/models/User.model'

const router = Router()

// 🔒 Hidden login
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  const user = await validateUser(username, password)
  if (!user) return res.sendStatus(401)

  const tokens = await rotateTokens(user.id)
  res.json(tokens)
})

// 🔄 Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const payload = verifyRefreshToken(req.body.refreshToken)
    const user = await User.findById(payload.sub)

    if (!user || user.tokenVersion !== payload.tv)
      return res.sendStatus(401)

    const tokens = await rotateTokens(user.id)
    res.json(tokens)
  } catch {
    res.sendStatus(401)
  }
})
// 🆕 Hidden register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password.trim()
  ) {
    return res.status(400).json({ error: "Invalid username or password" });
  }

  const existing = await User.findOne({ username });
  if (existing) return res.status(409).json({ error: "Username already exists" });

  const user = await User.create({ username, passwordHash: password }); // make sure hashing is applied

  const tokens = await rotateTokens(user.id);
  res.json(tokens);
});



export default router
