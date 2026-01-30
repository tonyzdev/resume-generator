#!/usr/bin/env node

/**
 * 详细调试 - 查看表单填写和点击的详细过程
 */

import { MCPClient } from './core/mcp_client.js';
import { parseFormFields, findButton } from './core/snapshot_parser.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

const TEST_URL = 'https://smartapply.indeed.com/beta/indeedapply/applybyapplyablejobid?indeedApplyableJobId=98df2269-88ca-4d88-a2fe-a5f0ddbc56a5-Y21o&iaUid=1jf0mp2j921k1001&iststd=1';

async function main() {
  console.log('🔍 Detailed Debug - Form Filling Process\n');

  const config = await loadConfig('./config/config.json');
  const mcp = new MCPClient();
  await mcp.connect(config.chrome.cdpEndpoint);

  console.log('Navigating...');
  await mcp.navigate(TEST_URL);
  await mcp.wait(3);

  // 处理对话框
  let snapshot = await mcp.snapshot();
  if (snapshot.includes('beforeunload')) {
    console.log('Dismissing dialog...');
    await mcp.callTool('browser_handle_dialog', { accept: true });
    await mcp.wait(2);
    snapshot = await mcp.snapshot();
  }

  console.log('\n=== STEP 1: Parse Fields ===');
  const fields = parseFormFields(snapshot);
  console.log(`Found ${fields.length} fields:`);
  fields.forEach((f, i) => {
    console.log(`  ${i + 1}. [${f.type}] "${f.label}" (ref=${f.ref})`);
  });

  console.log('\n=== STEP 2: Fill Fields ===');
  for (const field of fields) {
    const label = field.label.toLowerCase();
    let value = '';

    if (label.includes('zip')) {
      value = '10001';
    } else if (label.includes('city')) {
      value = 'New York, NY';
    } else if (label.includes('street') || label.includes('address')) {
      value = '123 Main St';
    }

    if (value) {
      console.log(`Filling "${field.label}" with "${value}"...`);
      try {
        if (field.type === 'textbox') {
          await mcp.type(field.label, field.ref, value);
        } else if (field.type === 'combobox') {
          await mcp.selectOption(field.label, field.ref, [value]);
        }
        console.log(`  ✓ Success`);
        await mcp.wait(0.5);
      } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
      }
    }
  }

  console.log('\n=== STEP 3: Find Continue Button ===');
  snapshot = await mcp.snapshot();
  const continueBtn = findButton(snapshot, 'continue');
  if (continueBtn) {
    console.log(`Found button: "${continueBtn.text}" (ref=${continueBtn.ref})`);
  } else {
    console.log('❌ Continue button not found!');
    await fs.writeFile('debug_no_button.txt', snapshot);
    console.log('Snapshot saved to debug_no_button.txt');
  }

  console.log('\n=== STEP 4: Click Continue ===');
  if (continueBtn) {
    try {
      await mcp.click(continueBtn.text, continueBtn.ref);
      console.log('✓ Clicked');
    } catch (error) {
      console.log(`✗ Click failed: ${error.message}`);
    }
  }

  console.log('\n=== STEP 5: Wait and Check Result ===');
  await mcp.wait(3);
  snapshot = await mcp.snapshot();

  const newUrl = snapshot.match(/Page URL: (.+)/);
  console.log(`New URL: ${newUrl ? newUrl[1] : 'unknown'}`);

  // 检查是否有错误消息
  if (snapshot.toLowerCase().includes('error') || snapshot.toLowerCase().includes('required')) {
    console.log('\n⚠️  Possible validation errors detected:');
    const lines = snapshot.split('\n');
    lines.forEach(line => {
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('required')) {
        console.log(`  - ${line.trim()}`);
      }
    });
  }

  await fs.writeFile('debug_after_click.txt', snapshot);
  console.log('\nFull snapshot saved to debug_after_click.txt');

  await mcp.close();
}

main().catch(console.error);
