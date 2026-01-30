#!/usr/bin/env node

/**
 * 调试脚本 - 查看页面快照以了解实际结构
 */

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.log('Usage: node debug-snapshot.js <url>');
    console.log('Example: node debug-snapshot.js "https://smartapply.indeed.com/..."');
    process.exit(1);
  }

  console.log('🔍 Debug Mode - Capturing page snapshot\n');

  try {
    // 加载配置
    const config = await loadConfig('./config/config.json');

    // 连接 MCP
    console.log('Connecting to MCP...');
    const mcp = new MCPClient();
    await mcp.connect(config.chrome.cdpEndpoint);

    // 导航到页面
    console.log(`Navigating to: ${url}\n`);
    await mcp.navigate(url);

    // 等待页面加载
    console.log('Waiting for page to load...');
    await mcp.wait(5);

    // 获取快照
    console.log('Capturing snapshot...\n');
    const snapshot = await mcp.snapshot();

    // 保存到文件
    const filename = `debug_snapshot_${Date.now()}.txt`;
    await fs.writeFile(filename, snapshot);

    console.log('✓ Snapshot saved to:', filename);
    console.log('\nFirst 100 lines of snapshot:\n');
    console.log('='.repeat(60));

    // 显示前100行
    const lines = snapshot.split('\n').slice(0, 100);
    lines.forEach((line, i) => {
      console.log(`${String(i + 1).padStart(3, ' ')} | ${line}`);
    });

    console.log('='.repeat(60));
    console.log(`\nTotal lines: ${snapshot.split('\n').length}`);
    console.log(`\nFull snapshot saved to: ${filename}`);

    // 关闭
    await mcp.close();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
