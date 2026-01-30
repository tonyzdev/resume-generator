#!/usr/bin/env node

/**
 * 简单测试：直接点击 "No" radio
 */

import { MCPClient } from './core/mcp_client.js';
import { parseFormFields } from './core/snapshot_parser.js';
import { loadConfig } from './utils/config_loader.js';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

console.log('🧪 Testing Direct Click on "No" Radio\n');

// 获取当前页面
const snapshot = await mcp.snapshot();
const fields = parseFormFields(snapshot);

console.log(`Found ${fields.length} fields:\n`);
fields.forEach((field, i) => {
  console.log(`${i + 1}. [${field.type}] ${field.label} (ref=${field.ref})`);
});

// 找到 "No" 字段
const noField = fields.find(f => f.label === 'No');
if (noField) {
  console.log(`\nClicking "No" (ref=${noField.ref})...`);
  await mcp.click('No', noField.ref);
  console.log('✓ Clicked!');

  // 等待并检查结果
  await mcp.wait(2);
  const newSnapshot = await mcp.snapshot();

  // 检查 Continue 按钮是否可用
  if (newSnapshot.includes('button "Continue" [ref=')) {
    console.log('✓ Continue button found');

    // 检查是否有错误提示
    if (newSnapshot.includes('Choose an option')) {
      console.log('⚠️  Still showing "Choose an option" - selection may not have worked');
    } else {
      console.log('✓ No error message - selection successful!');
    }
  }
} else {
  console.log('✗ "No" field not found');
}

await mcp.close();
console.log('\n✓ Test completed');
