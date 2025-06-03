#!/usr/bin/env python3
"""
Compare hierarchy to canonical category list

Usage:
    python compare_walmart_categories.py \
        --walmart walmart_grocery_hierarchy.json \
        --cats categories.json
"""
from __future__ import annotations
import argparse, json, re, string
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set

# normalization helper - remove punctuation, extra spaces, etc.
_PUNCT_XLAT = str.maketrans("", "", string.punctuation)
def _norm(label: str) -> str:
    return re.sub(r"\s+", " ",
                  label.lower().replace("&", "and").translate(_PUNCT_XLAT)).strip()

# recursive collectors - gather every 'name' in Walmart hierarchy JSON
def _collect_walmart_names(node: Any, names: Set[str]) -> None:
    if isinstance(node, dict):
        if "name" in node:
            names.add(node["name"])
        for key in ("sub_items",):
            if key in node and isinstance(node[key], list):
                for child in node[key]:
                    _collect_walmart_names(child, names)
    elif isinstance(node, list):
        for child in node:
            _collect_walmart_names(child, names)

# recursive collectors - gather every 'name' in Walmart hierarchy JSON
def _collect_category_names(cat_json: Dict[str, Any]) -> Set[str]:
    names: Set[str] = set()
    if "departments" in cat_json:
        for dept in cat_json["departments"]:
            if "department_name" in dept:
                names.add(dept["department_name"])
            _collect_walmart_names(dept.get("sub_items", []), names)
    if "name" in cat_json:
        names.add(cat_json["name"])
    return names

# department mapping (for nicer report - sort by department name)
def _map_missing_by_dept(walmart_json: Dict[str, Any],
                         missing_norms: Set[str]) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = defaultdict(list)

    def walk(node: Any, current_dept: str | None = None):
        if isinstance(node, dict):
            name = node.get("name", "")
            is_dept_level = current_dept is None  
            dept = name if is_dept_level else current_dept
            if not is_dept_level and _norm(name) in missing_norms:
                mapping[dept].append(name)
            for child in node.get("sub_items", []):
                walk(child, dept)
        elif isinstance(node, list):
            for child in node:
                walk(child, current_dept)

    walk(walmart_json.get("sub_items", []))
    # sort lists for readability
    for k in mapping:
        mapping[k].sort(key=str.lower)
    return dict(sorted(mapping.items()))

# CLI
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--walmart", default="walmart_grocery_hierarchy.json",
                    help="Path to Walmart hierarchy JSON")
    ap.add_argument("--cats", default="categories.json",
                    help="Path to canonical categories JSON")
    args = ap.parse_args()

    with open(Path(args.walmart), "r", encoding="utf-8") as f:
        walmart_json = json.load(f)
    with open(Path(args.cats), "r", encoding="utf-8") as f:
        cats_json = json.load(f)

    walmart_names = set()
    _collect_walmart_names(walmart_json, walmart_names)
    cats_names = _collect_category_names(cats_json)

    walmart_norm = {_norm(n): n for n in walmart_names}
    cats_norm = {_norm(n) for n in cats_names}

    missing_norms = set(walmart_norm) - cats_norm
    print(f"\nTotal Walmart labels: {len(walmart_names)}  "
          f"Canonical labels: {len(cats_names)}")
    print(f"Missing after normalisation: {len(missing_norms)}\n")

    missing_by_dept = _map_missing_by_dept(walmart_json, missing_norms)

    for dept, items in missing_by_dept.items():
        print(f"== {dept} ({len(items)}) ==")
        for item in items:
            print("  •", item)
        print()

if __name__ == "__main__":
    main()
