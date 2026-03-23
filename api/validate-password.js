// Serverside password validation — prefix stored as Vercel env var
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ valid: false });
  }

  const prefix = process.env.PASSWORD_PREFIX;
  if (!prefix) {
    return res.status(500).json({ error: 'Password not configured' });
  }

  // Build expected password: prefix + 2-digit day + 2-digit hour (Europe/Berlin)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(now);
  const dd = parts.find(p => p.type === 'day').value.padStart(2, '0');
  const hh = parts.find(p => p.type === 'hour').value.padStart(2, '0');

  const expected = prefix + dd + hh;

  return res.status(200).json({ valid: password === expected });
}
