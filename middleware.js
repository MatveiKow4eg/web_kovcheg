// middleware.js

export const config = {
  matcher: [
    '/theme.html',
    '/admin/:path*',
    '/draft/:path*',
    '/theme-edit',
    '/secret'
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

  const [user, pass] = atob(encoded).split(':');

  if (user === USER && pass === PASS) {
    // Пускаем дальше
    return Response.next();
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
  });
}