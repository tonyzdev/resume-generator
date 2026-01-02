"""
Batch Resume Generator with Tracking
- Use job index instead of full path
- Generate multiple people per job
- Track all generated resumes in CSV
"""

import subprocess
import random
import os
import json
import csv
import argparse
import glob
from datetime import datetime
from faker import Faker

from llm_client import call_llm_json
from generate_cv_llm import (
    parse_job_requirements,
    generate_experience_with_ai,
    generate_experience_without_ai,
    generate_project_with_ai,
    generate_project_without_ai,
    generate_skills,
    generate_position,
    generate_achievement,
    SKILL_BIASES,
)

fake = Faker('en_US')

# ============================================================
# Job Index System
# ============================================================

def get_all_jobs():
    """Get all job files sorted by name"""
    jobs_dir = "indeed_jobs_json"
    job_files = sorted(glob.glob(os.path.join(jobs_dir, "*.json")))
    return job_files


def load_job_index():
    """Load or create job index"""
    job_files = get_all_jobs()
    jobs = []
    for i, path in enumerate(job_files, 1):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        jobs.append({
            'index': i,
            'path': path,
            'job_title': data.get('job_title', 'Unknown'),
            'company': data.get('company', 'Unknown'),
            'location': data.get('location', 'Unknown'),
        })
    return jobs


def list_jobs(start=1, count=20):
    """List available jobs with index"""
    jobs = load_job_index()
    end = min(start + count - 1, len(jobs))

    print(f"\n{'='*70}")
    print(f"Available Jobs ({start}-{end} of {len(jobs)})")
    print(f"{'='*70}")
    print(f"{'Index':<6} {'Job Title':<30} {'Company':<20} {'Location':<15}")
    print(f"{'-'*70}")

    for job in jobs[start-1:end]:
        title = job['job_title'][:28] + '..' if len(job['job_title']) > 30 else job['job_title']
        company = job['company'][:18] + '..' if len(job['company']) > 20 else job['company']
        location = job['location'][:13] + '..' if len(job['location']) > 15 else job['location']
        print(f"{job['index']:<6} {title:<30} {company:<20} {location:<15}")

    if end < len(jobs):
        print(f"\n... use --list --start {end+1} to see more")
    print()
    return jobs


def get_job_by_index(index):
    """Get job data by index number"""
    jobs = load_job_index()
    if 1 <= index <= len(jobs):
        job = jobs[index - 1]
        with open(job['path'], 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data, job['path']
    else:
        raise ValueError(f"Job index {index} out of range (1-{len(jobs)})")


# ============================================================
# Data Loading
# ============================================================

def load_universities():
    universities = []
    with open('us_news.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['University Name'] and row['State']:
                try:
                    rank = int(float(row['2026'])) if row['2026'] else 9999
                except:
                    rank = 9999
                universities.append({
                    'University Name': row['University Name'],
                    'State': row['State'],
                    'rank': rank
                })
    return universities


def load_majors():
    with open('majors_flat.json', 'r', encoding='utf-8') as f:
        return json.load(f)


UNIVERSITIES = load_universities()
MAJORS = load_majors()


def get_universities_by_tier(tier='top'):
    if tier == 'top':
        return [u for u in UNIVERSITIES if u['rank'] <= 50]
    elif tier == 'medium':
        return [u for u in UNIVERSITIES if 51 <= u['rank'] <= 100]
    elif tier == 'low':
        return [u for u in UNIVERSITIES if u['rank'] > 100]
    else:
        return UNIVERSITIES


def select_major_for_job(job_info):
    major_families = job_info.get('major_families', [])
    for major in MAJORS:
        major_name_lower = major['name'].lower()
        for family in major_families:
            if family.lower() in major_name_lower or major_name_lower in family.lower():
                return major
    relevant_keywords = ['data', 'statistics', 'computer', 'business', 'analytics', 'information']
    for major in MAJORS:
        major_name_lower = major['name'].lower()
        for kw in relevant_keywords:
            if kw in major_name_lower:
                return major
    return random.choice(MAJORS)


# ============================================================
# Tracking System
# ============================================================

TRACKING_FILE = "resume_tracking.csv"


def init_tracking():
    """Initialize tracking CSV if not exists"""
    if not os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'job_index', 'job_title', 'company', 'location',
                'person_id', 'person_name', 'university', 'major', 'tier',
                'version', 'pdf_path', 'json_path', 'created_at'
            ])


