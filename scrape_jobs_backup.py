"""
备份，可以正常运行，需要手动登录一次chrome，且用完之后会退出

"""


import re
import json
import csv
import time
import random
import os
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout


def read_job_urls(file_path):
    """读取 job_list.txt，提取所有 Indeed URL"""
    urls = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('http') and 'indeed.com' in line:
                urls.append(line)
    return urls


def scrape_job_details(page, url, index):
    """爬取单个职位的详细信息"""
    job_info = {
        'url': url,
        'job_title': '',
        'company': '',
        'location': '',
        'salary': '',
        'job_type': '',
        'apply_method': '',
        'apply_url': '',
        'job_details': '',
        'full_description': '',
        'scraped_at': datetime.now().isoformat()
    }

    try:
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
        time.sleep(random.uniform(3, 5))

        # 职位标题
        job_info['job_title'] = extract_text(page, [
            'h1.jobsearch-JobInfoHeader-title',
            '[data-testid="jobsearch-JobInfoHeader-title"]',
            'h1[class*="jobTitle"]',
            '.jobsearch-JobInfoHeader-title-container h1',
            'h1',
        ])

        # 公司名称
        job_info['company'] = extract_text(page, [
            '[data-testid="inlineHeader-companyName"] a',
            '[data-testid="inlineHeader-companyName"]',
            '[data-company-name="true"]',
            '.jobsearch-InlineCompanyRating-companyHeader a',
            '.jobsearch-InlineCompanyRating a',
            'div[data-testid="jobsearch-CompanyInfoContainer"] a',
            '[class*="companyName"] a',
            '[class*="CompanyName"]',
        ])

        # 地点
        job_info['location'] = extract_text(page, [
            '[data-testid="inlineHeader-companyLocation"]',
            '[data-testid="job-location"]',
            '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
            '.jobsearch-JobInfoHeader-subtitle div:last-child',
            '[class*="companyLocation"]',
        ])

        # 薪资和工作类型
        salary_type_text = extract_text(page, [
            '#salaryInfoAndJobType',
            '[data-testid="attribute_snippet_testid"]',
            '.jobsearch-JobMetadataHeader-item',
            '[class*="SalaryInfo"]',
        ])

        if salary_type_text:
            salary_match = re.search(r'\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:a |an |per )?\w+)?', salary_type_text)
            if salary_match:
                job_info['salary'] = salary_match.group(0).strip()

            job_types = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Permanent']
            for jt in job_types:
                if jt.lower() in salary_type_text.lower():
                    job_info['job_type'] = jt
                    break

        if not job_info['job_type']:
            type_elements = page.query_selector_all('[class*="attribute"], [class*="metadata"], [class*="tag"]')
            for el in type_elements:
                try:
                    text = el.inner_text().strip()
                    if any(jt.lower() in text.lower() for jt in ['full-time', 'part-time', 'contract', 'remote']):
                        job_info['job_type'] = text
                        break
                except:
                    pass

        # Job Details
        job_details_parts = []
        details_section = page.query_selector('#jobDetailsSection, [aria-label="Job details"]')
        if details_section:
            job_details_parts.append(details_section.inner_text().strip())

        benefits = page.query_selector('#benefits, [aria-label="Benefits"]')
        if benefits:
            job_details_parts.append("Benefits:\n" + benefits.inner_text().strip())

        job_info['job_details'] = '\n\n'.join(job_details_parts)

        # 完整职位描述
        job_info['full_description'] = extract_text(page, [
            '#jobDescriptionText',
            '[data-testid="jobDescriptionText"]',
            '.jobsearch-jobDescriptionText',
            '[class*="jobDescription"]',
        ])

        # 申请方式检测
        try:
            indeed_apply = page.query_selector('#indeedApplyButton, button[aria-label*="Apply now"]')
            if indeed_apply:
                button_text = indeed_apply.inner_text().strip().lower()
                if 'apply now' in button_text:
                    job_info['apply_method'] = 'Indeed Easy Apply'
                    job_info['apply_url'] = url

            company_apply = page.query_selector('button[aria-label*="Apply on company site"], a[class*="applyButton"]')
            if company_apply:
                job_info['apply_method'] = 'Company Website'
                href = company_apply.get_attribute('href')
                if href:
                    job_info['apply_url'] = href

            if not job_info['apply_method']:
                apply_elements = page.query_selector_all('button, a')
                for el in apply_elements:
                    try:
                        text = el.inner_text().strip().lower()
                        aria = el.get_attribute('aria-label') or ''

                        if 'apply' in text or 'apply' in aria.lower():
                            if 'company' in text or 'company' in aria.lower() or 'employer' in text:
                                job_info['apply_method'] = 'Company Website'
                            else:
                                job_info['apply_method'] = 'Indeed Easy Apply'

                            href = el.get_attribute('href')
                            if href and href.startswith('http'):
                                job_info['apply_url'] = href
                            else:
                                job_info['apply_url'] = url
                            break
                    except:
                        pass

        except Exception as e:
            print(f"  申请方式检测错误: {e}")

        if not job_info['apply_url']:
            job_info['apply_url'] = url

    except PlaywrightTimeout:
        print(f"  超时错误")
    except Exception as e:
        print(f"  爬取错误: {e}")

    return job_info


