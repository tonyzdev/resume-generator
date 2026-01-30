import fs from 'fs/promises';

/**
 * 配置加载器
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 配置对象
 */
export async function loadConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    // 验证必需的配置项
    if (!config.llm || !config.llm.apiKey) {
      console.warn('Warning: LLM API key not configured');
    }

    console.log('✓ Configuration loaded');
    return config;
  } catch (error) {
    console.error(`✗ Failed to load config from ${configPath}:`, error.message);
    throw error;
  }
}

/**
 * 从环境变量覆盖配置
 * @param {Object} config - 配置对象
 * @returns {Object} 更新后的配置
 */
export function overrideFromEnv(config) {
  if (process.env.OPENAI_API_KEY) {
    config.llm.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENAI_API_BASE) {
    config.llm.apiBase = process.env.OPENAI_API_BASE;
  }
  if (process.env.CDP_ENDPOINT) {
    config.chrome.cdpEndpoint = process.env.CDP_ENDPOINT;
  }

  return config;
}
