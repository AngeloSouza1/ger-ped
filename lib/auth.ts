// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';

const enc = new TextEncoder();
const secret = enc.encode(process.env.AUTH_SECRET || 'dev-secret-change-me');

export async function signSession(email: string) {
  return await new SignJWT({ sub: email, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { sub?: string; role?: string; iat: number; exp: number };
}
