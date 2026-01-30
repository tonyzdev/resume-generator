#!/usr/bin/env node

/**
 * 直接测试脚本 - 不需要交互输入
 */

import fs from 'fs/promises';
import { MCPClient } from './core/mcp_client.js';
import { ResumeLoader } from './modules/resume_loader.js';
import { QAEngine } from './modules/qa_engine.js';
import { FormAnalyzer } from './modules/form_analyzer.js';
import { FormFiller } from './modules/form_filler.js';
import { ApplicationFlow } from './modules/application_flow.js';
import { LLMClient } from './utils/llm_client.js';
import { loadConfig, overrideFromEnv } from './utils/config_loader.js';
import { Logger } from './utils/logger.js';

const TEST_URL = 'https://smartapply.indeed.com/beta/indeedapply/applybyapplyablejobid?indeedApplyableJobId=98df2269-88ca-4d88-a2fe-a5f0ddbc56a5-Y21o&iaUid=1jf0mp2j921k1001&iststd=1';
const TEST_RESUME = '../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json';

async function main() {
  console.log('🧪 Test Run - Direct Execution\n');

  // 1. 加载配置
  console.log('📋 Loading configuration...');
  let config = await loadConfig('./config/config.json');
  config = overrideFromEnv(config);

  // 2. 初始化日志
  const logger = new Logger(config.logging.directory);
  await logger.init('test-98df2269');

  try {
    // 3. 连接 MCP
    console.log('🔌 Connecting to MCP server...');
    const mcp = new MCPClient();
    await mcp.connect(config.chrome.cdpEndpoint);

    // 4. 初始化 LLM 客户端
    console.log('🤖 Initializing LLM client...');
    const llmClient = new LLMClient(config.llm);

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
    const resumeData = await resumeLoader.load(TEST_RESUME);
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
    console.log(`   URL: ${TEST_URL}`);
    console.log(`   Applicant: ${resumeData.name}`);
    console.log();

    await flow.run(TEST_URL);

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

main();
