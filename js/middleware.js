// middleware.js
export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const url = new URL(request.url);

  // Пускаем, если стоит кука
  const cookies = request.headers.get('cookie') || '';
  if (/(^|;\s*)auth_ok=1(;|$)/.test(cookies)) {
    return; // авторизован — идёт дальше на theme.html
  }

  // Иначе редиректим на locked.html
  const login = new URL('/locked.html', url);
  login.searchParams.set('next', url.pathname); // чтобы вернуться обратно после логина
  return Response.redirect(login, 302);
}
