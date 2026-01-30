#!/usr/bin/env node

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

const TEST_URL = 'https://smartapply.indeed.com/beta/indeedapply/applybyapplyablejobid?indeedApplyableJobId=98df2269-88ca-4d88-a2fe-a5f0ddbc56a5-Y21o&iaUid=1jf0mp2j921k1001&iststd=1';

console.log('Navigating to:', TEST_URL);
await mcp.navigate(TEST_URL);
await mcp.wait(3);

// 处理初始对话框
let snapshot = await mcp.snapshot();
if (snapshot.includes('beforeunload')) {
  console.log('Dismissing initial dialog...');
  await mcp.callTool('browser_handle_dialog', { accept: true });
  await mcp.wait(2);
}

snapshot = await mcp.snapshot();
console.log('\nCurrent URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
console.log('Current Title:', snapshot.match(/Page Title: (.+)/)?.[1]);

const progress = snapshot.match(/(\d+)%/);
console.log('Progress:', progress ? progress[1] + '%' : 'Unknown');

await mcp.close();
console.log('\n✓ Ready for testing');
