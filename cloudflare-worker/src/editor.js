/**
 * Editor module for OmniBot
 * Handles self-editing functionality
 */

import { validateGeneratedCode } from './security.js';
import { githubGet, createOrUpdateFileWithPR } from './github.js';
import { callAI } from './ai.js';
import { DEFAULT_MASTER_PROMPT, REQUIRED_FUNCTIONS } from './config.js';
import { logTelemetry } from './telemetry.js';

/**
 * Self-edit functionality
 */
export async function selfEdit(instruction, options, env) {
  const startTime = Date.now();
  const editId = Date.now().toString(36);
  
  console.log(`[SelfEdit ${editId}] Starting edit: ${instruction.substring(0, 100)}...`);
  
  try {
    // Get current code
    console.log(`[SelfEdit ${editId}] Fetching current code...`);
    const file = await githubGet('cloudflare-worker/src/index.js', env);
    const currentCode = decodeURIComponent(escape(atob(file.content)));
    
    // Generate code changes
    console.log(`[SelfEdit ${editId}] Generating code changes...`);
    const codePrompt = createCodeEditPrompt(instruction, currentCode, options);
    
    const aiResponse = await callAI(codePrompt, [], env, 'coding');
    const generatedCode = extractCodeFromResponse(aiResponse.choices[0].message.content);
    
    if (!generatedCode) {
      throw new Error('No code generated');
    }
    
    console.log(`[SelfEdit ${editId}] Generated ${generatedCode.length} characters of code`);
    
    // Validate generated code
    console.log(`[SelfEdit ${editId}] Validating generated code...`);
    const validation = validateGeneratedCode(generatedCode, currentCode);
    
    if (!validation.isValid) {
      console.error(`[SelfEdit ${editId}] Validation failed:`, validation.errors);
      throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`[SelfEdit ${editId}] Validation warnings:`, validation.warnings);
    }
    
    // Apply patch if needed
    let finalCode = generatedCode;
    if (options.patch) {
      console.log(`[SelfEdit ${editId}] Applying patch...`);
      finalCode = applyPatch(currentCode, generatedCode);
    }
    
    // Create commit message
    const commitMessage = options.commitMessage || `Self-edit: ${instruction.substring(0, 50)}${instruction.length > 50 ? '...' : ''}`;
    
    // Create PR with changes
    console.log(`[SelfEdit ${editId}] Creating PR...`);
    const result = await createOrUpdateFileWithPR(
      'cloudflare-worker/src/index.js',
      finalCode,
      commitMessage,
      env
    );
    
    if (!result.success) {
      throw new Error(`Failed to create PR: ${result.error}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[SelfEdit ${editId}] Completed in ${duration}ms`);
    
    // Log telemetry
    await logTelemetry('self_edit', {
      edit_id: editId,
      instruction_length: instruction.length,
      code_length: finalCode.length,
      duration,
      pr_number: result.prNumber,
      success: true
    }, env);
    
    return {
      success: true,
      editId,
      duration,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      branch: result.branch,
      commit: result.commit,
      validationWarnings: validation.warnings
    };
    
  } catch (error) {
    console.error(`[SelfEdit ${editId}] Failed:`, error);
    
    // Log telemetry
    await logTelemetry('self_edit', {
      edit_id: editId,
      instruction_length: instruction.length,
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    }, env);
    
    throw error;
  }
}

/**
 * Create prompt for code editing
 */
function createCodeEditPrompt(instruction, currentCode, options) {
  const _systemPrompt = `${DEFAULT_MASTER_PROMPT}

You are editing the OmniBot source code. Follow these rules:

1. ONLY modify the code as requested in the instruction
2. Preserve ALL existing functionality
3. Maintain the existing code structure and style
4. Ensure the code still works in Cloudflare Workers
5. Include proper error handling
6. Add comments for complex logic
7. NEVER remove required functions: ${REQUIRED_FUNCTIONS.join(', ')}
8. ALWAYS preserve the HTML UI generation

Current code structure:
- 4,000+ lines of JavaScript
- Self-editing capabilities
- Multi-provider AI integration
- Google OAuth authentication
- GitHub PR workflow
- Real-time UI updates

Be extremely careful with changes. Test your logic mentally before implementing.`;

  const userPrompt = `Instruction: ${instruction}

Current code (first 1000 chars):
${currentCode.substring(0, 1000)}...

Please provide the COMPLETE modified code. Do not use patches or partial code.
Return ONLY the full JavaScript code, no explanations or markdown.

Options: ${JSON.stringify(options, null, 2)}`;

  return userPrompt;
}

/**
 * Extract code from AI response
 */
function extractCodeFromResponse(response) {
  // Remove markdown code blocks if present
  let code = response.replace(/```javascript\n/g, '').replace(/```\n?/g, '');
  
  // Trim whitespace
  code = code.trim();
  
  return code;
}

/**
 * Apply patch to code
 */
function applyPatch(originalCode, patch) {
  // Simple patch application - in a real implementation,
  // you'd use a proper diff library
  
  const patchLines = patch.split('\n');
  const originalLines = originalCode.split('\n');
  const resultLines = [];
  
  let i = 0;
  for (const patchLine of patchLines) {
    if (patchLine.startsWith('+')) {
      // Addition
      resultLines.push(patchLine.substring(1));
    } else if (patchLine.startsWith('-')) {
      // Deletion - skip this line from original
      if (i < originalLines.length) {
        i++;
      }
    } else {
      // Context line - copy from original if available
      if (i < originalLines.length) {
        resultLines.push(originalLines[i]);
        i++;
      } else {
        resultLines.push(patchLine);
      }
    }
  }
  
  // Add remaining original lines
  while (i < originalLines.length) {
    resultLines.push(originalLines[i]);
    i++;
  }
  
  return resultLines.join('\n');
}

export default {
  selfEdit
};