def add_tracking_record(record):
    """Add a record to tracking CSV"""
    init_tracking()
    with open(TRACKING_FILE, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            record['job_index'],
            record['job_title'],
            record['company'],
            record['location'],
            record['person_id'],
            record['person_name'],
            record['university'],
            record['major'],
            record['tier'],
            record['version'],
            record['pdf_path'],
            record['json_path'],
            record['created_at']
        ])


def show_tracking_summary():
    """Show summary of tracked resumes"""
    if not os.path.exists(TRACKING_FILE):
        print("No resumes generated yet.")
        return

    with open(TRACKING_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        records = list(reader)

    if not records:
        print("No resumes generated yet.")
        return

    print(f"\n{'='*80}")
    print(f"Resume Tracking Summary ({len(records)} total)")
    print(f"{'='*80}")

    # Group by job
    jobs = {}
    for r in records:
        key = f"{r['job_index']}_{r['job_title']}"
        if key not in jobs:
            jobs[key] = {'job_index': r['job_index'], 'job_title': r['job_title'],
                        'company': r['company'], 'persons': {}}

        person_key = r['person_id']
        if person_key not in jobs[key]['persons']:
            jobs[key]['persons'][person_key] = {'name': r['person_name'], 'versions': []}
        jobs[key]['persons'][person_key]['versions'].append(r['version'])

    for job_key, job in jobs.items():
        print(f"\nJob #{job['job_index']}: {job['job_title']} @ {job['company']}")
        print(f"  Persons: {len(job['persons'])}")
        for pid, person in job['persons'].items():
            versions = ', '.join(person['versions'])
            print(f"    - {person['name']}: [{versions}]")

    print()


# ============================================================
# Resume Generation
# ============================================================

def escape_latex(text):
    replacements = {
        '%': '\\%', '$': '\\$', '&': '\\&', '#': '\\#',
        '_': '\\_', '{': '\\{', '}': '\\}',
    }
    for old, new in replacements.items():
        text = str(text).replace(old, new)
    return text


def generate_latex(data):
    """Generate LaTeX content from resume data"""

    education_tex = ""
    for edu in data["education"]:
        education_tex += f"""    \\resumeSubheading
      {{{escape_latex(edu["school"])}}}{{{escape_latex(edu["score"])}}}
      {{{escape_latex(edu["degree"])}}}{{{edu["year"]}}}
"""

    experience_tex = ""
    for exp in data["experiences"]:
        items = "\n".join([f"    \\item {{{escape_latex(item)}}}" for item in exp["items"]])
        experience_tex += f"""    \\resumeSubheading
      {{{escape_latex(exp["company"])}}}{{{escape_latex(exp["city"])}}}
      {{{escape_latex(exp["role"])}}}{{{exp["dates"]}}}
      \\vspace{{-2.0mm}}
      \\resumeItemListStart
{items}
    \\resumeItemListEnd
"""

    projects_tex = ""
    for proj in data["projects"]:
        items = "\n".join([f"        \\item {{{escape_latex(item)}}}" for item in proj["items"]])
        projects_tex += f"""    \\resumeProject
      {{{escape_latex(proj["name"])}}}{{{escape_latex(proj["description"])}}}
      {{{proj["dates"]}}}
      {{}}
      \\resumeItemListStart
{items}
    \\resumeItemListEnd
    \\vspace{{-2mm}}
"""

    positions_tex = ""
    for pos in data["positions"]:
        positions_tex += f"""\\resumePOR{{{escape_latex(pos["title"])}, }}
    {{{escape_latex(pos["org"])}}}
    {{{pos["tenure"]}}}
"""

    achievements_tex = ""
    for ach in data["achievements"]:
        achievements_tex += f"""\\resumePOR{{{escape_latex(ach["title"])} }}
    {{{escape_latex(ach["desc"])}}}
    {{{ach["date"]}}}
"""

    latex_content = r"""%-------------------------
% Auto-Generated Resume (LLM-Enhanced)
%------------------------

\documentclass[a4paper,11pt]{article}
\usepackage{latexsym}
\usepackage{xcolor}
\usepackage{float}
\usepackage{ragged2e}
\usepackage[empty]{fullpage}
\usepackage{wrapfig}
\usepackage{lipsum}
\usepackage{tabularx}
\usepackage{titlesec}
\usepackage{geometry}
\usepackage{marvosym}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{fontawesome5}
\usepackage{multicol}
\usepackage{graphicx}
\usepackage{cfr-lm}
\usepackage[T1]{fontenc}
\setlength{\multicolsep}{0pt}
\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\geometry{left=1.4cm, top=0.8cm, right=1.2cm, bottom=1cm}

\usepackage[most]{tcolorbox}
\tcbset{
	frame code={}
	center title,
	left=0pt,
	right=0pt,
	top=0pt,
	bottom=0pt,
	colback=gray!20,
	colframe=white,
	width=\dimexpr\textwidth\relax,
	enlarge left by=-2mm,
	boxsep=4pt,
	arc=0pt,outer arc=0pt,
}

\urlstyle{same}
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-7pt}]

\newcommand{\resumeItem}[2]{
  \item{\textbf{#1}{\hspace{0.5mm}#2 \vspace{-0.5mm}}}
}

\newcommand{\resumePOR}[3]{
\vspace{0.5mm}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
        \textbf{#1}\hspace{0.3mm}#2 & \textit{\small{#3}}
    \end{tabular*}
    \vspace{-2mm}
}

\newcommand{\resumeSubheading}[4]{
\vspace{0.5mm}\item
    \begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}
        \textbf{#1} & \textit{\footnotesize{#4}} \\
        \textit{\footnotesize{#3}} &  \footnotesize{#2}\\
    \end{tabular*}
    \vspace{-2.4mm}
}

\newcommand{\resumeProject}[4]{
\vspace{0.5mm}\item
    \begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}
        \textbf{#1} & \textit{\footnotesize{#3}} \\
        \footnotesize{\textit{#2}} & \footnotesize{#4}
    \end{tabular*}
    \vspace{-2.4mm}
}

\newcommand{\resumeSubItem}[2]{\resumeItem{#1}{#2}\vspace{-4pt}}
\renewcommand{\labelitemi}{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=*,labelsep=0mm]}
\newcommand{\resumeHeadingSkillStart}{\begin{itemize}[leftmargin=*,itemsep=1.7mm, rightmargin=2ex]}
\newcommand{\resumeItemListStart}{\begin{justify}\begin{itemize}[leftmargin=3ex, rightmargin=2ex, noitemsep,labelsep=1.2mm,itemsep=0mm]\small}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}\vspace{2mm}}
\newcommand{\resumeHeadingSkillEnd}{\end{itemize}\vspace{-2mm}}
\newcommand{\resumeItemListEnd}{\end{itemize}\end{justify}\vspace{-2mm}}

\newcommand{\cvsection}[1]{%
\vspace{2mm}
\begin{tcolorbox}
    \textbf{\large #1}
\end{tcolorbox}
    \vspace{-4mm}
}

\newcolumntype{L}{>{\raggedright\arraybackslash}X}%
\newcolumntype{R}{>{\raggedleft\arraybackslash}X}%
\newcolumntype{C}{>{\centering\arraybackslash}X}%

\begin{document}
\fontfamily{cmr}\selectfont

\parbox{\dimexpr\linewidth\relax}{
\begin{tabularx}{\linewidth}{L r} \\
  \textbf{\Large """ + escape_latex(data["name"]) + r"""} & {\raisebox{0.0\height}{\footnotesize \faPhone}\ +1-""" + data["phone"] + r"""}\\
  {""" + escape_latex(data["location"]) + r"""} & \href{mailto:""" + data["email"] + r"""}{\raisebox{0.0\height}{\footnotesize \faEnvelope}\ {""" + data["email"] + r"""}} \\
  """ + escape_latex(data["course"]) + r""" & \href{https://github.com/}{\raisebox{0.0\height}{\footnotesize \faGithub}\ {GitHub Profile}} \\
  {""" + escape_latex(data["university"]) + r"""} & \href{https://linkedin.com/}{\raisebox{0.0\height}{\footnotesize \faLinkedin}\ {LinkedIn Profile}}
\end{tabularx}
}

\section{\textbf{Education}}
  \resumeSubHeadingListStart
""" + education_tex + r"""  \resumeSubHeadingListEnd
\vspace{-5.5mm}

\section{\textbf{Experience}}
  \resumeSubHeadingListStart
""" + experience_tex + r"""  \resumeSubHeadingListEnd
\vspace{-8.5mm}

\section{\textbf{Personal Projects}}
\resumeSubHeadingListStart
""" + projects_tex + r"""\resumeSubHeadingListEnd
\vspace{-5.5mm}

\section{\textbf{Technical Skills and Interests}}
 \begin{itemize}[leftmargin=0.05in, label={}]
    \small{\item{
     \textbf{Languages}{: """ + escape_latex(data["skills"]["languages"]) + r"""} \\
     \textbf{Developer Tools}{: """ + escape_latex(data["skills"]["tools"]) + r"""} \\
     \textbf{Frameworks}{: """ + escape_latex(data["skills"]["frameworks"]) + r"""} \\
     \textbf{Cloud/Databases}{: """ + escape_latex(data["skills"]["databases"]) + r"""} \\
     \textbf{Soft Skills}{: """ + escape_latex(data["skills"]["soft_skills"]) + r"""} \\
     \textbf{Coursework}{: """ + escape_latex(data["skills"]["coursework"]) + r"""} \\
     \textbf{Areas of Interest}{: """ + escape_latex(data["skills"]["interests"]) + r"""} \\
    }}
 \end{itemize}
 \vspace{-16pt}

\section{\textbf{Positions of Responsibility}}
\vspace{-0.4mm}
\resumeSubHeadingListStart
""" + positions_tex + r"""\resumeSubHeadingListEnd
\vspace{-5mm}

\section{\textbf{Achievements}}
\vspace{-0.4mm}
\resumeSubHeadingListStart
""" + achievements_tex + r"""\resumeSubHeadingListEnd
\vspace{-5mm}
\setlength{\footskip}{4.08003pt}

\end{document}
"""
    return latex_content


def compile_pdf(tex_file):
    """Compile LaTeX to PDF"""
    output_dir = os.path.dirname(tex_file) or "."

    subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True, text=True
    )
    subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True, text=True
    )

    pdf_file = tex_file.replace(".tex", ".pdf")
    if os.path.exists(pdf_file):
        for ext in [".aux", ".log", ".out"]:
            try:
                os.remove(tex_file.replace(".tex", ext))
            except FileNotFoundError:
                pass
        return True
    return False


