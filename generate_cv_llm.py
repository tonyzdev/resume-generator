"""
Generate CV content using LLM based on job descriptions
Similar to the ChatGPT conversation workflow
"""

import json
import os
import glob
from llm_client import call_llm, call_llm_json


def parse_job_requirements(job_desc: str) -> dict:
    """
    Parse job description to extract requirements
    Similar to the ChatGPT conversation step 1
    """
    prompt = f"""Analyze the following job description and extract the key requirements.
Return a JSON object with the following structure:
{{
    "degree_level": ["Bachelor", "Master"],  // required degree levels
    "major_families": ["Data Science", "Computer Science"],  // relevant majors
    "core_skills": ["Python", "SQL", "Data Analysis"],  // must-have skills
    "preferred_skills": ["Power BI", "Tableau"],  // nice-to-have skills
    "experience_requirements": {{"bachelor": "2+ years", "master": "1+ year"}},  // experience needed
    "job_title": "Data Analyst",  // job title
    "industry": "Energy",  // industry/domain
    "key_responsibilities": ["Analyze data", "Create reports"]  // main duties
}}

Job Description:
{job_desc}
"""

    system_prompt = "You are an expert HR analyst who extracts job requirements from job descriptions."

    return call_llm_json(prompt, system_prompt, temperature=0.3)


def generate_experience_with_ai(job_info: dict) -> dict:
    """
    Generate work experience entry that mentions AI/Generative AI
    Similar to ChatGPT conversation step 2
    """
    prompt = f"""Generate a realistic internship work experience entry for a student applying to this job.
The experience should be relevant to the job and MUST mention using Generative AI or AI-assisted tools.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Industry: {job_info.get('industry', 'General')}
Core Skills Required: {', '.join(job_info.get('core_skills', []))}
Key Responsibilities: {', '.join(job_info.get('key_responsibilities', []))}

Return JSON format:
{{
    "company": "Company Name (make it realistic but fictional)",
    "city": "City Name",
    "role": "Intern Role Title",
    "dates": "May 2024 - Aug 2024",
    "items": [
        "First bullet point describing AI-assisted work",
        "Second bullet point describing other relevant work"
    ]
}}

The experience should:
1. Be for an internship (entry-level appropriate)
2. Mention Generative AI, AI tools, or AI-assisted analysis
3. Use realistic metrics and achievements
4. Match the industry and skills required
"""

    system_prompt = "You are a career counselor helping students create compelling resume experiences."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_experience_without_ai(job_info: dict) -> dict:
    """
    Generate work experience entry WITHOUT mentioning AI
    Similar to ChatGPT conversation step 3
    """
    prompt = f"""Generate a realistic internship work experience entry for a student applying to this job.
The experience should be relevant to the job but should NOT mention AI, machine learning, or any AI-related tools.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Industry: {job_info.get('industry', 'General')}
Core Skills Required: {', '.join(job_info.get('core_skills', []))}
Key Responsibilities: {', '.join(job_info.get('key_responsibilities', []))}

Return JSON format:
{{
    "company": "Company Name (make it realistic but fictional)",
    "city": "City Name",
    "role": "Intern Role Title",
    "dates": "May 2024 - Aug 2024",
    "items": [
        "First bullet point describing traditional analytical work",
        "Second bullet point describing other relevant work"
    ]
}}

The experience should:
1. Be for an internship (entry-level appropriate)
2. Focus on traditional data analysis, NOT AI
3. Use realistic metrics and achievements
4. Match the industry and skills required
"""

    system_prompt = "You are a career counselor helping students create compelling resume experiences."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_project_with_ai(job_info: dict) -> dict:
    """
    Generate a course project that uses Generative AI
    Similar to ChatGPT conversation step 4
    """
    prompt = f"""Generate a realistic course project for a student applying to this job.
The project should be relevant and MUST emphasize using Generative AI in the learning process.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Industry: {job_info.get('industry', 'General')}
Core Skills Required: {', '.join(job_info.get('core_skills', []))}

Return JSON format:
{{
    "name": "Project Name with AI Focus",
    "description": "Brief description mentioning AI",
    "dates": "Sep 2024 - Dec 2024",
    "items": [
        "Tools: List of technologies including AI tools",
        "Achievement or result"
    ]
}}

The project should:
1. Be a course project (academic)
2. Mention Generative AI, LLMs, or AI-assisted development
3. Be relevant to the job requirements
"""

    system_prompt = "You are an academic advisor helping students showcase their projects."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_project_without_ai(job_info: dict) -> dict:
    """
    Generate a course project WITHOUT AI
    Similar to ChatGPT conversation step 5
    """
    prompt = f"""Generate a realistic course project for a student applying to this job.
The project should be relevant but should NOT mention AI, machine learning, or AI-related tools.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Industry: {job_info.get('industry', 'General')}
Core Skills Required: {', '.join(job_info.get('core_skills', []))}

Return JSON format:
{{
    "name": "Project Name",
    "description": "Brief description",
    "dates": "Sep 2024 - Dec 2024",
    "items": [
        "Tools: List of technologies (no AI)",
        "Achievement or result"
    ]
}}

The project should:
1. Be a course project (academic)
2. NOT mention AI, ML, or related technologies
3. Focus on traditional analysis/development
4. Be relevant to the job requirements
"""

    system_prompt = "You are an academic advisor helping students showcase their projects."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_skills(job_info: dict, include_ai: bool = True) -> dict:
    """
    Generate technical skills section
    Similar to ChatGPT conversation step 6
    """
    ai_instruction = ""
    if include_ai:
        ai_instruction = "Include AI-related skills like 'Generative AI', 'LLM prompting', 'ChatGPT/Copilot' etc."
    else:
        ai_instruction = "Do NOT include any AI-related skills. Focus only on traditional technical skills."

    prompt = f"""Generate a technical skills section for a student applying to this job.
{ai_instruction}

Job Title: {job_info.get('job_title', 'Data Analyst')}
Core Skills Required: {', '.join(job_info.get('core_skills', []))}
Preferred Skills: {', '.join(job_info.get('preferred_skills', []))}

Return JSON format:
{{
    "languages": "Python, SQL, R, JavaScript",
    "tools": "Git, VS Code, Jupyter, Excel",
    "frameworks": "Pandas, NumPy, Scikit-learn",
    "databases": "MySQL, PostgreSQL, MongoDB",
    "soft_skills": "Problem Solving, Communication, Teamwork",
    "coursework": "Data Structures, Statistics, Database Systems",
    "interests": "Data Visualization, Business Intelligence"
}}

Select 4-6 relevant skills for each category based on the job requirements.
"""

    system_prompt = "You are a career counselor helping students highlight their technical skills."

    return call_llm_json(prompt, system_prompt, temperature=0.5)


