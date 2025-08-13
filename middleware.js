import { NextResponse } from 'next/server';

export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const url = new URL(request.url);
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  // Если переменные не заданы — на заглушку
  if (!USER || !PASS) {
    return NextResponse.redirect(new URL('/locked.html', url), 302);
  }

  // Проверяем куку
  const cookies = request.headers.get('cookie') || '';
  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) {
    return NextResponse.next();
  }

  // Если нет куки — отправляем на locked.html с возвратом на нужную страницу
  const loginUrl = new URL('/locked.html', url);
  loginUrl.searchParams.set('next', url.pathname);
  return NextResponse.redirect(loginUrl, 302);
}
