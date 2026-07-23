export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Attempt to read from standard server env or vite prefixed env as fallback
    const apiKey = process.env.OPENROUTER_API_KEY || 
                   process.env.VITE_OPENROUTER_API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on Vercel Server.' });
    }

    // Extract only allowed fields to prevent malicious payload injection (e.g. streaming)
    const { model, messages, temperature, max_tokens } = body;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://hanpath.com",
        "X-Title": "HànPath Learning App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `OpenRouter error: ${response.status} - ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
