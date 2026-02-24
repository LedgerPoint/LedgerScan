// api/fmp.js — Vercel serverless function
// This runs on Vercel's servers, so no CORS issues.
// Your FMP API key stays secret in environment variables.

export default async function handler(req, res) {
  // Allow requests from your app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: "Missing endpoint parameter" });
  }

  // API key lives in Vercel environment variables — never exposed to browser
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  // Build FMP URL
  const queryParams = new URLSearchParams({ ...params, apikey: apiKey });
  const fmpUrl = `https://financialmodelingprep.com/api/v3/${endpoint}?${queryParams}`;

  try {
    const response = await fetch(fmpUrl);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch from FMP", detail: err.message });
  }
}
