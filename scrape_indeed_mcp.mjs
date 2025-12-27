/**
 * Indeed 职位爬虫 - 通过 MCP 协议调用 Playwright
 *
 * 使用方式:
 * 1. npm install @modelcontextprotocol/sdk
 * 2. 先启动 Chrome 调试模式 (端口 9222)
 * 3. node scrape_indeed_mcp.mjs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============ 配置 ============
const CONFIG = {
  outputDir: './indeed_jobs_html',
  clickDelay: 2, // 秒
  pageDelay: 3,  // 秒
  maxPages: 0,   // 0 = 无限制
};

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

async function waitForConfirm(rl, message = '准备好后请输入 yes 继续: ') {
  while (true) {
    const answer = await askQuestion(rl, message);
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      return true;
    }
    console.log('请输入 yes 或 y 继续...');
  }
}

// ============ 从 URL 提取搜索参数 ============
function parseSearchParams(url) {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // 提取关键词 (q 参数)
    let keyword = params.get('q') || 'jobs';
    keyword = decodeURIComponent(keyword).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');

    // 提取城市 (l 参数)
    let location = params.get('l') || 'unknown';
    location = decodeURIComponent(location).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');

    return { keyword, location };
  } catch (e) {
    return { keyword: 'jobs', location: 'unknown' };
  }
}

// ============ MCP Playwright 客户端 ============
class PlaywrightMCP {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    console.log('启动 Playwright MCP 服务器...');

    // 创建 stdio 传输层，启动 Playwright MCP 服务器
    // 连接到已启动的 Chrome 调试实例 (端口 9222)
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['@playwright/mcp@latest', '--cdp-endpoint', 'http://localhost:9222'],
    });

    // 创建 MCP 客户端
    this.client = new Client({
      name: 'indeed-scraper',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    // 连接
    await this.client.connect(this.transport);
    console.log('MCP 连接成功!\n');
  }

  async callTool(name, args = {}) {
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  // ============ 浏览器操作封装 ============

  async navigate(url) {
    console.log(`  -> 导航: ${url.substring(0, 60)}...`);
    return this.callTool('browser_navigate', { url });
  }

  async snapshot() {
    const result = await this.callTool('browser_snapshot', {});
    // MCP 返回的 content 是数组格式
    if (result.content && result.content[0]) {
      return result.content[0].text || JSON.stringify(result.content[0]);
    }
    return JSON.stringify(result);
  }

  async click(element, ref) {
    console.log(`  -> 点击: ${element}`);
    return this.callTool('browser_click', { element, ref });
  }

  async wait(seconds) {
    return this.callTool('browser_wait_for', { time: seconds });
  }

  async evaluate(jsFunction) {
    const result = await this.callTool('browser_evaluate', { function: jsFunction });
    if (result.content && result.content[0]) {
      return result.content[0].text || JSON.stringify(result.content[0]);
    }
    return JSON.stringify(result);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

// ============ 解析 snapshot ============

function parseJobsFromSnapshot(snapshotText) {
  const jobs = [];
  // 匹配: button "full details of XXX" [ref=eXXX]
  const regex = /button "full details of ([^"]+)"[^[]*\[ref=(e\d+)\]/g;
  let match;
  while ((match = regex.exec(snapshotText)) !== null) {
    // 跳过已按下的按钮 (当前选中的职位)
    if (!snapshotText.includes(`button "full details of ${match[1]}" [pressed]`)) {
      jobs.push({
        title: match[1],
        ref: match[2],
      });
    }
  }
  return jobs;
}

function findNextPageRef(snapshotText) {
  const match = snapshotText.match(/link "Next Page"[^[]*\[ref=(e\d+)\]/);
  return match ? match[1] : null;
}

function extractJobDetails(snapshotText) {
  // 提取职位详情面板内容
  const startMarker = 'Job Post Details';
  const startIdx = snapshotText.indexOf(startMarker);
  if (startIdx === -1) return snapshotText;

  const endMarker = 'contentinfo';
  const endIdx = snapshotText.indexOf(endMarker, startIdx);

  return endIdx === -1
    ? snapshotText.substring(startIdx)
    : snapshotText.substring(startIdx, endIdx);
}

// ============ 主函数 ============

async function main() {
  // 创建 readline 接口
  const rl = createReadline();

  console.log('========================================');
  console.log('  Indeed 职位爬虫 (MCP + Playwright)');
  console.log('========================================\n');

  // 1. 获取用户输入的 URL
  const defaultUrl = 'https://www.indeed.com/jobs?q=data+analyst&l=Chicago%2C+IL';
  console.log(`默认 URL: ${defaultUrl}`);
  const inputUrl = await askQuestion(rl, '\n请输入要爬取的 Indeed 搜索页面 URL (直接回车使用默认): ');
  const startUrl = inputUrl || defaultUrl;
  console.log(`\n将使用 URL: ${startUrl}\n`);

  // 解析 URL 获取关键词和城市
  const { keyword, location } = parseSearchParams(startUrl);
  console.log(`搜索关键词: ${keyword}`);
  console.log(`搜索城市: ${location}\n`);

  // 创建输出目录
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const mcp = new PlaywrightMCP();
  let totalJobsSaved = 0;

  try {
    await mcp.connect();

    // 2. 导航到页面
    console.log('正在打开页面...');
    await mcp.navigate(startUrl);
    await mcp.wait(3);

    // 3. 询问从第几页开始
    console.log('\n========================================');
    const startPageInput = await askQuestion(rl, '从第几页开始爬取? (直接回车从第1页开始，或输入页码): ');
    let startPage = 1;
    if (startPageInput && !isNaN(parseInt(startPageInput))) {
      startPage = parseInt(startPageInput);
      if (startPage > 1) {
        console.log(`\n将从第 ${startPage} 页开始，正在跳转...`);
        // 点击翻页到目标页
        for (let p = 1; p < startPage; p++) {
          console.log(`  跳转到第 ${p + 1} 页...`);
          const pageSnapshot = await mcp.snapshot();
          const nextPageRef = findNextPageRef(pageSnapshot);
          if (nextPageRef) {
            await mcp.click('Next Page', nextPageRef);
            await mcp.wait(CONFIG.pageDelay);
          } else {
            console.log(`  ⚠ 无法跳转到第 ${p + 1} 页，将从当前页开始`);
            startPage = p;
            break;
          }
        }
        console.log(`已跳转到第 ${startPage} 页`);
      }
    }

    // 4. 等待用户确认页面已准备好
    console.log('\n========================================');
    console.log('页面已准备好！');
    console.log('请在浏览器中检查页面，如需要可以：');
    console.log('  - 手动调整筛选条件');
    console.log('  - 关闭弹窗');
    console.log('  - 等待页面完全加载');
    console.log('========================================\n');

    await waitForConfirm(rl, '准备好开始爬取后，请输入 yes: ');

    let currentPage = startPage;
    let autoMode = false; // 自动模式标志
    let consecutiveSuccess = 0; // 连续成功计数
    let isFirstPage = true; // 是否是开始爬取的第一页

    while (true) {
      console.log(`\n========== 第 ${currentPage} 页 ==========`);

      // 获取页面快照
      const snapshot = await mcp.snapshot();

      // 解析职位列表
      const jobs = parseJobsFromSnapshot(snapshot);
      console.log(`找到 ${jobs.length} 个职位`);

      if (jobs.length === 0) {
        console.log('未找到职位，结束抓取');
        break;
      }

      let pageSuccessCount = 0;

      // 依次点击每个职位
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`\n处理职位 ${i + 1}/${jobs.length}: ${job.title}`);

        try {
          // 点击职位卡片
          await mcp.click(`Job: ${job.title}`, job.ref);
          await mcp.wait(CONFIG.clickDelay);

          // 获取右侧详情面板的完整 HTML
          const panelHtml = await mcp.evaluate(`() => {
            // 尝试多个可能的选择器获取右侧面板
            const selectors = [
              '[data-testid="jobsearch-ViewJobComponent"]',
              '.jobsearch-ViewJobLayout--embedded',
              '.jobsearch-JobComponent',
              '.jobsearch-RightPane',
              '#jobsearch-ViewjobPaneWrapper'
            ];

            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) {
                return el.outerHTML;
              }
            }

            // 如果都没找到，返回整个 body
            return document.body.outerHTML;
          }`);

          // 保存完整 HTML
          const safeTitle = job.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
          const filename = `${keyword}_${location}_page${currentPage}_job${i + 1}_${safeTitle}.html`;
          const filepath = path.join(CONFIG.outputDir, filename);

          const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="job-title" content="${job.title}">
  <meta name="page" content="${currentPage}">
  <meta name="index" content="${i + 1}">
  <meta name="scraped-at" content="${new Date().toISOString()}">
  <title>${job.title}</title>
</head>
<body>
${panelHtml}
</body>
</html>`;

          fs.writeFileSync(filepath, content, 'utf-8');
          totalJobsSaved++;
          pageSuccessCount++;
          consecutiveSuccess++;
          console.log(`  ✓ 已保存: ${filename}`);

          // 第一页连续成功3个后，询问是否开启自动模式
          if (isFirstPage && consecutiveSuccess === 3 && !autoMode) {
            console.log('\n----------------------------------------');
            console.log('已连续成功保存 3 个职位！');
            const autoAnswer = await askQuestion(rl, '是否开启自动模式，自动爬取所有页面? (yes/no): ');
            if (autoAnswer.toLowerCase() === 'yes' || autoAnswer.toLowerCase() === 'y') {
              autoMode = true;
              console.log('✓ 已开启自动模式，将自动爬取所有页面');
            } else {
              console.log('继续手动模式，每页结束后会询问');
            }
            console.log('----------------------------------------\n');
          }

        } catch (error) {
          console.log(`  ✗ 处理失败: ${error.message}`);
          consecutiveSuccess = 0; // 重置连续成功计数
        }
      }

      console.log(`\n第 ${currentPage} 页完成，本页保存 ${pageSuccessCount} 个，总共 ${totalJobsSaved} 个`);

      // 第一页爬完后，标记为非第一页
      isFirstPage = false;

      // 检查是否达到最大页数
      if (CONFIG.maxPages > 0 && currentPage >= CONFIG.maxPages) {
        console.log(`已达到最大页数限制 (${CONFIG.maxPages})`);
        break;
      }

      // 如果不是自动模式，询问是否继续
      if (!autoMode) {
        const continueNext = await askQuestion(rl, '\n是否继续爬取下一页? (yes/no): ');
        if (continueNext.toLowerCase() !== 'yes' && continueNext.toLowerCase() !== 'y') {
          console.log('用户选择停止');
          break;
        }
      }

      // 查找下一页按钮
      const pageSnapshot = await mcp.snapshot();
      const nextPageRef = findNextPageRef(pageSnapshot);

      if (nextPageRef) {
        console.log('\n点击下一页...');
        await mcp.click('Next Page', nextPageRef);
        await mcp.wait(CONFIG.pageDelay);
        currentPage++;
      } else {
        console.log('\n未找到下一页按钮，已到达最后一页');
        break;
      }
    }

    console.log(`\n========== 抓取完成 ==========`);
    console.log(`总共保存了 ${totalJobsSaved} 个职位`);
    console.log(`输出目录: ${path.resolve(CONFIG.outputDir)}`);

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    rl.close();
    await mcp.close();
  }
}

main().catch(console.error);
