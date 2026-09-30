import type { IncomingMessage, ServerResponse } from 'http';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface BuildingPartSummary {
  meshName: string;
  displayName: string;
  category: string;
}

interface GuideRequestBody {
  messages?: ChatMessage[];
  buildingParts?: BuildingPartSummary[];
}

// Tool definitions for Groq tool-calling
const GUIDE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'highlightPart',
      description: 'Highlight a specific part in the 3D view',
      parameters: {
        type: 'object',
        properties: {
          meshName: {
            type: 'string',
            description: 'The exact meshName of the part to highlight',
          },
        },
        required: ['meshName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'isolatePart',
      description: 'Isolate a specific part, hiding all others',
      parameters: {
        type: 'object',
        properties: {
          meshName: {
            type: 'string',
            description: 'The exact meshName of the part to isolate',
          },
        },
        required: ['meshName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'showParts',
      description:
        'Show a specific set of parts together, hiding everything else. Use this when discussing multiple related parts as a group (e.g. all roof tiers), instead of calling isolatePart repeatedly in sequence.',
      parameters: {
        type: 'object',
        properties: {
          meshNames: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of exact meshNames of the parts to show together',
          },
        },
        required: ['meshNames'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearIsolation',
      description: 'Exit isolate mode, show all parts again',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setExplodeAmount',
      description: 'Set the explode slider (0–100)',
      parameters: {
        type: 'object',
        properties: {
          percent: {
            type: 'number',
            description: 'The explode percentage from 0 to 100',
            minimum: 0,
            maximum: 100,
          },
        },
        required: ['percent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearSelection',
      description: 'Deselect everything, return to default view',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

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

  let body: GuideRequestBody = {};
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

  const { messages, buildingParts } = body;

  if (!Array.isArray(messages)) {
    return sendJson(400, {
      error: 'Missing or invalid "messages" parameter. An array of ChatMessage objects is required.',
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return sendJson(500, {
      error: 'Server configuration error: GROQ_API_KEY is not configured.',
    });
  }

  // Format parts list for the system prompt
  const partsListText = Array.isArray(buildingParts) && buildingParts.length > 0
    ? buildingParts
      .map((p) => `- ${p.displayName} (meshName: "${p.meshName}")`)
      .join('\n')
    : '(No parts metadata provided)';

  const systemPromptContent =
    `You are a spoken architecture tour guide for a 3D building viewer. You can see and control the model via tools. The only real parts in this building are:\n${partsListText}\n\nYou must NEVER reference or call a tool on a part name that isn't in this list. When explaining something spatially, use your tools to actually show it — e.g. highlight or isolate the part you're currently discussing — rather than only describing it in text. When explaining more than one related part together, prefer a single showParts call with all relevant mesh names, rather than isolating them one at a time. Use genuine, general real architectural knowledge; never invent specific history, dates, or facts tied to this particular model, which is a hobbyist study asset, not a documented landmark.`;

  // Prepend system prompt to conversation messages
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPromptContent },
    ...messages,
  ];

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: fullMessages,
        tools: GUIDE_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 300,
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
        error: `AI service error: ${errorDetails || 'Failed to communicate with AI guide.'}`,
      });
    }

    const data = await groqResponse.json();
    const choiceMessage = data.choices?.[0]?.message;

    if (!choiceMessage) {
      return sendJson(502, {
        error: 'AI service returned an empty choice response.',
      });
    }

    // Return the raw response's choices[0].message (content, tool_calls, etc.)
    return sendJson(200, choiceMessage);
  } catch (error: any) {
    console.error('[guide handler network/runtime error]:', error);
    return sendJson(500, {
      error: error?.message || 'Internal server error while processing guide request.',
    });
  }
}
