import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

// 检查错误信息
const errors = await page.evaluate(() => {
  const errorElements = document.querySelectorAll('[class*="error"], [class*="invalid"], [role="alert"]');
  return Array.from(errorElements).map(e => e.textContent?.trim()).filter(t => t);
});

console.log('错误信息:', errors.length ? errors : '无');

// 检查所有 Continue 按钮
const buttons = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.textContent?.trim(),
    disabled: b.disabled,
    visible: b.offsetParent !== null,
    classes: b.className
  })).filter(b => b.text?.includes('繼續') || b.text?.includes('Continue'));
});

console.log('\nContinue 按钮:');
buttons.forEach((b, i) => {
  console.log(`  ${i+1}. "${b.text}" disabled=${b.disabled} visible=${b.visible}`);
});

// 尝试点击第一个可见的 Continue
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  for (const btn of btns) {
    const text = btn.textContent?.trim() || '';
    if ((text.includes('繼續') || text.includes('Continue')) && !btn.disabled && btn.offsetParent !== null) {
      btn.scrollIntoView();
      btn.click();
      return btn.textContent?.trim();
    }
  }
  return null;
});

console.log('\n点击结果:', clicked || '未找到可点击按钮');

await new Promise(r => setTimeout(r, 3000));
console.log('新页面:', await page.title());

await browser.disconnect();
