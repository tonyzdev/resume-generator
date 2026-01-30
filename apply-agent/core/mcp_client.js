import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * MCP 客户端封装，提供与 Playwright MCP 服务器交互的高级 API
 */
export class MCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  /**
   * 连接到 Playwright MCP 服务器
   * @param {string} cdpEndpoint - Chrome DevTools Protocol 端点 (默认: http://localhost:9222)
   */
  async connect(cdpEndpoint = 'http://localhost:9222') {
    try {
      // 创建 stdio 传输层
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '@playwright/mcp@latest',
          '--cdp-endpoint',
          cdpEndpoint
        ],
      });

      // 创建 MCP 客户端
      this.client = new Client(
        {
          name: 'indeed-auto-apply-agent',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // 连接
      await this.client.connect(this.transport);
      console.log('✓ MCP client connected successfully');
    } catch (error) {
      console.error('✗ Failed to connect to MCP server:', error.message);
      throw error;
    }
  }

  /**
   * 调用 MCP 工具的通用方法
   * @param {string} name - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<Object>} 工具执行结果
   */
  async callTool(name, args = {}) {
    if (!this.client) {
      throw new Error('MCP client not connected. Call connect() first.');
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`✗ Tool call failed: ${name}`, error.message);
      throw error;
    }
  }

  /**
   * 获取页面快照 (accessibility tree)
   * @returns {Promise<string>} 快照文本
   */
  async snapshot() {
    const result = await this.callTool('browser_snapshot', {});
    return result.content[0].text;
  }

  /**
   * 导航到指定 URL
   * @param {string} url - 目标 URL
   */
  async navigate(url) {
    await this.callTool('browser_navigate', { url });
  }

  /**
   * 点击元素
   * @param {string} element - 元素描述（人类可读）
   * @param {string} ref - 元素引用 (从快照中提取)
   */
  async click(element, ref) {
    await this.callTool('browser_click', { element, ref });
  }

  /**
   * 在文本框中输入文字
   * @param {string} element - 元素描述（人类可读）
   * @param {string} ref - 元素引用 (从快照中提取)
   * @param {string} text - 要输入的文字
   * @param {boolean} submit - 是否在输入后按 Enter
   */
  async type(element, ref, text, submit = false) {
    await this.callTool('browser_type', {
      element,
      ref,
      text,
      submit,
    });
  }

  /**
   * 在下拉框中选择选项
   * @param {string} element - 元素描述（人类可读）
   * @param {string} ref - 元素引用 (从快照中提取)
   * @param {string[]} values - 要选择的值（可多选）
   */
  async selectOption(element, ref, values) {
    await this.callTool('browser_select_option', {
      element,
      ref,
      values,
    });
  }

  /**
   * 上传文件
   * @param {string[]} paths - 文件路径数组
   */
  async fileUpload(paths) {
    await this.callTool('browser_file_upload', { paths });
  }

  /**
   * 等待指定秒数
   * @param {number} seconds - 等待秒数
   */
  async wait(seconds) {
    await this.callTool('browser_wait_for', { time: seconds });
  }

  /**
   * 执行 JavaScript 代码
   * @param {string} func - JavaScript 函数字符串
   * @param {string} ref - 可选：元素引用（函数将接收该元素作为参数）
   * @returns {Promise<any>} 执行结果
   */
  async evaluate(func, ref = null) {
    const args = { function: func };
    if (ref) {
      args.ref = ref;
    }
    const result = await this.callTool('browser_evaluate', args);
    return result;
  }

  /**
   * 关闭 MCP 连接
   */
  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✓ MCP client closed');
    }
  }
}
