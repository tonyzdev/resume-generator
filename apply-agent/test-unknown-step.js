#!/usr/bin/env node

/**
 * 测试 Unknown 步骤的智能处理
 */

import { MCPClient } from './core/mcp_client.js';
import { parseFormFields } from './core/snapshot_parser.js';
import { loadConfig } from './utils/config_loader.js';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

console.log('🧪 Testing Unknown Step Handling\n');

// 获取当前页面快照
const snapshot = await mcp.snapshot();

console.log('Current URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
console.log('Current Title:', snapshot.match(/Page Title: (.+)/)?.[1]);

// 解析表单字段
const fields = parseFormFields(snapshot);
console.log(`\nFound ${fields.length} form fields:\n`);

fields.forEach((field, i) => {
  console.log(`${i + 1}. [${field.type}] ${field.label}`);
  console.log(`   ref: ${field.ref}`);
  if (field.question) {
    console.log(`   question: ${field.question}`);
  }
  if (field.value) {
    console.log(`   current value: ${field.value}`);
  }
  console.log();
});

if (fields.length === 0) {
  console.log('⚠️  No form fields found on this page');
  console.log('This page might be:');
  console.log('  - A confirmation page');
  console.log('  - A loading page');
  console.log('  - A page with only buttons');
}

await mcp.close();
console.log('✓ Test completed');
