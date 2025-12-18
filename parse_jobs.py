import json
import re
import csv


def extract_education(text):
    # 学历
    education_patterns = [
        r"(PhD|Ph\.D\.?|Doctorate)",
        r"(Master'?s?\s*(?:degree|'s)?|MS|M\.S\.|MBA|M\.A\.)",
        r"(Bachelor'?s?\s*(?:degree|'s)?|BS|B\.S\.|BA|B\.A\.)",
        r"(Associate'?s?\s*(?:degree)?)",
    ]

    education_levels = []
    text_lower = text.lower()

    if re.search(r'phd|ph\.d|doctorate', text_lower):
        education_levels.append('PhD/Doctorate')
    if re.search(r"master'?s|ms\b|m\.s\.|mba|m\.a\.", text_lower):
        education_levels.append("Master's")
    if re.search(r"bachelor'?s|bs\b|b\.s\.|ba\b|b\.a\.", text_lower):
        education_levels.append("Bachelor's")
    if re.search(r"associate'?s", text_lower):
        education_levels.append("Associate's")

    edu_sentences = []
    patterns = [
        r"(?:require|preferred|minimum|qualification)[^.]*(?:degree|bachelor|master|phd)[^.]*\.",
        r"(?:bachelor|master|phd|degree)[^.]*(?:require|preferred|in\s+\w+)[^.]*\.",
        r"\b(?:BS|BA|MS|MBA|PhD)[^.]*(?:degree|required|preferred)[^.]*\.",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        edu_sentences.extend(matches)

    if education_levels:
        return ', '.join(education_levels)
    return ''


def extract_major(text):
    # 专业
    majors = []

    major_keywords = [
        'Computer Science', 'Data Science', 'Statistics', 'Mathematics', 'Math',
        'Information Systems', 'Information Technology', 'IT',
        'Business Administration', 'Finance', 'Accounting', 'Economics',
        'Engineering', 'Physics', 'Chemistry', 'Biology',
        'Management Information Systems', 'MIS',
        'Data Analytics', 'Analytics',
        'Quantitative', 'STEM',
    ]

    degree_in_patterns = [
        r"(?:degree|bachelor'?s?|master'?s?|bs|ba|ms|mba|phd)\s+(?:in|of)\s+([A-Za-z\s,&]+?)(?:\.|,|;|or|and|\s+with|\s+required|\s+preferred)",
        r"(?:background|major|field)\s+(?:in)\s+([A-Za-z\s,&]+?)(?:\.|,|;|or|and|\s+is|\s+required)",
    ]

    for pattern in degree_in_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            cleaned = match.strip()
            if len(cleaned) > 3 and len(cleaned) < 100:
                majors.append(cleaned)

    for keyword in major_keywords:
        if re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE):
            if keyword not in majors:
                majors.append(keyword)

    # 去重
    seen = set()
    unique_majors = []
    for m in majors:
        m_lower = m.lower().strip()
        if m_lower not in seen and len(m_lower) > 2:
            seen.add(m_lower)
            unique_majors.append(m.strip())

    return ', '.join(unique_majors[:5]) if unique_majors else ''


def extract_experience(text):
    # 经验
    experience_info = []

    year_patterns = [
        r"(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)",
        r"(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)",
        r"(?:minimum|at least|required)\s+(\d+)\+?\s*(?:years?|yrs?)",
        r"(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:work|professional|related)",
    ]

    for pattern in year_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                experience_info.append(f"{match[0]}-{match[1]} years")
            else:
                experience_info.append(f"{match}+ years")

    # entry 还是 senior
    if re.search(r'\bentry[- ]?level\b', text, re.IGNORECASE):
        experience_info.append('Entry-level')
    if re.search(r'\bsenior\b', text, re.IGNORECASE):
        experience_info.append('Senior')
    if re.search(r'\bjunior\b', text, re.IGNORECASE):
        experience_info.append('Junior')
    if re.search(r'\bearly career\b', text, re.IGNORECASE):
        experience_info.append('Early Career')

    seen = set()
    unique = []
    for e in experience_info:
        if e.lower() not in seen:
            seen.add(e.lower())
            unique.append(e)

    return ', '.join(unique) if unique else ''


def extract_industry(text, company, job_title):
    # 行业
    industries = []

    company_lower = company.lower()
    intro_text = text[:500].lower()

    # todo: ai 生成的一个映射表，后续可能需要扩充，目前看基本够用
    industry_keywords = {
        'Technology/Software': [('software', intro_text), ('saas', intro_text), ('tech company', intro_text)],
        'Finance/Banking': [('bank', company_lower), ('financial services', intro_text), ('hedge fund', intro_text), ('brokerage', intro_text), ('investment', company_lower)],
        'Healthcare/Medical': [('medical', company_lower), ('healthcare', intro_text), ('hospital', company_lower), ('pharmaceutical', intro_text)],
        'Manufacturing': [('manufacturing', intro_text), ('manufactur', company_lower)],
        'Semiconductor': [('semiconductor', intro_text), ('wafer', intro_text)],
        'Energy': [('energy', company_lower), ('hitachi energy', company_lower)],
        'Defense/Aerospace': [('defense', company_lower), ('military', intro_text), ('aerospace', company_lower)],
        'Consulting': [('consulting', company_lower), ('consultant', company_lower)],
        'Education/University': [('university', company_lower), ('college', company_lower)],
        'Agriculture': [('agriculture', intro_text), ('crop', intro_text), ('vanguard', company_lower)],
        'Construction': [('construction', company_lower), ('contracting corp', company_lower)],
        'Government': [('state agency', intro_text), ('government', intro_text)],
    }

    for industry, checks in industry_keywords.items():
        for keyword, search_text in checks:
            if keyword in search_text:
                if industry not in industries:
                    industries.append(industry)
                break

    return ', '.join(industries[:2]) if industries else ''


def process_jobs(input_file, output_csv, output_json):

    with open(input_file, 'r', encoding='utf-8') as f:
        jobs = json.load(f)

    results = []

    for job in jobs:
        desc = job.get('full_description', '')
        title = job.get('job_title', '')
        company = job.get('company', '')

        result = {
            'job_title': title,
            'company': company,
            'location': job.get('location', ''),
            'salary': job.get('salary', ''),
            'job_type': job.get('job_type', ''),
            'education': extract_education(desc),
            'major': extract_major(desc),
            'experience': extract_experience(desc),
            'industry': extract_industry(desc, company, title),
            'apply_method': job.get('apply_method', ''),
            'apply_url': job.get('apply_url', ''),
            'url': job.get('url', ''),
        }
        results.append(result)

        # 打印摘要
        print(f"\n{'='*60}")
        print(f"职位: {title}")
        print(f"公司: {company}")
        print(f"学历: {result['education'] or '未明确'}")
        print(f"专业: {result['major'] or '未明确'}")
        print(f"经验: {result['experience'] or '未明确'}")
        print(f"行业: {result['industry'] or '未明确'}")

    # 保存 CSV
    fieldnames = ['job_title', 'company', 'location', 'salary', 'job_type',
                  'education', 'major', 'experience', 'industry',
                  'apply_method', 'apply_url', 'url']

    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    # 保存 JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"处理完成！共 {len(results)} 个职位")
    print(f"CSV 输出: {output_csv}")
    print(f"JSON 输出: {output_json}")


if __name__ == '__main__':
    process_jobs('jobs_output.json', 'jobs_parsed.csv', 'jobs_parsed.json')
