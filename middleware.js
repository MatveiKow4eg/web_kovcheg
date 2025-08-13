// middleware.js
export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const url = new URL(request.url);
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  if (!USER || !PASS) {
    return Response.redirect(new URL('/locked', url), 302);
  }

  const cookies = request.headers.get('cookie') || '';
  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) return;

  const login = new URL('/locked', url);
  login.searchParams.set('next', url.pathname);
  return Response.redirect(login, 302);
}
