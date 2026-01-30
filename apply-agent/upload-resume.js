#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import path from 'path';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

console.log('📄 上传简历...');

// 找到文件输入框
const fileInput = await page.$('input[type="file"]');
if (fileInput) {
  const resumePath = path.resolve('./temp-resume.pdf');
  await fileInput.uploadFile(resumePath);
  console.log('✓ 已上传:', resumePath);
  
  // 等待上传完成
  await new Promise(r => setTimeout(r, 3000));
  
  // 点击 Continue
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Continue') || b.textContent?.includes('繼續')
    );
    if (btn && !btn.disabled) btn.click();
  });
  console.log('✓ 已点击 Continue');
} else {
  console.log('❌ 未找到文件上传框');
}

await new Promise(r => setTimeout(r, 2000));
console.log('✓ 新页面:', await page.title());

await browser.disconnect();
