#!/usr/bin/env node

import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';
import { findButton } from './core/snapshot_parser.js';
import { ResumeLoader } from './modules/resume_loader.js';

const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 加载简历
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');

console.log('Resume PDF:', resume.pdfPath);
console.log('\n=== Testing Upload Flow ===\n');

// 1. 获取当前页面
let snapshot = await mcp.snapshot();
console.log('Current URL:', snapshot.match(/Page URL: (.+)/)?.[1]);

// 2. 查找 "Select file" 按钮
const selectFileBtn = findButton(snapshot, 'select file');
if (selectFileBtn) {
  console.log(`Found "Select file" button (ref=${selectFileBtn.ref})`);
  console.log('Clicking button...');
  await mcp.click(selectFileBtn.text, selectFileBtn.ref);
  await mcp.wait(1);
} else {
  console.log('❌ Select file button not found');
}

// 3. 上传文件
console.log(`\nUploading: ${resume.pdfPath}`);
try {
  await mcp.fileUpload([resume.pdfPath]);
  console.log('✓ File upload command sent');
} catch (error) {
  console.error('✗ Upload failed:', error.message);
}

// 4. 等待上传完成
console.log('\nWaiting for upload...');
await mcp.wait(5);

// 5. 检查结果
snapshot = await mcp.snapshot();
const hasFile = snapshot.match(/\.pdf|\.docx|\.txt/i);
console.log('File detected:', hasFile ? `Yes (${hasFile[0]})` : 'No');

const continueBtn = findButton(snapshot, 'continue');
console.log('Continue button:', continueBtn ? `Found (active: ${snapshot.includes('[active]')})` : 'Not found');

// 6. 尝试点击 Continue
if (continueBtn && hasFile) {
  console.log('\n✓ Upload successful! Clicking Continue...');
  await mcp.click(continueBtn.text, continueBtn.ref);
  await mcp.wait(1);

  try {
    await mcp.callTool('browser_handle_dialog', { accept: true });
    console.log('Handled dialog');
  } catch {}

  await mcp.wait(5);

  snapshot = await mcp.snapshot();
  console.log('\n=== After Continue ===');
  console.log('New URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
  const progress = snapshot.match(/(\d+)%/);
  console.log('Progress:', progress ? progress[1] + '%' : 'Unknown');
} else {
  console.log('\n⚠️  Upload may have failed or Continue not ready');
}

await mcp.close();
