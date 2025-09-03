// app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const AUTH_COOKIES = [
  'auth_token',                       // o principal
  'auth', 'token', 'session',         // variações suas
  'next-auth.session-token',          // se algum dia usar NextAuth
  '__Secure-next-auth.session-token'
];

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // base para sobrescrever no response (garantindo remoção no browser)
  const base = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    expires: new Date(0),
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };

  // delete no escopo do request
  const jar = await cookies();
  for (const name of AUTH_COOKIES) {
    try { jar.delete(name); } catch {}
    res.cookies.set({ name, value: '', ...base });
  }
  return res;
}

export const GET = POST;
