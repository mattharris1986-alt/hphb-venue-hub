exports.handler = async function(event, context) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable not set' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    let { messages, system, model, max_tokens, tools } = body;
    model = model || 'claude-sonnet-4-20250514';
    max_tokens = max_tokens || 1000;

    // Agentic loop — handles web_search tool use automatically
    let finalText = '';
    let iterations = 0;

    while (iterations < 8) {
      iterations++;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens, system, tools, messages }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        };
      }

      // Collect text from this turn
      if (data.content) {
        data.content.forEach(b => {
          if (b.type === 'text') finalText += b.text;
        });
      }

      // Done — return the text
      if (data.stop_reason === 'end_turn') break;

      // Claude wants to use a tool — feed results back and loop
      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
        if (!toolUseBlocks.length) break;

        // Add Claude's response (including tool_use blocks) to messages
        messages = [...messages, { role: 'assistant', content: data.content }];

        // Build tool_result blocks — for web_search Anthropic handles the actual
        // search; we just need to acknowledge each tool_use so the loop continues
        const toolResults = toolUseBlocks.map(tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: tu.type === 'web_search_tool_result'
            ? tu.content  // pass through actual search results if present
            : 'Search completed.',
        }));

        messages = [...messages, { role: 'user', content: toolResults }];
        finalText = ''; // reset — wait for the final answer text
        continue;
      }

      break;
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text: finalText || 'No response generated.' }]
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
