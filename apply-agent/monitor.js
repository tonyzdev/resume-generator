#!/usr/bin/env node
/**
 * 页面监控 - 显示当前 Indeed 页面状态
 */
import puppeteer from 'puppeteer-core';

async function monitor() {
  const response = await fetch('http://localhost:9222/json/version');
  const versionInfo = await response.json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('indeed.com'));

  if (!page) {
    console.log('❌ 没有找到 Indeed 页面');
    await browser.disconnect();
    return;
  }

  const title = await page.title();
  const url = page.url();

  console.log('============================================================');
  console.log('📍 当前页面状态');
  console.log('============================================================');
  console.log(`Title: ${title}`);
  console.log(`URL: ${url}`);
  console.log('------------------------------------------------------------');

  // 获取页面表单信息
  const formData = await page.evaluate(() => {
    const data = { inputs: [], radios: [], selects: [], buttons: [] };

    // 输入框
    document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').forEach(el => {
      const label = el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '(无标签)';
      if (!label.includes('recaptcha')) {
        data.inputs.push({ label, value: el.value || '', required: el.required });
      }
    });

    // Radio
    const groups = {};
    document.querySelectorAll('input[type="radio"]').forEach(el => {
      const name = el.name || 'unnamed';
      if (!groups[name]) {
        // 找问题文本
        let question = '';
        const container = el.closest('fieldset, [role="radiogroup"], [role="group"]');
        if (container) {
          const legend = container.querySelector('legend, [role="heading"]');
          if (legend) question = legend.textContent?.trim();
        }
        if (!question) {
          const parent = el.parentElement?.parentElement;
          const prevText = parent?.previousElementSibling?.textContent?.trim();
          if (prevText && prevText.length > 10) question = prevText;
        }
        groups[name] = { question: question || name, options: [], selected: null };
      }
      const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                    el.nextElementSibling?.textContent?.trim() || el.value;
      groups[name].options.push(label);
      if (el.checked) groups[name].selected = label;
    });
    data.radios = Object.values(groups);

    // 下拉框
    document.querySelectorAll('select').forEach(el => {
      const label = el.getAttribute('aria-label') || el.name || el.id;
      const options = Array.from(el.options).map(o => o.text).slice(0, 5);
      data.selects.push({ label, options, value: el.value });
    });

    // 按钮
    document.querySelectorAll('button').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length < 50 && text.length > 0) {
        data.buttons.push({ text, disabled: el.disabled });
      }
    });

    return data;
  });

  // 显示输入框
  if (formData.inputs.length > 0) {
    console.log('\n📝 输入框:');
    formData.inputs.forEach(f => {
      const status = f.value ? '✓' : '○';
      console.log(`   ${status} ${f.label}: "${f.value || '(空)'}"${f.required ? ' *必填' : ''}`);
    });
  }

  // 显示单选题
  if (formData.radios.length > 0) {
    console.log('\n📝 单选题:');
    formData.radios.forEach(r => {
      const status = r.selected ? '✓' : '○';
      console.log(`   ${status} ${r.question}`);
      console.log(`      选项: ${r.options.join(' | ')}`);
      if (r.selected) console.log(`      已选: ${r.selected}`);
    });
  }

  // 显示下拉框
  if (formData.selects.length > 0) {
    console.log('\n📝 下拉框:');
    formData.selects.forEach(s => {
      console.log(`   ${s.label}: ${s.options.join(', ')}...`);
    });
  }

  // 显示按钮
  console.log('\n📝 按钮:');
  formData.buttons.forEach(b => {
    const status = b.disabled ? '(禁用)' : '';
    console.log(`   - "${b.text}" ${status}`);
  });

  console.log('\n============================================================');

  await browser.disconnect();
}

monitor().catch(e => console.error('错误:', e.message));
