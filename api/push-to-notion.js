export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { notionToken, title, content, tags, relevance, dataSourceId, source, status } = req.body;

  if (!notionToken || !title || !content) {
    return res.status(400).json({ error: "notionToken, title, and content are required" });
  }

  const dsId = dataSourceId || "1e231cc6-fd56-81fc-963c-000b0aa534b4";

  // Build properties
  const properties = {
    Name: { title: [{ text: { content: title } }] },
    Status: { status: { name: status || "Not started" } }
  };

  // Add Tags if provided
  if (tags && Array.isArray(tags) && tags.length > 0) {
    properties.Tags = {
      multi_select: tags.map(t => ({ name: t }))
    };
  }

  // Add Relevance if provided
  if (relevance && Array.isArray(relevance) && relevance.length > 0) {
    properties.Relevance = {
      multi_select: relevance.map(r => ({ name: r }))
    };
  }

  // Add Source if provided
  if (source) {
    properties.Quelle = {
      rich_text: [{ text: { content: source } }]
    };
  }

  // Add Datum (today)
  properties.Datum = {
    date: { start: new Date().toISOString().split('T')[0] }
  };

  // Convert markdown content to Notion blocks
  const blocks = markdownToNotionBlocks(content);

  try {
    // Create page in Notion
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        parent: { database_id: dsId },
        properties,
        children: blocks.slice(0, 100) // Notion API limit: 100 blocks per request
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Notion API error: ${response.status}`);
    }

    const data = await response.json();

    // If more than 100 blocks, append in batches
    if (blocks.length > 100) {
      const pageId = data.id;
      for (let i = 100; i < blocks.length; i += 100) {
        const batch = blocks.slice(i, i + 100);
        await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
          },
          body: JSON.stringify({ children: batch })
        });
      }
    }

    return res.status(200).json({
      success: true,
      pageId: data.id,
      url: data.url
    });
  } catch (error) {
    console.error("Notion API error:", error);
    return res.status(500).json({ error: error.message || "Fehler beim Speichern in Notion" });
  }
}

function markdownToNotionBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.replace(/^## /, '').replace(/\*\*/g, '') } }]
        }
      });
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: line.replace(/^### /, '').replace(/\*\*/g, '') } }]
        }
      });
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineFormatting(line.trim().replace(/^\d+\.\s/, ''))
        }
      });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line.trim())) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineFormatting(line.trim().replace(/^[-*]\s/, ''))
        }
      });
      i++;
      continue;
    }

    // Letter list items (a), b), c)) — treat as bullet
    if (/^[a-z]\)\s/.test(line.trim())) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineFormatting(line.trim())
        }
      });
      i++;
      continue;
    }

    // Regular paragraph — collect lines until empty or heading
    let paragraphText = '';
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !/^\d+\.\s/.test(lines[i].trim()) && !/^[-*]\s/.test(lines[i].trim())) {
      if (paragraphText) paragraphText += ' ';
      paragraphText += lines[i].trim();
      i++;
    }

    if (paragraphText) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: parseInlineFormatting(paragraphText)
        }
      });
    }

    if (i < lines.length && lines[i].trim() === '') i++;
  }

  return blocks;
}

function parseInlineFormatting(text) {
  const richText = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      richText.push({
        type: 'text',
        text: { content: text.slice(lastIndex, match.index) }
      });
    }

    if (match[2]) {
      richText.push({
        type: 'text',
        text: { content: match[2] },
        annotations: { bold: true, italic: true }
      });
    } else if (match[3]) {
      richText.push({
        type: 'text',
        text: { content: match[3] },
        annotations: { bold: true }
      });
    } else if (match[4]) {
      richText.push({
        type: 'text',
        text: { content: match[4] },
        annotations: { italic: true }
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    richText.push({
      type: 'text',
      text: { content: text.slice(lastIndex) }
    });
  }

  if (richText.length === 0) {
    richText.push({ type: 'text', text: { content: text } });
  }

  return richText;
}
