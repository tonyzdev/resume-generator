#!/usr/bin/env node

import fs from 'fs/promises';
import readline from 'readline';
import { MCPClient } from './core/mcp_client.js';
import { ResumeLoader } from './modules/resume_loader.js';
import { QAEngine } from './modules/qa_engine.js';
import { FormAnalyzer } from './modules/form_analyzer.js';
import { FormFiller } from './modules/form_filler.js';
import { ApplicationFlow } from './modules/application_flow.js';
import { LLMClient } from './utils/llm_client.js';
import { loadConfig, overrideFromEnv } from './utils/config_loader.js';
import { Logger } from './utils/logger.js';

/**
 * Indeed Auto Apply Agent
 * Intelligent job application automation with LLM-powered form filling
 */

/**
 * 交互式输入
 */
async function promptForInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log('📝 Interactive Mode\n');

  // 输入 Apply URL
  console.log('Please enter the Indeed job application URL:');
  console.log('Examples:');
  console.log('  - https://www.indeed.com/applystart?jk=abc123def456');
  console.log('  - https://www.indeed.com/viewjob?jk=abc123def456');
  console.log('  - https://smartapply.indeed.com/beta/indeedapply/...\n');

  let applyUrl = await question('Apply URL: ');
  applyUrl = applyUrl.trim();

  // 如果是 viewjob URL，转换为 applystart
  if (applyUrl.includes('/viewjob?')) {
    applyUrl = applyUrl.replace('/viewjob?', '/applystart?');
    console.log(`✓ Converted to apply URL: ${applyUrl}\n`);
  }

  // 验证 URL
  const isValidUrl = applyUrl.includes('indeed.com') &&
                     (applyUrl.includes('jk=') || applyUrl.includes('indeedApplyableJobId='));

  if (!isValidUrl) {
    console.error('❌ Invalid Indeed URL. Must contain "indeed.com" and job ID parameter.\n');
    rl.close();
    process.exit(1);
  }

  // 列出可用的简历
  console.log('\n📄 Available Resumes:\n');
  try {
    const resumeDir = '../resumes/';
    const files = await fs.readdir(resumeDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.error('❌ No resume JSON files found in ../resumes/\n');
      rl.close();
      process.exit(1);
    }

    jsonFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });

    console.log();
    const choice = await question(`Select resume (1-${jsonFiles.length}) or enter custom path: `);

    let resumePath;
    const choiceNum = parseInt(choice);
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= jsonFiles.length) {
      resumePath = `${resumeDir}${jsonFiles[choiceNum - 1]}`;
      console.log(`✓ Selected: ${jsonFiles[choiceNum - 1]}\n`);
    } else {
      resumePath = choice.trim();
      console.log(`✓ Using custom path: ${resumePath}\n`);
    }

    rl.close();
    return { applyUrl, resumePath };

  } catch (error) {
    console.error(`❌ Error reading resumes: ${error.message}\n`);
    rl.close();
    process.exit(1);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Indeed Auto Apply Agent v1.0');
  console.log('='.repeat(60));
  console.log();

  // 解析命令行参数
  const args = process.argv.slice(2);

  let applyUrl = args[0];
  let resumePath = args[1] || null;

  // 如果没有提供参数，进入交互模式
  if (!applyUrl) {
    const result = await promptForInput();
    applyUrl = result.applyUrl;
    resumePath = result.resumePath;
  }

  // 1. 加载配置
  console.log('📋 Loading configuration...');
  let config = await loadConfig('./config/config.json');
  config = overrideFromEnv(config);

  // 2. 初始化日志
  const logger = new Logger(config.logging.directory);
  const jobId = extractJobId(applyUrl) || 'unknown';
  await logger.init(jobId);

  try {
    // 3. 连接 MCP
    console.log('🔌 Connecting to MCP server...');
    const mcp = new MCPClient();
    await mcp.connect(config.chrome.cdpEndpoint);

    // 4. 初始化 LLM 客户端
    console.log('🤖 Initializing LLM client...');
    const llmClient = new LLMClient(config.llm);
    // 可选：测试连接
    // await llmClient.testConnection();

    // 5. 加载问答库
    console.log('📚 Loading QA database...');
    const qaDbContent = await fs.readFile('./knowledge/qa_database.json', 'utf-8');
    const qaDatabase = JSON.parse(qaDbContent);

    // 6. 初始化组件
    const qaEngine = new QAEngine(qaDatabase, llmClient, logger);
    const formAnalyzer = new FormAnalyzer(mcp, logger);
    const formFiller = new FormFiller(mcp, qaEngine, formAnalyzer, logger);

    // 7. 加载简历
    console.log('📄 Loading resume...');
    const resumeLoader = new ResumeLoader();
    const finalResumePath = resumePath || config.resume.defaultPath;
    const resumeData = await resumeLoader.load(finalResumePath);
    const resumeSummary = resumeLoader.extractSummary(resumeData);

    // 8. 创建流程控制器
    const flow = new ApplicationFlow(
      mcp,
      formFiller,
      resumeData,
      resumeSummary,
      config.application,
      logger
    );

    // 9. 执行申请
    console.log();
    console.log('🚀 Starting application process...');
    console.log(`   URL: ${applyUrl}`);
    console.log(`   Applicant: ${resumeData.name}`);
    console.log();

    await flow.run(applyUrl);

    console.log();
    console.log('✅ Application process completed!');
    console.log(`   Log file: ${logger.logFile}`);

    // 10. 清理
    await mcp.close();
    process.exit(0);

  } catch (error) {
    console.error();
    console.error('❌ Application failed:', error.message);
    console.error(error.stack);
    await logger.error('Application failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

/**
 * 从申请 URL 中提取 Job ID
 * @param {string} url - 申请 URL
 * @returns {string|null} Job ID
 */
function extractJobId(url) {
  // 尝试提取传统的 jk 参数
  let match = url.match(/jk=([a-f0-9]+)/);
  if (match) return match[1];

  // 尝试提取新版的 indeedApplyableJobId
  match = url.match(/indeedApplyableJobId=([^&]+)/);
  if (match) {
    // 截取前8个字符作为简短ID
    return match[1].substring(0, 8);
  }

  return 'unknown';
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log('Usage: node main.js <apply_url> [resume_path]');
  console.log();
  console.log('Arguments:');
  console.log('  apply_url    - Indeed SmartApply URL (required)');
  console.log('  resume_path  - Path to resume JSON file (optional, defaults to config)');
  console.log();
  console.log('Examples:');
  console.log('  node main.js "https://www.indeed.com/applystart?jk=..." "../resumes/john_doe.json"');
  console.log('  npm run apply "https://www.indeed.com/applystart?jk=..." "../resumes/jane_smith.json"');
  console.log();
  console.log('Environment Variables:');
  console.log('  OPENAI_API_KEY    - Override LLM API key');
  console.log('  OPENAI_API_BASE   - Override LLM API base URL');
  console.log('  CDP_ENDPOINT      - Override Chrome CDP endpoint');
  console.log();
}

// 运行主程序
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
