export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const url = new URL(request.url);

  // Если уже есть кука — пускаем
  const cookies = request.headers.get('cookie') || '';
  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) {
    return; // авторизован
  }

  // Получаем Basic Auth заголовок
  const auth = request.headers.get('authorization') || '';
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  if (auth === expected) {
    // Ставим куку, чтобы не вводить каждый раз
    const res = Response.redirect(url, 302);
    res.headers.append('Set-Cookie', 'auth_ok=1; Path=/; HttpOnly; Max-Age=3600');
    return res;
  }

  // Иначе редиректим на locked.html
  const login = new URL('/locked.html', url);
  login.searchParams.set('next', url.pathname);
  return Response.redirect(login, 302);
}
