/**
 * Indeed 自动申请脚本 - 通过 MCP 协议调用 Playwright
 *
 * 使用方式:
 * 1. 先启动 Chrome 调试模式 (端口 9222)
 * 2. 在浏览器中打开 Indeed 职位搜索页面并登录
 * 3. node apply_indeed_mcp.mjs
 *
 * 功能:
 * - 自动上传简历
 * - 使用问答库回答常见问题
 * - 自动填写相关经验
 * - 可选择是否真正提交申请
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============ 配置 ============
const CONFIG = {
  // 简历文件路径
  resumePath: '/Users/iuser/Desktop/未命名文件夹/CV/resumes/job1_Michael_Shaw_with_ai_20260102_121500.pdf',

  // 相关经验信息（用于填写 71% 步骤）
  relevantExperience: {
    jobTitle: 'Business Intelligence Analyst',
    company: 'BlueRidge Health Analytics',
  },

  // 是否真正提交申请（false = 到 Review 页面停止）
  actuallySubmit: false,

  // 延迟设置（秒）
  stepDelay: 2,

  // 日志目录
  logDir: './apply_logs',
};

// ============ 问答库 ============
// 关键词匹配：如果问题包含某个关键词，则使用对应答案
const QA_DATABASE = [
  // 工作签证/Sponsorship
  {
    keywords: ['sponsorship', 'visa', 'authorized', 'legally', 'work permit'],
    answer: 'No, I do not require sponsorship. I am authorized to work in the USA.',
  },

  // 到岗/Onsite
  {
    keywords: ['onsite', 'on-site', 'in-office', 'in office', 'days a week', 'commute', 'relocate'],
    answer: 'Yes, I can commit to working onsite as required.',
  },

  // 远程工作
  {
    keywords: ['remote', 'work from home', 'hybrid'],
    answer: 'Yes, I am comfortable with remote/hybrid work arrangements and have experience working effectively in such environments.',
  },

  // 薪资期望
  {
    keywords: ['salary', 'compensation', 'pay', 'hourly rate', 'desired pay'],
    answer: 'I am open to discussing compensation based on the full scope of the role and benefits package.',
  },

  // 开始时间
  {
    keywords: ['start date', 'when can you start', 'available to start', 'notice period'],
    answer: 'I can start within 2 weeks of receiving an offer.',
  },

  // 经验年限
  {
    keywords: ['years of experience', 'how many years', 'experience with'],
    answer: 'Yes, I have relevant experience in this area as detailed in my resume.',
  },

  // Excel/技术技能
  {
    keywords: ['excel', 'spreadsheet', 'pivot', 'vlookup', 'formulas'],
    answer: 'Yes, I am highly proficient in Excel including advanced functions like VLOOKUP, INDEX-MATCH, pivot tables, Power Query, and data analysis.',
  },

  // SQL
  {
    keywords: ['sql', 'database', 'query', 'queries'],
    answer: 'Yes, I have strong SQL skills including complex queries, joins, window functions, and database optimization.',
  },

  // Python/编程
  {
    keywords: ['python', 'programming', 'coding', 'script'],
    answer: 'Yes, I am proficient in Python for data analysis, automation, and scripting.',
  },

  // Tableau/BI工具
  {
    keywords: ['tableau', 'power bi', 'looker', 'dashboard', 'visualization', 'bi tool'],
    answer: 'Yes, I have experience with BI tools including Tableau and Power BI for creating interactive dashboards and reports.',
  },

  // Smartsheet
  {
    keywords: ['smartsheet', 'workflow', 'automation'],
    answer: 'Yes, I have experience with Smartsheet including building workflows, automations, cross-sheet formulas, and dashboard reporting.',
  },

  // 短信/通知同意
  {
    keywords: ['sms', 'text message', 'phone call', 'contact you', 'notifications'],
    answer: 'Yes',
  },

  // 背景调查
  {
    keywords: ['background check', 'drug test', 'screening'],
    answer: 'Yes, I consent to a background check as part of the hiring process.',
  },

  // 是否申请过
  {
    keywords: ['applied before', 'previously applied', 'worked here'],
    answer: 'No, this is my first time applying to this company.',
  },

  // 推荐人
  {
    keywords: ['referral', 'referred by', 'how did you hear'],
    answer: 'I found this position through Indeed job search.',
  },
];

// ============ 交互式输入 ============
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ============ MCP Playwright 客户端 ============
class PlaywrightMCP {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    console.log('启动 Playwright MCP 服务器...');

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@latest', '--cdp-endpoint', 'http://localhost:9222'],
    });

    this.client = new Client({
      name: 'indeed-auto-apply',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await this.client.connect(this.transport);
    console.log('MCP 连接成功!\n');
  }

  async callTool(name, args = {}) {
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  async navigate(url) {
    console.log(`  -> 导航: ${url.substring(0, 80)}...`);
    return this.callTool('browser_navigate', { url });
  }

  async snapshot() {
    const result = await this.callTool('browser_snapshot', {});
    if (result.content && result.content[0]) {
      return result.content[0].text || JSON.stringify(result.content[0]);
    }
    return JSON.stringify(result);
  }

  async click(element, ref) {
    console.log(`  -> 点击: ${element}`);
    return this.callTool('browser_click', { element, ref });
  }

  async type(element, ref, text) {
    console.log(`  -> 输入: ${element} = "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    return this.callTool('browser_type', { element, ref, text });
  }

  async uploadFile(paths) {
    console.log(`  -> 上传文件: ${paths[0]}`);
    return this.callTool('browser_file_upload', { paths });
  }

  async wait(seconds) {
    return this.callTool('browser_wait_for', { time: seconds });
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

// ============ 问答库匹配 ============
function findAnswer(questionText) {
  const questionLower = questionText.toLowerCase();

  for (const qa of QA_DATABASE) {
    for (const keyword of qa.keywords) {
      if (questionLower.includes(keyword.toLowerCase())) {
        return qa.answer;
      }
    }
  }

  return null; // 没有匹配到
}

// ============ 解析页面状态 ============
function getProgress(snapshotText) {
  const match = snapshotText.match(/generic \[ref=\w+\]: (\d+)%/);
  return match ? parseInt(match[1]) : 0;
}

function getCurrentStep(url) {
  if (url.includes('resume-selection')) return 'resume';
  if (url.includes('questions')) return 'questions';
  if (url.includes('relevant-experience')) return 'experience';
  if (url.includes('review-module')) return 'review';
  return 'unknown';
}

// ============ 解析问题 ============
function parseQuestions(snapshotText) {
  const questions = [];

  // 匹配问题文本和对应的 textbox ref
  // 格式: generic [ref=eXXX] [cursor=pointer]: 问题文本
  //       textbox "问题文本" [ref=eYYY]
  const lines = snapshotText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 查找 textbox
    const textboxMatch = line.match(/textbox "([^"]+)" \[ref=(e\d+)\]/);
    if (textboxMatch) {
      questions.push({
        text: textboxMatch[1],
        ref: textboxMatch[2],
      });
    }
  }

  return questions;
}

// ============ 解析表单字段 ============
function parseFormFields(snapshotText) {
  const fields = {};

  // Job title combobox
  const jobTitleMatch = snapshotText.match(/combobox "Job title" \[ref=(e\d+)\]/);
  if (jobTitleMatch) {
    fields.jobTitle = jobTitleMatch[1];
  }

  // Company combobox
  const companyMatch = snapshotText.match(/combobox "Company"[^[]*\[ref=(e\d+)\]/);
  if (companyMatch) {
    fields.company = companyMatch[1];
  }

  return fields;
}

// ============ 查找按钮 ============
function findButton(snapshotText, buttonText) {
  // 匹配: button "XXX" [ref=eYYY]
  const regex = new RegExp(`button "${buttonText}"[^[]*\\[ref=(e\\d+)\\]`);
  const match = snapshotText.match(regex);
  return match ? match[1] : null;
}

function findContinueButton(snapshotText) {
  return findButton(snapshotText, 'Continue');
}

function findSubmitButton(snapshotText) {
  return findButton(snapshotText, 'Submit your application');
}

function findUploadResumeButton(snapshotText) {
  // 查找 "Upload a resume" 按钮
  const match = snapshotText.match(/button "Upload a resume[^"]*" \[ref=(e\d+)\]/);
  return match ? match[1] : null;
}

// ============ 申请单个职位 ============
async function applyToJob(mcp, applyUrl, rl) {
  console.log('\n========================================');
  console.log(`开始申请: ${applyUrl}`);
  console.log('========================================\n');

  const result = {
    url: applyUrl,
    success: false,
    stoppedAt: null,
    skippedQuestions: [],
    error: null,
  };

  try {
    // 导航到申请页面
    await mcp.navigate(applyUrl);
    await mcp.wait(CONFIG.stepDelay);

    let maxSteps = 10; // 防止无限循环

    while (maxSteps-- > 0) {
      const snapshot = await mcp.snapshot();
      const progress = getProgress(snapshot);
      const currentUrl = snapshot.match(/Page URL: ([^\n]+)/)?.[1] || '';
      const step = getCurrentStep(currentUrl);

      console.log(`\n--- 当前进度: ${progress}% (${step}) ---`);

      // ========== 步骤 1: 简历上传 (43%) ==========
      if (step === 'resume') {
        console.log('处理简历上传步骤...');

        // 点击 "Upload a resume"
        const uploadRef = findUploadResumeButton(snapshot);
        if (uploadRef) {
          await mcp.click('Upload a resume', uploadRef);
          await mcp.wait(1);

          // 上传文件
          await mcp.uploadFile([CONFIG.resumePath]);
          await mcp.wait(CONFIG.stepDelay);

          // 获取新快照找 Continue 按钮
          const newSnapshot = await mcp.snapshot();
          const continueRef = findContinueButton(newSnapshot);
          if (continueRef) {
            await mcp.click('Continue', continueRef);
            await mcp.wait(CONFIG.stepDelay);
          }
        } else {
          console.log('  未找到上传按钮，尝试直接点击 Continue');
          const continueRef = findContinueButton(snapshot);
          if (continueRef) {
            await mcp.click('Continue', continueRef);
            await mcp.wait(CONFIG.stepDelay);
          }
        }
        continue;
      }

      // ========== 步骤 2: 雇主问题 (57%) ==========
      if (step === 'questions') {
        console.log('处理雇主问题步骤...');

        const questions = parseQuestions(snapshot);
        console.log(`  找到 ${questions.length} 个问题`);

        for (const q of questions) {
          const answer = findAnswer(q.text);
          if (answer) {
            await mcp.type(`Question: ${q.text.substring(0, 30)}...`, q.ref, answer);
            await mcp.wait(0.5);
          } else {
            console.log(`  ⚠ 未匹配到答案: "${q.text.substring(0, 50)}..."`);
            result.skippedQuestions.push(q.text);
            // 留空不填写，看看能否跳过
          }
        }

        // 点击 Continue
        await mcp.wait(1);
        const newSnapshot = await mcp.snapshot();
        const continueRef = findContinueButton(newSnapshot);
        if (continueRef) {
          await mcp.click('Continue', continueRef);
          await mcp.wait(CONFIG.stepDelay);
        }
        continue;
      }

      // ========== 步骤 3: 相关经验 (71%) ==========
      if (step === 'experience') {
        console.log('处理相关经验步骤...');

        const fields = parseFormFields(snapshot);

        if (fields.jobTitle) {
          await mcp.type('Job title', fields.jobTitle, CONFIG.relevantExperience.jobTitle);
        }
        if (fields.company) {
          await mcp.type('Company', fields.company, CONFIG.relevantExperience.company);
        }

        await mcp.wait(1);
        const newSnapshot = await mcp.snapshot();
        const continueRef = findContinueButton(newSnapshot);
        if (continueRef) {
          await mcp.click('Continue', continueRef);
          await mcp.wait(CONFIG.stepDelay);
        }
        continue;
      }

      // ========== 步骤 4: Review (100%) ==========
      if (step === 'review') {
        console.log('到达 Review 页面!');
        result.stoppedAt = 'review';

        if (CONFIG.actuallySubmit) {
          const submitRef = findSubmitButton(snapshot);
          if (submitRef) {
            console.log('正在提交申请...');
            await mcp.click('Submit your application', submitRef);
            await mcp.wait(CONFIG.stepDelay);
            result.success = true;
            console.log('✓ 申请已提交!');
          }
        } else {
          console.log('✓ 已到达 Review 页面，未提交（actuallySubmit = false）');
          result.success = true;
        }
        break;
      }

      // 未知步骤，尝试点击 Continue
      console.log(`未知步骤，尝试点击 Continue...`);
      const continueRef = findContinueButton(snapshot);
      if (continueRef) {
        await mcp.click('Continue', continueRef);
        await mcp.wait(CONFIG.stepDelay);
      } else {
        console.log('未找到 Continue 按钮，停止');
        result.stoppedAt = step;
        break;
      }
    }

  } catch (error) {
    console.error('申请过程中出错:', error.message);
    result.error = error.message;
  }

  return result;
}

// ============ 主函数 ============
async function main() {
  const rl = createReadline();

  console.log('========================================');
  console.log('  Indeed 自动申请脚本 (MCP + Playwright)');
  console.log('========================================\n');

  // 创建日志目录
  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }

  const mcp = new PlaywrightMCP();

  try {
    await mcp.connect();

    // 获取当前页面状态
    console.log('获取当前浏览器状态...');
    const snapshot = await mcp.snapshot();
    const currentUrl = snapshot.match(/Page URL: ([^\n]+)/)?.[1] || '';
    console.log(`当前页面: ${currentUrl}\n`);

    // 询问用户输入申请 URL
    console.log('请输入 Indeed Easy Apply URL（smartapply.indeed.com 开头）');
    console.log('或直接回车使用当前页面:\n');

    const inputUrl = await askQuestion(rl, 'Apply URL: ');
    const applyUrl = inputUrl || currentUrl;

    if (!applyUrl.includes('indeed.com')) {
      console.log('错误: 请提供有效的 Indeed URL');
      return;
    }

    // 开始申请
    const result = await applyToJob(mcp, applyUrl, rl);

    // 保存结果
    const logFile = path.join(CONFIG.logDir, `apply_${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify(result, null, 2));

    console.log('\n========================================');
    console.log('申请结果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  停止于: ${result.stoppedAt}`);
    if (result.skippedQuestions.length > 0) {
      console.log(`  跳过的问题: ${result.skippedQuestions.length} 个`);
    }
    if (result.error) {
      console.log(`  错误: ${result.error}`);
    }
    console.log(`  日志: ${logFile}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    rl.close();
    await mcp.close();
  }
}

main().catch(console.error);
