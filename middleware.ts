// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const hasAuth = Boolean(req.cookies.get('auth_token')?.value);

  // Libere APIs e assets
  if (pathname.startsWith('/api')) return NextResponse.next();
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) return NextResponse.next();

  // Se logado e em /login, manda para callbackUrl (ou "/")
  if (pathname === '/login' && hasAuth) {
    const to = url.searchParams.get('callbackUrl') || '/';
    const dest = url.clone(); dest.pathname = to; dest.search = '';
    return NextResponse.redirect(dest);
  }

  // Se NÃO logado e pedindo qualquer coisa que não seja /login -> manda para /login
  if (!hasAuth && pathname !== '/login') {
    const dest = url.clone();
    dest.pathname = '/login';
    dest.searchParams.set('callbackUrl', pathname + (url.search || ''));
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)'],
};