# ============================================================
# Batch Generation
# ============================================================

def generate_batch(job_index, count, tier='top', output_dir='resumes'):
    """
    Generate batch of resumes for one job

    Args:
        job_index: Job index number (1, 2, 3, ...)
        count: Number of people to generate
        tier: University tier
        output_dir: Output directory
    """
    os.makedirs(output_dir, exist_ok=True)
    init_tracking()

    # Load job data
    job_data, job_path = get_job_by_index(job_index)
    job_desc = job_data.get('full_description', '')
    job_title = job_data.get('job_title', 'Unknown')
    company = job_data.get('company', 'Unknown')
    location = job_data.get('location', 'Unknown')

    print(f"\n{'='*70}")
    print(f"Batch Generation")
    print(f"{'='*70}")
    print(f"Job #{job_index}: {job_title} @ {company}")
    print(f"Location: {location}")
    print(f"Generating: {count} people x 2 versions = {count * 2} resumes")
    print(f"Tier: {tier}")
    print(f"{'='*70}\n")

    # Parse job requirements ONCE (save API calls)
    print("Step 1: Parsing job requirements (1 API call)...")
    job_info = parse_job_requirements(job_desc)
    print(f"   Core Skills: {', '.join(job_info.get('core_skills', [])[:5])}")

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results = []

    for person_num in range(1, count + 1):
        person_id = f"job{job_index}_p{person_num}_{timestamp}"

        # Assign a unique skill bias to this person
        skill_bias = SKILL_BIASES[(person_num - 1) % len(SKILL_BIASES)]

        print(f"\n{'─'*50}")
        print(f"Person {person_num}/{count}")
        print(f"Skill Bias: {skill_bias}")
        print(f"{'─'*50}")

        # Generate shared personal info (no API needed)
        tier_universities = get_universities_by_tier(tier)
        if not tier_universities:
            tier_universities = UNIVERSITIES
        university = random.choice(tier_universities)
        uni_name = university['University Name']
        uni_state = university['State']
        uni_city = fake.city()

        major = select_major_for_job(job_info)
        major_name = major['name']

        degree_levels = job_info.get('degree_level', ['Bachelor'])
        if 'Master' in degree_levels or 'M.S.' in degree_levels:
            degree_type = random.choice(["M.S.", "M.A."])
            grad_year = random.randint(2024, 2025)
            start_year = grad_year - 2
        else:
            degree_type = random.choice(["B.S.", "B.A."])
            grad_year = random.randint(2024, 2025)
            start_year = grad_year - 4

        course = f"{degree_type} in {major_name}"
        person_name = fake.name()
        phone = fake.msisdn()[:10]
        email = fake.email()

        print(f"   Name: {person_name}")
        print(f"   University: {uni_name}")
        print(f"   Major: {course}")

        # Generate shared content (position, achievement - 2 API calls)
        print("   Generating position & achievement...")
        position = generate_position(job_info)
        achievement = generate_achievement(job_info)

        # Generate both versions
        for include_ai in [True, False]:
            version = "with_ai" if include_ai else "no_ai"
            print(f"\n   Generating [{version}] version...")

            # Generate version-specific content (3 API calls per version)
            if include_ai:
                experience = generate_experience_with_ai(job_info)
                project = generate_project_with_ai(job_info)
            else:
                experience = generate_experience_without_ai(job_info)
                project = generate_project_without_ai(job_info)

            # Generate skills based on ACTUAL experience and project content
            skills = generate_skills(
                job_info,
                include_ai=include_ai,
                experience=experience,
                project=project,
                skill_bias=skill_bias
            )

            # Build resume data
            resume_data = {
                "name": person_name,
                "course": course,
                "roll": str(random.randint(2020001, 2024999)),
                "phone": phone,
                "email": email,
                "university": uni_name,
                "location": f"{uni_city}, {uni_state}",
                "skill_bias": skill_bias,  # Track the skill bias
                "education": [{
                    "school": uni_name,
                    "score": f"GPA: {round(random.uniform(3.2, 4.0), 2)}/4.0",
                    "degree": course,
                    "year": f"{start_year}-{grad_year}",
                    "location": f"{uni_city}, {uni_state}"
                }],
                "experiences": [experience],
                "projects": [project],
                "skills": skills,
                "positions": [position],
                "achievements": [achievement],
            }

            # Generate files
            name_clean = person_name.replace(' ', '_').replace('.', '')
            job_clean = job_title.replace(' ', '_').replace('/', '_')[:20]
            filename = f"job{job_index}_{name_clean}_{version}_{timestamp}"

            output_tex = os.path.join(output_dir, f"{filename}.tex")
            output_json = os.path.join(output_dir, f"{filename}.json")
            output_pdf = os.path.join(output_dir, f"{filename}.pdf")

            # Write files
            latex_content = generate_latex(resume_data)
            with open(output_tex, "w", encoding="utf-8") as f:
                f.write(latex_content)
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(resume_data, f, indent=2, ensure_ascii=False)

            # Compile PDF
            if compile_pdf(output_tex):
                print(f"      PDF: {output_pdf}")
            else:
                print(f"      PDF failed!")

            # Add tracking record
            add_tracking_record({
                'job_index': job_index,
                'job_title': job_title,
                'company': company,
                'location': location,
                'person_id': person_id,
                'person_name': person_name,
                'university': uni_name,
                'major': course,
                'tier': tier,
                'version': version,
                'pdf_path': output_pdf,
                'json_path': output_json,
                'created_at': datetime.now().isoformat()
            })

            results.append({
                'person': person_name,
                'version': version,
                'pdf': output_pdf
            })

    # Summary
    print(f"\n{'='*70}")
    print(f"Batch Complete!")
    print(f"{'='*70}")
    print(f"Generated {len(results)} resumes for job #{job_index}")
    print(f"Tracking file: {TRACKING_FILE}")
    print()

    return results


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Batch Resume Generator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 generate_batch.py --list                    # List all jobs
  python3 generate_batch.py --list --start 20         # List jobs starting from #20
  python3 generate_batch.py --job 1 --count 3         # Generate 3 people (6 resumes) for job #1
  python3 generate_batch.py --job 5 --count 2 --tier medium
  python3 generate_batch.py --summary                 # Show tracking summary
        """
    )

    parser.add_argument('--list', '-l', action='store_true',
                        help='List available jobs')
    parser.add_argument('--start', '-s', type=int, default=1,
                        help='Start index for listing (default: 1)')
    parser.add_argument('--job', '-j', type=int,
                        help='Job index number (1, 2, 3, ...)')
    parser.add_argument('--count', '-c', type=int, default=1,
                        help='Number of people to generate (default: 1)')
    parser.add_argument('--tier', '-t', type=str, default='top',
                        choices=['top', 'medium', 'low'],
                        help='University tier (default: top)')
    parser.add_argument('--output', '-o', type=str, default='resumes',
                        help='Output directory (default: resumes)')
    parser.add_argument('--summary', action='store_true',
                        help='Show tracking summary')

    args = parser.parse_args()

    if args.list:
        list_jobs(start=args.start)
    elif args.summary:
        show_tracking_summary()
    elif args.job:
        generate_batch(
            job_index=args.job,
            count=args.count,
            tier=args.tier,
            output_dir=args.output
        )
    else:
        parser.print_help()
