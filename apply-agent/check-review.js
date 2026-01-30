import puppeteer from 'puppeteer-core';

const response = await fetch('http://localhost:9222/json/version');
const versionInfo = await response.json();
const browser = await puppeteer.connect({
  browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
  defaultViewport: null
});

const pages = await browser.pages();
const page = pages.find(p => p.url().includes('indeed.com'));

// 检查页面上的所有文本内容，找错误或必填提示
const pageInfo = await page.evaluate(() => {
  const info = {
    errors: [],
    required: [],
    sections: []
  };

  // 找错误提示
  document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"]').forEach(el => {
    const text = el.textContent?.trim();
    if (text) info.errors.push(text);
  });

  // 找必填标记
  document.querySelectorAll('[class*="required"], *:has(> span:contains("*"))').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 100) info.required.push(text);
  });

  // 找所有 section 标题
  document.querySelectorAll('h2, h3, [role="heading"]').forEach(el => {
    const text = el.textContent?.trim();
    if (text) info.sections.push(text);
  });

  return info;
});

console.log('页面信息:');
console.log('错误:', pageInfo.errors.length ? pageInfo.errors : '无');
console.log('必填:', pageInfo.required.length ? pageInfo.required : '无');
console.log('章节:', pageInfo.sections);

// 检查提交按钮状态
const submitBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => 
    b.textContent?.includes('提交') || b.textContent?.includes('Submit')
  );
  return btn ? { text: btn.textContent?.trim(), disabled: btn.disabled } : null;
});

console.log('\n提交按钮:', submitBtn);

await browser.disconnect();
