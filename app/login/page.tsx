// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const sp = useSearchParams();
  const callbackUrl = sp.get('callbackUrl') || sp.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const formOk = emailOk && password.length >= 3 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formOk) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se não precisar do remember no backend, pode remover essa chave
        body: JSON.stringify({ email, password, remember: true }),
        credentials: 'include',
        cache: 'no-store',
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || 'Falha no login');
        return;
      }

      location.assign(callbackUrl);
    } catch {
      setError('Falha no login');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-slate-50 to-blue-50 py-12 md:py-20">
      <div
        className="mx-auto grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border bg-white shadow-xl md:grid-cols-5"
        style={{ borderColor: 'var(--card-brd)' }}
      >
        {/* Esquerda — imagem + overlay gradiente */}
        <div className="relative hidden overflow-hidden md:col-span-3 md:block">
          <Image
            src="/login-side.jpg"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 60vw, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/70 via-sky-600/50 to-cyan-500/50 mix-blend-multiply" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Logo" width={28} height={28} className="opacity-95" />
              <span className="text-sm/6 opacity-90">Gerador de Pedidos</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Organize seus pedidos com rapidez</h2>
            <p className="mt-1 max-w-md text-sm/6 opacity-90">Emita, salve, compartilhe e gere PDFs em segundos.</p>
          </div>
        </div>

        {/* Direita — formulário */}
        <div className="md:col-span-2 flex items-center justify-center p-7 md:p-10">
          <form onSubmit={onSubmit} className="w-full max-w-md" aria-describedby={error ? 'login-error' : undefined}>
            {/* Cabeçalho do formulário */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Acessar</h1>
              <p className="mt-1 text-sm text-slate-600">Informe suas credenciais para continuar.</p>
            </div>

            {/* E-mail */}
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              E-mail
            </label>
            <div className="relative mb-3">
              <input
                id="email"
                type="email"
                value={email}
                autoComplete="username"
                required
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={email.length > 0 && !emailOk}
                className={`w-full rounded-lg border px-3 py-2 pl-10 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 ${
                  email.length > 0 && !emailOk ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''
                }`}
              />
              <span className="pointer-events-none absolute inset-y-0 left-3 my-auto inline-flex h-5 w-5 items-center justify-center text-slate-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M20 4H4a2 2 0 0 0-2 2v.4l10 6.25L22 6.4V6a2 2 0 0 0-2-2zm0 6.2-8 5-8-5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.8z" />
                </svg>
              </span>
            </div>

            {/* Senha */}
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsOn((e as any).getModifierState?.('CapsLock'))}
                onKeyDown={(e) => setCapsOn((e as any).getModifierState?.('CapsLock'))}
                autoComplete="current-password"
                minLength={3}
                required
                className="w-full rounded-lg border px-3 py-2 pl-10 pr-10 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
              />
              {/* ícone cadeado */}
              <span className="pointer-events-none absolute inset-y-0 left-3 my-auto inline-flex h-5 w-5 items-center justify-center text-slate-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3H9z" />
                </svg>
              </span>
              {/* toggle ver senha */}
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M3 3l18 18-1.5 1.5-3.1-3.1C14.9 20 13.5 20.5 12 20.5 5.5 20.5 2 13.5 2 13.5a21.8 21.8 0 0 1 4.1-5.8L1.5 4.5 3 3z" />
                  </svg>
                )}
              </button>
            </div>

            {/* aviso Caps Lock */}
            {capsOn && (
              <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 border border-amber-200">
                Caps Lock está ativado.
              </div>
            )}

            {/* (REMOVIDOS) Manter conectado / Esqueci minha senha */}
            {/* espaço vertical menor */}
            <div className="mt-2" />

            {/* erro */}
            {error && (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <svg viewBox="0 0 24 24" className="mt-[2px] h-4 w-4" fill="currentColor">
                  <path d="M11 7h2v7h-2V7zm0 9h2v2h-2v-2z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={!formOk}
              className="mt-5 w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center justify-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/30 disabled:opacity-60"
              title="Entrar"
            >
              {submitting && (
                <svg className="mr-2 animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm7.07 3.93a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 0 1-1.41-1.41l1.42-1.42a1 1 0 0 1 1.41 0zM21 11a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2zM7.76 6.34A1 1 0 0 1 6.34 7.76L4.93 6.34A1 1 0 1 1 6.34 4.93l1.42 1.41zM5 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h2zm12.24 6.66a1 1 0 0 1-1.41 1.41l-1.42-1.41a1 1 0 1 1 1.41-1.42l1.42 1.42zM13 21a1 1 0 1 1-2 0v-2a1 1 0 1 1 2 0v2zM7.76 17.66l-1.42 1.42a1 1 0 1 1-1.41-1.41l1.41-1.42a1 1 0 1 1 1.42 1.41z" />
                </svg>
              )}
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>

            {/* (REMOVIDO) “Precisa de ajuda? Fale conosco” */}

            {/* Rodapé (mantido) */}
            <footer className="mt-8 text-[11px] text-slate-500">
              Ao continuar, você concorda com nossos{' '}
              <a href="#" className="underline decoration-dotted">
                Termos
              </a>{' '}
              e{' '}
              <a href="#" className="underline decoration-dotted">
                Privacidade
              </a>
              .
            </footer>
          </form>
        </div>
      </div>
    </main>
  );
}
