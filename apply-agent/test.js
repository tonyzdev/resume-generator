#!/usr/bin/env node

/**
 * 测试脚本 - 验证各个组件是否正常工作
 */

import { LLMClient } from './utils/llm_client.js';
import { loadConfig } from './utils/config_loader.js';
import { ResumeLoader } from './modules/resume_loader.js';
import fs from 'fs/promises';

console.log('🧪 Testing Indeed Auto Apply Agent Components\n');

async function testLLMConnection() {
  console.log('1️⃣  Testing LLM connection...');
  try {
    const config = await loadConfig('./config/config.json');
    const llmClient = new LLMClient(config.llm);

    const response = await llmClient.complete('Say "OK" if you can hear me.');
    console.log(`   ✅ LLM connected: ${response.substring(0, 50)}...\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ LLM connection failed: ${error.message}\n`);
    return false;
  }
}

async function testResumeLoader() {
  console.log('2️⃣  Testing resume loader...');
  try {
    const loader = new ResumeLoader();

    // 查找第一个简历文件
    const resumeDir = '../resumes/';
    const files = await fs.readdir(resumeDir);
    const jsonFile = files.find(f => f.endsWith('.json'));

    if (!jsonFile) {
      console.log(`   ⚠️  No resume JSON found in ${resumeDir}`);
      console.log(`   💡 Create a resume JSON file first\n`);
      return false;
    }

    const resumePath = `${resumeDir}${jsonFile}`;
    const resume = await loader.load(resumePath);
    const summary = loader.extractSummary(resume);

    console.log(`   ✅ Resume loaded: ${resume.name}`);
    console.log(`   📄 Education: ${summary.education}`);
    console.log(`   🛠️  Skills: ${summary.skills.slice(0, 5).join(', ')}...\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Resume loader failed: ${error.message}\n`);
    return false;
  }
}

async function testQADatabase() {
  console.log('3️⃣  Testing QA database...');
  try {
    const content = await fs.readFile('./knowledge/qa_database.json', 'utf-8');
    const qaDatabase = JSON.parse(content);

    console.log(`   ✅ QA database loaded: ${qaDatabase.length} rules`);
    console.log(`   📚 Categories: ${qaDatabase.map(q => q.category).slice(0, 5).join(', ')}...\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ QA database failed: ${error.message}\n`);
    return false;
  }
}

async function testChromeConnection() {
  console.log('4️⃣  Testing Chrome CDP connection...');
  try {
    const config = await loadConfig('./config/config.json');
    const response = await fetch(`${config.chrome.cdpEndpoint}/json/version`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Chrome connected: ${data.Browser}\n`);
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`   ❌ Chrome connection failed: ${error.message}`);
    console.log(`   💡 Make sure Chrome is running in debug mode:`);
    console.log(`      cd .. && ./start-chrome-debug.sh\n`);
    return false;
  }
}

async function runTests() {
  const results = {
    llm: await testLLMConnection(),
    resume: await testResumeLoader(),
    qa: await testQADatabase(),
    chrome: await testChromeConnection(),
  };

  console.log('=' .repeat(60));
  console.log('📊 Test Results:');
  console.log('=' .repeat(60));
  console.log(`LLM Connection:    ${results.llm ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Resume Loader:     ${results.resume ? '✅ PASS' : '⚠️  SKIP'}`);
  console.log(`QA Database:       ${results.qa ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Chrome Connection: ${results.chrome ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=' .repeat(60));

  const allPassed = results.llm && results.qa && results.chrome;

  if (allPassed) {
    console.log('\n🎉 All critical tests passed! Ready to apply.\n');
    console.log('Next steps:');
    console.log('1. Find a job URL: https://www.indeed.com/jobs?q=data+analyst');
    console.log('2. Run: node main.js "<apply_url>" "../resumes/<your_resume>.json"');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.\n');
  }
}

runTests().catch(console.error);
