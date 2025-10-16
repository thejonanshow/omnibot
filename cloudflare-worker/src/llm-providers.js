/**
 * LLM Provider API calls
 */

import { getSharedContext } from './lib/context.js';

const API_ENDPOINTS = {
  GROQ: 'https://api.groq.com/openai/v1/chat/completions',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  CLAUDE: 'https://api.anthropic.com/v1/messages',
};

export async function callGroq(message, conversation, env, sessionId) {
  const context = await getSharedContext(env.CONTEXT, sessionId);

  const systemPrompt = `You are Omnibot, an AI assistant with access to powerful tools.

SHARED CONTEXT (from previous sessions):
${JSON.stringify(context, null, 2)}

You can use tools to help users with coding, web research, file management, and more.`;

  const response = await fetch(API_ENDPOINTS.GROQ, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversation,
        { role: 'user', content: message }
      ],
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq failed: ${response.status} - ${error}`);
  }
  
  return response.json();
}

export async function callGemini(message, conversation, env, sessionId) {
  const context = await getSharedContext(env.CONTEXT, sessionId);

  const systemPrompt = `You are Omnibot, an AI assistant.

SHARED CONTEXT: ${JSON.stringify(context, null, 2)}`;

  const response = await fetch(`${API_ENDPOINTS.GEMINI}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...conversation.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();

  return {
    choices: [{
      message: {
        content: data.candidates[0].content.parts[0].text,
        role: 'assistant'
      }
    }]
  };
}

export async function callQwen(message, conversation, env, sessionId) {
  // Mock implementation - returns template code
  const codingResponse = `Here's a coding solution for: "${message}"

\`\`\`python
def solve_problem():
    """
    Solution for: ${message}
    """
    result = "Implementation placeholder"
    return result

if __name__ == "__main__":
    output = solve_problem()
    print(output)
\`\`\`

**Implementation Notes:**
- This is a template implementation
- Customize for your specific requirements
- Add error handling and validation
- Follow best practices

I'm Qwen, specialized in coding tasks!`;

  return {
    choices: [{
      message: {
        content: codingResponse,
        role: 'assistant'
      }
    }]
  };
}

export async function callClaude(message, conversation, env, sessionId) {
  const context = await getSharedContext(env.CONTEXT, sessionId);

  const systemPrompt = `You are Omnibot, an AI assistant.

SHARED CONTEXT: ${JSON.stringify(context, null, 2)}`;

  const response = await fetch(API_ENDPOINTS.CLAUDE, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...conversation, { role: 'user', content: message }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Claude failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();

  return {
    choices: [{
      message: {
        content: data.content[0].text,
        role: 'assistant'
      }
    }]
  };
}
