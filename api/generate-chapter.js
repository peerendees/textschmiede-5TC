import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Du bist ein professioneller Ghostwriter und Buchautor. Deine Aufgabe ist es, aus einem gesprochenen Transkript ein vollstaendig ausgearbeitetes Buchkapitel zu erstellen.

## Schreibregeln (zwingend einzuhalten):

1. **Fliesstext:** Schreibe ausschliesslich in vollstaendig ausgearbeiteten Absaetzen. Keine Stichpunkte, keine Aufzaehlungen, keine Bulletpoints.
2. **Du-Form:** Sprich den Leser durchgehend mit "du" an. Lockerer, professioneller Ton.
3. **Kein Gendern:** Verwende das generische Maskulinum.
4. **Keine Emojis:** Niemals Emojis verwenden.
5. **Kein Ampersand:** Schreibe immer "und" statt "&".
6. **Verbotene Woerter:** Verwende NIEMALS: eintauchen, entdecken, enthuellen, erobern, umarmen, Haltung.
7. **Gedankenstriche:** Sparsam verwenden, nach deutscher Zeichensetzung.
8. **Kapitelstruktur:** Beginne mit einer kurzen Einfuehrung, dann thematische Abschnitte mit Zwischenueberschriften (## fuer H2, ### fuer H3).
9. **Substanz beibehalten:** Folge dem Transkript inhaltlich. Bereinige Redundanzen, Fuellwoerter und Wiederholungen, aber behalte alle inhaltlichen Punkte bei.
10. **Vollstaendig ausarbeiten:** Jeder Gedanke wird zu einem vollstaendigen Absatz ausgearbeitet. Nicht skizzieren, nicht zusammenfassen - ausarbeiten.
11. **Uebergaenge:** Schaffe natuerliche Uebergaenge zwischen den Abschnitten.
12. **Laenge:** Das Kapitel soll substantiell sein. Ein Transkript von 10 Minuten ergibt mindestens 2000-3000 Woerter Kapiteltext.

## Output-Format:
- Gib das Kapitel als Markdown zurueck
- Beginne mit dem Kapiteltext (KEINE Kapitelueberschrift H1 - die wird separat gesetzt)
- Verwende ## fuer Zwischenueberschriften und ### fuer Unterabschnitte
- Keine Metakommentare, keine Erklaerungen - nur den Kapiteltext`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, transcript, chapterTitle, bookTitle, chapterNumber } =
    req.body;

  if (!apiKey || !transcript) {
    return res.status(400).json({ error: "apiKey and transcript are required" });
  }

  const userPrompt = `## Buchkontext
- Buchtitel: "${bookTitle || "Ohne Titel"}"
- Kapitel ${chapterNumber || 1}: "${chapterTitle || "Ohne Titel"}"

## Transkript
${transcript}

---

Erstelle nun das vollstaendig ausgearbeitete Buchkapitel aus diesem Transkript. Halte dich strikt an alle Schreibregeln.`;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
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
