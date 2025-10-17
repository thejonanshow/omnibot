# 🛡️ Anti-Hallucination Strategy

## Problem Statement

AI models can hallucinate facts, make up features, or provide incorrect information. We need a robust system to detect and prevent hallucinations in our AI responses.

## Solution: Multi-Model Consensus System

### Core Concept: 3-Node Swarm for Fact-Checking

**Default Configuration:**
- **Node 1**: Primary model (Qwen for code, Groq for general)
- **Node 2**: Verification model (different provider/model)
- **Node 3**: Consensus model (lightweight, fast)

**Cost Threshold**: Max 3x cost per request (3 models vs 1)

### Implementation Architecture

```javascript
async function handleRequestWithConsensus(message, env, sessionId) {
  const isCodeRequest = isCodeImplementationRequest(message);
  
  // Determine swarm configuration
  const swarmConfig = getSwarmConfig(message, env);
  
  if (swarmConfig.enabled) {
    return await executeConsensusSwarm(message, swarmConfig, env, sessionId);
  } else {
    // Fallback to single model
    return await handleChat(message, [], env, sessionId);
  }
}

async function executeConsensusSwarm(message, config, env, sessionId) {
  // Spawn 3 models in parallel
  const [primary, verification, consensus] = await Promise.all([
    callPrimaryModel(message, config.primary, env, sessionId),
    callVerificationModel(message, config.verification, env, sessionId),
    callConsensusModel(message, config.consensus, env, sessionId)
  ]);
  
  // Analyze consensus
  const consensusResult = await analyzeConsensus(primary, verification, consensus);
  
  if (consensusResult.confidence > 0.8) {
    return consensusResult.response;
  } else {
    // Low confidence - flag for human review
    return await handleLowConfidence(consensusResult, env);
  }
}
```

### Swarm Configurations

#### 1. Code Implementation Swarm
```javascript
const codeSwarmConfig = {
  enabled: true,
  primary: { provider: 'qwen', model: 'qwen2.5:7b' },
  verification: { provider: 'groq', model: 'llama3-8b' },
  consensus: { provider: 'gemini', model: 'gemini-2.0-flash' },
  maxCost: 0.15, // $0.15 max per request
  timeout: 30000 // 30 seconds
};
```

#### 2. General Knowledge Swarm
```javascript
const generalSwarmConfig = {
  enabled: true,
  primary: { provider: 'groq', model: 'llama3-8b' },
  verification: { provider: 'gemini', model: 'gemini-2.0-flash' },
  consensus: { provider: 'qwen', model: 'qwen2.5:7b' },
  maxCost: 0.10, // $0.10 max per request
  timeout: 20000 // 20 seconds
};
```

#### 3. Fact-Checking Swarm
```javascript
const factCheckSwarmConfig = {
  enabled: true,
  primary: { provider: 'claude', model: 'claude-3-haiku' },
  verification: { provider: 'groq', model: 'llama3-8b' },
  consensus: { provider: 'gemini', model: 'gemini-2.0-flash' },
  maxCost: 0.20, // $0.20 max per request
  timeout: 25000 // 25 seconds
};
```

### Consensus Analysis

```javascript
async function analyzeConsensus(primary, verification, consensus) {
  const responses = [primary, verification, consensus];
  
  // 1. Semantic similarity analysis
  const similarities = await calculateSimilarities(responses);
  
  // 2. Fact extraction and comparison
  const facts = await extractFacts(responses);
  const factConsensus = await compareFacts(facts);
  
  // 3. Code quality analysis (for code requests)
  const codeQuality = await analyzeCodeQuality(responses);
  
  // 4. Confidence scoring
  const confidence = calculateConfidence(similarities, factConsensus, codeQuality);
  
  return {
    confidence,
    response: selectBestResponse(responses, confidence),
    analysis: {
      similarities,
      factConsensus,
      codeQuality,
      disagreements: findDisagreements(responses)
    }
  };
}
```

### Cost Management

