#!/usr/bin/env node

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import { findButton } from './core/snapshot_parser.js';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

console.log('Getting current page snapshot...\n');
let snapshot = await mcp.snapshot();

console.log('Page URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
console.log('Page Title:', snapshot.match(/Page Title: (.+)/)?.[1]);

// 查找 Continue 按钮
const continueBtn = findButton(snapshot, 'continue');
if (continueBtn) {
  console.log(`\nFound Continue button: "${continueBtn.text}" (ref=${continueBtn.ref})`);
  console.log('Clicking Continue...');

  await mcp.click(continueBtn.text, continueBtn.ref);
  await mcp.wait(1);

  // 处理对话框
  try {
    await mcp.callTool('browser_handle_dialog', { accept: true });
    console.log('Handled dialog');
  } catch (error) {
    console.log('No dialog to handle');
  }

  // 等待页面跳转
  console.log('Waiting for page transition...');
  await mcp.wait(5);

  // 获取新页面
  snapshot = await mcp.snapshot();
  console.log('\n=== After clicking Continue ===');
  console.log('New URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
  console.log('New Title:', snapshot.match(/Page Title: (.+)/)?.[1]);

  // 检查进度
  const progressMatch = snapshot.match(/(\d+)%/);
  if (progressMatch) {
    console.log('Progress:', progressMatch[1] + '%');
  }
} else {
  console.log('\n❌ Continue button not found');
}

await mcp.close();
