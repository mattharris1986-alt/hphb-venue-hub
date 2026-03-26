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

  try {
    const body = JSON.parse(event.body);
    const API_KEY = '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';

    // web_search_20250305 is a built-in Anthropic tool - the API handles the search
    // internally and returns text blocks in the response. No tool loop needed.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Extract all text blocks from the response
    let finalText = '';
    if (data.content && Array.isArray(data.content)) {
      data.content.forEach(block => {
        if (block.type === 'text') {
          finalText += block.text;
        }
      });
    }

    // Always return with CORS headers
    return {
      statusCode: response.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        finalText
          ? { content: [{ type: 'text', text: finalText }] }
          : data  // return raw data if no text found so we can debug
      ),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
