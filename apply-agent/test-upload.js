#!/usr/bin/env node

import { ResumeLoader } from './modules/resume_loader.js';
import { MCPClient } from './core/mcp_client.js';
import { loadConfig } from './utils/config_loader.js';

console.log('🧪 Testing Resume Upload\n');

// 1. 测试简历加载
console.log('=== Step 1: Load Resume ===');
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');

console.log('Resume name:', resume.name);
console.log('PDF path:', resume.pdfPath);
console.log('PDF exists:', resume.pdfPath ? 'Yes' : 'No');

if (!resume.pdfPath) {
  console.error('❌ PDF path not set!');
  process.exit(1);
}

// 2. 测试文件上传
console.log('\n=== Step 2: Test File Upload ===');
const config = await loadConfig('./config/config.json');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 导航到测试页面
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

// 填写地址（快速跳过）
console.log('\nFilling address...');
snapshot = await mcp.snapshot();
const fields = snapshot.match(/textbox "Zip code" \[ref=(\w+)\]/);
if (fields) {
  await mcp.type('Zip code', fields[1], '10001');
  await mcp.wait(0.5);

  const cityField = snapshot.match(/combobox "City, State" \[ref=(\w+)\]/);
  if (cityField) {
    await mcp.selectOption('City, State', cityField[1], ['New York, NY']);
  }

  const streetField = snapshot.match(/textbox "Street address" \[ref=(\w+)\]/);
  if (streetField) {
    await mcp.type('Street address', streetField[1], '123 Main St');
  }

  // 点击 Continue
  const continueBtn = snapshot.match(/button "Continue" \[ref=(\w+)\]/);
  if (continueBtn) {
    await mcp.click('Continue', continueBtn[1]);
    await mcp.wait(1);
    try {
      await mcp.callTool('browser_handle_dialog', { accept: true });
    } catch {}
    await mcp.wait(3);
  }
}

// 现在应该在简历上传页面
console.log('\n=== Step 3: Upload Resume ===');
snapshot = await mcp.snapshot();

console.log('Current URL:', snapshot.match(/Page URL: (.+)/)?.[1]);
console.log('Current Title:', snapshot.match(/Page Title: (.+)/)?.[1]);

// 查找上传按钮
const uploadBtnMatch = snapshot.match(/button "([^"]*[Uu]pload[^"]*)" \[ref=(\w+)\]/);
if (uploadBtnMatch) {
  console.log(`Found upload button: "${uploadBtnMatch[1]}" (ref=${uploadBtnMatch[2]})`);
  console.log('Clicking upload button...');
  await mcp.click(uploadBtnMatch[1], uploadBtnMatch[2]);
  await mcp.wait(1);
}

console.log(`\nUploading file: ${resume.pdfPath}`);
try {
  await mcp.fileUpload([resume.pdfPath]);
  console.log('✓ File upload command sent');
} catch (error) {
  console.error('✗ File upload failed:', error.message);
}

// 等待上传完成
console.log('\nWaiting for upload to complete...');
await mcp.wait(5);

// 检查结果
snapshot = await mcp.snapshot();
const hasActiveButton = snapshot.includes('button "Continue" [active]');
console.log('Continue button active:', hasActiveButton ? 'Yes ✓' : 'No ✗');

if (hasActiveButton) {
  console.log('\n✅ Resume uploaded successfully!');
} else {
  console.log('\n⚠️  Resume may not have uploaded correctly');
  console.log('Checking for upload-related elements...');

  const lines = snapshot.split('\n');
  lines.forEach(line => {
    if (line.toLowerCase().includes('upload') || line.toLowerCase().includes('resume') || line.toLowerCase().includes('file')) {
      console.log('  -', line.trim().substring(0, 100));
    }
  });
}

await mcp.close();
