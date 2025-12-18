"""basic resume template
https://www.overleaf.com/latex/templates/iiit-vadodara-resume/crrpnvzhktfs
"""

import subprocess
import random
import os
import json
import csv
import argparse
from datetime import datetime
from faker import Faker

fake = Faker('en_US')

def load_universities():
    universities = []
    with open('us_news.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['University Name'] and row['State']:
                # 目前用的就是2026年的了，可以更具需要来改
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

def get_universities_by_tier(tier='top'):
    """
    Get universities by tier:
    - 'top': rank 1-50 (优秀)
    - 'medium': rank 51-100 (中等)
    - 'low': rank 101+ (一般)
    """
    if tier == 'top':
        return [u for u in UNIVERSITIES if u['rank'] <= 50]
    elif tier == 'medium':
        return [u for u in UNIVERSITIES if 51 <= u['rank'] <= 100]
    elif tier == 'low':
        return [u for u in UNIVERSITIES if u['rank'] > 100]
    else:
        return UNIVERSITIES  # all

# Load majors data
def load_majors():
    with open('majors_flat.json', 'r', encoding='utf-8') as f:
        return json.load(f)

UNIVERSITIES = load_universities()
MAJORS = load_majors()

def generate_resume_data(tier='top'):
    """
    Generate resume data with university tier:
    - 'top': rank 1-50 (优秀)
    - 'medium': rank 51-100 (中等)
    - 'low': rank 101+ (一般)
    """

    tier_universities = get_universities_by_tier(tier)
    if not tier_universities:
        tier_universities = UNIVERSITIES  
    university = random.choice(tier_universities)
    uni_name = university['University Name']
    uni_state = university['State']
    uni_city = fake.city()  # 城市还是用的fake的随机，而不是学校的所在地 这个可能需要再改一下

    major = random.choice(MAJORS)
    major_name = major['name']
    degree_type = random.choice(["B.S.", "B.A.", "M.S.", "M.A.", "Ph.D."])
    course = f"{degree_type} in {major_name}"

    grad_year = random.randint(2020, 2025)
    start_year = grad_year - random.choice([4, 2, 5])  # 4 years for BS, 2 for MS, 5 for PhD

    return {
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
                "score": f"GPA: {round(random.uniform(3.0, 4.0), 2)}/4.0",
                "degree": course,
                "year": f"{start_year}-{grad_year}",
                "location": f"{uni_city}, {uni_state}"
            },
            {
                "school": fake.company() + " High School",
                "score": f"GPA: {round(random.uniform(3.5, 4.0), 2)}/4.0",
                "degree": "High School Diploma",
                "year": str(start_year),
                "location": f"{fake.city()}, {fake.state_abbr()}"
            },
        ],
        
        "experiences": [
            {
                "company": fake.company(),
                "city": fake.city(),
                "role": random.choice(["Software Engineer Intern", "Data Science Intern", "Backend Developer Intern"]),
                "dates": "May 2023 - July 2023",
                "items": [
                    f"Developed {random.choice(['REST APIs', 'microservices', 'data pipelines'])} using {random.choice(['Python', 'Java', 'Node.js'])}",
                    f"Improved system performance by {random.randint(20, 50)}% through optimization"
                ]
            }
        ],
        
        "projects": [
            {
                "name": random.choice(["E-Commerce Platform", "Chat Application", "ML Image Classifier", "Task Manager App"]),
                "description": "Full-stack web application with modern architecture",
                "dates": "Jan 2023 - Mar 2023",
                "items": [
                    f"Tools: {random.choice(['React, Node.js, MongoDB', 'Python, Flask, PostgreSQL', 'Vue.js, Django, Redis'])}",
                    f"Achieved {random.randint(1000, 5000)}+ users and {random.randint(90, 99)}% uptime"
                ]
            },
            {
                "name": random.choice(["Portfolio Website", "Blog Platform", "Weather App", "Stock Tracker"]),
                "description": "Personal project to demonstrate technical skills",
                "dates": "Aug 2022 - Oct 2022",
                "items": [
                    f"Tools: {random.choice(['HTML, CSS, JavaScript', 'Python, Streamlit', 'React, Firebase'])}",
                    "Implemented responsive design and CI/CD pipeline"
                ]
            }
        ],
        
        "skills": {
            "languages": "Python, Java, C++, JavaScript, SQL",
            "tools": "Git, Docker, VS Code, Linux, Postman",
            "frameworks": "React, Node.js, Django, Flask, TensorFlow",
            "databases": "MySQL, MongoDB, PostgreSQL, Redis",
            "soft_skills": "Problem Solving, Team Leadership, Communication",
            "coursework": "Data Structures, Algorithms, DBMS, OS, Computer Networks",
            "interests": "Machine Learning, Web Development, Cloud Computing"
        },
        
        "positions": [
            {"title": "Technical Lead", "org": "Coding Club", "tenure": "2022-2023"},
            {"title": "Event Coordinator", "org": "Tech Fest", "tenure": "2021-2022"}
        ],
        
        "achievements": [
            {"title": "1st Place", "desc": "National Hackathon", "date": "2023"},
            {"title": "Top 5%", "desc": "LeetCode Contest Rating", "date": "2022"}
        ]
    }


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
% Auto-Generated Resume
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
    # Get directory of tex file for output
    output_dir = os.path.dirname(tex_file) or "."

    result1 = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True,
        text=True
    )

    if result1.returncode != 0:
        print(f"❌ 第一次编译失败！")
        print(f"错误信息:\n{result1.stderr}")
        print(f"输出信息:\n{result1.stdout}")
        return False


    result2 = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_file],
        capture_output=True,
        text=True
    )

    if result2.returncode != 0:
        print(f"❌ 第二次编译失败！")
        print(f"错误信息:\n{result2.stderr}")
        print(f"输出信息:\n{result2.stdout}")
        return False


    pdf_file = tex_file.replace(".tex", ".pdf")
    if os.path.exists(pdf_file):
        print(f"✅ PDF 生成完成: {pdf_file}")


        for ext in [".aux", ".log", ".out"]:
            try:
                os.remove(tex_file.replace(".tex", ext))
            except FileNotFoundError:
                pass
        return True
    else:
        print(f"❌ PDF 文件未生成: {pdf_file}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate random resume')
    parser.add_argument('--tier', '-t', type=str, default='top',
                        choices=['top', 'medium', 'low'],
                        help='University tier: top (1-50), medium (51-100), low (100+)')
    args = parser.parse_args()

    resume_data = generate_resume_data(tier=args.tier)
    latex_content = generate_latex(resume_data)

    output_dir = "resumes" # 都放到子目录里
    os.makedirs(output_dir, exist_ok=True)

    name_clean = resume_data['name'].replace(' ', '_')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{name_clean}_{args.tier}_{timestamp}"

    output_tex = os.path.join(output_dir, f"{filename}.tex")
    with open(output_tex, "w", encoding="utf-8") as f:
        f.write(latex_content)

    print(f"📝 生成的简历信息:")
    print(f"   姓名: {resume_data['name']}")
    print(f"   大学: {resume_data['university']} (tier: {args.tier})")
    print(f"   专业: {resume_data['course']}")
    print(f"   邮箱: {resume_data['email']}")

    compile_pdf(output_tex)