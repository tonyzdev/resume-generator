import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

// 选择 "是"
await page.evaluate(() => {
  const radios = document.querySelectorAll('input[type="radio"]');
  for (const radio of radios) {
    const label = document.querySelector(`label[for="${radio.id}"]`);
    if (label?.textContent?.includes('是')) {
      radio.click();
      break;
    }
  }
});

console.log('✓ 选择: 是');
await new Promise(r => setTimeout(r, 1000));

// 点击 Continue
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => 
    (b.textContent?.includes('繼續') || b.textContent?.includes('Continue')) && 
    b.offsetParent !== null && !b.disabled
  );
  if (btn) btn.click();
});

console.log('✓ 点击 Continue');
await new Promise(r => setTimeout(r, 2000));
console.log('新页面:', await page.title());

await browser.disconnect();
