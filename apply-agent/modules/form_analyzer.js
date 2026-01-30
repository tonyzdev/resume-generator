/**
 * 表单字段分析器
 * 负责从表单字段中提取选项列表等信息
 */
export class FormAnalyzer {
  constructor(mcp, logger) {
    this.mcp = mcp;
    this.logger = logger;
  }

  /**
   * 获取字段选项（用于 combobox/radio/checkbox）
   * @param {Object} field - 字段对象 { type, label, ref }
   * @returns {Promise<Array<string>|null>} 选项列表或 null
   */
  async getFieldOptions(field) {
    try {
      if (field.type === 'combobox') {
        return await this.getComboboxOptions(field);
      }

      if (field.type === 'radio') {
        return await this.getRadioOptions(field);
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to get options for field: ${field.label}`, { error: error.message });
      return null;
    }
  }

  /**
   * 获取 combobox 选项（通过 evaluate）
   * @param {Object} field - 字段对象
   * @returns {Promise<Array<string>>} 选项列表
   */
  async getComboboxOptions(field) {
    const result = await this.mcp.evaluate(
      `(element) => {
        if (element.tagName === 'SELECT') {
          return Array.from(element.options).map(opt => opt.text.trim()).filter(t => t);
        }
        return [];
      }`,
      field.ref
    );

    // 解析结果
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content.type === 'text') {
        try {
          const options = JSON.parse(content.text);
          return options;
        } catch {
          // 如果不是 JSON，尝试直接返回
          return [content.text];
        }
      }
    }

    return [];
  }

  /**
   * 获取 radio 选项（从快照解析）
   * @param {Object} field - 字段对象
   * @returns {Promise<Array<string>>} 选项列表
   */
  async getRadioOptions(field) {
    // Radio options 通常在 snapshot 中可见
    // 这里返回 null，让调用者从 snapshot 直接获取
    // 或者实现一个快照缓存机制
    return null;
  }

  /**
   * 检测字段是否必填
   * @param {Object} field - 字段对象
   * @returns {boolean} 是否必填
   */
  isRequired(field) {
    return (
      field.label.includes('*') ||
      field.label.includes('required') ||
      field.required === true
    );
  }

  /**
   * 推断字段类别（用于决策是否需要 LLM）
   * @param {string} label - 字段标签
   * @returns {string} 类别 (generic/personal/skills)
   */
  inferFieldCategory(label) {
    const lower = label.toLowerCase();

    const genericKeywords = ['sponsorship', 'visa', 'onsite', 'start date', 'background check'];
    if (genericKeywords.some(kw => lower.includes(kw))) {
      return 'generic';
    }

    const personalKeywords = ['name', 'email', 'phone', 'address'];
    if (personalKeywords.some(kw => lower.includes(kw))) {
      return 'personal';
    }

    const skillsKeywords = ['experience', 'years', 'proficient', 'familiar', 'skill'];
    if (skillsKeywords.some(kw => lower.includes(kw))) {
      return 'skills';
    }

    return 'unknown';
  }
}
