import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

console.log('Getting current page snapshot...\n');
const snapshot = await mcp.snapshot();

console.log('Page URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
console.log('Page Title:', snapshot.match(/Page Title: (.+)/)?.[1]);
console.log('\nSearching for buttons...\n');

const lines = snapshot.split('\n');
lines.forEach((line, i) => {
  if (line.includes('button') && line.includes('ref=')) {
    console.log(`Line ${i}: ${line.trim()}`);
  }
});

await fs.writeFile('current_page.txt', snapshot);
console.log('\nFull snapshot saved to current_page.txt');

await mcp.close();
