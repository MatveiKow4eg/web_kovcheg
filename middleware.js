// middleware.js
export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const url = new URL(request.url);
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  // Если env не заданы — ведём на форму/заглушку
  if (!USER || !PASS) {
    return Response.redirect(new URL('/locked', url), 302);
  }

  // Пускаем, если стоит кука
  const cookies = request.headers.get('cookie') || '';
  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) return;

  // Иначе — на форму
  const login = new URL('/locked', url);
  login.searchParams.set('next', url.pathname); // чтобы вернуться куда шёл
  return Response.redirect(login, 302);
}
