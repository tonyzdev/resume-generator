import fs from 'fs/promises';
import path from 'path';

/**
 * 简单的日志工具
 */
export class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.logFile = null;
  }

  /**
   * 初始化日志文件
   * @param {string} jobId - 职位 ID 或唯一标识
   */
  async init(jobId) {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      this.logFile = path.join(this.logDir, `apply_${jobId}_${timestamp}.log`);
      await this.log('info', 'Application started');
    } catch (error) {
      console.error('Failed to initialize logger:', error.message);
    }
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别 (info, warn, error, success)
   * @param {string} message - 日志消息
   * @param {Object} data - 可选的附加数据
   */
  async log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    // 控制台输出
    const prefix = this.getPrefix(level);
    console.log(`${prefix} ${message}`);

    // 文件输出
    if (this.logFile) {
      try {
        await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
      } catch (error) {
        console.error('Failed to write log:', error.message);
      }
    }
  }

  getPrefix(level) {
    const prefixes = {
      info: 'ℹ',
      warn: '⚠',
      error: '✗',
      success: '✓',
    };
    return prefixes[level] || 'ℹ';
  }

  async info(message, data) {
    await this.log('info', message, data);
  }

  async warn(message, data) {
    await this.log('warn', message, data);
  }

  async error(message, data) {
    await this.log('error', message, data);
  }

  async success(message, data) {
    await this.log('success', message, data);
  }

  /**
   * 记录问答对
   * @param {string} question - 问题
   * @param {string} answer - 答案
   * @param {string} source - 答案来源 (rule/llm)
   */
  async logQA(question, answer, source) {
    await this.log('info', `Q&A [${source}]`, { question, answer });
  }

  /**
   * 记录步骤完成
   * @param {string} step - 步骤名称
   */
  async logStep(step) {
    await this.success(`Completed step: ${step}`);
  }
}
