import urllib.request
import json
import urllib.parse

query = urllib.parse.quote("mechanical engineering MIT")
url = f"https://api.openalex.org/authors?search={query}&sort=cited_by_count:desc&per-page=5"
req = urllib.request.Request(url, headers={'User-Agent': 'mailto:test@example.com'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for author in data.get('results', []):
            name = author.get('display_name')
            inst = author.get('last_known_institution', {})
            inst_name = inst.get('display_name') if inst else "Unknown"
            works = author.get('works_count')
            citations = author.get('cited_by_count')
            concepts = [c['display_name'] for c in author.get('x_concepts', [])[:3]]
            print(f"{name} ({inst_name}) - Works: {works}, Citations: {citations} - Concepts: {concepts}")
except Exception as e:
    print("Error:", e)