def generate_position(job_info: dict) -> dict:
    """
    Generate a position of responsibility (extracurricular)
    Similar to ChatGPT conversation step 7
    """
    prompt = f"""Generate a realistic extracurricular position of responsibility for a student.
This should be related to the job field but in an academic/club context.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Industry: {job_info.get('industry', 'General')}

Return JSON format:
{{
    "title": "Position Title",
    "org": "Organization/Club Name",
    "tenure": "2023-2024"
}}

Examples: Student Association Member, Data Science Club President, etc.
"""

    system_prompt = "You are helping students showcase their leadership experience."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_achievement(job_info: dict) -> dict:
    """
    Generate an academic achievement
    Similar to ChatGPT conversation step 8
    """
    prompt = f"""Generate a realistic academic achievement for a student applying to this job.

Job Title: {job_info.get('job_title', 'Data Analyst')}
Major: {', '.join(job_info.get('major_families', ['Computer Science']))}

Return JSON format:
{{
    "title": "Achievement Title (e.g., 'Dean's List', '1st Place')",
    "desc": "Brief description or award name",
    "date": "2024"
}}

Keep it realistic and academic (scholarship, competition, honor roll, etc.)
"""

    system_prompt = "You are helping students highlight their achievements."

    return call_llm_json(prompt, system_prompt, temperature=0.7)


def generate_cv_content(job_desc: str, include_ai: bool = True) -> dict:
    """
    Generate complete CV content based on job description

    Args:
        job_desc: Full job description text
        include_ai: If True, include AI-related content; if False, exclude AI

    Returns:
        Dictionary with all CV content sections
    """
    print(f"📋 Parsing job requirements...")
    job_info = parse_job_requirements(job_desc)
    print(f"   Job Title: {job_info.get('job_title', 'Unknown')}")
    print(f"   Industry: {job_info.get('industry', 'Unknown')}")
    print(f"   Core Skills: {', '.join(job_info.get('core_skills', [])[:5])}")

    print(f"\n🔧 Generating experience {'with' if include_ai else 'without'} AI...")
    if include_ai:
        experience = generate_experience_with_ai(job_info)
    else:
        experience = generate_experience_without_ai(job_info)

    print(f"📚 Generating project {'with' if include_ai else 'without'} AI...")
    if include_ai:
        project = generate_project_with_ai(job_info)
    else:
        project = generate_project_without_ai(job_info)

    print(f"⚙️ Generating skills...")
    skills = generate_skills(job_info, include_ai=include_ai)

    print(f"🏆 Generating position and achievement...")
    position = generate_position(job_info)
    achievement = generate_achievement(job_info)

    return {
        "job_info": job_info,
        "experiences": [experience],
        "projects": [project],
        "skills": skills,
        "positions": [position],
        "achievements": [achievement]
    }


def load_job_from_json(json_path: str) -> dict:
    """Load job data from JSON file"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def process_job_file(json_path: str, include_ai: bool = True) -> dict:
    """
    Process a single job JSON file and generate CV content
    """
    job_data = load_job_from_json(json_path)
    job_desc = job_data.get('full_description', '')

    if not job_desc:
        raise ValueError(f"No job description found in {json_path}")

    return generate_cv_content(job_desc, include_ai=include_ai)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Generate CV content from job description using LLM')
    parser.add_argument('--job', '-j', type=str, help='Path to job JSON file')
    parser.add_argument('--ai', action='store_true', default=True, help='Include AI content (default: True)')
    parser.add_argument('--no-ai', action='store_true', help='Exclude AI content')
    parser.add_argument('--list-jobs', '-l', action='store_true', help='List available job files')

    args = parser.parse_args()

    if args.list_jobs:
        jobs_dir = "indeed_jobs_json"
        job_files = glob.glob(os.path.join(jobs_dir, "*.json"))
        print(f"Found {len(job_files)} job files:")
        for i, f in enumerate(job_files[:20], 1):
            print(f"  {i}. {os.path.basename(f)}")
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

    include_ai = not args.no_ai

    print(f"\n{'='*60}")
    print(f"Generating CV content {'WITH AI' if include_ai else 'WITHOUT AI'}")
    print(f"{'='*60}\n")

    cv_content = process_job_file(args.job, include_ai=include_ai)

    print(f"\n{'='*60}")
    print("Generated CV Content:")
    print(f"{'='*60}")
    print(json.dumps(cv_content, indent=2, ensure_ascii=False))
