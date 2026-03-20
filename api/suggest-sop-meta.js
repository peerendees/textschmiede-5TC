import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, model, sopContent, sopTitle, availableTags, availableRelevance } = req.body;

  if (!apiKey || !sopContent) {
    return res.status(400).json({ error: "apiKey and sopContent are required" });
  }

  const systemPrompt = `Du analysierst SOPs und schlägst passende Metadaten vor.
Antworte NUR mit einem JSON-Objekt, keine Erklärung, kein Markdown.

Format:
{
  "tags": ["Tag1", "Tag2"],
  "relevance": ["Rolle1", "Rolle2"]
}

Regeln:
- Wähle nur Tags und Rollen aus den bereitgestellten Listen
- Wähle 2-5 Tags, die den Inhalt der SOP am besten beschreiben
- Wähle 1-4 Relevanz-Rollen, für die diese SOP relevant ist
- Bevorzuge spezifische Tags gegenüber allgemeinen`;

  const userPrompt = `SOP-Titel: "${sopTitle}"

SOP-Inhalt (gekürzt):
${sopContent.substring(0, 3000)}

Verfügbare Tags: ${availableTags.join(', ')}
Verfügbare Relevanz-Rollen: ${availableRelevance.join(', ')}

Schlage passende Tags und Relevanz vor.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: model || "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content.filter(b => b.type === "text").map(b => b.text).join("");

    try {
      const suggestions = JSON.parse(text);
      return res.status(200).json(suggestions);
    } catch (e) {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return res.status(200).json(JSON.parse(match[0]));
      }
      return res.status(200).json({ tags: [], relevance: [] });
    }
  } catch (error) {
    console.error("Suggest meta error:", error);
    return res.status(200).json({ tags: [], relevance: [] });
  }
}
