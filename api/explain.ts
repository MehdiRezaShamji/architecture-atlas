import type { IncomingMessage, ServerResponse } from 'http';

interface ExplainRequestBody {
  displayName?: string;
  romanizedTerm?: string;
  category?: string;
  description?: string;
}

export default async function handler(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse & {
    status?: (statusCode: number) => any;
    json?: (body: any) => any;
  }
) {
  const sendJson = (statusCode: number, data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(405, { error: 'Method not allowed. Use POST.' });
  }

  let body: ExplainRequestBody = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      body = rawBody ? JSON.parse(rawBody) : {};
    }
  } catch {
    return sendJson(400, { error: 'Invalid JSON request body.' });
  }

  const { displayName, romanizedTerm, category, description } = body;

  if (!displayName || !category || !description) {
    return sendJson(400, {
      error: 'Missing required fields: displayName, category, and description are required.',
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return sendJson(500, {
      error: 'Server configuration error: GROQ_API_KEY is not configured.',
    });
  }

  const systemPrompt =
    "You are an architecture guide helping someone understand a specific part of a building. You will be given a part's name, category, and a short factual description. Using genuine, general real-world architectural knowledge, explain this part in more depth than the description alone: why it exists structurally or functionally, how it typically relates to neighboring parts of a structure like this, and relevant comparisons to similar features in other architectural traditions if relevant. Important: this specific 3D model is a hobbyist asset, not a documented historical landmark. Never invent specific dates, names, historical events, or claims tied to this particular building — stick to real, general knowledge about this type of architectural feature. Keep your answer to 2-4 short paragraphs.";

  const userMessage = [
    `Part Name: ${displayName}`,
    romanizedTerm ? `Romanized Term: ${romanizedTerm}` : null,
    `Category: ${category}`,
    `Description: ${description}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      let errorDetails = '';
      try {
        const errorJson = await groqResponse.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetails = await groqResponse.text();
      }
      console.error(`[Groq API error ${groqResponse.status}]:`, errorDetails);
      return sendJson(groqResponse.status >= 500 ? 502 : groqResponse.status, {
        error: `AI service error: ${errorDetails || 'Failed to generate explanation.'}`,
      });
    }

    const data = await groqResponse.json();
    const explanation = data.choices?.[0]?.message?.content?.trim();

    if (!explanation) {
      return sendJson(502, {
        error: 'AI service returned an empty explanation.',
      });
    }

    return sendJson(200, { explanation });
  } catch (error: any) {
    console.error('[explain handler network/runtime error]:', error);
    return sendJson(500, {
      error: error?.message || 'Internal server error while generating explanation.',
    });
  }
}
