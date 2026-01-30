/**
 * 表单填充器
 * 负责实际填写表单字段
 */
export class FormFiller {
  constructor(mcp, qaEngine, formAnalyzer, logger) {
    this.mcp = mcp;
    this.qaEngine = qaEngine;
    this.formAnalyzer = formAnalyzer;
    this.logger = logger;
  }

  /**
   * 填写单个字段
   * @param {Object} field - 字段对象 { type, label, ref, question }
   * @param {Object} resumeSummary - 简历摘要
   * @returns {Promise<Object>} { field, answer, source, success }
   */
  async fillField(field, resumeSummary) {
    try {
      // 使用问题上下文（如果有）或字段标签
      const questionText = field.question || field.label;
      await this.logger.info(`Filling field: ${field.label} (${field.type})`);
      if (field.question) {
        await this.logger.info(`  Question: ${field.question}`);
      }

      // 1. 获取选项（如果需要）
      let options = null;
      if (['combobox', 'radio'].includes(field.type)) {
        options = await this.formAnalyzer.getFieldOptions(field);
        if (options && options.length > 0) {
          await this.logger.info(`  Options: ${options.join(', ')}`);
        }
      }

      // 2. 获取答案（使用问题上下文）
      const { answer, source } = await this.qaEngine.answerQuestion(
        questionText,
        field.type,
        options,
        resumeSummary
      );

      if (answer === null) {
        await this.logger.warn(`  Skipping field (no answer): ${field.label}`);
        return { field: field.label, answer: null, source, success: false };
      }

      // 3. 填写
      await this.fill(field, answer);
      await this.logger.success(`  Filled: ${answer}`);

      return { field: field.label, answer, source, success: true };
    } catch (error) {
      const errorMsg = `Failed to fill field ${field.label}: ${error.message}`;
      await this.logger.error(errorMsg, { error: error.message });
      console.error('✗', errorMsg);
      console.error('Stack:', error.stack);
      return { field: field.label, answer: null, source: 'error', success: false };
    }
  }

  /**
   * 执行填写操作
   * @param {Object} field - 字段对象
   * @param {any} answer - 答案
   */
  async fill(field, answer) {
    switch (field.type) {
      case 'textbox':
        await this.mcp.type(field.label, field.ref, String(answer));
        break;

      case 'combobox':
        await this.mcp.selectOption(field.label, field.ref, [String(answer)]);
        break;

      case 'checkbox':
        if (this.shouldCheck(answer)) {
          await this.mcp.click(field.label, field.ref);
        }
        break;

      case 'radio':
        // Radio 通常需要点击
        await this.mcp.click(field.label, field.ref);
        break;

      default:
        throw new Error(`Unknown field type: ${field.type}`);
    }
  }

  /**
   * 判断是否应该勾选 checkbox
   * @param {any} answer - 答案
   * @returns {boolean}
   */
  shouldCheck(answer) {
    if (typeof answer === 'boolean') {
      return answer;
    }
    if (typeof answer === 'string') {
      const lower = answer.toLowerCase().trim();
      return lower === 'yes' || lower === 'true' || lower === '1';
    }
    return false;
  }

  /**
   * 批量填写多个字段
   * @param {Array<Object>} fields - 字段数组
   * @param {Object} resumeSummary - 简历摘要
   * @returns {Promise<Array<Object>>} 填写结果数组
   */
  async fillFields(fields, resumeSummary) {
    const results = [];

    // 对于 radio 字段，需要分组处理（同一个问题的多个选项）
    const radioGroups = this.groupRadioFields(fields);

    for (const field of fields) {
      // 如果是 radio 字段，检查是否已经处理过这个组
      if (field.type === 'radio') {
        const groupKey = field.question || 'default';
        if (radioGroups[groupKey].processed) {
          continue; // 跳过已处理的 radio 组
        }

        // 处理整个 radio 组
        const result = await this.fillRadioGroup(radioGroups[groupKey].fields, resumeSummary);
        results.push(result);
        radioGroups[groupKey].processed = true;
      } else {
        // 处理其他类型的字段
        const result = await this.fillField(field, resumeSummary);
        results.push(result);
      }

      // 短暂延迟，避免操作过快
      await this.mcp.wait(0.5);
    }

    return results;
  }

  /**
   * 将 radio 字段按问题分组
   * @param {Array<Object>} fields - 字段数组
   * @returns {Object} 分组后的 radio 字段
   */
  groupRadioFields(fields) {
    const groups = {};

    fields.forEach(field => {
      if (field.type === 'radio') {
        const groupKey = field.question || 'default';
        if (!groups[groupKey]) {
          groups[groupKey] = {
            fields: [],
            processed: false
          };
        }
        groups[groupKey].fields.push(field);
      }
    });

    return groups;
  }

  /**
   * 填写 radio 组（从多个选项中选择一个）
   * @param {Array<Object>} radioFields - 同一组的 radio 字段
   * @param {Object} resumeSummary - 简历摘要
   * @returns {Promise<Object>} 填写结果
   */
  async fillRadioGroup(radioFields, resumeSummary) {
    if (radioFields.length === 0) {
      return { field: 'radio-group', answer: null, source: 'error', success: false };
    }

    try {
      const firstField = radioFields[0];
      const questionText = firstField.question || firstField.label;
      const options = radioFields.map(f => f.label);

      await this.logger.info(`Filling radio group: ${questionText.substring(0, 80)}...`);
      await this.logger.info(`  Options: ${options.join(', ')}`);

      // 获取答案
      const { answer, source } = await this.qaEngine.answerQuestion(
        questionText,
        'radio',
        options,
        resumeSummary
      );

      if (answer === null) {
        await this.logger.warn(`  Skipping radio group (no answer)`);
        return { field: questionText, answer: null, source, success: false };
      }

      // 找到对应的 radio 字段并点击
      const targetField = radioFields.find(f => f.label === answer);
      if (!targetField) {
        const errorMsg = `Answer "${answer}" not found in options: ${options.join(', ')}`;
        await this.logger.error(`  ${errorMsg}`);
        console.error('✗ Radio group error:', errorMsg);
        return { field: questionText, answer, source, success: false };
      }

      // 点击对应的 radio
      await this.mcp.click(targetField.label, targetField.ref);
      await this.logger.success(`  Selected: ${answer}`);

      return { field: questionText, answer, source, success: true };
    } catch (error) {
      const errorMsg = `Failed to fill radio group: ${error.message}`;
      await this.logger.error(errorMsg, { error: error.message });
      console.error('✗', errorMsg);
      console.error('Stack:', error.stack);
      return { field: 'radio-group', answer: null, source: 'error', success: false };
    }
  }
}
