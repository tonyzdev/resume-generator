#!/usr/bin/env node

/**
 * 测试 fillFields（包含 radio 分组）
 */

import { MCPClient } from './core/mcp_client.js';
import { parseFormFields } from './core/snapshot_parser.js';
import { FormFiller } from './modules/form_filler.js';
import { QAEngine } from './modules/qa_engine.js';
import { LLMClient } from './utils/llm_client.js';
import { ResumeLoader } from './modules/resume_loader.js';
import { Logger } from './utils/logger.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

console.log('🧪 Testing fillFields with Radio Grouping\n');

// 1. 加载配置
const config = await loadConfig('./config/config.json');

// 2. 连接 MCP
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 3. 初始化组件
const logger = new Logger('test-fillfields', config.logging);
const qaDatabase = JSON.parse(await fs.readFile('./knowledge/qa_database.json', 'utf-8'));
const llmClient = new LLMClient(config.llm);
const qaEngine = new QAEngine(qaDatabase, llmClient, logger);
const formAnalyzer = { getFieldOptions: async (field) => [] };
const formFiller = new FormFiller(mcp, qaEngine, formAnalyzer, logger);

// 4. 加载简历
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');
const resumeSummary = loader.extractSummary(resume);

// 5. 获取当前页面的字段
const snapshot = await mcp.snapshot();
const fields = parseFormFields(snapshot);

console.log(`Found ${fields.length} fields\n`);

// 6. 使用 fillFields 填写所有字段
console.log('=== Filling all fields ===\n');
try {
  const results = await formFiller.fillFields(fields, resumeSummary);

  console.log('\n=== Results ===');
  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.success ? '✓' : '✗'} ${result.field.substring(0, 60)}`);
    console.log(`   Answer: ${result.answer}`);
    console.log(`   Source: ${result.source}`);
  });

  const successful = results.filter(r => r.success).length;
  console.log(`\nFilled ${successful}/${results.length} fields`);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}

await mcp.close();
console.log('\n✓ Test completed');
