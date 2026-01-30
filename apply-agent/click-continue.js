import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

// 检查是否有错误提示
const errorText = await page.evaluate(() => {
  const alerts = document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"]');
  for (const el of alerts) {
    const text = el.textContent?.trim();
    if (text && text.length > 5) return text;
  }
  return null;
});

if (errorText) {
  console.log('⚠ 错误提示:', errorText);
}

// 点击 Continue
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => 
    (b.textContent?.includes('繼續') || b.textContent?.includes('Continue')) && 
    b.offsetParent !== null && !b.disabled
  );
  if (btn) btn.click();
});

console.log('✓ 点击 Continue');
await new Promise(r => setTimeout(r, 3000));
console.log('新页面:', await page.title());
console.log('URL:', page.url());

await browser.disconnect();
