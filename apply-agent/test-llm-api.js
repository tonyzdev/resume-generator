#!/usr/bin/env node

/**
 * 测试 LLM API 连接
 */

import { LLMClient } from './utils/llm_client.js';
import { loadConfig } from './utils/config_loader.js';

console.log('🧪 Testing LLM API Connection\n');

const config = await loadConfig('./config/config.json');

// 测试原始配置
console.log('=== Test 1: Original API Base ===');
console.log('API Base:', config.llm.apiBase);
console.log('Model:', config.llm.model);

const llm1 = new LLMClient(config.llm);

try {
  const response = await llm1.complete('Say "Hello" if you can hear me.');
  console.log('✓ Success!');
  console.log('Response:', response);
} catch (error) {
  console.error('✗ Failed:', error.message);
}

// 测试加上 /v1
console.log('\n=== Test 2: API Base with /v1 ===');
const configWithV1 = {
  ...config.llm,
  apiBase: config.llm.apiBase + '/v1'
};
console.log('API Base:', configWithV1.apiBase);

const llm2 = new LLMClient(configWithV1);

try {
  const response = await llm2.complete('Say "Hello" if you can hear me.');
  console.log('✓ Success!');
  console.log('Response:', response);
} catch (error) {
  console.error('✗ Failed:', error.message);
}

console.log('\n✓ Test completed');
