/**
 * 快照解析工具
 * 从 browser_snapshot 返回的 accessibility tree 中提取有用信息
 */

/**
 * 解析表单字段
 * @param {string} snapshotText - 快照文本
 * @returns {Array<Object>} 字段数组 [{ type, label, ref, value, question }, ...]
 */
export function parseFormFields(snapshotText) {
  const fields = [];
  const lines = snapshotText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 匹配 textbox
    const textboxMatch = line.match(/textbox\s+"([^"]+)".*?\[ref=(\w+)\]/);
    if (textboxMatch) {
      const question = findQuestionContext(lines, i);
      fields.push({
        type: 'textbox',
        label: textboxMatch[1],
        ref: textboxMatch[2],
        value: extractValue(line),
        question,
      });
      continue;
    }

    // 匹配 combobox
    const comboboxMatch = line.match(/combobox\s+"([^"]+)".*?\[ref=(\w+)\]/);
    if (comboboxMatch) {
      const question = findQuestionContext(lines, i);
      fields.push({
        type: 'combobox',
        label: comboboxMatch[1],
        ref: comboboxMatch[2],
        value: extractValue(line),
        question,
      });
      continue;
    }

    // 匹配 radio
    const radioMatch = line.match(/radio\s+"([^"]+)".*?\[ref=(\w+)\]/);
    if (radioMatch) {
      const question = findQuestionContext(lines, i);
      fields.push({
        type: 'radio',
        label: radioMatch[1],
        ref: radioMatch[2],
        checked: line.includes('[checked]') || line.includes('[active]'),
        question,
      });
      continue;
    }

    // 匹配 checkbox
    const checkboxMatch = line.match(/checkbox\s+"([^"]+)".*?\[ref=(\w+)\]/);
    if (checkboxMatch) {
      const question = findQuestionContext(lines, i);
      fields.push({
        type: 'checkbox',
        label: checkboxMatch[1],
        ref: checkboxMatch[2],
        checked: line.includes('[checked]'),
        question,
      });
      continue;
    }
  }

  return fields;
}

/**
 * 查找字段的问题上下文
 * @param {Array<string>} lines - 所有行
 * @param {number} fieldIndex - 字段所在行号
 * @returns {string|null} 问题文本
 */
function findQuestionContext(lines, fieldIndex) {
  const fieldIndent = lines[fieldIndex].match(/^(\s*)/)[1].length;

  // 向上查找，寻找同级或父级的 generic 中的长文本
  for (let i = fieldIndex - 1; i >= Math.max(0, fieldIndex - 20); i--) {
    const line = lines[i];
    const indent = line.match(/^(\s*)/)[1].length;

    // 如果缩进太小，说明已经超出了当前表单组
    if (indent < fieldIndent - 10) {
      break;
    }

    // 查找 generic 中的文本
    const genericMatch = line.match(/generic \[ref=\w+\]:\s*(.+)/);
    if (genericMatch) {
      const text = genericMatch[1].trim();
      // 如果文本包含问号或足够长，可能是问题
      if (text.includes('?') || text.length > 40) {
        return text;
      }
    }
  }

  return null;
}

/**
 * 从行中提取当前值
 * @param {string} line - 快照中的一行
 * @returns {string|null} 当前值
 */
function extractValue(line) {
  // 匹配 value="..." 或 [value: ...]
  const valueMatch = line.match(/value[=:]\s*["']([^"']+)["']/);
  return valueMatch ? valueMatch[1] : null;
}

/**
 * 查找按钮
 * @param {string} snapshotText - 快照文本
 * @param {string} buttonText - 按钮文本（如 "Continue", "Submit"）
 * @returns {Object|null} { ref, text } 或 null
 */
export function findButton(snapshotText, buttonText) {
  const lines = snapshotText.split('\n');
  const normalizedTarget = buttonText.toLowerCase();

  for (const line of lines) {
    if (line.includes('button')) {
      const textMatch = line.match(/"([^"]+)"/);
      const refMatch = line.match(/\[ref=(\w+)\]/);

      if (textMatch && refMatch) {
        const text = textMatch[1];
        const ref = refMatch[1];

        if (text.toLowerCase().includes(normalizedTarget)) {
          return { ref, text };
        }
      }
    }
  }

  return null;
}

