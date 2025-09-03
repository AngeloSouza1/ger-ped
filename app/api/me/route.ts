// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { signSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password)
    return NextResponse.json({ error: 'Credenciais ausentes' }, { status: 400 });

  const ok =
    email === process.env.AUTH_EMAIL &&
    password === process.env.AUTH_PASSWORD;

  if (!ok)
    return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });

  const token = await signSession(email);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
  return res;
}
