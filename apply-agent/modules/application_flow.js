import { parseFormFields, findButton, getProgress, findFileUploadButton } from '../core/snapshot_parser.js';

/**
 * SmartApply 流程控制器
 * 管理 Indeed SmartApply 的整个申请流程
 */
export class ApplicationFlow {
  constructor(mcp, formFiller, resumeData, resumeSummary, config, logger) {
    this.mcp = mcp;
    this.formFiller = formFiller;
    this.resumeData = resumeData;
    this.resumeSummary = resumeSummary;
    this.config = config;
    this.logger = logger;
    this.maxSteps = 20; // 防止无限循环
  }

  /**
   * 从当前页面开始运行（不导航）
   */
  async runFromCurrentPage() {
    await this.logger.info('Starting from current page');

    let stepsRemaining = this.maxSteps;
    let currentStep = 'unknown';
    let previousSnapshot = '';

    while (stepsRemaining-- > 0) {
      const snapshot = await this.mcp.snapshot();
      await this.logger.info(`Snapshot length: ${snapshot.length} chars`);

      // 检查是否有对话框
      if (snapshot.includes('beforeunload') || snapshot.includes('dialog')) {
        await this.logger.warn('Detected dialog, attempting to dismiss');
        try {
          await this.mcp.callTool('browser_handle_dialog', { accept: true });
          await this.mcp.wait(1);
          continue;
        } catch (error) {
          // 忽略
        }
      }

      const step = getProgress(snapshot);
      await this.logger.info(`Current step detected: ${step}`);

      // 检查是否卡住
      if (snapshot === previousSnapshot) {
        await this.logger.warn('Step did not advance, may be stuck');
        break;
      }

      currentStep = step;
      previousSnapshot = snapshot;
      await this.logger.info(`Current step: ${step}`);

      switch (step) {
        case 'profile-location':
          await this.handleProfileLocationStep(snapshot);
          break;
        case 'resume':
          await this.handleResumeStep(snapshot);
          break;
        case 'privacy':
          await this.handlePrivacyStep(snapshot);
          break;
        case 'questions':
          await this.handleQuestionsStep(snapshot);
          break;
        case 'experience':
          await this.handleExperienceStep(snapshot);
          break;
        case 'review':
          await this.handleReviewStep(snapshot);
          return;
        case 'unknown':
          await this.logger.warn('Unknown step detected, analyzing page content');
          await this.handleUnknownStep(snapshot);
          break;
      }

      await this.mcp.wait(this.config.stepDelay);
    }

    await this.logger.success('Application flow completed');
  }

  /**
   * 执行完整的申请流程
   * @param {string} applyUrl - 申请 URL
   */
  async run(applyUrl) {
    await this.logger.info(`Starting application: ${applyUrl}`);

    // 导航到申请页面
    await this.mcp.navigate(applyUrl);
    await this.mcp.wait(this.config.stepDelay);

    let stepsRemaining = this.maxSteps;
    let currentStep = 'unknown';
    let previousSnapshot = '';

    while (stepsRemaining-- > 0) {
      // 获取当前页面状态
      const snapshot = await this.mcp.snapshot();

      // 调试：保存快照
      await this.logger.info(`Snapshot length: ${snapshot.length} chars`);

      // 检查是否有对话框需要处理
      if (snapshot.includes('beforeunload') || snapshot.includes('dialog')) {
        await this.logger.warn('Detected dialog, attempting to dismiss');
        try {
          await this.mcp.callTool('browser_handle_dialog', { accept: true });
          await this.mcp.wait(1);
          continue;
        } catch (error) {
          await this.logger.warn('Failed to handle dialog', { error: error.message });
        }
      }

      const step = getProgress(snapshot);

      // 调试：记录当前步骤
      await this.logger.info(`Current step detected: ${step}`);

      if (step === currentStep && snapshot === previousSnapshot) {
        // 如果步骤和快照都没变化，可能卡住了
        await this.logger.warn('Step did not advance, may be stuck');
        await this.logger.info('Snapshot preview:', { preview: snapshot.substring(0, 500) });
        break;
      }

      currentStep = step;
      previousSnapshot = snapshot;
      await this.logger.info(`Current step: ${step}`);

      // 根据步骤执行相应操作
      switch (step) {
        case 'profile-location':
          await this.handleProfileLocationStep(snapshot);
          break;

        case 'resume':
          await this.handleResumeStep(snapshot);
          break;

        case 'privacy':
          await this.handlePrivacyStep(snapshot);
          break;

        case 'questions':
          await this.handleQuestionsStep(snapshot);
          break;

        case 'experience':
          await this.handleExperienceStep(snapshot);
          break;

        case 'review':
          await this.handleReviewStep(snapshot);
          return; // 完成

        case 'unknown':
          await this.logger.warn('Unknown step detected, analyzing page content');
          await this.handleUnknownStep(snapshot);
          break;
      }

      await this.mcp.wait(this.config.stepDelay);
    }

    if (stepsRemaining <= 0) {
      await this.logger.error('Max steps reached, application may be incomplete');
    }
  }

