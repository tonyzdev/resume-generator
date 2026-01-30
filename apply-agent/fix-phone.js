import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

console.log('📞 修复电话号码...');

// 找到电话输入框并清空重填
const phoneInput = await page.$('input[type="tel"], input[name*="phone"], input[id*="phone"]');
if (phoneInput) {
  await phoneInput.click({ clickCount: 3 }); // 选中全部
  await phoneInput.type('5551234567'); // 输入新号码
  console.log('✓ 已输入新电话: 5551234567');
} else {
  // 尝试通过 aria-label 找
  const input = await page.$('input[aria-label*="電話"], input[aria-label*="phone"]');
  if (input) {
    await input.click({ clickCount: 3 });
    await input.type('5551234567');
    console.log('✓ 已输入新电话: 5551234567');
  } else {
    console.log('❌ 未找到电话输入框');
  }
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
