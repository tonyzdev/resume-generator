"""
Full Resume Generator using LLM
Combines LLM-generated content with the LaTeX template from main.py
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

from llm_client import call_llm, call_llm_json
from generate_cv_llm import (
    parse_job_requirements,
    generate_experience_with_ai,
    generate_experience_without_ai,
    generate_project_with_ai,
    generate_project_without_ai,
    generate_skills,
    generate_position,
    generate_achievement,
    load_job_from_json
)

fake = Faker('en_US')


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


def select_major_for_job(job_info: dict) -> dict:
    """
    Select a major that matches the job requirements
    """
    major_families = job_info.get('major_families', [])

    # Try to find a matching major
    for major in MAJORS:
        major_name_lower = major['name'].lower()
        for family in major_families:
            if family.lower() in major_name_lower or major_name_lower in family.lower():
                return major

    # Fallback to a random relevant major
    relevant_keywords = ['data', 'statistics', 'computer', 'business', 'analytics', 'information']
    for major in MAJORS:
        major_name_lower = major['name'].lower()
        for kw in relevant_keywords:
            if kw in major_name_lower:
                return major

    # Final fallback
    return random.choice(MAJORS)


def generate_resume_data_from_job(job_json_path: str, tier: str = 'top', include_ai: bool = True) -> dict:
    """
    Generate complete resume data based on job description

    Args:
        job_json_path: Path to the job JSON file
        tier: University tier (top, medium, low)
        include_ai: Whether to include AI-related content
    """
    # Load job data
    job_data = load_job_from_json(job_json_path)
    job_desc = job_data.get('full_description', '')
    job_title = job_data.get('job_title', 'Data Analyst')
    company = job_data.get('company', 'Unknown')

    print(f"\n{'='*60}")
    print(f"Generating resume for: {job_title} at {company}")
    print(f"AI Content: {'Yes' if include_ai else 'No'}")
    print(f"University Tier: {tier}")
    print(f"{'='*60}\n")

    # Parse job requirements
    print("📋 Step 1: Parsing job requirements...")
    job_info = parse_job_requirements(job_desc)

    # Generate LLM content
    print(f"📝 Step 2: Generating experience...")
    if include_ai:
        experience = generate_experience_with_ai(job_info)
    else:
        experience = generate_experience_without_ai(job_info)

    print(f"📚 Step 3: Generating project...")
    if include_ai:
        project = generate_project_with_ai(job_info)
    else:
        project = generate_project_without_ai(job_info)

    print(f"⚙️ Step 4: Generating skills...")
    skills = generate_skills(job_info, include_ai=include_ai)

    print(f"🏆 Step 5: Generating position and achievement...")
    position = generate_position(job_info)
    achievement = generate_achievement(job_info)

    # Select university and major
    tier_universities = get_universities_by_tier(tier)
    if not tier_universities:
        tier_universities = UNIVERSITIES
    university = random.choice(tier_universities)
    uni_name = university['University Name']
    uni_state = university['State']
    uni_city = fake.city()

    # Select major based on job requirements
    major = select_major_for_job(job_info)
    major_name = major['name']

    # Determine degree type based on job requirements
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

    # Build the complete resume data
    resume_data = {
        "name": fake.name(),
        "course": course,
        "roll": str(random.randint(2020001, 2024999)),
        "phone": fake.msisdn()[:10],
        "email": fake.email(),
        "university": uni_name,
        "location": f"{uni_city}, {uni_state}",

        "education": [
            {
                "school": uni_name,
                "score": f"GPA: {round(random.uniform(3.2, 4.0), 2)}/4.0",
                "degree": course,
                "year": f"{start_year}-{grad_year}",
                "location": f"{uni_city}, {uni_state}"
            }
        ],

        "experiences": [experience],
        "projects": [project],
        "skills": skills,
        "positions": [position],
        "achievements": [achievement],

        # Metadata
        "_job_title": job_title,
        "_company": company,
        "_include_ai": include_ai,
        "_tier": tier
    }

    return resume_data


def escape_latex(text):
    replacements = {
        '%': '\\%',
        '$': '\\$',
        '&': '\\&',
        '#': '\\#',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
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

% Custom commands
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

%----------HEADING-----------------
\parbox{\dimexpr\linewidth\relax}{
\begin{tabularx}{\linewidth}{L r} \\
  \textbf{\Large """ + escape_latex(data["name"]) + r"""} & {\raisebox{0.0\height}{\footnotesize \faPhone}\ +1-""" + data["phone"] + r"""}\\
  {""" + escape_latex(data["location"]) + r"""} & \href{mailto:""" + data["email"] + r"""}{\raisebox{0.0\height}{\footnotesize \faEnvelope}\ {""" + data["email"] + r"""}} \\
  """ + escape_latex(data["course"]) + r""" & \href{https://github.com/}{\raisebox{0.0\height}{\footnotesize \faGithub}\ {GitHub Profile}} \\
  {""" + escape_latex(data["university"]) + r"""} & \href{https://linkedin.com/}{\raisebox{0.0\height}{\footnotesize \faLinkedin}\ {LinkedIn Profile}}
\end{tabularx}
}

%-----------EDUCATION-----------
\section{\textbf{Education}}
  \resumeSubHeadingListStart
""" + education_tex + r"""  \resumeSubHeadingListEnd
\vspace{-5.5mm}

%-----------EXPERIENCE-----------------
\section{\textbf{Experience}}
  \resumeSubHeadingListStart
""" + experience_tex + r"""  \resumeSubHeadingListEnd
\vspace{-8.5mm}

%-----------PROJECTS-----------------
\section{\textbf{Personal Projects}}
\resumeSubHeadingListStart
""" + projects_tex + r"""\resumeSubHeadingListEnd
\vspace{-5.5mm}

%-----------Technical skills-----------------
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

%-----------Positions of Responsibility-----------------
\section{\textbf{Positions of Responsibility}}
\vspace{-0.4mm}
\resumeSubHeadingListStart
""" + positions_tex + r"""\resumeSubHeadingListEnd
\vspace{-5mm}

%-----------Achievements-----------------
\section{\textbf{Achievements}}
\vspace{-0.4mm}
\resumeSubHeadingListStart
""" + achievements_tex + r"""\resumeSubHeadingListEnd
\vspace{-5mm}
\setlength{\footskip}{4.08003pt}

\end{document}
"""
    return latex_content


