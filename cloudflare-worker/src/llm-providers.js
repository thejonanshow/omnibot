/**

- LLM Provider implementations
- 
- This module provides functions to call various LLM providers
- with consistent interfaces and error handling.
  */

// Qwen/Alibaba Cloud API endpoint
const QWEN_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

/**

- Call Qwen (Alibaba Cloud) for code-specialized tasks
- 
- Qwen is particularly strong at code generation and technical tasks.
- We use it as the primary provider for coding requests.
- 
- @param {string} message - User message
- @param {Array} conversation - Conversation history
- @param {Object} env - Environment bindings
- @param {string} sessionId - Session identifier
- @returns {Promise<Object>} Response in OpenAI-compatible format
  */
  export async function callQwen(message, conversation, env, sessionId) {
  // Check if Qwen API key is configured
  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) {
  console.log('[Qwen] No API key configured, skipping');
  throw new Error('Qwen API key not configured');
  }

const apiKey = env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;

// Build messages array
const messages = [
{
role: 'system',
content: `You are Qwen, a highly capable AI assistant specialized in code generation and technical tasks.
You excel at:

- Writing clean, efficient, well-documented code
- Explaining technical concepts clearly
- Debugging and problem-solving
- Providing complete, working implementations

When writing code:

- Include helpful comments
- Handle edge cases
- Follow best practices for the language
- Provide usage examples when helpful

Current session: ${sessionId}`
},
...conversation.map(m => ({
role: m.role,
content: m.content
})),
{
role: 'user',
content: message
}
];

console.log(`[Qwen] Calling API with ${messages.length} messages`);

try {
const response = await fetch(QWEN_API_ENDPOINT, {
method: 'POST',
headers: {
'Authorization': `Bearer ${apiKey}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
model: 'qwen-max', // or 'qwen-plus', 'qwen-turbo'
input: {
messages: messages
},
parameters: {
result_format: 'message',
max_tokens: 4096,
temperature: 0.7,
top_p: 0.8
}
})
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`[Qwen] API error: ${response.status} - ${errorText}`);
  throw new Error(`Qwen API error: ${response.status}`);
}

const data = await response.json();

// Check for API-level errors
if (data.code && data.code !== '200' && data.code !== 'Success') {
  console.error(`[Qwen] Response error: ${data.code} - ${data.message}`);
  throw new Error(`Qwen error: ${data.message || data.code}`);
}

// Extract the response content
const content = data.output?.choices?.[0]?.message?.content 
             || data.output?.text 
             || 'No response generated';

console.log(`[Qwen] Success - ${content.length} chars`);

// Return in OpenAI-compatible format for consistency
return {
  choices: [{
    message: {
      role: 'assistant',
      content: content
    },
    finish_reason: 'stop'
  }],
  usage: data.usage || {},
  provider: 'qwen'
};

} catch (error) {
console.error(`[Qwen] Call failed: ${error.message}`);
throw error;
}
}

/**

- Alternative Qwen implementation using OpenAI-compatible endpoint
- Some Qwen deployments support the OpenAI API format
- 
- @param {string} message - User message
- @param {Array} conversation - Conversation history
- @param {Object} env - Environment bindings
- @param {string} sessionId - Session identifier
- @returns {Promise<Object>} Response in OpenAI-compatible format
  */
  export async function callQwenOpenAI(message, conversation, env, _sessionId) {
  const apiKey = env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;

if (!apiKey) {
throw new Error('Qwen API key not configured');
}

// OpenAI-compatible endpoint (if available)
const endpoint = env.QWEN_OPENAI_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const messages = [
{
role: 'system',
content: 'You are a helpful AI assistant specialized in code generation and technical tasks.'
},
...conversation,
{ role: 'user', content: message }
];

const response = await fetch(endpoint, {
method: 'POST',
headers: {
'Authorization': `Bearer ${apiKey}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
model: 'qwen-max',
messages: messages,
max_tokens: 4096,
temperature: 0.7
})
});

if (!response.ok) {
throw new Error(`Qwen OpenAI-compat error: ${response.status}`);
}

return response.json();
}



/**
 * Call Gemini API for general-purpose tasks
 * 
 * @param {string} message - User message
 * @param {Array} conversation - Conversation history
 * @param {Object} env - Environment bindings
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Response in OpenAI-compatible format
 */
export async function callGemini(message, conversation, env, sessionId) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const messages = [
    {
      role: 'user',
      parts: [{ text: `You are a helpful AI assistant. Current session: ${sessionId}` }]
    },
    ...conversation.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: messages,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Convert to OpenAI-compatible format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    },
    provider: 'gemini'
  };
}

/**
 * Call Claude API for general-purpose tasks
 * 
 * @param {string} message - User message
 * @param {Array} conversation - Conversation history
 * @param {Object} env - Environment bindings
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Response in OpenAI-compatible format
 */
export async function callClaude(message, conversation, env, sessionId) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const messages = [
    {
      role: 'user',
      content: `You are a helpful AI assistant. Current session: ${sessionId}`
    },
    ...conversation.map(m => ({
      role: m.role,
      content: m.content
    })),
    {
      role: 'user',
      content: message
    }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Convert to OpenAI-compatible format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.content?.[0]?.text || 'No response'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    provider: 'claude'
  };
}

/**

- Test if Qwen API is available and working
- 
- @param {Object} env - Environment bindings
- @returns {Promise<boolean>} True if Qwen is available
  */
  export async function testQwenConnection(env) {
  try {
  const result = await callQwen('Say "OK" if you can hear me.', [], env, 'test');
  return result.choices?.[0]?.message?.content?.includes('OK') ?? false;
  } catch (error) {
  console.error('[Qwen] Connection test failed:', error.message);
  return false;
  }
  }