// Sends contact form messages through Resend (https://resend.com).
// Needs RESEND_API_KEY, CONTACT_TO and CONTACT_FROM; without them it answers 503 and the
// form shows the studio's email address instead.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'bad_request' }, { status: 400 });
  const { name, email, message, company } = body as Record<string, unknown>;
  if (company) return Response.json({ ok: true }); // honeypot
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string' ||
      !name.trim() || !EMAIL.test(email) || !message.trim() || message.length > 5000 || name.length > 200) {
    return Response.json({ error: 'invalid' }, { status: 422 });
  }

  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO, from = process.env.CONTACT_FROM;
  if (!key || !to || !from) return Response.json({ error: 'not_configured' }, { status: 503 });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: email, subject: `Web · ${name}`, text: `${name} <${email}>\n\n${message}` }),
  });
  if (!res.ok) return Response.json({ error: 'send_failed' }, { status: 502 });
  return Response.json({ ok: true });
}
