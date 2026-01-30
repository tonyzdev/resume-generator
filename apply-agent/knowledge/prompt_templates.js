/**
 * LLM Prompt 模板
 */

/**
 * 为 textbox 问题生成 prompt
 * @param {string} question - 问题文本
 * @param {Object} resumeSummary - 简历摘要
 * @returns {string} Prompt
 */
export function buildTextboxPrompt(question, resumeSummary) {
  return `You are helping fill out a job application form on Indeed.

Applicant Information:
- Name: ${resumeSummary.name}
- Education: ${resumeSummary.education}
- Skills: ${resumeSummary.skills.join(', ')}
- Experience: ${resumeSummary.experience}

Question: "${question}"

Instructions:
- Provide a concise, professional answer (max 200 characters)
- Base your answer on the applicant's resume information
- Use first person ("I have...", "I am...")
- Be honest and accurate

Answer:`;
}

/**
 * 为 combobox/radio 选择生成 prompt
 * @param {string} question - 问题文本
 * @param {Array<string>} options - 可选项列表
 * @param {Object} resumeSummary - 简历摘要
 * @returns {string} Prompt
 */
export function buildSelectionPrompt(question, options, resumeSummary) {
  const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

  return `You are helping select the most appropriate option for a job application question.

Applicant Information:
- Name: ${resumeSummary.name}
- Education: ${resumeSummary.education}
- Skills: ${resumeSummary.skills.join(', ')}
- Experience: ${resumeSummary.experience}

Question: "${question}"

Available Options:
${optionsList}

Instructions:
- Select the option that best matches the applicant's qualifications
- Respond with ONLY the option number (1, 2, 3, etc.)
- If none fit perfectly, choose the closest match
- Do not explain your choice

Answer (number only):`;
}

/**
 * 为 checkbox 决策生成 prompt
 * @param {string} question - 问题文本
 * @param {Object} resumeSummary - 简历摘要
 * @returns {string} Prompt
 */
export function buildCheckboxPrompt(question, resumeSummary) {
  return `You are helping decide whether to check a checkbox on a job application form.

Applicant Information:
- Name: ${resumeSummary.name}
- Education: ${resumeSummary.education}
- Skills: ${resumeSummary.skills.join(', ')}
- Experience: ${resumeSummary.experience}

Question/Statement: "${question}"

Instructions:
- Respond with ONLY "Yes" or "No"
- "Yes" means the checkbox should be checked
- "No" means the checkbox should not be checked
- Base your decision on the applicant's qualifications and the question context

Answer (Yes or No):`;
}
