"""
ProfScout Data Pipeline
Transforms raw CSrankings + CSStipendRankings CSVs into optimized JSON for the frontend.
"""
import csv
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# Area category mapping - maps venue codes to human-readable categories
AREA_MAP = {
    # AI & Machine Learning
    "aaai": {"label": "AI (AAAI)", "category": "AI & ML"},
    "ijcai": {"label": "AI (IJCAI)", "category": "AI & ML"},
    "iclr": {"label": "Deep Learning (ICLR)", "category": "AI & ML"},
    "icml": {"label": "Machine Learning (ICML)", "category": "AI & ML"},
    "nips": {"label": "Machine Learning (NeurIPS)", "category": "AI & ML"},
    # Computer Vision
    "cvpr": {"label": "Vision (CVPR)", "category": "Computer Vision"},
    "eccv": {"label": "Vision (ECCV)", "category": "Computer Vision"},
    "iccv": {"label": "Vision (ICCV)", "category": "Computer Vision"},
    # NLP
    "acl": {"label": "NLP (ACL)", "category": "NLP"},
    "emnlp": {"label": "NLP (EMNLP)", "category": "NLP"},
    "naacl": {"label": "NLP (NAACL)", "category": "NLP"},
    # Systems
    "sosp": {"label": "OS (SOSP)", "category": "Systems"},
    "osdi": {"label": "OS (OSDI)", "category": "Systems"},
    "eurosys": {"label": "Systems (EuroSys)", "category": "Systems"},
    "usenixatc": {"label": "Systems (USENIX ATC)", "category": "Systems"},
    "fast": {"label": "Storage (FAST)", "category": "Systems"},
    # Networking
    "sigcomm": {"label": "Networks (SIGCOMM)", "category": "Networking"},
    "nsdi": {"label": "Networks (NSDI)", "category": "Networking"},
    "mobicom": {"label": "Mobile (MobiCom)", "category": "Networking"},
    "mobisys": {"label": "Mobile (MobiSys)", "category": "Networking"},
    "imc": {"label": "Measurement (IMC)", "category": "Networking"},
    "sensys": {"label": "Sensors (SenSys)", "category": "Networking"},
    # Security
    "ccs": {"label": "Security (CCS)", "category": "Security"},
    "oakland": {"label": "Security (S&P)", "category": "Security"},
    "usenixsec": {"label": "Security (USENIX)", "category": "Security"},
    "ndss": {"label": "Security (NDSS)", "category": "Security"},
    "crypto": {"label": "Cryptography", "category": "Security"},
    "eurocrypt": {"label": "Cryptography (Euro)", "category": "Security"},
    "pets": {"label": "Privacy (PETS)", "category": "Security"},
    # Architecture
    "isca": {"label": "Architecture (ISCA)", "category": "Architecture"},
    "micro": {"label": "Architecture (MICRO)", "category": "Architecture"},
    "hpca": {"label": "Architecture (HPCA)", "category": "Architecture"},
    "asplos": {"label": "Architecture (ASPLOS)", "category": "Architecture"},
    # Databases
    "sigmod": {"label": "Databases (SIGMOD)", "category": "Databases"},
    "vldb": {"label": "Databases (VLDB)", "category": "Databases"},
    "icde": {"label": "Databases (ICDE)", "category": "Databases"},
    "pods": {"label": "DB Theory (PODS)", "category": "Databases"},
    # Theory
    "stoc": {"label": "Theory (STOC)", "category": "Theory"},
    "focs": {"label": "Theory (FOCS)", "category": "Theory"},
    "soda": {"label": "Algorithms (SODA)", "category": "Theory"},
    "lics": {"label": "Logic (LICS)", "category": "Theory"},
    # PL & SE
    "popl": {"label": "PL (POPL)", "category": "PL & SE"},
    "pldi": {"label": "PL (PLDI)", "category": "PL & SE"},
    "oopsla": {"label": "PL (OOPSLA)", "category": "PL & SE"},
    "icfp": {"label": "FP (ICFP)", "category": "PL & SE"},
    "icse": {"label": "SE (ICSE)", "category": "PL & SE"},
    "fse": {"label": "SE (FSE)", "category": "PL & SE"},
    "ase": {"label": "SE (ASE)", "category": "PL & SE"},
    "issta": {"label": "Testing (ISSTA)", "category": "PL & SE"},
    # HCI
    "chiconf": {"label": "HCI (CHI)", "category": "HCI"},
    "uist": {"label": "UI (UIST)", "category": "HCI"},
    "ubicomp": {"label": "Ubicomp", "category": "HCI"},
    "vr": {"label": "VR/AR", "category": "HCI"},
    # Graphics & Visualization
    "siggraph": {"label": "Graphics (SIGGRAPH)", "category": "Graphics"},
    "siggraph-asia": {"label": "Graphics (SIG Asia)", "category": "Graphics"},
    "eurographics": {"label": "Graphics (EG)", "category": "Graphics"},
    "vis": {"label": "Visualization", "category": "Graphics"},
    # Robotics
    "icra": {"label": "Robotics (ICRA)", "category": "Robotics"},
    "iros": {"label": "Robotics (IROS)", "category": "Robotics"},
    "rss": {"label": "Robotics (RSS)", "category": "Robotics"},
    # EDA & Embedded
    "dac": {"label": "EDA (DAC)", "category": "EDA & Embedded"},
    "iccad": {"label": "EDA (ICCAD)", "category": "EDA & Embedded"},
    "emsoft": {"label": "Embedded (EMSOFT)", "category": "EDA & Embedded"},
    "rtas": {"label": "Real-Time (RTAS)", "category": "EDA & Embedded"},
    "rtss": {"label": "Real-Time (RTSS)", "category": "EDA & Embedded"},
    # Data Mining & IR
    "kdd": {"label": "Data Mining (KDD)", "category": "Data Mining & IR"},
    "www": {"label": "Web (WWW)", "category": "Data Mining & IR"},
    "sigir": {"label": "IR (SIGIR)", "category": "Data Mining & IR"},
    # HPC
    "sc": {"label": "HPC (SC)", "category": "HPC"},
    "hpdc": {"label": "HPC (HPDC)", "category": "HPC"},
    "ics": {"label": "HPC (ICS)", "category": "HPC"},
    "sigmetrics": {"label": "Metrics (SIGMETRICS)", "category": "HPC"},
    # Bioinformatics
    "ismb": {"label": "Bioinformatics (ISMB)", "category": "Bioinformatics"},
    "recomb": {"label": "Comp Bio (RECOMB)", "category": "Bioinformatics"},
    # Economics & Computation
    "ec": {"label": "Econ & Comp (EC)", "category": "Computational Economics"},
    "wine": {"label": "Econ & Comp (WINE)", "category": "Computational Economics"},
    # CS Education
    "sigcse": {"label": "CS Education (SIGCSE)", "category": "CS Education"},
}

