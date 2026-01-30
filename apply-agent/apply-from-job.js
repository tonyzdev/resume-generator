#!/usr/bin/env node

/**
 * 从职位 JSON 文件直接申请
 * 用法: node apply-from-job.js <job_json_path> <resume_json_path>
 */

import fs from 'fs/promises';
import { spawn } from 'child_process';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node apply-from-job.js <job_json_path> <resume_json_path>');
    console.log();
    console.log('Example:');
    console.log('  node apply-from-job.js \\');
    console.log('    "../indeed_jobs_json/data_analyst_Houston__TX_page1_job10_Business_Intelligence_Analyst.json" \\');
    console.log('    "../resumes/job1_Aaron_Carter_with_ai_20260102_121500.json"');
    process.exit(1);
  }

  const jobJsonPath = args[0];
  const resumeJsonPath = args[1];

  try {
    // 读取职位 JSON
    console.log(`📄 Reading job file: ${jobJsonPath}`);
    const jobContent = await fs.readFile(jobJsonPath, 'utf-8');
    const jobData = JSON.parse(jobContent);

    // 提取 apply_url
    const applyUrl = jobData.apply_url;
    if (!applyUrl) {
      console.error('❌ No apply_url found in job JSON');
      process.exit(1);
    }

    // 显示职位信息
    console.log();
    console.log('🎯 Job Information:');
    console.log(`   Title:    ${jobData.job_title}`);
    console.log(`   Company:  ${jobData.company}`);
    console.log(`   Location: ${jobData.location}`);
    console.log(`   Method:   ${jobData.apply_method}`);
    console.log();

    // 检查是否为 external_apply
    if (jobData.apply_method === 'external_apply') {
      console.log('⚠️  Warning: This job uses external apply (not SmartApply)');
      console.log('   The agent may not work correctly for external applications.');
      console.log();

      // 询问是否继续
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('   Continue anyway? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('   Aborted.');
        process.exit(0);
      }
    }

    // 调用 main.js
    console.log('🚀 Starting application...');
    console.log();

    const child = spawn('node', ['main.js', applyUrl, resumeJsonPath], {
      stdio: 'inherit'
    });

    child.on('exit', (code) => {
      process.exit(code);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
