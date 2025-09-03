// app/api/login/route.ts
import { NextResponse } from 'next/server';

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // ex.: ".suaempresa.com"

type LoginBody = {
  email: string;
  password: string;
  remember?: boolean;
};

export async function POST(req: Request) {
  // Lê e valida o corpo
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { email, password, remember = true } = body;
  const emailOk = typeof email === 'string' && /\S+@\S+\.\S+/.test(email);
  const passOk = typeof password === 'string' && password.length >= 3;

  if (!emailOk || !passOk) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
  }

  // Gere seu token real (JWT, etc). Aqui só um placeholder único.
  const token = crypto.randomUUID();

  const res = NextResponse.json({ ok: true });

  // Se remember=true, cookie persistente (30 dias); senão, cookie de sessão (sem maxAge)
  const common = {
    name: 'auth_token',
    value: token,
    path: '/',
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };

  res.cookies.set({
    ...common,
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}), // 30 dias
  });

  return res;
}
