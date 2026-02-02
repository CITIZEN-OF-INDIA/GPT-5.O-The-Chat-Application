import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from './auth.tokens'

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization
  if (!header) return res.sendStatus(401)

  try {
    const token = header.split(' ')[1]
    const payload = verifyAccessToken(token)

    ;(req as any).userId = payload.sub
    next()
  } catch {
    res.sendStatus(401)
  }
}
