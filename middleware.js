export const config = { matcher: ['/theme', '/theme.html'] };

export default function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  const authHeader = request.headers.get('authorization') || '';
  const basic = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  if (authHeader === basic) {
    // авторизация прошла, можно ставить куку
    const response = new Response(null, { status: 200 });
    response.headers.set('Set-Cookie', 'auth_ok=1; Path=/; Max-Age=3600');
    return response;
  }

  // иначе шлём 401 с заголовком для Basic Auth
  return new Response('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Restricted Area"'
    }
  });
}
