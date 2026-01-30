import fs from 'fs/promises';
import path from 'path';

/**
 * 简历加载器
 * 从 JSON 文件加载简历数据
 */
export class ResumeLoader {
  /**
   * 加载简历文件
   * @param {string} resumePath - 简历文件路径或目录
   * @returns {Promise<Object>} 简历数据
   */
  async load(resumePath) {
    try {
      // 如果是目录，查找第一个 .json 文件
      const stats = await fs.stat(resumePath);
      let jsonPath = resumePath;

      if (stats.isDirectory()) {
        const files = await fs.readdir(resumePath);
        const jsonFile = files.find(f => f.endsWith('.json'));
        if (!jsonFile) {
          throw new Error(`No JSON resume found in directory: ${resumePath}`);
        }
        jsonPath = path.join(resumePath, jsonFile);
      }

      // 读取并解析 JSON
      const content = await fs.readFile(jsonPath, 'utf-8');
      const resume = JSON.parse(content);

      // 验证必需字段
      this.validate(resume);

      // 添加 PDF 路径（如果存在）
      const pdfPath = jsonPath.replace('.json', '.pdf');
      try {
        await fs.access(pdfPath);

        // 将 PDF 复制到当前目录（Playwright 只能访问当前目录）
        const localPdfPath = path.join(process.cwd(), 'temp-resume.pdf');
        await fs.copyFile(pdfPath, localPdfPath);
        resume.pdfPath = localPdfPath;

        console.log(`✓ Resume PDF copied to: ${localPdfPath}`);
      } catch {
        // PDF 不存在，跳过
        console.warn(`Warning: PDF resume not found at ${pdfPath}`);
      }

      console.log(`✓ Resume loaded: ${resume.name}`);
      return resume;
    } catch (error) {
      console.error(`✗ Failed to load resume from ${resumePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 验证简历数据
   * @param {Object} resume - 简历对象
   */
  validate(resume) {
    const requiredFields = ['name', 'email'];
    const missing = requiredFields.filter(field => !resume[field]);

    if (missing.length > 0) {
      throw new Error(`Resume missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * 从简历中提取摘要信息（用于 LLM prompt）
   * @param {Object} resume - 简历对象
   * @returns {Object} 摘要信息
   */
  extractSummary(resume) {
    const summary = {
      name: resume.name,
      email: resume.email,
      phone: resume.phone || 'N/A',
      education: this.extractEducation(resume),
      skills: this.extractSkills(resume),
      experience: this.extractExperience(resume),
      projects: this.extractProjects(resume),
    };

    return summary;
  }

  extractEducation(resume) {
    if (!resume.education) return 'N/A';
    const edu = resume.education;
    return `${edu.university || ''}, ${edu.major || ''}, GPA ${edu.gpa || 'N/A'}`;
  }

  extractSkills(resume) {
    if (!resume.skills) return [];

    // 合并所有技能类别
    const allSkills = [];
    if (resume.skills.technical) allSkills.push(...resume.skills.technical);
    if (resume.skills.analytical) allSkills.push(...resume.skills.analytical);
    if (resume.skills.tools) allSkills.push(...resume.skills.tools);
    if (resume.skills.others) allSkills.push(...resume.skills.others);

    return allSkills;
  }

  extractExperience(resume) {
    if (!resume.experiences || resume.experiences.length === 0) {
      return 'N/A';
    }

    // 返回第一个工作经历的摘要
    const exp = resume.experiences[0];
    return `${exp.title || 'N/A'} at ${exp.company || 'N/A'}: ${exp.description || ''}`;
  }

  extractProjects(resume) {
    if (!resume.projects || resume.projects.length === 0) {
      return [];
    }

    return resume.projects.map(p => p.title || p.name).filter(Boolean);
  }
}
