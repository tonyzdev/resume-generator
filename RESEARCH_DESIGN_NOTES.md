# AI Experience A/B Testing Research Design Notes

## 研究目标

测试简历中是否包含AI相关经验（Generative AI、LLM、AI-assisted tools等）对求职结果的影响，观察HR/公司对有AI工作经验候选人的态度。

---

## 当前实现

- 针对每个职位生成多个候选人
- 每个候选人生成两份简历：with_ai 和 no_ai 版本
- 使用 `resume_tracking.csv` 追踪所有生成的简历

---

## 改进建议

### 1. 控制变量问题（最重要）

**现状问题**：
- 学校、专业、GPA 等都是随机生成的
- 同一职位的不同候选人背景差异大
- 无法确定结果差异是因为 AI 经验还是其他因素

**建议**：
- 同一对比较的两份简历应该有**完全相同的背景**：
  - 相同学校
  - 相同专业
  - 相同 GPA
  - 相同经历公司名称
  - 相同项目框架
- 唯一差异：经历/项目/技能描述中是否提到 AI
- 使用不同的姓名（避免 HR 发现重复）

### 2. 专业匹配度

**现状问题**：
- 专业选择过于随机
- 可能出现 "Agribusiness" 申请 Data Analyst 的情况
- 不匹配的专业可能导致简历被直接筛掉

**建议**：
- 根据职位类型预设合理的专业池：
  - Data Analyst → Statistics, Computer Science, Data Science, Economics, Mathematics, Information Systems
  - Software Engineer → Computer Science, Software Engineering, Information Technology
  - Business Analyst → Business Administration, Economics, Finance, Data Analytics
- 专业选择应在合理范围内，不要完全随机

### 3. 投递策略

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| 方案 A | 同一职位投 2 份简历（AI vs Non-AI） | 直接对比 | 可能被 HR 发现重复投递 |
| 方案 B | 不同职位分别投（Job1 投 AI 版，Job2 投 Non-AI 版） | 避免重复 | 职位本身不同，难以比较 |
| 方案 C | 同类职位配对（类似公司、类似职位分别投不同版本） | 较科学，可比较 | 需要更大样本量，配对困难 |

**推荐方案 C**：
- 将职位按公司规模、行业、地区等分类
- 类似职位配对，一个投 AI 版，一个投 Non-AI 版
- 交替投递以避免偏差

### 4. 样本量考虑

**统计功效分析**：
- 假设要检测 10% 的回复率差异（如 AI 版 15% vs Non-AI 版 5%）
- 所需样本量：每组约 100-200 份简历
- 总计：200-400 份简历

**如果预期差异更小**：
- 5% 差异 → 每组需要 300-500 份
- 需要根据预算和时间调整

### 5. 结果追踪

需要在 tracking 系统中增加以下字段：

| 字段 | 说明 |
|------|------|
| applied_date | 投递日期 |
| applied_to_company | 实际投递的公司（可能与原职位不同） |
| applied_to_position | 实际投递的职位 |
| response_received | 是否收到回复 |
| response_date | 回复日期 |
| response_type | 回复类型：no_response / rejection / interview_invite / other |
| interview_stage | 面试阶段（如适用） |
| final_outcome | 最终结果 |
| notes | 备注 |

### 6. 简历配对设计

**推荐的实验设计**：

```
实验单元：一对简历（同一个虚拟人的 AI 版和 Non-AI 版）

Person A (虚拟身份)
├── 基础信息（两个版本共享）
│   ├── 学校：Stanford University
│   ├── 专业：B.S. in Computer Science
│   ├── GPA：3.75
│   └── 经历公司：Tech Corp（名称相同，描述不同）
│
├── with_ai.pdf
│   ├── 姓名：John Smith
│   ├── 经历：提到使用 Generative AI
│   ├── 项目：AI-assisted development
│   └── 技能：包含 LLM, Prompt Engineering
│
└── no_ai.pdf
    ├── 姓名：Michael Johnson（不同名字）
    ├── 经历：传统技术栈描述
    ├── 项目：传统开发方法
    └── 技能：不包含 AI 相关

投递策略：
- with_ai.pdf → 投给 Company A 的 Data Analyst 职位
- no_ai.pdf → 投给 Company B 的类似 Data Analyst 职位
```

### 7. 其他注意事项

1. **时间控制**：同一对简历应在相近时间投递，避免招聘季节性影响

2. **地区控制**：考虑是否需要控制地区变量（不同地区对 AI 的态度可能不同）

3. **公司类型**：
   - 科技公司 vs 传统公司
   - 大公司 vs 初创公司
   - 可以作为分层分析的维度

4. **职位级别**：
   - Entry-level vs Mid-level
   - 不同级别对 AI 经验的重视程度可能不同

5. **简历真实性**：
   - 确保生成的经历描述合理可信
   - 避免过于夸张或不切实际的成就
   - 数据和指标应在合理范围内

6. **伦理考虑**：
   - 这类研究可能涉及欺骗性投递
   - 考虑是否需要 IRB 审批
   - 研究结束后的数据处理

---

## 数据分析建议

### 主要指标

1. **回复率**：收到任何回复的比例
2. **面试邀请率**：收到面试邀请的比例
3. **回复时间**：从投递到收到回复的天数

### 分析方法

1. **卡方检验**：比较 AI vs Non-AI 组的回复率差异
2. **逻辑回归**：控制其他变量后的 AI 经验效应
3. **分层分析**：按公司类型、职位类型、地区等分层比较

### 预期结果

可能的发现：
- AI 经验对科技公司更有吸引力
- 传统行业可能对 AI 经验无感或负面
- Entry-level 职位可能更看重 AI 学习能力
- 不同地区（如硅谷 vs 其他地区）态度不同

---

## 文件结构

```
CV/
├── generate_batch.py      # 批量生成脚本
├── resume_tracking.csv    # 追踪表
├── resumes/               # 生成的简历
│   ├── job1_PersonA_with_ai.pdf
│   ├── job1_PersonA_no_ai.pdf
│   └── ...
└── RESEARCH_DESIGN_NOTES.md  # 本文档
```

---

*Last updated: 2026-01-02*
