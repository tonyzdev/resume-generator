#!/usr/bin/env node

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import path from 'path';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 使用本地测试文件
const localFile = './test-resume.pdf';
const absolutePath = path.resolve(localFile);
console.log('Absolute path:', absolutePath);

console.log('\n=== Using browser_run_code for upload ===\n');

// 使用 Playwright 代码直接设置文件
const code = `
async (page) => {
  // 查找文件输入元素
  const fileInput = await page.locator('input[type="file"]').first();

  if (fileInput) {
    console.log('Found file input');
    await fileInput.setInputFiles('${absolutePath}');
    console.log('File set successfully');

    // 等待上传完成
    await page.waitForTimeout(3000);

    return { success: true };
  } else {
    return { success: false, error: 'File input not found' };
  }
}
`;

try {
  const result = await mcp.callTool('browser_run_code', { code });
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error.message);
}

// 检查结果
await mcp.wait(3);
const snapshot = await mcp.snapshot();
const hasFile = snapshot.match(/\.pdf|\.docx|\.txt/i);
console.log('\nFile detected:', hasFile ? `Yes (${hasFile[0]})` : 'No');

await mcp.close();
