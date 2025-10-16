/**
 * Comprehensive test suite for provider rotation system
 * Uses mocks to avoid consuming real API credits
 */

const ProviderRotation = require('../provider_rotation.js');

// Mock provider functions that don't make real API calls
const mockProviders = [
  {
    name: 'groq',
    fn: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Groq response', role: 'assistant' } }]
    }),
    limit: 30,
    priority: 1,
    fallback: true
  },
  {
    name: 'gemini',
    fn: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Gemini response', role: 'assistant' } }]
    }),
    limit: 15,
    priority: 2,
    fallback: true
  },
  {
    name: 'qwen',
    fn: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Qwen response', role: 'assistant' } }]
    }),
    limit: 1000,
    priority: 3,
    fallback: true
  },
  {
    name: 'claude',
    fn: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Claude response', role: 'assistant' } }]
    }),
    limit: 50,
    priority: 4,
    fallback: false
  }
];

// Mock usage tracking
const mockUsage = { groq: 0, gemini: 0, qwen: 0, claude: 0 };
const mockGetUsage = jest.fn().mockImplementation((providerName) => mockUsage[providerName] || 0);
const mockIncrementUsage = jest.fn().mockImplementation((providerName) => {
  mockUsage[providerName] = (mockUsage[providerName] || 0) + 1;
});

describe('ProviderRotation', () => {
  let rotation;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    Object.keys(mockUsage).forEach(key => mockUsage[key] = 0);

    // Reset provider function mocks
    mockProviders.forEach(provider => {
      provider.fn.mockResolvedValue({
        choices: [{ message: { content: `${provider.name} response`, role: 'assistant' } }]
      });
    });

    rotation = new ProviderRotation(mockProviders, mockGetUsage, mockIncrementUsage);
  });

  describe('Provider Selection', () => {
    test('should select first available provider by priority', async () => {
      const provider = await rotation.selectProvider('Hello world');
      expect(provider.name).toBe('groq');
    });

    test('should skip providers at their limit', async () => {
      mockUsage.groq = 30; // At limit
      mockUsage.gemini = 0;

      const provider = await rotation.selectProvider('Hello world');
      expect(provider.name).toBe('gemini');
    });

    test('should return null when all providers are at limit', async () => {
      mockUsage.groq = 30;
      mockUsage.gemini = 15;
      mockUsage.qwen = 1000;
      mockUsage.claude = 50;

      const provider = await rotation.selectProvider('Hello world');
      expect(provider).toBeNull();
    });

    test('should prioritize Qwen for coding requests', async () => {
      const result = await rotation.executeWithProvider('Write some code for me', [], {}, 'test');
      expect(result.provider).toBe('qwen');
    });
  });

  describe('Code Detection', () => {
    test('should detect coding requests correctly', () => {
      const codingMessages = [
        'Write a Python function',
        'Create an API endpoint',
        'Build a React component',
        'Implement a sorting algorithm',
        'Write some code for me'
      ];

      codingMessages.forEach(message => {
        expect(rotation.isCodeRequest(message)).toBe(true);
      });
    });

    test('should not detect general requests as coding', () => {
      const generalMessages = [
        'Hello world',
        'How are you?',
        'What is the weather?',
        'Tell me a joke',
        'Explain quantum physics'
      ];

      generalMessages.forEach(message => {
        expect(rotation.isCodeRequest(message)).toBe(false);
      });
    });
  });

  describe('Provider Execution', () => {
    test('should execute with first available provider', async () => {
      const result = await rotation.executeWithProvider('Hello', [], {}, 'test');

      expect(result.provider).toBe('groq');
      expect(result.response).toBeDefined();
      expect(mockIncrementUsage).toHaveBeenCalledWith('groq');
    });

    test('should handle provider failures gracefully', async () => {
      mockProviders[0].fn.mockRejectedValue(new Error('API Error'));

      const result = await rotation.executeWithProvider('Hello', [], {}, 'test');

      expect(result.provider).toBe('gemini');
      expect(mockIncrementUsage).toHaveBeenCalledWith('gemini');
    });

    test('should throw error when all providers fail', async () => {
      mockProviders.forEach(provider => {
        provider.fn.mockRejectedValue(new Error('API Error'));
      });

      await expect(rotation.executeWithProvider('Hello', [], {}, 'test'))
        .rejects.toThrow('All providers are at their usage limits');
    });
  });

  describe('Usage Tracking', () => {
    test('should track usage correctly', async () => {
      const result = await rotation.executeWithProvider('Hello', [], {}, 'test');

      expect(result.provider).toBe('groq');
      expect(mockGetUsage).toHaveBeenCalledWith('groq');
      expect(mockIncrementUsage).toHaveBeenCalledWith('groq');
    });

    test('should respect usage limits', async () => {
      mockUsage.groq = 30; // At limit

      const result = await rotation.executeWithProvider('Hello', [], {}, 'test');
      expect(result.provider).toBe('gemini');
    });
  });
});

describe('Provider Rotation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockUsage).forEach(key => mockUsage[key] = 0);
  });

  test('should handle complete rotation cycle', async () => {
    const rotation = new ProviderRotation(mockProviders, mockGetUsage, mockIncrementUsage);

    // First request - should use Groq
    let result = await rotation.executeWithProvider('Hello', [], {}, 'test');
    expect(result.provider).toBe('groq');

    // Set Groq at limit, should use Gemini
    mockUsage.groq = 30;
    result = await rotation.executeWithProvider('Hello', [], {}, 'test');
    expect(result.provider).toBe('gemini');

    // Set Gemini at limit, should use Qwen
    mockUsage.gemini = 15;
    result = await rotation.executeWithProvider('Hello', [], {}, 'test');
    expect(result.provider).toBe('qwen');
  });
});
