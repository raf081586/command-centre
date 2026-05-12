export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, system, max_tokens } = req.body;

    const mistralMessages = [];
    if (system) mistralMessages.push({ role: "system", content: system });
    messages.forEach(m => mistralMessages.push({ role: m.role, content: m.content }));

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: mistralMessages,
        max_tokens: max_tokens || 1000,
      }),
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        content: [{ type: "text", text: `API error (${response.status}): ${raw.slice(0, 200)}` }],
        usage: { input_tokens: 0, output_tokens: 0 },
      });
    }

    if (data.error) {
      return res.status(500).json({
        content: [{ type: "text", text: `Mistral error: ${data.error.message || JSON.stringify(data.error)}` }],
        usage: { input_tokens: 0, output_tokens: 0 },
      });
    }

    const text = data.choices?.[0]?.message?.content || "No response.";
    res.status(200).json({
      content: [{ type: "text", text }],
      usage: {
        input_tokens:  data.usage?.prompt_tokens     || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    });
  } catch (err) {
    res.status(500).json({
      content: [{ type: "text", text: `Server error: ${err.message}` }],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  }
}