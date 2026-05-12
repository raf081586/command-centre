export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, system, max_tokens } = req.body;

    // Build Mistral messages array — system prompt as first message
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

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "No response.";

    // Return in Anthropic-compatible shape so App.jsx needs no changes
    res.status(200).json({
      content: [{ type: "text", text }],
      usage: {
        input_tokens:  data.usage?.prompt_tokens     || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, system, max_tokens } = req.body;

    // Build Mistral messages array — system prompt as first message
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

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "No response.";

    // Return in Anthropic-compatible shape so App.jsx needs no changes
    res.status(200).json({
      content: [{ type: "text", text }],
      usage: {
        input_tokens:  data.usage?.prompt_tokens     || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}