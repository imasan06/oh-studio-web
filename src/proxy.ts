import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['es', 'en'];

/** Sends locale-less URLs to /es or /en, from the browser's Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const accept = request.headers.get('accept-language') ?? '';
  const first = accept.split(',').map(s => s.trim().slice(0, 2).toLowerCase()).find(l => LOCALES.includes(l));
  request.nextUrl.pathname = `/${first ?? 'es'}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // skip Next internals, the API, render frames and any file with an extension
  matcher: ['/((?!_next|api|renders|.*\\..*).*)'],
};
