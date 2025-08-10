// middleware.js
export const config = {
  // какие пути защищаем и служебный обработчик логина
  matcher: ['/theme.html', '/_auth'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  // если env не заданы — просто отдадим страницу логина
  if (!USER || !PASS) {
    return Response.redirect(new URL('/locked.html', url), 302);
  }

  // Обработка сабмита формы логина
  if (url.pathname === '/_auth' && request.method === 'POST') {
    const form = await request.formData();
    const user = (form.get('user') || '').toString();
    const pass = (form.get('pass') || '').toString();
    const next = (form.get('next') || '/theme.html').toString();

    if (user === USER && pass === PASS) {
      const res = Response.redirect(new URL(next, url), 302);
      // cookie на 24 часа
      res.headers.append(
        'Set-Cookie',
        'auth_ok=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax'
      );
      return res;
    }
    // ошибка — вернём на форму с маркером ошибки
    const back = new URL('/locked.html', url);
    back.searchParams.set('e', '1');
    back.searchParams.set('next', next);
    return Response.redirect(back, 302);
  }

  // Защита самой страницы
  if (url.pathname === '/theme.html') {
    const cookies = request.headers.get('cookie') || '';
    const ok = /(?:^|;\s*)auth_ok=1(?:;|$)/.test(cookies);
    if (ok) return; // пускаем дальше

    // не залогинен — уводим на форму
    const login = new URL('/locked.html', url);
    login.searchParams.set('next', url.pathname);
    return Response.redirect(login, 302);
  }

  // по умолчанию — ничего не делаем
  return;
}