CATEGORY_ORDER = [
    "AI & ML", "Computer Vision", "NLP", "Systems", "Networking", "Security",
    "Architecture", "Databases", "Theory", "PL & SE", "HCI", "Graphics",
    "Robotics", "EDA & Embedded", "Data Mining & IR", "HPC",
    "Bioinformatics", "Computational Economics", "CS Education"
]


def find_project_root():
    """Find the data root directory.
    
    Looks for git submodules in profscout/data/ first,
    falls back to parent mail_automation/ directory.
    """
    script_dir = Path(__file__).resolve().parent
    profscout_dir = script_dir.parent
    
    # Prefer submodules inside profscout/data/
    submodule_root = profscout_dir / "data"
    if (submodule_root / "CSrankings" / "csrankings.csv").exists():
        print(f"  Using submodule data from: {submodule_root}")
        return submodule_root
    
    # Fallback: parent directory (mail_automation/)
    parent_root = profscout_dir.parent
    if (parent_root / "CSrankings" / "csrankings.csv").exists():
        print(f"  Using parent directory data from: {parent_root}")
        return parent_root
    
    print("  ERROR: Could not find CSrankings data!")
    print("  Run: git submodule update --init --recursive")
    raise FileNotFoundError("CSrankings data not found. Run 'git submodule update --init --recursive'")


