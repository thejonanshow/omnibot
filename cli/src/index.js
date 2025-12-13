/**
 * Omnibot CLI - Main entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { loadConfig, saveConfig, isLoggedIn, getConfigPath, getBaseUrl } from './config.js';
import { whoami, chat, health } from './api.js';

const program = new Command();

program
  .name('omnibot')
  .description('Command-line interface for Omnibot AI assistant')
  .version('1.0.0');

/**
 * Login command
 */
program
  .command('login')
  .description('Configure access token and base URL')
  .option('-t, --token <token>', 'Access token')
  .option('-b, --base-url <url>', 'Base URL (default: https://omnibot.jonanscheffler.workers.dev)')
  .action(async (options) => {
    try {
      if (!options.token) {
        console.error(chalk.red('Error: --token is required'));
        console.log(chalk.yellow('\nUsage: omnibot login --token <TOKEN> [--base-url <URL>]'));
        console.log(chalk.dim('\nNote: Tokens must be provisioned manually in the CLI_TOKENS KV namespace.'));
        process.exit(1);
      }

      // Basic access token validation
      const token = options.token;
      // Example: at least 20 chars, alphanumeric plus dash/underscore
      const tokenPattern = /^[A-Za-z0-9\-_]{20,}$/;
      if (typeof token !== 'string' || !tokenPattern.test(token)) {
        console.error(chalk.red('Error: Invalid access token. Tokens must be at least 20 characters and contain only letters, numbers, dashes, or underscores.'));
        process.exit(1);
      }

      const config = loadConfig();
      config.accessToken = token;

      if (options.baseUrl) {
        config.baseUrl = options.baseUrl;
      }

      saveConfig(config);

      console.log(chalk.green('✓ Login successful!'));
      console.log(chalk.dim(`  Config saved to: ${getConfigPath()}`));
      console.log(chalk.dim(`  Base URL: ${config.baseUrl}`));
      console.log(chalk.dim('\nRun "omnibot whoami" to verify your credentials.'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Whoami command
 */
program
  .command('whoami')
  .description('Show current user information')
  .action(async () => {
    try {
      if (!isLoggedIn()) {
        console.error(chalk.red('Error: Not logged in'));
        console.log(chalk.yellow('Run "omnibot login" first.'));
        process.exit(1);
      }

      const user = await whoami();
      
      console.log(chalk.green('✓ Authenticated\n'));
      console.log(chalk.bold('User Information:'));
      console.log(`  ID:     ${user.id}`);
      console.log(`  Email:  ${user.email || 'N/A'}`);
      console.log(`  Source: ${user.source}`);
      console.log(`  Scopes: ${user.scopes.join(', ')}`);
      console.log(chalk.dim(`\n  Base URL: ${getBaseUrl()}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Chat command (interactive and one-shot modes)
 */
program
  .command('chat')
  .description('Chat with Omnibot (interactive REPL or one-shot)')
  .option('-m, --message <message>', 'Send a single message (one-shot mode)')
  .option('-c, --conversation-id <id>', 'Continue a specific conversation')
  .action(async (options) => {
    try {
      if (!isLoggedIn()) {
        console.error(chalk.red('Error: Not logged in'));
        console.log(chalk.yellow('Run "omnibot login" first.'));
        process.exit(1);
      }

      // One-shot mode
      if (options.message) {
        await oneShot(options.message, options.conversationId);
        return;
      }

      // Interactive REPL mode
      await interactive(options.conversationId);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Health check command
 */
program
  .command('health')
  .description('Check API health status')
  .action(async () => {
    try {
      const status = await health();
      
      console.log(chalk.green('✓ API is healthy\n'));
      console.log(chalk.bold('Status:'));
      console.log(`  OK:      ${status.ok}`);
      console.log(`  Version: ${status.versionFull || status.versionString || 'N/A'}`);
      console.log(chalk.dim(`\n  Base URL: ${getBaseUrl()}`));
    } catch (error) {
      console.error(chalk.red(`✗ API is unhealthy`));
      console.error(chalk.red(`  Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * One-shot chat: send a single message and exit
 */
async function oneShot(message, conversationId) {
  console.log(chalk.dim('Sending message...'));
  
  const response = await chat(message, conversationId);
  
  console.log(chalk.cyan('\nYou:'));
  console.log(`  ${message}`);
  console.log(chalk.green('\nOmnibot:'));
  console.log(`  ${response.response}`);
  
  if (!conversationId) {
    console.log(chalk.dim(`\n  Conversation ID: ${response.conversation_id}`));
    console.log(chalk.dim('  Use -c to continue this conversation.'));
  }
}

/**
 * Interactive REPL: maintain a conversation
 */
async function interactive(initialConversationId) {
  let conversationId = initialConversationId;
  
  console.log(chalk.green('✓ Omnibot Chat (Interactive Mode)'));
  console.log(chalk.dim('  Type your message and press Enter. Type "exit" to quit.\n'));
  
  if (conversationId) {
    console.log(chalk.dim(`  Continuing conversation: ${conversationId}\n`));
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('You> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const message = line.trim();

    if (!message) {
      rl.prompt();
      return;
    }

    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
      console.log(chalk.dim('\nGoodbye!'));
      rl.close();
      process.exit(0);
    }

    try {
      const response = await chat(message, conversationId);
      
      if (!conversationId) {
        conversationId = response.conversation_id;
        console.log(chalk.dim(`[Started conversation ${conversationId}]`));
      }

      console.log(chalk.green('Omnibot> ') + response.response);
      console.log(); // blank line
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.dim('\nGoodbye!'));
    process.exit(0);
  });
}

/**
 * Parse and execute CLI
 */
export function run(argv) {
  program.parse(argv);
}