  /**
   * 处理个人资料-地址步骤（新版 SmartApply）
   * @param {string} snapshot - 页面快照
   */
  async handleProfileLocationStep(snapshot) {
    await this.logger.info('Step 0: Profile Location (New SmartApply)');

    // 解析字段
    const fields = parseFormFields(snapshot);
    await this.logger.info(`Found ${fields.length} fields`);

    // 填写地址信息（从简历或使用默认值）
    for (const field of fields) {
      const label = field.label.toLowerCase();

      if (label.includes('zip')) {
        await this.formFiller.fill(field, '10001'); // 默认 NYC zip
        await this.logger.info('Filled zip code: 10001');
      } else if (label.includes('city')) {
        await this.formFiller.fill(field, 'New York, NY');
        await this.logger.info('Filled city: New York, NY');
      } else if (label.includes('street') || label.includes('address')) {
        await this.formFiller.fill(field, '123 Main St');
        await this.logger.info('Filled street: 123 Main St');
      }
    }

    // 点击继续
    await this.mcp.wait(1);
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('profile-location');
  }

  /**
   * 处理简历上传步骤
   * @param {string} snapshot - 页面快照
   */
  async handleResumeStep(snapshot) {
    await this.logger.info('Step 1: Resume upload');

    // 检查是否已经有简历文件名显示（说明真的上传了）
    const hasUploadedFile = snapshot.match(/\.pdf|\.docx|\.txt/i);

    if (hasUploadedFile) {
      await this.logger.info('Resume file detected, clicking Continue');
      await this.clickContinueButton(snapshot);
      await this.logger.logStep('resume');
      return;
    }

    // 检查是否选择了 "Build an Indeed Resume"
    if (snapshot.includes('radio "Build an Indeed Resume') &&
        snapshot.includes('button "Continue" [active]') &&
        !snapshot.includes('button "Select file"')) {
      await this.logger.info('User chose "Build an Indeed Resume", clicking Continue');
      await this.clickContinueButton(snapshot);
      await this.logger.logStep('resume');
      return;
    }

    if (!this.resumeData.pdfPath) {
      await this.logger.error('No PDF resume path provided');
      throw new Error('Resume PDF path is required');
    }

    // 首先选择 "Upload a resume" radio button
    const lines = snapshot.split('\n');
    let uploadRef = null;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('radio "Upload a resume')) {
        // 向上查找父 generic 元素
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const match = lines[j].match(/generic \[ref=(\w+)\].*\[cursor=pointer\]/);
          if (match) {
            uploadRef = match[1];
            break;
          }
        }
        break;
      }
    }

    if (uploadRef) {
      await this.logger.info(`Selecting "Upload a resume" option (ref=${uploadRef})`);
      await this.mcp.click('Upload a resume', uploadRef);
      await this.mcp.wait(2); // 等待 DOM 更新
    } else {
      await this.logger.warn('Upload radio button not found');
    }

    // 使用 Playwright 代码直接上传文件
    await this.logger.info(`Uploading file: ${this.resumeData.pdfPath}`);

    const uploadCode = `
async (page) => {
  const fileInput = await page.locator('input[type="file"]').first();
  if (fileInput) {
    await fileInput.setInputFiles('${this.resumeData.pdfPath}');
    await page.waitForTimeout(3000);
    return { success: true };
  } else {
    return { success: false, error: 'File input not found' };
  }
}
`;

    try {
      const result = await this.mcp.callTool('browser_run_code', { code: uploadCode });
      if (result.content && result.content[0] && result.content[0].text.includes('"success":true')) {
        await this.logger.success('Resume file uploaded successfully');
      } else {
        await this.logger.error('Resume upload failed', { result });
        throw new Error('Resume upload failed');
      }
    } catch (error) {
      await this.logger.error('Resume upload error', { error: error.message });
      throw error;
    }

    // 等待上传完成
    await this.mcp.wait(3);

    // 获取新快照检查是否成功
    snapshot = await this.mcp.snapshot();
    if (snapshot.match(/\.pdf|\.docx|\.txt/i)) {
      await this.logger.success('Resume file name detected in page');
    } else {
      await this.logger.warn('Resume file name not detected - upload may have failed');
    }

    // 点击继续
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('resume');
  }

  /**
   * 处理隐私设置步骤（简历上传后）
   * @param {string} snapshot - 页面快照
   */
  async handlePrivacyStep(snapshot) {
    await this.logger.info('Step 1.5: Privacy settings');

    // 直接点击 Continue，使用默认隐私设置
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('privacy');
  }

  /**
   * 处理问题回答步骤
   * @param {string} snapshot - 页面快照
   */
  async handleQuestionsStep(snapshot) {
    await this.logger.info('Step 2: Answering questions');

    // 解析所有表单字段
    const fields = parseFormFields(snapshot);
    await this.logger.info(`Found ${fields.length} fields to fill`);

    if (fields.length === 0) {
      await this.logger.warn('No fields found, trying to continue');
      await this.clickContinueButton(snapshot);
      return;
    }

    // 填写所有字段
    const results = await this.formFiller.fillFields(fields, this.resumeSummary);

    // 统计结果
    const successful = results.filter(r => r.success).length;
    await this.logger.info(`Filled ${successful}/${fields.length} fields`);

    // 点击继续
    await this.mcp.wait(1);
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('questions');
  }

  /**
   * 处理相关经验步骤
   * @param {string} snapshot - 页面快照
   */
  async handleExperienceStep(snapshot) {
    await this.logger.info('Step 3: Relevant experience');

    // 解析字段
    const fields = parseFormFields(snapshot);

    if (fields.length > 0) {
      // 从简历中提取第一个工作经历
      let jobTitle = 'Business Intelligence Analyst';
      let company = 'Data Analytics Corp';

      if (this.resumeData.experiences && this.resumeData.experiences.length > 0) {
        const exp = this.resumeData.experiences[0];
        jobTitle = exp.title || jobTitle;
        company = exp.company || company;
      }

      // 填写字段
      for (const field of fields) {
        if (field.label.toLowerCase().includes('job') || field.label.toLowerCase().includes('title')) {
          await this.formFiller.fill(field, jobTitle);
          await this.logger.info(`Filled job title: ${jobTitle}`);
        } else if (field.label.toLowerCase().includes('company')) {
          await this.formFiller.fill(field, company);
          await this.logger.info(`Filled company: ${company}`);
        }
      }
    }

    // 点击继续
    await this.mcp.wait(1);
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('experience');
  }

  /**
   * 处理审核步骤
   * @param {string} snapshot - 页面快照
   */
  async handleReviewStep(snapshot) {
    await this.logger.info('Step 4: Review');

    if (this.config.actuallySubmit) {
      await this.logger.warn('Submitting application...');
      const submitBtn = findButton(snapshot, 'submit');
      if (submitBtn) {
        await this.mcp.click(submitBtn.text, submitBtn.ref);
        await this.logger.success('Application submitted!');
      } else {
        await this.logger.error('Submit button not found');
      }
    } else {
      await this.logger.info('Dry run mode: NOT submitting');
    }

    await this.logger.logStep('review');
  }

  /**
   * 处理未知步骤（公司自定义问题等）
   * @param {string} snapshot - 页面快照
   */
  async handleUnknownStep(snapshot) {
    await this.logger.info('Analyzing unknown step for form fields');

    // 1. 解析页面中的所有表单字段
    const fields = parseFormFields(snapshot);
    await this.logger.info(`Found ${fields.length} fields in unknown step`);

    if (fields.length === 0) {
      // 没有表单字段，直接点击 Continue
      await this.logger.info('No form fields found, clicking Continue');
      await this.clickContinueButton(snapshot);
      return;
    }

    // 2. 填写所有字段
    await this.logger.info('Filling fields in unknown step');
    const results = await this.formFiller.fillFields(fields, this.resumeSummary);

    // 3. 统计结果
    const successful = results.filter(r => r.success).length;
    await this.logger.info(`Filled ${successful}/${fields.length} fields in unknown step`);

    // 4. 点击 Continue
    await this.mcp.wait(1);
    await this.clickContinueButton(snapshot);
    await this.logger.logStep('unknown');
  }

  /**
   * 点击继续按钮
   * @param {string} snapshot - 页面快照
   */
  async clickContinueButton(snapshot) {
    const continueBtn = findButton(snapshot, 'continue');
    if (continueBtn) {
      await this.mcp.click(continueBtn.text, continueBtn.ref);
      await this.logger.info('Clicked Continue button');

      // 等待可能出现的对话框
      await this.mcp.wait(1);

      // 尝试处理 beforeunload 对话框
      try {
        await this.mcp.callTool('browser_handle_dialog', { accept: true });
        await this.logger.info('Handled navigation dialog');
      } catch (error) {
        // 没有对话框，忽略错误
      }

      // 等待页面跳转完成
      await this.mcp.wait(3);
    } else {
      await this.logger.warn('Continue button not found');
    }
  }
}
