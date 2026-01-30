#!/usr/bin/env node
import puppeteer from 'puppeteer-core';

console.log('🔌 Connecting to Chrome...');

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
let page = pages.find(p => p.url().includes('smartapply.indeed.com'));

if (!page) {
  console.log('❌ 没有找到 Indeed 页面');
  process.exit(1);
}

console.log('✓ 找到页面:', await page.title());

// 点击 Continue
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent?.includes('Continue') || b.textContent?.includes('繼續')
  );
  if (btn) btn.click();
});

console.log('✓ 已点击 Continue');
await new Promise(r => setTimeout(r, 2000));
console.log('✓ 新页面:', await page.title());

await browser.disconnect();
