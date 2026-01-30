#!/usr/bin/env node

/**
 * 完整的申请流程测试
 * 使用已经打开的 Chrome 会话
 */

import { MCPClient } from './core/mcp_client.js';
import { ResumeLoader } from './modules/resume_loader.js';
import { ApplicationFlow } from './modules/application_flow.js';
import { FormFiller } from './modules/form_filler.js';
import { QAEngine } from './modules/qa_engine.js';
import { LLMClient } from './utils/llm_client.js';
import { Logger } from './utils/logger.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

console.log('🧪 Testing Full Application Flow\n');

// 1. 加载配置
const config = await loadConfig('./config/config.json');

// 2. 加载 QA 数据库
const qaDatabase = JSON.parse(await fs.readFile('./knowledge/qa_database.json', 'utf-8'));

// 3. 连接 MCP
console.log('Connecting to MCP...');
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 4. 加载简历
console.log('\nLoading resume...');
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');
const resumeSummary = loader.extractSummary(resume);

// 5. 初始化组件
const logger = new Logger('test-flow', config.logging);
const llmClient = new LLMClient(config.llm);
const qaEngine = new QAEngine(qaDatabase, llmClient, logger);
const formAnalyzer = { getFieldOptions: async (field) => [] }; // 简化版
const formFiller = new FormFiller(mcp, qaEngine, formAnalyzer, logger);

// 6. 创建申请流程
const flow = new ApplicationFlow(mcp, formFiller, resume, resumeSummary, config.application, logger);

// 7. 执行申请
const applyUrl = 'https://smartapply.indeed.com/beta/indeedapply/applybyapplyablejobid?indeedApplyableJobId=98df2269-88ca-4d88-a2fe-a5f0ddbc56a5-Y21o&iaUid=1jf0mp2j921k1001&iststd=1';

console.log('\n=== Starting Application ===\n');
try {
  await flow.run(applyUrl);
  console.log('\n✅ Application completed successfully!');
} catch (error) {
  console.error('\n❌ Application failed:', error.message);
  console.error(error.stack);
}

// 8. 清理
await mcp.close();
console.log('\n✓ Test completed');