def load_csv(filepath, encoding='utf-8'):
    """Load a CSV file and return list of dicts."""
    rows = []
    try:
        with open(filepath, 'r', encoding=encoding, errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Strip whitespace from keys and values
                cleaned = {k.strip(): v.strip() if v else '' for k, v in row.items() if k}
                rows.append(cleaned)
    except FileNotFoundError:
        print(f"  WARNING: File not found: {filepath}")
    return rows


def build_professors(root):
    """Build aggregated professor data from CSrankings CSVs."""
    print("  Loading csrankings.csv...")
    profs_raw = load_csv(root / "CSrankings" / "csrankings.csv")
    print(f"  Loaded {len(profs_raw)} professor entries")

    print("  Loading generated-author-info.csv (this may take a moment)...")
    pubs_raw = load_csv(root / "CSrankings" / "generated-author-info.csv")
    print(f"  Loaded {len(pubs_raw)} publication records")

    print("  Loading institutions.csv...")
    inst_raw = load_csv(root / "CSrankings" / "institutions.csv")
    inst_map = {}
    for inst in inst_raw:
        name = inst.get('institution', '')
        if name:
            inst_map[name] = {
                'region': inst.get('region', ''),
                'country': inst.get('countryabbrv', ''),
                'homepage': inst.get('homepage', ''),
            }

    # Aggregate publications per professor
    print("  Aggregating publications per professor...")
    pub_agg = defaultdict(lambda: {
        'areas': defaultdict(float),
        'total_pubs': 0,
        'recent_pubs': 0,
        'min_year': 9999,
        'max_year': 0
    })

    for pub in pubs_raw:
        name = pub.get('name', '')
        area = pub.get('area', '')
        try:
            count = float(pub.get('count', 0))
            year = int(pub.get('year', 0))
        except (ValueError, TypeError):
            continue

        if name and area:
            agg = pub_agg[name]
            agg['areas'][area] += count
            agg['total_pubs'] += count
            if year >= 2020:
                agg['recent_pubs'] += count
            if year < agg['min_year']:
                agg['min_year'] = year
            if year > agg['max_year']:
                agg['max_year'] = year

    # Build professor records (deduplicate by name - take first entry)
    print("  Building professor records...")
    seen_names = set()
    professors = []

    for prof in profs_raw:
        name = prof.get('name', '')
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        affiliation = prof.get('affiliation', '')
        inst_info = inst_map.get(affiliation, {})
        pubs = pub_agg.get(name, None)

        areas = []
        total_pubs = 0
        recent_pubs = 0
        year_range = [0, 0]

        if pubs:
            # Get areas sorted by publication count
            areas = sorted(pubs['areas'].keys(), key=lambda a: pubs['areas'][a], reverse=True)
            total_pubs = round(pubs['total_pubs'], 1)
            recent_pubs = round(pubs['recent_pubs'], 1)
            if pubs['min_year'] < 9999:
                year_range = [pubs['min_year'], pubs['max_year']]

        professors.append({
            'n': name,
            'a': affiliation,
            'h': prof.get('homepage', ''),
            's': prof.get('scholarid', ''),
            'ar': areas[:15],  # Top 15 areas
            'tp': total_pubs,
            'rp': recent_pubs,
            'yr': year_range,
            'c': inst_info.get('country', ''),
            'r': inst_info.get('region', ''),
        })

    # Sort by total publications descending
    professors.sort(key=lambda p: p['tp'], reverse=True)
    print(f"  Built {len(professors)} unique professor records")
    return professors


def build_institutions(root):
    """Build institution data with stipend and living cost info."""
    print("  Loading institutions.csv...")
    inst_raw = load_csv(root / "CSrankings" / "institutions.csv")

    print("  Loading stipend-us.csv...")
    stipend_raw = load_csv(root / "CSStipendRankings" / "stipend-us.csv")

    print("  Loading university-fips.csv...")
    fips_raw = load_csv(root / "CSStipendRankings" / "university-fips.csv")

    print("  Loading epi-living-cost.csv...")
    cost_raw = load_csv(root / "CSStipendRankings" / "epi-living-cost.csv")

    # Build FIPS → living cost map
    cost_map = {}
    for cost in cost_raw:
        fips = cost.get('county_fips', '').strip()
        if fips:
            try:
                cost_map[fips] = {
                    'county': cost.get('county_name', ''),
                    'annual': int(cost.get('annual_living_wage', 0)),
                    'housing': int(cost.get('housing', 0)),
                    'food': int(cost.get('food', 0)),
                    'transport': int(cost.get('transportation', 0)),
                    'healthcare': int(cost.get('healthcare', 0)),
                }
            except (ValueError, TypeError):
                pass

    # Build university → FIPS map
    uni_fips = {}
    for uf in fips_raw:
        inst = uf.get('institution', '').strip()
        fips = uf.get('county_fips', '').strip()
        if inst and fips:
            # Pad FIPS to 5 digits
            fips = fips.zfill(5)
            uni_fips[inst] = fips

    # Build stipend map
    stipend_map = {}
    for s in stipend_raw:
        inst = s.get('institution', '').strip().strip('"')
        if not inst:
            continue
        try:
            labels = s.get('labels', '')
            summer_gtd = 'summer-gtd' in labels
            pre_qual = int(s.get('pre_qual stipend', 0) or 0)
            post_qual = int(s.get('after_qual stipend', 0) or 0)
            fee = int(s.get('fee', 0) or 0)
            pub_priv = s.get('public/private', '').strip()

            stipend_map[inst] = {
                'preQual': pre_qual,
                'postQual': post_qual,
                'fee': fee,
                'type': pub_priv,
                'summerGtd': summer_gtd,
                'labels': labels,
            }
        except (ValueError, TypeError):
            pass

    # Build institutions output
    institutions = {}
    for inst in inst_raw:
        name = inst.get('institution', '')
        if not name:
            continue
        entry = {
            'region': inst.get('region', ''),
            'country': inst.get('countryabbrv', ''),
            'homepage': inst.get('homepage', ''),
        }

        # Add stipend data if available
        # Try exact match first, then fuzzy match
        stipend = stipend_map.get(name)
        if not stipend:
            # Try matching with common name variations
            for s_name, s_data in stipend_map.items():
                if s_name in name or name in s_name:
                    stipend = s_data
                    break
        if stipend:
            entry['stipend'] = stipend

        # Add living cost data
        fips = uni_fips.get(name)
        if not fips:
            # Try fuzzy match
            for u_name, u_fips in uni_fips.items():
                if u_name in name or name in u_name:
                    fips = u_fips
                    break
        if fips and fips in cost_map:
            entry['livingCost'] = cost_map[fips]

        institutions[name] = entry

    # Also add stipend-only institutions that might not be in institutions.csv
    for s_name, s_data in stipend_map.items():
        if s_name not in institutions:
            fips = uni_fips.get(s_name)
            entry = {
                'region': 'northamerica',
                'country': 'us',
                'homepage': '',
                'stipend': s_data,
            }
            if fips and fips in cost_map:
                entry['livingCost'] = cost_map[fips]
            institutions[s_name] = entry

    print(f"  Built {len(institutions)} institution records")
    stipend_count = sum(1 for v in institutions.values() if 'stipend' in v)
    print(f"  {stipend_count} institutions have stipend data")
    return institutions


def build_areas():
    """Build the areas metadata."""
    areas = {}
    categories = defaultdict(list)
    for code, info in AREA_MAP.items():
        areas[code] = info
        categories[info['category']].append(code)

    return {
        'areas': areas,
        'categories': {cat: categories[cat] for cat in CATEGORY_ORDER if cat in categories}
    }


def main():
    root = find_project_root()
    out_dir = Path(__file__).resolve().parent.parent / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("ProfScout Data Pipeline")
    print("=" * 60)

    # Build areas
    print("\n[1/3] Building areas metadata...")
    areas_data = build_areas()
    areas_path = out_dir / "areas.json"
    with open(areas_path, 'w', encoding='utf-8') as f:
        json.dump(areas_data, f, separators=(',', ':'))
    print(f"  Wrote {areas_path} ({os.path.getsize(areas_path) / 1024:.1f} KB)")

    # Build institutions
    print("\n[2/3] Building institutions data...")
    inst_data = build_institutions(root)
    inst_path = out_dir / "institutions.json"
    with open(inst_path, 'w', encoding='utf-8') as f:
        json.dump(inst_data, f, separators=(',', ':'))
    print(f"  Wrote {inst_path} ({os.path.getsize(inst_path) / 1024:.1f} KB)")

    # Build professors
    print("\n[3/3] Building professors data...")
    prof_data = build_professors(root)
    prof_path = out_dir / "professors.json"
    with open(prof_path, 'w', encoding='utf-8') as f:
        json.dump(prof_data, f, separators=(',', ':'))
    print(f"  Wrote {prof_path} ({os.path.getsize(prof_path) / 1024 / 1024:.1f} MB)")

    print("\n" + "=" * 60)
    print(f"[OK] Data pipeline complete! {len(prof_data)} professors, {len(inst_data)} institutions")
    print("=" * 60)


if __name__ == '__main__':
    main()
