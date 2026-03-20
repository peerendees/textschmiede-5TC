import Anthropic from "@anthropic-ai/sdk";

// Template-specific prompt variations
const TEMPLATE_CONFIGS = {
  buch: {
    role: "professioneller Ghostwriter und Buchautor",
    style: "Schreibe ausschließlich in vollständig ausgearbeiteten Absätzen. Keine Stichpunkte, keine Aufzählungen, keine Bulletpoints.",
    structure: "Beginne mit einer kurzen Einführung, dann thematische Abschnitte mit Zwischenüberschriften.",
    lengthHint: "Ein Transkript von 10 Minuten ergibt mindestens 2000-3000 Wörter Kapiteltext."
  },
  workbook: {
    role: "Trainingsdesigner und Workbook-Autor",
    style: "Kombiniere erklärende Fließtext-Abschnitte mit praktischen Elementen: Reflexionsfragen, Übungen, Checklisten, Platz für eigene Notizen (markiert mit '📝 Dein Raum:'). Verwende Aufzählungen nur für Übungen und Checklisten.",
    structure: "Beginne mit einem kurzen Impuls, dann Wissensvermittlung mit eingestreuten Praxisübungen, am Ende eine Zusammenfassung und eine Transferübung.",
    lengthHint: "Ein Transkript von 10 Minuten ergibt 1500-2500 Wörter mit Übungen."
  },
  training: {
    role: "Trainingsexperte und didaktischer Autor",
    style: "Didaktisch strukturiert mit klaren Lernzielen, Kernbotschaften und Praxistransfer. Verwende 'Merke:'-Kästen für Kernaussagen. Jeder Abschnitt hat ein konkretes Lernziel.",
    structure: "Beginne mit Lernzielen, dann didaktisch aufgebaute Abschnitte, jeweils mit Theorie → Beispiel → Praxistransfer, am Ende ein Fazit mit Handlungsempfehlungen.",
    lengthHint: "Ein Transkript von 10 Minuten ergibt 1500-2500 Wörter Trainingsmaterial."
  },
  newsletter: {
    role: "Newsletter-Autor und Content-Spezialist",
    style: "Direkt, kompakt, scanbar. Kurze Absätze (2-3 Sätze). Spitze Einstiege. Klare Takeaways. Ein Gedanke pro Absatz.",
    structure: "Hook-Einstieg, dann 3-5 prägnante Kernpunkte mit Zwischenüberschriften, abschließend ein CTA oder Denkanstoss.",
    lengthHint: "Ein Transkript von 10 Minuten ergibt 800-1200 Wörter Newsletter-Text."
  }
};

const TONE_CONFIGS = {
  professionell: "Professioneller, kompetenter Ton. Du-Form, aber mit Substanz und Autorität.",
  locker: "Lockerer, nahbarer Ton. Wie ein Gespräch unter Kollegen. Du-Form, persönlich, mit Humor wo es passt.",
  sachlich: "Sachlicher, nüchterner Ton. Faktenorientiert, präzise, ohne Füllwörter. Klar und direkt.",
  inspirierend: "Inspirierender, motivierender Ton. Energie und Begeisterung, ohne dabei unseriös zu werden."
};

const DETAIL_CONFIGS = {
  ausfuehrlich: "Arbeite jeden Gedanken vollständig aus. Ausführliche Erklärungen, Beispiele, Kontextualisierung. Nichts zusammenfassen — alles voll ausarbeiten.",
  standard: "Ausgewogene Ausarbeitung. Kerngedanken vollständig, Nebenaspekte straff. Gute Balance zwischen Tiefe und Lesbarkeit.",
  kompakt: "Auf den Punkt. Keine Wiederholungen, keine Ausschweifungen. Jeder Satz muss Mehrwert liefern. Kurze Absätze."
};

function buildSystemPrompt(template, tone, detail) {
  const t = TEMPLATE_CONFIGS[template] || TEMPLATE_CONFIGS.buch;
  const toneDesc = TONE_CONFIGS[tone] || TONE_CONFIGS.professionell;
  const detailDesc = DETAIL_CONFIGS[detail] || DETAIL_CONFIGS.standard;

  return `Du bist ein ${t.role}. Deine Aufgabe ist es, aus einem gesprochenen Transkript ein vollständig ausgearbeitetes Kapitel zu erstellen.

## Schreibregeln (zwingend einzuhalten):

1. **Stil:** ${t.style}
2. **Ton:** ${toneDesc}
3. **Ausführlichkeit:** ${detailDesc}
4. **Kein Gendern:** Verwende das generische Maskulinum.
5. **Keine Emojis:** Niemals Emojis verwenden.
6. **Kein Ampersand:** Schreibe immer "und" statt "&".
7. **Verbotene Wörter:** Verwende NIEMALS: eintauchen, entdecken, enthüllen, erobern, umarmen, Haltung.
8. **Gedankenstriche:** Sparsam verwenden, nach deutscher Zeichensetzung.
9. **Kapitelstruktur:** ${t.structure}
10. **Substanz beibehalten:** Folge dem Transkript inhaltlich. Bereinige Redundanzen, Füllwörter und Wiederholungen, aber behalte alle inhaltlichen Punkte bei.
11. **Übergänge:** Schaffe natürliche Übergänge zwischen den Abschnitten.
12. **Länge:** ${t.lengthHint}

## Output-Format:
- Gib das Kapitel als Markdown zurück
- Beginne mit dem Kapiteltext (KEINE Kapitelüberschrift H1 - die wird separat gesetzt)
- Verwende ## für Zwischenüberschriften und ### für Unterabschnitte
- Keine Metakommentare, keine Erklärungen - nur den Kapiteltext`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, model, audience, template, tone, detail, transcript, chapterTitle, bookTitle, chapterNumber } =
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
  const systemPrompt = buildSystemPrompt(template || 'buch', tone || 'professionell', detail || 'standard');

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: selectedModel,
      max_tokens: 16000,
      system: systemPrompt,
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
