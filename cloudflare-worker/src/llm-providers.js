/**

- LLM Provider implementations
- 
- This module provides functions to call various LLM providers
- with consistent interfaces and error handling.
  */

// Qwen/Alibaba Cloud API endpoint
const QWEN_API_ENDPOINT = ‘https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation’;

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
  console.log(’[Qwen] No API key configured, skipping’);
  throw new Error(‘Qwen API key not configured’);
  }

const apiKey = env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;

// Build messages array
const messages = [
{
role: ‘system’,
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
…conversation.map(m => ({
role: m.role,
content: m.content
})),
{
role: ‘user’,
content: message
}
];

console.log(`[Qwen] Calling API with ${messages.length} messages`);

try {
const response = await fetch(QWEN_API_ENDPOINT, {
method: ‘POST’,
headers: {
‘Authorization’: `Bearer ${apiKey}`,
‘Content-Type’: ‘application/json’
},
body: JSON.stringify({
model: ‘qwen-max’, // or ‘qwen-plus’, ‘qwen-turbo’
input: {
messages: messages
},
parameters: {
result_format: ‘message’,
max_tokens: 4096,
temperature: 0.7,
top_p: 0.8
}
})
});

```
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
```

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
  export async function callQwenOpenAI(message, conversation, env, sessionId) {
  const apiKey = env.QWEN_API_KEY || env.DASHSCOPE_API_KEY;

if (!apiKey) {
throw new Error(‘Qwen API key not configured’);
}

// OpenAI-compatible endpoint (if available)
const endpoint = env.QWEN_OPENAI_ENDPOINT || ‘https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions’;

const messages = [
{
role: ‘system’,
content: ‘You are a helpful AI assistant specialized in code generation and technical tasks.’
},
…conversation,
{ role: ‘user’, content: message }
];

const response = await fetch(endpoint, {
method: ‘POST’,
headers: {
‘Authorization’: `Bearer ${apiKey}`,
‘Content-Type’: ‘application/json’
},
body: JSON.stringify({
model: ‘qwen-max’,
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

- Test if Qwen API is available and working
- 
- @param {Object} env - Environment bindings
- @returns {Promise<boolean>} True if Qwen is available
  */
  export async function testQwenConnection(env) {
  try {
  const result = await callQwen(‘Say “OK” if you can hear me.’, [], env, ‘test’);
  return result.choices?.[0]?.message?.content?.includes(‘OK’) ?? false;
  } catch (error) {
  console.error(’[Qwen] Connection test failed:’, error.message);
  return false;
  }
  }