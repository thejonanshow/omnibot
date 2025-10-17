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
  const context = await getSharedContext(env.CONTEXT, sessionId);

  // Determine Qwen endpoint based on environment
  const isLocal = env.NODE_ENV === 'development';
  const qwenUrl = isLocal
    ? 'http://localhost:11434'
    : env.QWEN_RUNLOOP_URL || 'https://dbx_test.runloop.dev:8000';

  // Log which Qwen instance is being used
  console.log(`Using Qwen instance: ${qwenUrl} (${isLocal ? 'local' : 'remote'})`);

  // Build conversation context
  const conversationText = conversation
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are Qwen, a specialized coding AI assistant.

SHARED CONTEXT (from previous sessions):
${JSON.stringify(context, null, 2)}

CONVERSATION HISTORY:
${conversationText}

You specialize in:
- Code generation and implementation
- Debugging and optimization
- Best practices and patterns
- Technical explanations

Provide helpful, production-ready code with clear explanations.`;

  try {
    // Try local Qwen first if in development
    if (isLocal) {
      try {
        return await callLocalQwen(message, systemPrompt, qwenUrl);
      } catch (localError) {
        console.log(`Local Qwen unavailable: ${localError.message}`);
        
        // Skip fallback if explicitly disabled (for testing)
        if (env.DISABLE_QWEN_FALLBACK === 'true') {
          throw localError;
        }
        
        console.log('Falling back to Runloop Qwen...');

        // Fallback to Runloop Qwen
        const runloopUrl = env.QWEN_RUNLOOP_URL || 'https://dbx_test.runloop.dev:8000';
        return await callRunloopQwen(message, systemPrompt, runloopUrl);
      }
    } else {
      // Use Runloop Qwen directly in staging/production
      return await callRunloopQwen(message, systemPrompt, qwenUrl);
    }
  } catch (error) {
    console.error(`Qwen call failed: ${error.message}`);
    throw new Error(`Qwen failed: ${error.message}`);
  }
}

async function callLocalQwen(message, systemPrompt, baseUrl) {
  // Call local Ollama Qwen
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:7b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Local Qwen failed: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();

  return {
    choices: [{
      message: {
        content: data.message?.content || 'No response generated',
        role: 'assistant'
      }
    }]
  };
}

async function callRunloopQwen(message, systemPrompt, baseUrl) {
  // Call Runloop Qwen server
  const response = await fetch(`${baseUrl}/qwen/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation: [{ role: 'system', content: systemPrompt }],
      sessionId: 'default'
    })
  });

  if (!response.ok) {
    throw new Error(`Runloop Qwen failed: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();

  return {
    choices: [{
      message: {
        content: data.response || 'No response generated',
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