/**
 * 获取当前申请进度
 * @param {string} snapshotText - 快照文本
 * @returns {string} 'profile-location' | 'resume' | 'privacy' | 'questions' | 'experience' | 'review' | 'unknown'
 */
export function getProgress(snapshotText) {
  const lower = snapshotText.toLowerCase();

  // 新版 SmartApply 流程
  if (lower.includes('profile-location') || lower.includes('review your location')) {
    return 'profile-location';
  }

  // 隐私设置页面（简历上传后）
  if (lower.includes('privacy-settings') || lower.includes('preview what employers see')) {
    return 'privacy';
  }

  // 问题回答步骤
  if (lower.includes('questions-module') || lower.includes('answer screener questions') || lower.includes('57%')) {
    return 'questions';
  }

  // 检测进度百分比
  if (lower.includes('43%') || (lower.includes('resume-selection-module') && lower.includes('resume-selection'))) {
    return 'resume';
  }
  if (lower.includes('71%') || lower.includes('relevant-experience')) {
    return 'experience';
  }
  if (lower.includes('100%') || lower.includes('review-module')) {
    return 'review';
  }

  // Fallback: 根据页面内容判断
  if (lower.includes('upload') && lower.includes('resume') && !lower.includes('privacy')) {
    return 'resume';
  }
  if (lower.includes('review your application') || lower.includes('submit your application')) {
    return 'review';
  }

  return 'unknown';
}

/**
 * 检查是否有错误消息
 * @param {string} snapshotText - 快照文本
 * @returns {string|null} 错误消息或 null
 */
export function getErrorMessage(snapshotText) {
  const lines = snapshotText.split('\n');

  for (const line of lines) {
    if (line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('required') ||
        line.toLowerCase().includes('invalid')) {
      // 提取错误文本
      const textMatch = line.match(/"([^"]+)"/);
      if (textMatch) {
        return textMatch[1];
      }
    }
  }

  return null;
}

/**
 * 检查页面是否已完成加载
 * @param {string} snapshotText - 快照文本
 * @returns {boolean} 是否已加载
 */
export function isPageLoaded(snapshotText) {
  // 如果页面有 "Loading..." 或 spinner，返回 false
  const lower = snapshotText.toLowerCase();
  return !lower.includes('loading') && !lower.includes('spinner');
}

/**
 * 提取上传文件的按钮
 * @param {string} snapshotText - 快照文本
 * @returns {Object|null} { ref, text } 或 null
 */
export function findFileUploadButton(snapshotText) {
  const lines = snapshotText.split('\n');

  for (const line of lines) {
    if (line.includes('button') || line.includes('link')) {
      const textMatch = line.match(/"([^"]+)"/);
      const refMatch = line.match(/ref=(\S+)/);

      if (textMatch && refMatch) {
        const text = textMatch[1].toLowerCase();
        const ref = refMatch[1];

        if (text.includes('upload') || text.includes('browse') || text.includes('choose file')) {
          return { ref, text: textMatch[1] };
        }
      }
    }
  }

  return null;
}

/**
 * 解析 radio group 的所有选项
 * @param {string} snapshotText - 快照文本
 * @param {string} groupName - radio group 名称
 * @returns {Array<Object>} [{ label, ref, checked }, ...]
 */
export function parseRadioGroup(snapshotText, groupName) {
  const options = [];
  const lines = snapshotText.split('\n');
  const normalizedGroupName = groupName.toLowerCase();

  let inGroup = false;
  for (const line of lines) {
    // 检测是否进入目标 group
    if (line.toLowerCase().includes(normalizedGroupName) && line.includes('group')) {
      inGroup = true;
      continue;
    }

    // 如果在 group 内，收集 radio 选项
    if (inGroup && line.includes('radio')) {
      const textMatch = line.match(/"([^"]+)"/);
      const refMatch = line.match(/ref=(\S+)/);

      if (textMatch && refMatch) {
        options.push({
          label: textMatch[1],
          ref: refMatch[1],
          checked: line.includes('[checked]'),
        });
      }
    }

    // 如果遇到新的 group，退出
    if (inGroup && line.includes('group') && !line.toLowerCase().includes(normalizedGroupName)) {
      break;
    }
  }

  return options;
}
