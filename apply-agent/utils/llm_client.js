/**
 * LLM 客户端封装
 * 支持 OpenAI API 和兼容的 API
 */
export class LLMClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiBase = config.apiBase || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 500;
  }

  /**
   * 调用 LLM 完成文本
   * @param {string} prompt - Prompt 文本
   * @returns {Promise<string>} LLM 生成的文本
   */
  async complete(prompt) {
    try {
      const url = `${this.apiBase}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error.substring(0, 200)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error(`Invalid response format: ${JSON.stringify(data).substring(0, 200)}`);
      }

      const completion = data.choices[0].message.content.trim();

      return completion;
    } catch (error) {
      console.error('✗ LLM completion failed:', error.message);
      throw error;
    }
  }

  /**
   * 测试 API 连接
   * @returns {Promise<boolean>} 是否连接成功
   */
  async testConnection() {
    try {
      await this.complete('Say "OK" if you can hear me.');
      console.log('✓ LLM client connected successfully');
      return true;
    } catch (error) {
      console.error('✗ LLM client connection failed:', error.message);
      return false;
    }
  }
}
