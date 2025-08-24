// middleware.js
export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  const cookies = request.headers.get('cookie') || '';
  console.log('Middleware: проверка куки', cookies);

  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) {
    console.log('Middleware: кука auth_ok найдена — пропускаем');
    return; // авторизован — идём дальше
  }

  const authHeader = request.headers.get('authorization') || '';
  const expectedBasic = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  console.log('Middleware: проверка Authorization', authHeader);

  if (authHeader === expectedBasic) {
    console.log('Middleware: Basic Auth прошёл успешно, ставим куку');
    const response = new Response(null, { status: 200 });
    response.headers.set('Set-Cookie', 'auth_ok=1; Path=/; Max-Age=3600');
    return response;
  }

  console.log('Middleware: авторизация не пройдена — редирект на /locked.html');
  const url = new URL(request.url);
  const login = new URL('/locked.html', url);
  login.searchParams.set('next', url.pathname);
  return Response.redirect(login, 302, {
    'WWW-Authenticate': 'Basic realm="Restricted Area"',
  });
}
