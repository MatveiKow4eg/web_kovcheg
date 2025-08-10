// api/auth.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const USER = process.env.BASIC_AUTH_USER;
    const PASS = process.env.BASIC_AUTH_PASS;
    if (!USER || !PASS) {
      res.status(500).send('Auth not configured');
      return;
    }

    // Получаем поля формы
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    const params = new URLSearchParams(body);
    const user = (params.get('user') || '').toString();
    const pass = (params.get('pass') || '').toString();
    const next = (params.get('next') || '/theme.html').toString();

    if (user === USER && pass === PASS) {
      // Ставим куку на 24 часа
      res.setHeader('Set-Cookie', [
        'auth_ok=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax',
      ]);
      res.writeHead(302, { Location: next });
      res.end();
      return;
    }

    // Неверно — обратно на форму с флагом ошибки
    const back = new URL('/locked.html', `https://${req.headers.host}`);
    back.searchParams.set('e', '1');
    back.searchParams.set('next', next);
    res.writeHead(302, { Location: back.toString() });
    res.end();
  } catch (e) {
    res.status(500).send('Internal Error');
  }
}
