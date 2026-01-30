import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

console.log('📍 填写地址...');

// 填写邮编
const zipInput = await page.$('input[id*="postal"], input[name*="postal"], input[aria-label*="郵遞區號"]');
if (zipInput) {
  await zipInput.click({ clickCount: 3 });
  await zipInput.type('10001');
  console.log('✓ 邮编: 10001');
}

// 填写街道地址
const addressInput = await page.$('input[id*="address"], input[name*="address"], input[aria-label*="地址"]');
if (addressInput) {
  await addressInput.click({ clickCount: 3 });
  await addressInput.type('123 Main St');
  console.log('✓ 地址: 123 Main St');
}

await new Promise(r => setTimeout(r, 1000));

// 点击 Continue
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => 
    (b.textContent?.includes('繼續') || b.textContent?.includes('Continue')) && 
    b.offsetParent !== null
  );
  if (btn) btn.click();
});

console.log('✓ 点击 Continue');
await new Promise(r => setTimeout(r, 2000));
console.log('新页面:', await page.title());

await browser.disconnect();
