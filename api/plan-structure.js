import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Du bist ein erfahrener Buchlektor und Strukturberater. Du analysierst Transkripte und schlägst eine optimale Kapitelstruktur vor.

## Deine Aufgabe:
1. Lies die Zusammenfassungen aller Transkripte
2. Erkenne thematische Zusammenhänge und eine sinnvolle Reihenfolge
3. Schlage aussagekräftige Kapitelüberschriften vor
4. Begründe deine Empfehlung kurz

## Output-Format (strikt als JSON):
{
  "recommendation": "Deine Gesamtbewertung und Begründung der vorgeschlagenen Struktur (2-4 Sätze)",
  "chapters": [
    {
      "title": "Vorgeschlagener Kapitelname",
      "source": "Quelldatei(en), die diesem Kapitel zugrunde liegen",
      "description": "Kurze Beschreibung, was dieses Kapitel abdeckt und warum es an dieser Stelle steht (1-2 Sätze)"
    }
  ]
}

## Regeln:
- Antworte NUR mit validem JSON, kein Markdown-Codeblock, keine Erklärungen drumherum
- Die Anzahl der vorgeschlagenen Kapitel sollte der Anzahl der Transkripte entsprechen (es sei denn, eine Zusammenlegung oder Aufteilung ist inhaltlich sinnvoll)
- Kapitelüberschriften sollen prägnant und ansprechend sein
- Berücksichtige die Zielgruppe bei der Strukturempfehlung`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, model, summaries, bookTitle, audience, chapterCount } = req.body;

  if (!apiKey || !summaries) {
    return res.status(400).json({ error: "apiKey and summaries are required" });
  }

  const userPrompt = `## Buchprojekt
- Titel: "${bookTitle || "Ohne Titel"}"
- Zielgruppe: ${audience || "Allgemein"}
- Anzahl Transkripte: ${chapterCount || "unbekannt"}

## Transkript-Zusammenfassungen

${summaries}

---

Analysiere die Transkripte und schlage die optimale Buchstruktur als JSON vor.`;

  const selectedModel = model || "claude-sonnet-4-20250514";

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: selectedModel,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return res.status(200).json({ structure: content });
  } catch (error) {
    console.error("Claude API error:", error);
    const status = error.status || 500;
    const errorMessage = error.message || "Fehler bei der Strukturplanung";
    return res.status(status).json({ error: errorMessage });
  }
}
