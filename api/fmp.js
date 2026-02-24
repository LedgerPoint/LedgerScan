module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { path, ...params } = req.query;
  if (!path) return res.status(400).json({ error: "Missing path" });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "FMP_API_KEY not configured" });

  const queryParams = new URLSearchParams({ ...params, apikey: apiKey });
  const url = `https://financialmodelingprep.com/stable/${path}?${queryParams}`;

  console.log("Fetching:", url.replace(apiKey, "***"));

  try {
    const response = await fetch(url);
    const text = await response.text();
    console.log("FMP status:", response.status, "preview:", text.slice(0, 200));
    const data = JSON.parse(text);
    if (data && data["Error Message"]) return res.status(403).json({ error: data["Error Message"] });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy failed", detail: err.message });
  }
};
