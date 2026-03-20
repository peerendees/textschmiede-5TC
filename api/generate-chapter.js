import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Du bist ein professioneller Ghostwriter und Buchautor. Deine Aufgabe ist es, aus einem gesprochenen Transkript ein vollständig ausgearbeitetes Buchkapitel zu erstellen.

## Schreibregeln (zwingend einzuhalten):

1. **Fließtext:** Schreibe ausschließlich in vollständig ausgearbeiteten Absätzen. Keine Stichpunkte, keine Aufzählungen, keine Bulletpoints.
2. **Du-Form:** Sprich den Leser durchgehend mit "du" an. Lockerer, professioneller Ton.
3. **Kein Gendern:** Verwende das generische Maskulinum.
4. **Keine Emojis:** Niemals Emojis verwenden.
5. **Kein Ampersand:** Schreibe immer "und" statt "&".
6. **Verbotene Wörter:** Verwende NIEMALS: eintauchen, entdecken, enthüllen, erobern, umarmen, Haltung.
7. **Gedankenstriche:** Sparsam verwenden, nach deutscher Zeichensetzung.
8. **Kapitelstruktur:** Beginne mit einer kurzen Einführung, dann thematische Abschnitte mit Zwischenüberschriften (## für H2, ### für H3).
9. **Substanz beibehalten:** Folge dem Transkript inhaltlich. Bereinige Redundanzen, Füllwörter und Wiederholungen, aber behalte alle inhaltlichen Punkte bei.
10. **Vollständig ausarbeiten:** Jeder Gedanke wird zu einem vollständigen Absatz ausgearbeitet. Nicht skizzieren, nicht zusammenfassen - ausarbeiten.
11. **Übergänge:** Schaffe natürliche Übergänge zwischen den Abschnitten.
12. **Länge:** Das Kapitel soll substantiell sein. Ein Transkript von 10 Minuten ergibt mindestens 2000-3000 Wörter Kapiteltext.

## Output-Format:
- Gib das Kapitel als Markdown zurück
- Beginne mit dem Kapiteltext (KEINE Kapitelüberschrift H1 - die wird separat gesetzt)
- Verwende ## für Zwischenüberschriften und ### für Unterabschnitte
- Keine Metakommentare, keine Erklärungen - nur den Kapiteltext`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, model, audience, transcript, chapterTitle, bookTitle, chapterNumber } =
    req.body;

  if (!apiKey || !transcript) {
    return res.status(400).json({ error: "apiKey and transcript are required" });
  }

  const audienceHint = audience
    ? `\n- Zielgruppe: ${audience} — passe Komplexität und Tiefe entsprechend an`
    : '';

  const userPrompt = `## Buchkontext
- Buchtitel: "${bookTitle || "Ohne Titel"}"
- Kapitel ${chapterNumber || 1}: "${chapterTitle || "Ohne Titel"}"${audienceHint}

## Transkript
${transcript}

---

Erstelle nun das vollständig ausgearbeitete Buchkapitel aus diesem Transkript. Halte dich strikt an alle Schreibregeln.`;

  const selectedModel = model || "claude-sonnet-4-20250514";

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: selectedModel,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return res.status(200).json({ content });
  } catch (error) {
    console.error("Claude API error:", error);
    const status = error.status || 500;
    const errorMessage =
      error.message || "Fehler bei der Kapitelgenerierung";
    return res.status(status).json({ error: errorMessage });
  }
}
