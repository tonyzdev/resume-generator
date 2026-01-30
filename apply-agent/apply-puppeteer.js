#!/usr/bin/env node

/**
 * Indeed 自动申请 - 使用 Puppeteer 直接连接
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import { LLMClient } from './utils/llm_client.js';
import { loadConfig } from './utils/config_loader.js';

console.log('============================================================');
console.log('  Indeed Auto Apply Agent v1.0 (Puppeteer)');
console.log('============================================================\n');

// 加载配置
const config = await loadConfig('./config/config.json');
const llmClient = new LLMClient(config.llm);

// 连接到 Chrome
console.log('🔌 Connecting to Chrome...');

try {
  // 获取 Chrome 信息
  const response = await fetch('http://localhost:9222/json/version');
  const versionInfo = await response.json();
  console.log(`✓ Chrome ${versionInfo.Browser}`);

  // 连接浏览器
  const browser = await puppeteer.connect({
    browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
    defaultViewport: null
  });

  // 获取所有页面
  const pages = await browser.pages();

  // 找到 Indeed 页面
  let page = null;
  for (const p of pages) {
    const url = p.url();
    if (url.includes('smartapply.indeed.com')) {
      page = p;
      break;
    }
  }

  if (!page) {
    console.log('\n❌ 没有找到 Indeed 申请页面！');
    console.log('请先在 Chrome 中打开 Indeed 申请页面');
    await browser.disconnect();
    process.exit(1);
  }

  const title = await page.title();
  console.log(`✓ 找到 Indeed 页面: ${title}\n`);

  // 分析页面
  console.log('📍 分析页面表单...\n');

  // 获取所有表单字段
  const formData = await page.evaluate(() => {
    const result = {
      textInputs: [],
      selects: [],
      radios: [],
      checkboxes: [],
      buttons: []
    };

    // 文本输入框
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea').forEach(el => {
      const label = el.getAttribute('aria-label') ||
                    el.placeholder ||
                    document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                    el.name;
      if (label) {
        result.textInputs.push({
          selector: el.id ? `#${el.id}` : `[name="${el.name}"]`,
          label: label,
          value: el.value,
          name: el.name,
          id: el.id
        });
      }
    });

    // 下拉框
    document.querySelectorAll('select').forEach(el => {
      const label = el.getAttribute('aria-label') ||
                    document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                    el.name;
      const options = Array.from(el.options).map(o => o.text);
      result.selects.push({
        selector: el.id ? `#${el.id}` : `[name="${el.name}"]`,
        label: label,
        options: options,
        value: el.value
      });
    });

    // Radio 按钮
    const radioGroups = {};
    document.querySelectorAll('input[type="radio"]').forEach(el => {
      const name = el.name;
      if (!radioGroups[name]) {
        radioGroups[name] = {
          name: name,
          options: [],
          question: ''
        };
        // 尝试找到问题文本
        const container = el.closest('[role="radiogroup"]') || el.closest('fieldset') || el.parentElement?.parentElement;
        if (container) {
          const questionEl = container.querySelector('legend, [role="heading"], label');
          if (questionEl) {
            radioGroups[name].question = questionEl.textContent?.trim();
          }
        }
      }
      const label = el.getAttribute('aria-label') ||
                    document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
                    el.nextSibling?.textContent?.trim();
      radioGroups[name].options.push({
        value: el.value,
        label: label,
        checked: el.checked,
        selector: el.id ? `#${el.id}` : `[name="${name}"][value="${el.value}"]`
      });
    });
    result.radios = Object.values(radioGroups);

    // 按钮
    document.querySelectorAll('button').forEach(el => {
      result.buttons.push({
        text: el.textContent?.trim(),
        type: el.type,
        disabled: el.disabled,
        selector: el.id ? `#${el.id}` : null
      });
    });

    return result;
  });

  // 显示找到的字段
  console.log(`📝 文本输入框 (${formData.textInputs.length}):`);
  formData.textInputs.forEach(f => {
    console.log(`   - ${f.label}: "${f.value || '(空)'}"`);
  });

  console.log(`\n📝 下拉框 (${formData.selects.length}):`);
  formData.selects.forEach(f => {
    console.log(`   - ${f.label}: ${f.options.slice(0, 3).join(', ')}...`);
  });

  console.log(`\n📝 单选题 (${formData.radios.length}):`);
  formData.radios.forEach(r => {
    console.log(`   - ${r.question || r.name}: ${r.options.map(o => o.label).join(' / ')}`);
  });

  console.log(`\n📝 按钮 (${formData.buttons.length}):`);
  formData.buttons.forEach(b => {
    console.log(`   - "${b.text}" ${b.disabled ? '(disabled)' : ''}`);
  });

  // 开始填写
  console.log('\n\n=== 开始自动填写 ===\n');

  // 填写文本框
  for (const field of formData.textInputs) {
    if (field.value) {
      console.log(`✓ ${field.label}: 已有值 "${field.value}"`);
      continue;
    }

    // 使用 LLM 生成答案
    const prompt = `You are filling out a job application form.
The field label is: "${field.label}"
Provide a short, professional answer. Just the answer, no explanation.
If it's a name field, use "Cassidy King".
If it's an email, use "cassidy.king@email.com".
If it's a phone, use "+1-555-123-4567".
If it's an address, use "123 Main St, New York, NY 10001".`;

    try {
      const answer = await llmClient.complete(prompt);
      console.log(`📝 ${field.label}: "${answer}"`);

      // 填写
      if (field.id) {
        await page.type(`#${field.id}`, answer, { delay: 50 });
      } else if (field.name) {
        await page.type(`[name="${field.name}"]`, answer, { delay: 50 });
      }
      console.log(`✓ 已填写`);
    } catch (error) {
      console.log(`✗ 填写失败: ${error.message}`);
    }
  }

  // 填写单选题
  for (const radio of formData.radios) {
    const question = radio.question || radio.name;
    const options = radio.options.map(o => o.label).join(', ');

    // 使用 LLM 选择答案
    const prompt = `You are filling out a job application form.
Question: "${question}"
Options: ${options}

Which option should be selected? Just respond with the exact option text, nothing else.
For visa/sponsorship questions, answer "No" (assuming the applicant doesn't need sponsorship).
For referral questions, answer "No".`;

    try {
      const answer = await llmClient.complete(prompt);
      console.log(`📝 ${question}: "${answer}"`);

      // 找到匹配的选项并点击
      const matchingOption = radio.options.find(o =>
        o.label?.toLowerCase().includes(answer.toLowerCase()) ||
        answer.toLowerCase().includes(o.label?.toLowerCase())
      );

      if (matchingOption) {
        await page.click(matchingOption.selector);
        console.log(`✓ 已选择: ${matchingOption.label}`);
      } else {
        console.log(`⚠ 未找到匹配选项`);
      }
    } catch (error) {
      console.log(`✗ 选择失败: ${error.message}`);
    }
  }

  // 查找并点击 Continue 按钮
  const continueBtn = formData.buttons.find(b =>
    b.text?.toLowerCase().includes('continue') && !b.disabled
  );

  if (continueBtn) {
    console.log('\n🚀 点击 Continue...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.toLowerCase().includes('continue')
      );
      if (btn) btn.click();
    });
    console.log('✓ 已点击 Continue');
  }

  // 断开连接（不关闭浏览器）
  await browser.disconnect();
  console.log('\n✅ 当前页面填写完成！');
  console.log('💡 如果还有更多步骤，请再次运行此脚本');

} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error.stack);
}

console.log('\n✓ 程序结束');
