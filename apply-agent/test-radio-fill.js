#!/usr/bin/env node

/**
 * 测试填写 radio 字段
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

console.log('🧪 Testing Radio Field Filling\n');

// 1. 加载配置
const config = await loadConfig('./config/config.json');

// 2. 连接 MCP
const mcp = new MCPClient();
await mcp.connect(config.chrome.cdpEndpoint);

// 3. 初始化组件
const logger = new Logger('test-radio', config.logging);
const qaDatabase = JSON.parse(await fs.readFile('./knowledge/qa_database.json', 'utf-8'));
const llmClient = new LLMClient(config.llm);
const qaEngine = new QAEngine(qaDatabase, llmClient, logger);
const formAnalyzer = { getFieldOptions: async (field) => ['Yes', 'No'] };
const formFiller = new FormFiller(mcp, qaEngine, formAnalyzer, logger);

// 4. 加载简历
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');
const resumeSummary = loader.extractSummary(resume);

// 5. 获取当前页面的字段
const snapshot = await mcp.snapshot();
const fields = parseFormFields(snapshot);

console.log(`Found ${fields.length} fields:\n`);
fields.forEach((field, i) => {
  console.log(`${i + 1}. [${field.type}] ${field.label}`);
  console.log(`   ref: ${field.ref}`);
  if (field.question) {
    console.log(`   question: ${field.question.substring(0, 80)}...`);
  }
  console.log();
});

// 6. 尝试填写第一个字段
if (fields.length > 0) {
  console.log('=== Attempting to fill first field ===\n');
  const field = fields[0];

  try {
    const result = await formFiller.fillField(field, resumeSummary);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

await mcp.close();
console.log('\n✓ Test completed');
