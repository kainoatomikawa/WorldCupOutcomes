// Serverless proxy (Vercel-style function). The browser calls /api/matches; this
// function adds the football API key server-side and returns clean JSON, so the
// key is never exposed and CORS is avoided.
//
// Deploy target (Vercel/Netlify) and exact handler signature TBD — this is the
// shape to fill in once a provider and host are chosen.

export const config = { runtime: 'edge' };

export default async function handler(_request: Request): Promise<Response> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_API_KEY not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // TODO: fetch from the chosen provider using `apiKey`, then return its JSON.
  return new Response(
    JSON.stringify({ error: 'matches proxy not implemented' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
}
