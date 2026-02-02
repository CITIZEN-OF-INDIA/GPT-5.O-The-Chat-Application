import jwt from 'jsonwebtoken'
import { JwtPayload } from './auth.types'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '30d'

export function signTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL }
  )

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_TTL }
  )

  return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET!
  ) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET!
  ) as JwtPayload
}
