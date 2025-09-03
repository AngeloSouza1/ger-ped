// app/api/login/route.ts
import { NextResponse } from 'next/server';

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // ex.: ".suaempresa.com"

export async function POST(req: Request) {
  // 1) valide credenciais (exemplo simplificado)
  // const { email, senha } = await req.json();
  // if (!ok) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });

  const token = 'seu-token-ou-jwt'; // gere seu token real aqui

  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: 'auth_token',
    value: token,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });

  return res;
}
