"""
LLM Client for CV generation
Uses OpenAI-compatible API
"""

from openai import OpenAI
import json
import os

# API Configuration - load from environment variables
API_KEY = os.getenv("OPENAI_API_KEY", "your-api-key-here")
BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4")

client = OpenAI(
    api_key=API_KEY,
    base_url=BASE_URL
)


def call_llm(prompt: str, system_prompt: str = None, temperature: float = 0.7) -> str:
    """
    Call LLM with the given prompt
    """
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature
    )

    return response.choices[0].message.content


def call_llm_json(prompt: str, system_prompt: str = None, temperature: float = 0.7) -> dict:
    """
    Call LLM and parse the response as JSON
    """
    if system_prompt is None:
        system_prompt = "You are a helpful assistant. Always respond with valid JSON only, no markdown formatting."
    else:
        system_prompt += "\n\nAlways respond with valid JSON only, no markdown formatting."

    response = call_llm(prompt, system_prompt, temperature)

    # Try to extract JSON from response
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]
    response = response.strip()

    return json.loads(response)


if __name__ == "__main__":
    # Test the LLM client
    result = call_llm("Hello! Please respond with a short greeting.")
    print("LLM Response:", result)