def extract_text(page, selectors):
    """尝试多个选择器提取文本"""
    for selector in selectors:
        try:
            el = page.query_selector(selector)
            if el:
                text = el.inner_text().strip()
                if text:
                    return text
        except:
            pass
    return ''


def save_to_csv(jobs, output_file):
    """保存到 CSV 文件"""
    if not jobs:
        return

    fieldnames = ['job_title', 'company', 'location', 'salary', 'job_type',
                  'apply_method', 'apply_url', 'job_details', 'full_description',
                  'url', 'scraped_at']

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(jobs)


def save_to_json(jobs, output_file):
    """保存到 JSON 文件"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)


def main():
    input_file = 'job_list.txt'
    output_csv = f'jobs_output_{time.time()}.csv'
    output_json = f'jobs_output_{time.time()}.json'

    # 专用的 Chrome 数据目录（会保存登录状态）
    chrome_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chrome_data')

    urls = read_job_urls(input_file)
    print(f"找到 {len(urls)} 个职位链接")

    if not urls:
        print("没有找到有效的 Indeed URL")
        return

    is_first_run = not os.path.exists(chrome_data_dir)

    if is_first_run:
        print(f"\n首次运行，将创建专用 Chrome 配置...")
        print(f"配置目录: {chrome_data_dir}")
        print(f"\n浏览器打开后，请先登录 Indeed，然后爬取会自动开始。")
    else:
        print(f"\n使用已有配置: {chrome_data_dir}")

    jobs = []

    with sync_playwright() as p:
        print("\n正在启动 Chrome...")

        # 使用持久化上下文（保存登录状态）
        context = p.chromium.launch_persistent_context(
            user_data_dir=chrome_data_dir,
            headless=False,  # 显示浏览器
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--disable-infobars',
            ],
            viewport={'width': 1920, 'height': 1080},
            locale='en-US',
        )

        page = context.pages[0] if context.pages else context.new_page()

        if is_first_run:
            # 首次运行，先访问 Indeed 让用户登录
            print("\n请在浏览器中登录 Indeed...")
            page.goto('https://www.indeed.com', wait_until='domcontentloaded', timeout=60000)
            print("登录完成后按 Enter 继续爬取...")
            input()
        else:
            print("开始爬取...\n")

        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] 正在爬取...")
            print(f"  URL: {url[:70]}...")

            job_info = scrape_job_details(page, url, i)
            jobs.append(job_info)

            if job_info['job_title']:
                print(f"  ✓ 职位: {job_info['job_title']}")
                print(f"    公司: {job_info['company']}")
                print(f"    地点: {job_info['location']}")
                print(f"    薪资: {job_info['salary'] or '未提供'}")
                print(f"    类型: {job_info['job_type'] or '未提供'}")
                print(f"    申请: {job_info['apply_method'] or '未知'}")
            else:
                print(f"  ✗ 页面加载失败或职位已下架")

            if i < len(urls):
                delay = random.uniform(3, 6)
                print(f"  等待 {delay:.1f} 秒...\n")
                time.sleep(delay)

        context.close()

    # 保存结果
    save_to_csv(jobs, output_csv)
    save_to_json(jobs, output_json)

    successful = sum(1 for j in jobs if j['job_title'])
    print(f"\n{'='*50}")
    print(f"完成！成功爬取 {successful}/{len(jobs)} 个职位")
    print(f"CSV 输出: {output_csv}")
    print(f"JSON 输出: {output_json}")

    indeed_apply = sum(1 for j in jobs if j['apply_method'] == 'Indeed Easy Apply')
    company_apply = sum(1 for j in jobs if j['apply_method'] == 'Company Website')
    unknown = len(jobs) - indeed_apply - company_apply

    print(f"\n申请方式统计:")
    print(f"  Indeed Easy Apply: {indeed_apply}")
    print(f"  公司网站申请: {company_apply}")
    print(f"  未知/失败: {unknown}")


if __name__ == '__main__':
    main()
