import { callProvider } from "./lib/providers.js";

const SYSTEM_PROMPT = `Du bist ein Experte für Prozessdokumentation und Standard Operating Procedures (SOPs). Deine Aufgabe ist es, aus einem gesprochenen Transkript oder einer Prozessbeschreibung eine professionelle, strukturierte SOP zu erstellen.

## SOP-Struktur (zwingend einzuhalten):

1. **Zweck und Ziel** — Warum existiert diese SOP? Was wird erreicht?
2. **Geltungsbereich** — Für wen/was gilt diese SOP?
3. **Verantwortlichkeiten** — Wer ist zuständig? Welche Rollen sind beteiligt?
4. **Voraussetzungen** — Was muss vorhanden sein, bevor der Prozess startet?
5. **Schritt-für-Schritt-Anleitung** — Nummerierte, klare Schritte. Jeder Schritt beginnt mit einem Verb.
6. **Hinweise und Ausnahmen** — Besondere Situationen, Fallstricke, Tipps
7. **Qualitätskontrolle** — Wie wird geprüft, ob der Prozess korrekt durchgeführt wurde?

## Schreibregeln:

- **Klare, direkte Sprache.** Kurze Sätze, aktive Formulierungen.
- **Du-Form** für Anleitungen, **Man-Form** für allgemeine Beschreibungen.
- **Kein Gendern.** Generisches Maskulinum.
- **Keine Emojis.**
- **Verbotene Wörter:** eintauchen, entdecken, enthüllen, erobern, umarmen, Haltung.
- **Nummerierung:** Hauptschritte mit 1., 2., 3. — Unterpunkte mit a), b), c)
- **Jeder Schritt muss eigenständig verständlich sein.**
- **Wenn-Dann-Logik** für Entscheidungspunkte: "Wenn X, dann Y. Andernfalls Z."

## Output-Format:
- Markdown
- Beginne direkt mit ## Zweck und Ziel (KEIN H1-Titel — wird separat gesetzt)
- Verwende ## für Hauptabschnitte, ### für Unterabschnitte
- Nummerierte Listen für Schritte
- Keine Metakommentare — nur die SOP`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, provider, model, transcript, sopTitle, audience } = req.body;

  if (!apiKey || !transcript) {
    return res.status(400).json({ error: "apiKey and transcript are required" });
  }

  const audienceHint = audience
    ? `\n- Zielgruppe: ${audience} — passe Detailtiefe und Fachsprache entsprechend an`
    : '';

  const userPrompt = `## SOP-Kontext
- SOP-Titel: "${sopTitle || "Ohne Titel"}"${audienceHint}

## Transkript / Prozessbeschreibung
${transcript}

---

Erstelle nun die vollständige SOP aus diesem Transkript. Halte dich strikt an die Struktur und alle Schreibregeln.`;

  try {
    const { content } = await callProvider({
      provider: provider || 'anthropic',
      apiKey,
      model: model || 'claude-sonnet-4-20250514',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 8000
    });

    return res.status(200).json({ content });
  } catch (error) {
    console.error("API error:", error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Fehler bei der SOP-Generierung" });
  }
}