```javascript
class SwarmCostManager {
  constructor(env) {
    this.dailyBudget = env.SWARM_DAILY_BUDGET || 5.00; // $5/day default
    this.requestLimit = env.SWARM_REQUEST_LIMIT || 100; // 100 requests/day
    this.currentSpend = 0;
    this.requestCount = 0;
  }
  
  async canAffordSwarm(config) {
    const estimatedCost = this.estimateCost(config);
    const dailySpend = await this.getDailySpend();
    
    return (dailySpend + estimatedCost) <= this.dailyBudget;
  }
  
  estimateCost(config) {
    // Estimate cost based on model and request complexity
    const modelCosts = {
      'qwen2.5:7b': 0.00, // Free on Runloop
      'llama3-8b': 0.05,
      'gemini-2.0-flash': 0.03,
      'claude-3-haiku': 0.08
    };
    
    return (modelCosts[config.primary.model] || 0.05) +
           (modelCosts[config.verification.model] || 0.05) +
           (modelCosts[config.consensus.model] || 0.05);
  }
}
```

### Hallucination Detection

```javascript
class HallucinationDetector {
  async detectHallucination(response, context) {
    const checks = await Promise.all([
      this.checkFactualAccuracy(response),
      this.checkCodeValidity(response),
      this.checkConsistencyWithContext(response, context),
      this.checkForMadeUpFeatures(response),
      this.checkForImpossibleClaims(response)
    ]);
    
    const hallucinationScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    
    return {
      isHallucination: hallucinationScore > 0.7,
      score: hallucinationScore,
      details: checks
    };
  }
  
  async checkForMadeUpFeatures(response) {
    // Check if response mentions features that don't exist
    const knownFeatures = await this.getKnownFeatures();
    const mentionedFeatures = this.extractFeatures(response);
    
    const unknownFeatures = mentionedFeatures.filter(f => !knownFeatures.includes(f));
    
    return {
      score: unknownFeatures.length / mentionedFeatures.length,
      unknownFeatures
    };
  }
}
```

### Implementation Plan

#### Phase 1: Basic Consensus (Week 1)
- [ ] Implement 3-node swarm for code requests
- [ ] Add cost estimation and budgeting
- [ ] Basic consensus analysis (similarity scoring)

#### Phase 2: Advanced Detection (Week 2)
- [ ] Fact extraction and comparison
- [ ] Hallucination detection algorithms
- [ ] Confidence scoring system

#### Phase 3: Optimization (Week 3)
- [ ] Cost optimization (use cheaper models for consensus)
- [ ] Performance optimization (parallel execution)
- [ ] Adaptive swarm sizing based on request complexity

### Configuration Options

```javascript
// Environment variables for swarm control
const swarmConfig = {
  ENABLE_SWARM: 'true',
  SWARM_DAILY_BUDGET: '5.00',
  SWARM_REQUEST_LIMIT: '100',
  SWARM_MIN_CONFIDENCE: '0.8',
  SWARM_TIMEOUT: '30000',
  SWARM_FALLBACK_TO_SINGLE: 'true'
};
```

### Benefits

1. **Reduced Hallucinations**: Multiple models catch each other's mistakes
2. **Higher Confidence**: Consensus provides confidence scores
3. **Cost Control**: Budget limits prevent runaway costs
4. **Adaptive**: Can disable swarm for simple requests
5. **Transparent**: Shows analysis and disagreements

### Fallback Strategy

```javascript
async function handleLowConfidence(consensusResult, env) {
  if (env.SWARM_FALLBACK_TO_SINGLE === 'true') {
    // Fall back to single model with warning
    const fallbackResponse = await callPrimaryModel(consensusResult.originalMessage, env);
    
    return {
      ...fallbackResponse,
      warning: 'Low consensus confidence - response may be less reliable',
      consensus: consensusResult
    };
  } else {
    // Request human review
    return {
      response: 'I need human review for this request due to low confidence.',
      consensus: consensusResult,
      requiresHumanReview: true
    };
  }
}
```

### Monitoring and Metrics

```javascript
// Track swarm performance
const swarmMetrics = {
  totalRequests: 0,
  consensusRequests: 0,
  lowConfidenceRequests: 0,
  averageConfidence: 0,
  totalCost: 0,
  hallucinationDetections: 0
};
```

This system provides a robust defense against hallucinations while maintaining cost control and performance.
