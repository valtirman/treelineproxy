export const handler = async (event) => {
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const body = JSON.parse(event.body || '{}');
  const text = (body.text || '').toLowerCase();
  const highRisk = /\breveal (system|developer) prompt\b/.test(text);

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, extra: { highRisk } }) };
};
