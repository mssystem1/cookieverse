function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export default async function handler(req: Request) {
  return json({
    ok: true,
    service: "ping",
    method: req.method,
    timestamp: new Date().toISOString()
  });
}