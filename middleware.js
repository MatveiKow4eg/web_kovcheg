// middleware.js
import { next } from '@vercel/functions';

// Какие маршруты закрываем паролем — поменяй под себя
export const config = {
  matcher: [
    '/admin/:path*',
    '/draft/:path*',
    '/theme-edit',     // пример одиночной страницы /theme-edit
    '/secret',         // пример /secret
    // Если нужно защитить файл /theme.html:
    '/theme.html'
  ],
};

export default function middleware(request) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;

  if (!USER || !PASS) {
    return new Response('Auth not configured', { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (!auth) {
    return new Response('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
    });
  }

  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return new Response('Invalid auth', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
    });
  }

  // atob доступен в edge-окружении
  const [user, pass] = atob(encoded).split(':');

  if (user === USER && pass === PASS) {
    // Пускаем дальше к странице/статике
    return next();
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
  });
}
