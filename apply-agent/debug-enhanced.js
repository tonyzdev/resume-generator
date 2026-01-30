#!/usr/bin/env node

/**
 * 增强调试脚本 - 处理对话框并等待页面加载
 */

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.log('Usage: node debug-enhanced.js <url>');
    process.exit(1);
  }

  console.log('🔍 Enhanced Debug Mode\n');

  try {
    const config = await loadConfig('./config/config.json');
    const mcp = new MCPClient();
    await mcp.connect(config.chrome.cdpEndpoint);

    console.log(`Navigating to: ${url}\n`);
    await mcp.navigate(url);

    // 多次尝试获取快照
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`\n--- Attempt ${attempt} ---`);
      await mcp.wait(3);

      const snapshot = await mcp.snapshot();
      console.log(`Snapshot length: ${snapshot.length} chars`);

      // 检查对话框
      if (snapshot.includes('beforeunload') || snapshot.includes('dialog')) {
        console.log('⚠️  Detected dialog, dismissing...');
        try {
          await mcp.callTool('browser_handle_dialog', { accept: true });
          await mcp.wait(2);
          continue;
        } catch (error) {
          console.log('Failed to handle dialog:', error.message);
        }
      }

      // 显示快照内容
      console.log('\nSnapshot content:');
      console.log('='.repeat(60));
      const lines = snapshot.split('\n').slice(0, 50);
      lines.forEach((line, i) => {
        console.log(`${String(i + 1).padStart(3, ' ')} | ${line}`);
      });
      console.log('='.repeat(60));

      // 检查是否有实际内容
      if (snapshot.length > 100 && !snapshot.includes('beforeunload')) {
        console.log('\n✓ Page loaded successfully!');

        // 保存完整快照
        const filename = `debug_full_snapshot_${Date.now()}.txt`;
        await fs.writeFile(filename, snapshot);
        console.log(`✓ Full snapshot saved to: ${filename}`);
        break;
      }

      if (attempt === 5) {
        console.log('\n⚠️  Page did not load properly after 5 attempts');
        console.log('Possible issues:');
        console.log('  1. Not logged into Indeed');
        console.log('  2. Job URL expired or invalid');
        console.log('  3. Page requires manual interaction');
      }
    }

    await mcp.close();

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
