#!/usr/bin/env node
/**
 * Indeed 自动申请 - 完整版
 * 自动检测页面状态并执行相应操作
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const RESUME_PATH = path.resolve('./temp-resume.pdf');

async function connect() {
  const response = await fetch('http://localhost:9222/json/version');
  const versionInfo = await response.json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: versionInfo.webSocketDebuggerUrl,
    defaultViewport: null
  });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('indeed.com'));
  return { browser, page };
}

async function detectStep(page) {
  const url = page.url();
  const title = await page.title();

  if (url.includes('contact-info')) return 'contact';
  if (url.includes('resume-selection') && !url.includes('privacy')) return 'resume';
  if (url.includes('privacy-settings')) return 'privacy';
  if (url.includes('questions')) return 'questions';
  if (url.includes('review')) return 'review';
  if (url.includes('work-experience')) return 'experience';

  return 'unknown';
}

async function getFormData(page) {
  return await page.evaluate(() => {
    const data = { inputs: [], radios: [], selects: [], fileInputs: [], buttons: [] };

    // 文本输入
    document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea').forEach(el => {
      const label = el.getAttribute('aria-label') || el.placeholder || el.name || '';
      if (label && !label.includes('recaptcha')) {
        data.inputs.push({ label, value: el.value, id: el.id, name: el.name });
      }
    });

    // Radio 按钮
    const groups = {};
    document.querySelectorAll('input[type="radio"]').forEach(el => {
      const name = el.name;
      if (!groups[name]) {
        let question = '';
        const container = el.closest('fieldset, [role="radiogroup"], [role="group"]');
        if (container) {
          const legend = container.querySelector('legend, [role="heading"]');
          if (legend) question = legend.textContent?.trim();
        }
        groups[name] = { question: question || name, options: [], selected: null };
      }
      const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || el.value;
      groups[name].options.push({ label, value: el.value, id: el.id });
      if (el.checked) groups[name].selected = label;
    });
    data.radios = Object.values(groups);

    // 文件上传
    document.querySelectorAll('input[type="file"]').forEach(el => {
      data.fileInputs.push({ id: el.id, name: el.name });
    });

    // 按钮
    document.querySelectorAll('button').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length < 50) {
        data.buttons.push({ text, disabled: el.disabled });
      }
    });

    return data;
  });
}

async function uploadResume(page) {
  console.log('📄 上传简历...');

  if (!fs.existsSync(RESUME_PATH)) {
    console.log('❌ 简历文件不存在:', RESUME_PATH);
    return false;
  }

  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(RESUME_PATH);
    console.log('✓ 已上传:', RESUME_PATH);
    await new Promise(r => setTimeout(r, 2000));
    return true;
  }

  console.log('⚠ 未找到文件上传框');
  return false;
}

async function selectRadio(page, radioGroup, answer) {
  const option = radioGroup.options.find(o =>
    o.label.toLowerCase().includes(answer.toLowerCase()) ||
    answer.toLowerCase().includes(o.label.toLowerCase())
  );

  if (option && option.id) {
    await page.click(`#${option.id}`);
    return true;
  }
  return false;
}

async function clickContinue(page) {
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const text = b.textContent?.toLowerCase() || '';
      return (text.includes('continue') || text.includes('繼續') || text.includes('继续')) && !b.disabled;
    });
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (clicked) {
    console.log('✓ 点击 Continue');
    await new Promise(r => setTimeout(r, 2000));
  }
  return clicked;
}

async function handleStep(page, step, formData) {
  console.log(`\n📍 当前步骤: ${step}`);

  switch (step) {
    case 'contact':
      // 联系信息通常已填好，直接继续
      console.log('   联系信息页面');
      // 忽略蜜罐字段（反机器人）
      const realInputs = formData.inputs.filter(i =>
        !i.label.includes('人類') && !i.label.includes('human') && !i.label.includes('留空')
      );
      if (realInputs.every(i => i.value)) {
        await clickContinue(page);
      } else {
        console.log('   ⚠ 有未填写的字段');
        realInputs.filter(i => !i.value).forEach(i => console.log(`     - ${i.label}`));
        await clickContinue(page); // 仍然尝试继续
      }
      break;

    case 'resume':
      console.log('   简历上传页面');
      // 检查是否需要上传
      if (formData.fileInputs.length > 0) {
        await uploadResume(page);
      }
      await clickContinue(page);
      break;

    case 'privacy':
      console.log('   隐私设置页面');
      await clickContinue(page);
      break;

    case 'questions':
      console.log('   问题页面');
      // 处理单选题
      for (const radio of formData.radios) {
        if (!radio.selected) {
          console.log(`   问题: ${radio.question}`);
          console.log(`   选项: ${radio.options.map(o => o.label).join(' | ')}`);

          // 简单规则匹配
          let answer = null;
          const q = radio.question.toLowerCase();
          if (q.includes('sponsor') || q.includes('visa') || q.includes('authorization')) {
            answer = 'no';
          } else if (q.includes('refer') || q.includes('relative') || q.includes('employee')) {
            answer = 'no';
          } else if (q.includes('legal') || q.includes('authorized') || q.includes('eligible')) {
            answer = 'yes';
          }

          if (answer) {
            const selected = await selectRadio(page, radio, answer);
            console.log(`   ✓ 选择: ${answer} (${selected ? '成功' : '失败'})`);
          } else {
            console.log('   ⚠ 无法自动回答，请手动选择');
          }
        } else {
          console.log(`   ✓ ${radio.question}: 已选 "${radio.selected}"`);
        }
      }
      await clickContinue(page);
      break;

    case 'review':
      console.log('   审核页面 - 请手动确认提交');
      break;

    default:
      console.log('   未知页面，尝试继续...');
      await clickContinue(page);
  }
}

async function main() {
  console.log('============================================================');
  console.log('  Indeed Auto Apply');
  console.log('============================================================\n');

  const { browser, page } = await connect();

  if (!page) {
    console.log('❌ 没有找到 Indeed 页面');
    await browser.disconnect();
    return;
  }

  const title = await page.title();
  console.log('✓ 连接成功:', title);

  let lastUrl = '';
  let stuckCount = 0;

  // 循环处理每个步骤
  for (let i = 0; i < 10; i++) {
    const currentUrl = page.url();

    if (currentUrl === lastUrl) {
      stuckCount++;
      if (stuckCount >= 2) {
        console.log('\n⚠ 页面未变化，可能需要手动操作');
        break;
      }
    } else {
      stuckCount = 0;
      lastUrl = currentUrl;
    }

    const step = await detectStep(page);
    const formData = await getFormData(page);

    await handleStep(page, step, formData);

    if (step === 'review') {
      console.log('\n🎉 已到达审核页面！');
      break;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.disconnect();
  console.log('\n✓ 完成');
}

main().catch(e => console.error('错误:', e.message));
