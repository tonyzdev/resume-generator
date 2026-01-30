import { buildTextboxPrompt, buildSelectionPrompt, buildCheckboxPrompt } from '../knowledge/prompt_templates.js';

/**
 * 智能问答引擎
 * 结合规则匹配和 LLM 智能生成答案
 */
export class QAEngine {
  constructor(qaDatabase, llmClient, logger) {
    this.qaDatabase = qaDatabase;
    this.llmClient = llmClient;
    this.logger = logger;
  }

  /**
   * 核心方法：回答问题
   * @param {string} question - 问题文本
   * @param {string} fieldType - 字段类型 (textbox/combobox/radio/checkbox)
   * @param {Array<string>} options - 选项列表（如果有）
   * @param {Object} resumeSummary - 简历摘要
   * @returns {Promise<Object>} { answer, source }
   */
  async answerQuestion(question, fieldType, options, resumeSummary) {
    // 1. 尝试规则匹配（仅用于通用问题的快速回答）
    const ruleAnswer = this.matchQADatabase(question);
    if (ruleAnswer && this.isGenericQuestion(question)) {
      // 对于选择题，仍然调用 LLM 让它从选项中选择
      if ((fieldType === 'radio' || fieldType === 'combobox') && options && options.length > 0) {
        try {
          const answer = await this.askLLM(question, fieldType, options, resumeSummary);
          await this.logger.logQA(question, answer, 'llm');
          return { answer, source: 'llm' };
        } catch (error) {
          // LLM 失败，使用规则答案的简单匹配
          const matched = this.simpleMatch(ruleAnswer, options);
          await this.logger.logQA(question, matched, 'rule-fallback');
          return { answer: matched, source: 'rule-fallback' };
        }
      }

      // 对于文本框，直接使用规则答案
      await this.logger.logQA(question, ruleAnswer, 'rule');
      return { answer: ruleAnswer, source: 'rule' };
    }

    // 2. 调用 LLM
    try {
      const answer = await this.askLLM(question, fieldType, options, resumeSummary);
      await this.logger.logQA(question, answer, 'llm');
      return { answer, source: 'llm' };
    } catch (error) {
      await this.logger.warn(`LLM failed for question: ${question}`, { error: error.message });

      // Fallback: 使用规则答案
      if (ruleAnswer) {
        const finalAnswer = (fieldType === 'radio' || fieldType === 'combobox') && options
          ? this.simpleMatch(ruleAnswer, options)
          : ruleAnswer;

        await this.logger.logQA(question, finalAnswer, 'rule-fallback');
        return { answer: finalAnswer, source: 'rule-fallback' };
      }

      // 如果都失败，返回 null
      return { answer: null, source: 'none' };
    }
  }

  /**
   * 简单的选项匹配（仅用于 fallback）
   * @param {string} answer - 答案文本
   * @param {Array<string>} options - 选项列表
   * @returns {string} 匹配的选项
   */
  simpleMatch(answer, options) {
    const lowerAnswer = answer.toLowerCase();

    // 对于 Yes/No 问题
    if (options.length === 2 &&
        options.some(o => o.toLowerCase() === 'yes') &&
        options.some(o => o.toLowerCase() === 'no')) {

      const negativeWords = ['no', 'not', 'don\'t', 'do not', 'never'];
      const hasNegative = negativeWords.some(word => lowerAnswer.includes(word));

      return hasNegative
        ? (options.find(o => o.toLowerCase() === 'no') || options[1])
        : (options.find(o => o.toLowerCase() === 'yes') || options[0]);
    }

    // 其他情况返回第一个选项
    return options[0];
  }

  /**
   * 规则匹配
   * @param {string} question - 问题文本
   * @returns {string|null} 答案或 null
   */
  matchQADatabase(question) {
    const normalizedQ = question.toLowerCase();

    for (const qa of this.qaDatabase) {
      if (qa.keywords.some(kw => normalizedQ.includes(kw.toLowerCase()))) {
        return qa.answer;
      }
    }

    return null;
  }

  /**
   * 判断是否为通用问题（签证、到岗等）
   * @param {string} question - 问题文本
   * @returns {boolean}
   */
  isGenericQuestion(question) {
    const genericKeywords = [
      'sponsorship',
      'visa',
      'authorized',
      'onsite',
      'commute',
      'relocate',
      'start date',
      'background check',
      'drug test',
      'sms',
      'text message',
      'notifications'
    ];

    const normalizedQ = question.toLowerCase();
    return genericKeywords.some(kw => normalizedQ.includes(kw));
  }

  /**
   * LLM 问答
   * @param {string} question - 问题文本
   * @param {string} fieldType - 字段类型
   * @param {Array<string>} options - 选项列表
   * @param {Object} resumeSummary - 简历摘要
   * @returns {Promise<string>} 答案
   */
  async askLLM(question, fieldType, options, resumeSummary) {
    let prompt;

    switch (fieldType) {
      case 'textbox':
        prompt = buildTextboxPrompt(question, resumeSummary);
        break;

      case 'combobox':
      case 'radio':
        prompt = buildSelectionPrompt(question, options, resumeSummary);
        break;

      case 'checkbox':
        prompt = buildCheckboxPrompt(question, resumeSummary);
        break;

      default:
        throw new Error(`Unknown field type: ${fieldType}`);
    }

    const response = await this.llmClient.complete(prompt);
    return this.parseResponse(response, fieldType, options);
  }

  /**
   * 解析 LLM 响应
   * @param {string} response - LLM 返回的文本
   * @param {string} fieldType - 字段类型
   * @param {Array<string>} options - 选项列表
   * @returns {string} 解析后的答案
   */
  parseResponse(response, fieldType, options) {
    const trimmed = response.trim();

    if (fieldType === 'textbox') {
      // 限制长度
      return trimmed.substring(0, 200);
    }

    if (fieldType === 'combobox' || fieldType === 'radio') {
      // 解析选项编号
      const match = trimmed.match(/(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        if (index >= 0 && index < options.length) {
          return options[index];
        }
      }
      // Fallback: 返回第一个选项
      return options[0];
    }

    if (fieldType === 'checkbox') {
      // 解析 Yes/No
      const lower = trimmed.toLowerCase();
      return lower.includes('yes') || lower.includes('true');
    }

    return trimmed;
  }
}
