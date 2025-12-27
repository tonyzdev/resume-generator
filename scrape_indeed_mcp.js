const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============ 配置 ============
const CONFIG = {
  startUrl: 'https://www.indeed.com/jobs?q=data+analyst&l=Chicago%2C+IL&sc=0kf%3Aexplvl%28ENTRY_LEVEL%29%3B&from=searchOnDesktopSerp',
  outputDir: './indeed_jobs_html',
  clickDelay: 2000,
  pageDelay: 3000,
  maxPages: 3, // 设置为 0 表示无限制
};

// ============ MCP 客户端 ============
class PlaywrightMCPClient {
  constructor() {
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  async start() {
    return new Promise((resolve, reject) => {
      // 启动 Playwright MCP 服务器
      // 你可能需要根据实际安装位置调整命令
      this.process = spawn('npx', ['@anthropic-ai/mcp-playwright'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr.on('data', (data) => {
        console.error('[MCP stderr]:', data.toString());
      });

      this.process.on('error', (err) => {
        reject(err);
      });

      // 等待服务器启动
      setTimeout(() => {
        this.initialize().then(resolve).catch(reject);
      }, 2000);
    });
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id !== undefined && this.pendingRequests.has(response.id)) {
            const { resolve, reject } = this.pendingRequests.get(response.id);
            this.pendingRequests.delete(response.id);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          // 忽略非 JSON 行
        }
      }
    }
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(request) + '\n');

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async initialize() {
    return this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'indeed-scraper', version: '1.0.0' },
    });
  }

  async callTool(name, args = {}) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  // ============ 封装的浏览器操作 ============

  async navigate(url) {
    console.log(`  -> 导航到: ${url.substring(0, 60)}...`);
    return this.callTool('browser_navigate', { url });
  }

  async snapshot() {
    return this.callTool('browser_snapshot', {});
  }

  async click(element, ref) {
    console.log(`  -> 点击: ${element}`);
    return this.callTool('browser_click', { element, ref });
  }

  async evaluate(fn) {
    return this.callTool('browser_evaluate', { function: fn });
  }

  async wait(seconds) {
    return this.callTool('browser_wait_for', { time: seconds });
  }

  close() {
    if (this.process) {
      this.process.kill();
    }
  }
}

// ============ 解析 snapshot 获取职位列表 ============
function parseJobsFromSnapshot(snapshotText) {
  const jobs = [];
  // 匹配类似: button "full details of XXX" [ref=eXXX]
  const regex = /button "full details of ([^"]+)"[^[]*\[ref=(e\d+)\]/g;
  let match;
  while ((match = regex.exec(snapshotText)) !== null) {
    jobs.push({
      title: match[1],
      ref: match[2],
    });
  }
  return jobs;
}

// ============ 解析 snapshot 获取下一页按钮 ============
function findNextPageRef(snapshotText) {
  // 匹配: link "Next Page" [ref=eXXX]
  const match = snapshotText.match(/link "Next Page"[^[]*\[ref=(e\d+)\]/);
  return match ? match[1] : null;
}

// ============ 从 snapshot 提取职位详情区域 ============
function extractJobDetails(snapshotText) {
  // 查找 "Full job description" 后的内容
  const startMarker = 'Full job description';
  const startIdx = snapshotText.indexOf(startMarker);
  if (startIdx === -1) return null;

  // 查找结束位置 (Report job 按钮之前)
  const endMarker = 'Report job';
  const endIdx = snapshotText.indexOf(endMarker, startIdx);

  if (endIdx === -1) {
    return snapshotText.substring(startIdx);
  }
  return snapshotText.substring(startIdx, endIdx);
}

// ============ 主函数 ============
async function main() {
  // 创建输出目录
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const client = new PlaywrightMCPClient();
  let totalJobsSaved = 0;

  try {
    console.log('启动 Playwright MCP 服务器...');
    await client.start();
    console.log('MCP 服务器已启动\n');

    // 导航到起始页面
    await client.navigate(CONFIG.startUrl);
    await client.wait(3);

    let currentPage = 1;

    while (true) {
      console.log(`\n========== 第 ${currentPage} 页 ==========`);

      // 获取页面快照
      const snapshotResult = await client.snapshot();
      const snapshotText = typeof snapshotResult === 'string'
        ? snapshotResult
        : JSON.stringify(snapshotResult, null, 2);

      // 解析职位列表
      const jobs = parseJobsFromSnapshot(snapshotText);
      console.log(`找到 ${jobs.length} 个职位`);

      if (jobs.length === 0) {
        console.log('未找到职位，结束抓取');
        break;
      }

      // 依次点击每个职位
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`\n处理职位 ${i + 1}/${jobs.length}: ${job.title}`);

        try {
          // 点击职位卡片
          await client.click(`Job: ${job.title}`, job.ref);
          await client.wait(CONFIG.clickDelay / 1000);

          // 获取更新后的快照 (包含职位详情)
          const detailSnapshot = await client.snapshot();
          const detailText = typeof detailSnapshot === 'string'
            ? detailSnapshot
            : JSON.stringify(detailSnapshot, null, 2);

          // 保存完整的 snapshot 作为详情
          const filename = `page${currentPage}_job${i + 1}_${job.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.txt`;
          const filepath = path.join(CONFIG.outputDir, filename);

          // 提取职位详情部分
          const jobDetails = extractJobDetails(detailText) || detailText;

          const content = `职位: ${job.title}
页码: ${currentPage}
序号: ${i + 1}
抓取时间: ${new Date().toISOString()}
=====================================

${jobDetails}
`;

          fs.writeFileSync(filepath, content, 'utf-8');
          totalJobsSaved++;
          console.log(`  ✓ 已保存: ${filename}`);

        } catch (error) {
          console.log(`  ✗ 处理失败: ${error.message}`);
        }
      }

      console.log(`\n第 ${currentPage} 页完成`);

      // 检查是否达到最大页数
      if (CONFIG.maxPages > 0 && currentPage >= CONFIG.maxPages) {
        console.log(`已达到最大页数限制 (${CONFIG.maxPages})`);
        break;
      }

      // 重新获取快照以查找下一页按钮
      const pageSnapshot = await client.snapshot();
      const pageText = typeof pageSnapshot === 'string'
        ? pageSnapshot
        : JSON.stringify(pageSnapshot, null, 2);

      const nextPageRef = findNextPageRef(pageText);

      if (nextPageRef) {
        console.log('\n点击下一页...');
        await client.click('Next Page', nextPageRef);
        await client.wait(CONFIG.pageDelay / 1000);
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
    client.close();
  }
}

main().catch(console.error);