def compile_pdf(tex_file, output_name="resume"):
    """Compile LaTeX to PDF"""
    output_dir = os.path.dirname(tex_file) or "."

    result1 = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True,
        text=True
    )

    if result1.returncode != 0:
        print(f"⚠️ First compilation warning (may be normal)")

    result2 = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True,
        text=True
    )

    pdf_file = tex_file.replace(".tex", ".pdf")
    if os.path.exists(pdf_file):
        print(f"✅ PDF generated: {pdf_file}")

        # Cleanup aux files
        for ext in [".aux", ".log", ".out"]:
            try:
                os.remove(tex_file.replace(".tex", ext))
            except FileNotFoundError:
                pass
        return True
    else:
        print(f"❌ PDF generation failed: {pdf_file}")
        print(f"Error: {result2.stderr}")
        return False


def generate_resume_pair(job_json_path: str, tier: str = 'top', output_dir: str = 'resumes'):
    """
    Generate both AI and non-AI versions of resume for comparison

    Args:
        job_json_path: Path to job JSON file
        tier: University tier
        output_dir: Output directory for resumes
    """
    os.makedirs(output_dir, exist_ok=True)

    job_data = load_job_from_json(job_json_path)
    job_title = job_data.get('job_title', 'Unknown').replace(' ', '_').replace('/', '_')[:30]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    results = []

    for include_ai in [True, False]:
        ai_suffix = "with_ai" if include_ai else "no_ai"

        print(f"\n{'#'*60}")
        print(f"# Generating {ai_suffix.upper()} version")
        print(f"{'#'*60}")

        resume_data = generate_resume_data_from_job(job_json_path, tier=tier, include_ai=include_ai)
        latex_content = generate_latex(resume_data)

        name_clean = resume_data['name'].replace(' ', '_')
        filename = f"{name_clean}_{job_title}_{tier}_{ai_suffix}_{timestamp}"

        output_tex = os.path.join(output_dir, f"{filename}.tex")
        with open(output_tex, "w", encoding="utf-8") as f:
            f.write(latex_content)

        # Also save JSON data for reference
        output_json = os.path.join(output_dir, f"{filename}.json")
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(resume_data, f, indent=2, ensure_ascii=False)

        print(f"\n📝 Resume generated:")
        print(f"   Name: {resume_data['name']}")
        print(f"   University: {resume_data['university']} (tier: {tier})")
        print(f"   Major: {resume_data['course']}")
        print(f"   AI Content: {'Yes' if include_ai else 'No'}")

        if compile_pdf(output_tex):
            results.append({
                'ai': include_ai,
                'pdf': output_tex.replace('.tex', '.pdf'),
                'name': resume_data['name']
            })

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate LLM-enhanced resume from job description')
    parser.add_argument('--job', '-j', type=str, help='Path to job JSON file')
    parser.add_argument('--tier', '-t', type=str, default='top',
                        choices=['top', 'medium', 'low'],
                        help='University tier: top (1-50), medium (51-100), low (100+)')
    parser.add_argument('--ai', action='store_true', default=False,
                        help='Include AI content only')
    parser.add_argument('--no-ai', action='store_true', default=False,
                        help='Exclude AI content only')
    parser.add_argument('--pair', action='store_true', default=False,
                        help='Generate both AI and non-AI versions for comparison')
    parser.add_argument('--output', '-o', type=str, default='resumes',
                        help='Output directory')
    parser.add_argument('--list-jobs', '-l', action='store_true',
                        help='List available job files')

    args = parser.parse_args()

    if args.list_jobs:
        jobs_dir = "indeed_jobs_json"
        job_files = glob.glob(os.path.join(jobs_dir, "*.json"))
        print(f"Found {len(job_files)} job files:")
        for i, f in enumerate(job_files[:20], 1):
            job_data = load_job_from_json(f)
            print(f"  {i}. {job_data.get('job_title', 'Unknown')} @ {job_data.get('company', 'Unknown')}")
            print(f"      File: {os.path.basename(f)}")
        if len(job_files) > 20:
            print(f"  ... and {len(job_files) - 20} more")
        exit(0)

    if not args.job:
        # Use first job file as demo
        jobs_dir = "indeed_jobs_json"
        job_files = glob.glob(os.path.join(jobs_dir, "*.json"))
        if job_files:
            args.job = job_files[0]
            print(f"📁 Using demo job file: {args.job}")
        else:
            print("❌ No job files found. Please specify --job path")
            exit(1)

    if args.pair:
        # Generate both versions
        results = generate_resume_pair(args.job, tier=args.tier, output_dir=args.output)
        print(f"\n{'='*60}")
        print("Summary:")
        print(f"{'='*60}")
        for r in results:
            print(f"  {'[AI]' if r['ai'] else '[No AI]'} {r['name']}: {r['pdf']}")
    else:
        # Generate single version
        include_ai = not args.no_ai  # Default to include AI unless --no-ai specified

        resume_data = generate_resume_data_from_job(args.job, tier=args.tier, include_ai=include_ai)
        latex_content = generate_latex(resume_data)

        os.makedirs(args.output, exist_ok=True)

        name_clean = resume_data['name'].replace(' ', '_')
        job_title = resume_data.get('_job_title', 'Unknown').replace(' ', '_').replace('/', '_')[:30]
        ai_suffix = "with_ai" if include_ai else "no_ai"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{name_clean}_{job_title}_{args.tier}_{ai_suffix}_{timestamp}"

        output_tex = os.path.join(args.output, f"{filename}.tex")
        with open(output_tex, "w", encoding="utf-8") as f:
            f.write(latex_content)

        output_json = os.path.join(args.output, f"{filename}.json")
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(resume_data, f, indent=2, ensure_ascii=False)

        print(f"\n📝 Resume generated:")
        print(f"   Name: {resume_data['name']}")
        print(f"   University: {resume_data['university']} (tier: {args.tier})")
        print(f"   Major: {resume_data['course']}")
        print(f"   AI Content: {'Yes' if include_ai else 'No'}")

        compile_pdf(output_tex)
