export default async function handler(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? "New York";

  return {
    city,
    temperature: 72,
    conditions: "sunny",
    timestamp: new Date().toISOString()
  };
}