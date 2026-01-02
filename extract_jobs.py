#!/usr/bin/env python3
"""
Extract job information from Indeed HTML files.
"""

import os
import re
import json
from pathlib import Path
from bs4 import BeautifulSoup
from html import unescape


def extract_job_from_html(html_content: str, filename: str) -> dict:
    """Extract job information from a single HTML file."""
    # First extract meta tags using BeautifulSoup on the head section only
    head_match = re.search(r'<head>(.*?)</head>', html_content, re.DOTALL | re.IGNORECASE)

    job_data = {
        'filename': filename,
        'job_title': None,
        'company': None,
        'location': None,
        'salary': None,
        'job_type': None,
        'scraped_at': None,
        'full_description': None,
        'apply_method': None,  # "indeed_apply" or "external_apply"
        'apply_url': None,     # Apply URL (for external apply)
    }

    if head_match:
        head_soup = BeautifulSoup(head_match.group(1), 'html.parser')

        meta_title = head_soup.find('meta', attrs={'name': 'job-title'})
        if meta_title:
            job_data['job_title'] = meta_title.get('content')

        meta_scraped = head_soup.find('meta', attrs={'name': 'scraped-at'})
        if meta_scraped:
            job_data['scraped_at'] = meta_scraped.get('content')

    # Extract the embedded HTML string directly from raw content
    # The format is: "<div class=\"fastviewjob ... </div>"
    match = re.search(r'"(<div class=\\"fastviewjob.*?</div>)"', html_content, re.DOTALL)
    if not match:
        # Try alternative pattern - match until end of line or ### Ran
        match = re.search(r'"(<div class=\\"fastviewjob[^"]*)"', html_content, re.DOTALL)

    if match:
        embedded_html = match.group(1)
        # Unescape the JSON-escaped HTML
        embedded_html = embedded_html.replace('\\"', '"')
        embedded_html = unescape(embedded_html)

        inner_soup = BeautifulSoup(embedded_html, 'html.parser')

        # Extract job title from header
        title_elem = inner_soup.find('h2', {'data-testid': 'jobsearch-JobInfoHeader-title'})
        if title_elem:
            # Remove the " - job post" suffix
            title_span = title_elem.find('span')
            if title_span:
                job_data['job_title'] = title_span.get_text().replace(' - job post', '').strip()

        # Extract company name
        company_elem = inner_soup.find('div', {'data-testid': 'inlineHeader-companyName'})
        if company_elem:
            company_link = company_elem.find('a')
            if company_link:
                job_data['company'] = company_link.get_text().strip()
            else:
                job_data['company'] = company_elem.get_text().strip()

        # Extract location
        location_elem = inner_soup.find('div', {'data-testid': 'inlineHeader-companyLocation'})
        if location_elem:
            job_data['location'] = location_elem.get_text().strip()

        # Extract salary and job type from salaryInfoAndJobType section
        salary_section = inner_soup.find('div', id='salaryInfoAndJobType')
        if salary_section:
            spans = salary_section.find_all('span')
            for span in spans:
                text = span.get_text().strip()
                # Check if it's a salary (contains $ or "hour" or "year")
                if '$' in text or 'hour' in text.lower() or 'year' in text.lower():
                    # Clean up the text (remove leading dashes)
                    job_data['salary'] = text.lstrip('- ').strip()
                # Check if it's a job type
                elif text.lower() in ['full-time', 'part-time', 'contract', 'temporary', 'internship']:
                    job_data['job_type'] = text.lstrip('- ').strip()
                elif 'full-time' in text.lower() or 'part-time' in text.lower():
                    job_data['job_type'] = text.lstrip('- ').strip()

        # Extract full job description
        desc_elem = inner_soup.find('div', id='jobDescriptionText')
        if desc_elem:
            # Get text content, preserving some structure
            job_data['full_description'] = clean_description(desc_elem)

        # Extract apply method and URL
        # Check for Indeed Easy Apply button
        indeed_apply_btn = inner_soup.find('button', id='indeedApplyButton')
        if indeed_apply_btn:
            job_data['apply_method'] = 'indeed_apply'
            job_data['apply_url'] = None  # Indeed Apply uses internal system
        else:
            # Check for external apply button (Apply on company site)
            external_apply_btn = inner_soup.find('button', string=re.compile(r'Apply on company site', re.IGNORECASE))
            if not external_apply_btn:
                # Try finding by content
                external_apply_btn = inner_soup.find('button', attrs={'contenthtml': re.compile(r'Apply on company site', re.IGNORECASE)})

            if external_apply_btn:
                job_data['apply_method'] = 'external_apply'
                # Get the href attribute from the button
                href = external_apply_btn.get('href', '')
                if href:
                    # Unescape HTML entities in URL
                    job_data['apply_url'] = unescape(href)
            else:
                # Default fallback - check raw HTML for patterns
                if 'indeedApplyButton' in html_content:
                    job_data['apply_method'] = 'indeed_apply'
                elif 'Apply on company site' in html_content:
                    job_data['apply_method'] = 'external_apply'
                    # Try to extract URL from raw HTML
                    url_match = re.search(r'href=\\"(https://www\.indeed\.com/applystart[^"\\]+)\\"', html_content)
                    if url_match:
                        job_data['apply_url'] = unescape(url_match.group(1).replace('\\u0026', '&'))

    return job_data


def clean_description(elem) -> str:
    """Clean and format the job description text."""
    # Get all text with basic formatting
    text = elem.get_text(separator='\n', strip=True)

    # Clean up excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Clean up whitespace
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)

    return text.strip()


def process_all_jobs(html_dir: str, output_dir: str) -> list:
    """Process all HTML files in the directory and save individual JSON files."""
    jobs = []
    html_path = Path(html_dir)
    output_path = Path(output_dir)

    if not html_path.exists():
        print(f"Directory not found: {html_dir}")
        return jobs

    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)

    html_files = sorted(html_path.glob('*.html'))
    print(f"Found {len(html_files)} HTML files")

    for html_file in html_files:
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()

            job_data = extract_job_from_html(content, html_file.name)
            jobs.append(job_data)

            # Save individual JSON file
            json_filename = html_file.stem + '.json'
            json_path = output_path / json_filename
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(job_data, f, indent=2, ensure_ascii=False)

            print(f"  Processed: {html_file.name} -> {json_filename}")
        except Exception as e:
            print(f"  Error processing {html_file.name}: {e}")

    return jobs


def main():
    # Directory containing the HTML files
    html_dir = '/Users/iuser/Desktop/未命名文件夹/CV/indeed_jobs_html'
    # Directory for individual JSON files
    output_dir = '/Users/iuser/Desktop/未命名文件夹/CV/indeed_jobs_json'

    print("Extracting job data from Indeed HTML files...")
    jobs = process_all_jobs(html_dir, output_dir)

    # Also save combined JSON for convenience
    combined_file = '/Users/iuser/Desktop/未命名文件夹/CV/extracted_jobs.json'
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, indent=2, ensure_ascii=False)

    print(f"\nExtracted {len(jobs)} jobs")
    print(f"  - Individual JSON files saved to: {output_dir}")
    print(f"  - Combined JSON saved to: {combined_file}")

    # Print summary
    print("\n=== Summary ===")
    for job in jobs[:5]:
        print(f"- {job['job_title']} @ {job['company']} ({job['location']})")
    if len(jobs) > 5:
        print(f"  ... and {len(jobs) - 5} more")


if __name__ == '__main__':
    main()
