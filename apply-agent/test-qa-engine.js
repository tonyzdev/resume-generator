#!/usr/bin/env node

/**
 * 测试 LLM 回答 visa sponsorship 问题
 */

import { LLMClient } from './utils/llm_client.js';
import { QAEngine } from './modules/qa_engine.js';
import { ResumeLoader } from './modules/resume_loader.js';
import { Logger } from './utils/logger.js';
import { loadConfig } from './utils/config_loader.js';
import fs from 'fs/promises';

console.log('🧪 Testing LLM Question Answering\n');

// 1. 加载配置
const config = await loadConfig('./config/config.json');

// 2. 加载 QA 数据库
const qaDatabase = JSON.parse(await fs.readFile('./knowledge/qa_database.json', 'utf-8'));

// 3. 初始化 Logger, LLM 和 QA 引擎
const logger = new Logger('test-qa', config.logging);
const llmClient = new LLMClient(config.llm);
const qaEngine = new QAEngine(qaDatabase, llmClient, logger);

// 4. 加载简历
const loader = new ResumeLoader();
const resume = await loader.load('../resumes/Cassidy_King_Data_Analyst_medium_no_ai_20260102_115323.json');
const resumeSummary = loader.extractSummary(resume);

console.log('Resume:', resume.name);
console.log('Education:', resumeSummary.education);
console.log();

// 5. 测试问题
const question = 'This position does not offer employment visa sponsorship. Do you currently require or will you in the future require sponsorship to work in the United States?';
const fieldType = 'radio';
const options = ['Yes', 'No'];

console.log('Question:', question);
console.log('Options:', options.join(', '));
console.log();

console.log('Getting answer...');
try {
  const { answer, source } = await qaEngine.answerQuestion(
    question,
    fieldType,
    options,
    resumeSummary
  );

  console.log('✓ Answer:', answer);
  console.log('  Source:', source);
} catch (error) {
  console.error('✗ Failed:', error.message);
}

console.log('\n✓ Test completed');
