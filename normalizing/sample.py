"""
Random Sample Script for Crawl Data

Extracts random samples from hierarchical crawl JSON files.
Supports Amazon, Target, and Walmart crawl outputs.
Supports hierarchical structure preservation & per-category sampling.

Usage:
    python sample.py --retailer amazon --count 10
    python sample.py --file amazon_crawl.json --count 5 --format csv
    python sample.py --retailer target --count 20 --output samples.json
    python sample.py --retailer walmart --preserve-hierarchy --count 100
    python sample.py --retailer amazon --per-category --count 5 --products-per-category 3
    python sample.py --list-files

Main use cases:
    python sample.py --retailer amazon --count 20 --per-category --products-per-category 5 --preserve-hierarchy --output amazon_samples.json
    python sample.py --retailer target --count 20 --per-category --products-per-category 5 --preserve-hierarchy --output target_samples.json
    python sample.py --retailer walmart --count 20 --per-category --products-per-category 5 --preserve-hierarchy --output walmart_samples.json
"""

import argparse
import json
import random
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
import csv
from datetime import datetime
import logging
import copy

# logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# file mappings
DEFAULT_FILES = {
    "amazon": "crawls/amazon_crawl.json",
    "target": "crawls/target_crawl.json", 
    "walmart": "crawls/walmart_crawl.json"
}

# extract products from hierarchy (original flat method)
def extract_products_from_hierarchy(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    logger.info("Starting product extraction from hierarchy...")
    products = []
    departments_processed = 0
    
    def walk_node(node, depth=0):
        nonlocal departments_processed
        
        # log progress for top-level departments
        if depth == 0:
            departments_processed += 1
            node_name = node.get("name", f"Department {departments_processed}")
            logger.info(f"Processing department {departments_processed}: {node_name}")
        
        # check if this node has products
        if "products" in node and isinstance(node["products"], list):
            product_count = len(node["products"])
            if product_count > 0:
                logger.debug(f"Found {product_count} products in {node.get('name', 'unnamed category')}")
                for product in node["products"]:
                    # add category context to product
                    if isinstance(product, dict):
                        enhanced_product = product.copy()
                        enhanced_product["category"] = node.get("name", "Unknown")
                        products.append(enhanced_product)
        
        # recurse into sub_items
        if "sub_items" in node and isinstance(node["sub_items"], list):
            for sub_item in node["sub_items"]:
                walk_node(sub_item, depth + 1)
    
    # handle different root structures
    if "departments" in data:
        # amazon/target structure
        total_departments = len(data["departments"])
        logger.info(f"Found {total_departments} departments to process")
        for department in data["departments"]:
            walk_node(department)
    elif "sub_items" in data:
        # walmart structure or single department
        total_items = len(data["sub_items"])
        logger.info(f"Found {total_items} top-level items to process")
        for item in data["sub_items"]:
            walk_node(item)
    else:
        # single node structure
        logger.info("Processing single node structure")
        walk_node(data)
    
    logger.info(f"Product extraction complete. Found {len(products)} total products")
    return products

# extract categories with products (for per-category sampling)
def extract_categories_with_products(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    logger.info("Extracting categories with products...")
    categories = []
    
    def walk_node(node, path=""):
        current_path = f"{path} > {node.get('name', 'Unknown')}" if path else node.get('name', 'Unknown')
        
        # check if this node has products
        if "products" in node and isinstance(node["products"], list) and len(node["products"]) > 0:
            category_info = {
                "name": node.get("name", "Unknown"),
                "path": current_path,
                "products": node["products"],
                "product_count": len(node["products"])
            }
            categories.append(category_info)
            logger.debug(f"Found category with {len(node['products'])} products: {current_path}")
        
        # recurse into sub_items
        if "sub_items" in node and isinstance(node["sub_items"], list):
            for sub_item in node["sub_items"]:
                walk_node(sub_item, current_path)
    
    # handle different root structures
    if "departments" in data:
        for department in data["departments"]:
            walk_node(department)
    elif "sub_items" in data:
        for item in data["sub_items"]:
            walk_node(item)
    else:
        walk_node(data)
    
    logger.info(f"Found {len(categories)} categories with products")
    return categories

# sample products while preserving hierarchy
def sample_hierarchy_preserving(data: Dict[str, Any], total_samples: int, category_filter: Optional[str] = None) -> Dict[str, Any]:
    logger.info(f"Sampling {total_samples} products while preserving hierarchy...")
    
    # first, collect all products to determine sampling strategy
    all_categories = extract_categories_with_products(data)
    
    # apply category filter if specified
    if category_filter:
        original_count = len(all_categories)
        all_categories = [
            cat for cat in all_categories 
            if category_filter.lower() in cat["name"].lower()
        ]
        logger.info(f"Category filter reduced categories from {original_count} to {len(all_categories)}")
    
    if not all_categories:
        logger.error("No categories with products found")
        return data
    
    # calculate total available products
    total_available = sum(cat["product_count"] for cat in all_categories)
    
    if total_samples >= total_available:
        logger.warning(f"Requested {total_samples} samples but only {total_available} products available. Using all products.")
        return data
    
    # distribute samples across categories proportionally
    samples_per_category = {}
    remaining_samples = total_samples
    
    for cat in all_categories:
        if remaining_samples <= 0:
            break
        
        # calculate proportional share
        proportion = cat["product_count"] / total_available
        cat_samples = max(1, int(total_samples * proportion))
        cat_samples = min(cat_samples, remaining_samples, cat["product_count"])
        
        samples_per_category[cat["name"]] = cat_samples
        remaining_samples -= cat_samples
    
    # distribute any remaining samples
    category_names = list(samples_per_category.keys())
    i = 0
    while remaining_samples > 0 and category_names:
        cat_name = category_names[i % len(category_names)]
        cat = next(c for c in all_categories if c["name"] == cat_name)
        
        if samples_per_category[cat_name] < cat["product_count"]:
            samples_per_category[cat_name] += 1
            remaining_samples -= 1
        else:
            category_names.remove(cat_name)
        
        i += 1
    
    logger.info(f"Sample distribution: {samples_per_category}")
    
    # create a deep copy of the data structure
    sampled_data = copy.deepcopy(data)
    
    # sample products from each category
    def sample_node(node):
        if "products" in node and isinstance(node["products"], list):
            cat_name = node.get("name", "Unknown")
            target_samples = samples_per_category.get(cat_name, 0)
            
            if target_samples > 0 and len(node["products"]) > 0:
                # sample products for this category
                sampled_products = random.sample(
                    node["products"],
                    min(target_samples, len(node["products"]))
                )
                node["products"] = sampled_products
                logger.debug(f"Sampled {len(sampled_products)} products from {cat_name}")
            else:
                node["products"] = []
        
        # recurse into sub_items
        if "sub_items" in node and isinstance(node["sub_items"], list):
            for sub_item in node["sub_items"]:
                sample_node(sub_item)
    
    # apply sampling to the copied data
    if "departments" in sampled_data:
        for department in sampled_data["departments"]:
            sample_node(department)
    elif "sub_items" in sampled_data:
        for item in sampled_data["sub_items"]:
            sample_node(item)
    else:
        sample_node(sampled_data)
    
    # count final sampled products
    final_count = len(extract_products_from_hierarchy(sampled_data))
    logger.info(f"Hierarchical sampling complete. Final product count: {final_count}")
    
    return sampled_data

# sample N products from each of M randomly selected categories
def sample_per_category(data: Dict[str, Any], num_categories: int, products_per_category: int, category_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    logger.info(f"Randomly selecting {num_categories} categories, then sampling {products_per_category} products from each...")
    
    categories = extract_categories_with_products(data)
    
    # apply category filter if specified
    if category_filter:
        original_count = len(categories)
        categories = [
            cat for cat in categories 
            if category_filter.lower() in cat["name"].lower()
        ]
        logger.info(f"Category filter reduced categories from {original_count} to {len(categories)}")
    
    if not categories:
        logger.error("No categories with products found")
        return []
    
    # randomly select categories
    available_categories = len(categories)
    categories_to_select = min(num_categories, available_categories)
    
    if categories_to_select < num_categories:
        logger.warning(f"Only {available_categories} categories available, selecting all of them instead of {num_categories}")
    
    selected_categories = random.sample(categories, categories_to_select)
    logger.info(f"Randomly selected {len(selected_categories)} categories: {[cat['name'] for cat in selected_categories]}")
    
    all_sampled_products = []
    
    for cat in selected_categories:
        available_products = len(cat["products"])
        sample_count = min(products_per_category, available_products)
        
        if sample_count > 0:
            sampled = random.sample(cat["products"], sample_count)
            
            # add category context to each product
            for product in sampled:
                if isinstance(product, dict):
                    enhanced_product = product.copy()
                    enhanced_product["category"] = cat["name"]
                    enhanced_product["category_path"] = cat["path"]
                    all_sampled_products.append(enhanced_product)
            
            logger.info(f"Sampled {sample_count} products from '{cat['name']}' (had {available_products} available)")
        else:
            logger.warning(f"No products to sample from '{cat['name']}'")
    
    total_expected = categories_to_select * products_per_category
    logger.info(f"Per-category sampling complete. Got {len(all_sampled_products)} products (expected up to {total_expected})")
    return all_sampled_products

# load crawl data
def load_crawl_data(file_path: Path) -> Dict[str, Any]:
    logger.info(f"Loading crawl data from: {file_path}")
    
    # check file size for progress indication
    try:
        file_size = file_path.stat().st_size
        size_mb = file_size / (1024 * 1024)
        logger.info(f"File size: {size_mb:.1f} MB")
    except:
        pass
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            logger.info("Parsing JSON data...")
            data = json.load(f)
            logger.info("JSON parsing complete")
            return data
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        sys.exit(1)

# get retailer from data
def get_retailer_from_data(products: List[Dict[str, Any]]) -> str:
    logger.debug("Determining retailer from product data...")
    
    if not products:
        logger.warning("No products available to determine retailer")
        return "unknown"
    
    sample_product = products[0]
    retailer_id = sample_product.get("retailer_id")
    
    retailer_map = {1: "amazon", 2: "target", 3: "walmart"}
    retailer = retailer_map.get(retailer_id, "unknown")
    
    logger.info(f"Detected retailer: {retailer} (ID: {retailer_id})")
    return retailer

# format product for display
def format_product_for_display(product: Dict[str, Any], retailer: str) -> Dict[str, Any]:
    formatted = {
        "retailer": retailer,
        "title": product.get("title", "Unknown"),
        "price": product.get("price", "Unknown"),
        "url": product.get("url", ""),
        "category": product.get("category", "Unknown")
    }
    
    # add category path if available (for per-category sampling)
    if "category_path" in product:
        formatted["category_path"] = product["category_path"]
    
    # add retailer-specific IDs
    if retailer == "amazon":
        formatted["asin"] = product.get("asin")
    elif retailer == "target":
        formatted["tcin"] = product.get("tcin")
    elif retailer == "walmart":
        formatted["wm_item_id"] = product.get("wm_item_id")
    
    return formatted

# output hierarchical data as JSON
def output_hierarchy_as_json(data: Dict[str, Any], output_file: Optional[Path] = None, per_category: bool = False, categories_selected: int = 0, products_per_category: int = 0):
    logger.info("Formatting hierarchical data as JSON...")
    
    # add metadata
    sample_info = {
        "timestamp": datetime.now().isoformat(),
        "total_products": len(extract_products_from_hierarchy(data))
    }
    
    if per_category:
        sample_info["sampling_mode"] = "per_category_hierarchical_preserved"
        sample_info["categories_selected"] = categories_selected
        sample_info["products_per_category"] = products_per_category
    else:
        sample_info["sampling_mode"] = "hierarchical_preserved"
    
    output_data = {
        "sample_info": sample_info,
        "hierarchy": data
    }
    
    json_str = json.dumps(output_data, indent=2, ensure_ascii=False)
    
    if output_file:
        logger.info(f"Writing hierarchical JSON output to: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(json_str)
        logger.info(f"Hierarchical JSON output complete: {output_file}")
    else:
        logger.info("Outputting hierarchical JSON to stdout")
        print(json_str)

# output as json
def output_as_json(samples: List[Dict[str, Any]], output_file: Optional[Path] = None, per_category: bool = False):
    logger.info(f"Formatting {len(samples)} samples as JSON...")
    
    sampling_mode = "per_category" if per_category else "standard"
    
    output_data = {
        "sample_info": {
            "timestamp": datetime.now().isoformat(),
            "sample_count": len(samples),
            "retailer": samples[0]["retailer"] if samples else "unknown",
            "sampling_mode": sampling_mode
        },
        "samples": samples
    }
    
    json_str = json.dumps(output_data, indent=2, ensure_ascii=False)
    
    if output_file:
        logger.info(f"Writing JSON output to: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(json_str)
        logger.info(f"JSON output complete: {output_file}")
    else:
        logger.info("Outputting JSON to stdout")
        print(json_str)

# output as csv
def output_as_csv(samples: List[Dict[str, Any]], output_file: Optional[Path] = None):
    if not samples:
        logger.warning("No samples to output")
        return
    
    logger.info(f"Formatting {len(samples)} samples as CSV...")
    
    # get all unique keys from samples
    all_keys = set()
    for sample in samples:
        all_keys.update(sample.keys())
    
    fieldnames = sorted(all_keys)
    logger.debug(f"CSV columns: {', '.join(fieldnames)}")
    
    if output_file:
        logger.info(f"Writing CSV output to: {output_file}")
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(samples)
        logger.info(f"CSV output complete: {output_file}")
    else:
        logger.info("Outputting CSV to stdout")
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(samples)

# output as table
def output_as_table(samples: List[Dict[str, Any]], per_category: bool = False):
    if not samples:
        logger.warning("No samples to display")
        return
    
    logger.info(f"Formatting {len(samples)} samples as table...")
    
    # define column widths
    if per_category and "category_path" in samples[0]:
        col_widths = {
            "retailer": 8,
            "title": 40,
            "price": 10,
            "category": 30,
            "id": 15
        }
        
        # print header
        print(f"{'Retailer':<{col_widths['retailer']}} "
              f"{'Title':<{col_widths['title']}} "
              f"{'Price':<{col_widths['price']}} "
              f"{'Category Path':<{col_widths['category']}} "
              f"{'ID':<{col_widths['id']}}")
    else:
        col_widths = {
            "retailer": 8,
            "title": 50,
            "price": 10,
            "category": 25,
            "id": 15
        }
        
        # print header
        print(f"{'Retailer':<{col_widths['retailer']}} "
              f"{'Title':<{col_widths['title']}} "
              f"{'Price':<{col_widths['price']}} "
              f"{'Category':<{col_widths['category']}} "
              f"{'ID':<{col_widths['id']}}")
    
    print("-" * (sum(col_widths.values()) + 4))
    
    # print samples
    for sample in samples:
        retailer = sample.get("retailer", "")[:col_widths["retailer"]]
        title = sample.get("title", "")[:col_widths["title"]]
        price = sample.get("price", "")[:col_widths["price"]]
        
        if per_category and "category_path" in sample:
            category = sample.get("category_path", "")[:col_widths["category"]]
        else:
            category = sample.get("category", "")[:col_widths["category"]]
        
        # get retailer-specific ID
        product_id = ""
        if "asin" in sample:
            product_id = sample.get("asin", "")
        elif "tcin" in sample:
            product_id = sample.get("tcin", "")
        elif "wm_item_id" in sample:
            product_id = sample.get("wm_item_id", "")
        
        product_id = product_id[:col_widths["id"]]
        
        print(f"{retailer:<{col_widths['retailer']}} "
              f"{title:<{col_widths['title']}} "
              f"{price:<{col_widths['price']}} "
              f"{category:<{col_widths['category']}} "
              f"{product_id:<{col_widths['id']}}")
    
    logger.info("Table output complete")

# list available files
def list_available_files():
    logger.info("Scanning for available crawl files...")
    
    current_dir = Path(".")
    crawl_files = list(current_dir.glob("*_crawl.json"))
    
    print("Available crawl files:")
    if crawl_files:
        logger.info(f"Found {len(crawl_files)} crawl files")
        for file in sorted(crawl_files):
            try:
                logger.debug(f"Analyzing {file}...")
                data = load_crawl_data(file)
                products = extract_products_from_hierarchy(data)
                categories = extract_categories_with_products(data)
                retailer = get_retailer_from_data(products)
                print(f"  {file} ({len(products)} products across {len(categories)} categories, {retailer})")
            except Exception as e:
                logger.warning(f"Unable to parse {file}: {e}")
                print(f"  {file} (unable to parse)")
    else:
        logger.info("No *_crawl.json files found in current directory")
        print("  No *_crawl.json files found in current directory")
    
    print(f"\nDefault file mappings:")
    for retailer, filename in DEFAULT_FILES.items():
        exists = Path(filename).exists()
        status = "✓" if exists else "✗"
        print(f"  {status} {retailer}: {filename}")

# sample from randomly selected categories while preserving hierarchy
def sample_per_category_with_hierarchy(data: Dict[str, Any], num_categories: int, products_per_category: int, category_filter: Optional[str] = None) -> Dict[str, Any]:
    logger.info(f"Randomly selecting {num_categories} categories with hierarchy preservation, sampling {products_per_category} products from each...")
    
    categories = extract_categories_with_products(data)
    
    # apply category filter if specified
    if category_filter:
        original_count = len(categories)
        categories = [
            cat for cat in categories 
            if category_filter.lower() in cat["name"].lower()
        ]
        logger.info(f"Category filter reduced categories from {original_count} to {len(categories)}")
    
    if not categories:
        logger.error("No categories with products found")
        return data
    
    # randomly select categories
    available_categories = len(categories)
    categories_to_select = min(num_categories, available_categories)
    
    if categories_to_select < num_categories:
        logger.warning(f"Only {available_categories} categories available, selecting all of them instead of {num_categories}")
    
    selected_categories = random.sample(categories, categories_to_select)
    selected_category_names = {cat["name"] for cat in selected_categories}
    logger.info(f"Randomly selected {len(selected_categories)} categories: {[cat['name'] for cat in selected_categories]}")
    
    # create mapping of category names to sample counts
    samples_per_category = {}
    for cat in selected_categories:
        available_products = len(cat["products"])
        sample_count = min(products_per_category, available_products)
        samples_per_category[cat["name"]] = sample_count
        logger.info(f"Will sample {sample_count} products from '{cat['name']}' (has {available_products} available)")
    
    # create a deep copy of the data structure
    sampled_data = copy.deepcopy(data)
    
    # helper function to check if a node or any of its descendants has products
    def has_products_in_tree(sub_node):
        if "products" in sub_node and isinstance(sub_node["products"], list) and len(sub_node["products"]) > 0:
            return True
        if "sub_items" in sub_node and isinstance(sub_node["sub_items"], list):
            return any(has_products_in_tree(child) for child in sub_node["sub_items"])
        return False
    
    # helper function to check if a node contains any selected categories
    def contains_selected_category(node):
        if "products" in node and isinstance(node["products"], list):
            cat_name = node.get("name", "Unknown")
            if cat_name in selected_category_names and len(node["products"]) > 0:
                return True
        
        if "sub_items" in node and isinstance(node["sub_items"], list):
            return any(contains_selected_category(child) for child in node["sub_items"])
        
        return False
    
    # sample products from selected categories only
    def process_node(node):
        # check if this node has products and is a selected category
        if "products" in node and isinstance(node["products"], list):
            cat_name = node.get("name", "Unknown")
            
            if cat_name in selected_category_names:
                target_samples = samples_per_category.get(cat_name, 0)
                
                if target_samples > 0 and len(node["products"]) > 0:
                    # sample products for this selected category
                    sampled_products = random.sample(
                        node["products"],
                        min(target_samples, len(node["products"]))
                    )
                    node["products"] = sampled_products
                    logger.debug(f"Sampled {len(sampled_products)} products from selected category '{cat_name}'")
                else:
                    node["products"] = []
            else:
                # this category was not selected, remove its products but keep the category if it has selected descendants
                node["products"] = []
        
        # process sub_items recursively
        if "sub_items" in node and isinstance(node["sub_items"], list):
            # first, process all sub-items
            for sub_item in node["sub_items"]:
                process_node(sub_item)
            
            # keep only sub-items that contain selected categories or have products after processing
            node["sub_items"] = [
                sub for sub in node["sub_items"] 
                if contains_selected_category(sub) or has_products_in_tree(sub)
            ]
    
    # apply processing to the copied data
    if "departments" in sampled_data:
        for department in sampled_data["departments"]:
            process_node(department)
        # keep only departments that contain selected categories
        sampled_data["departments"] = [
            dept for dept in sampled_data["departments"] 
            if contains_selected_category(dept) or has_products_in_tree(dept)
        ]
    elif "sub_items" in sampled_data:
        for item in sampled_data["sub_items"]:
            process_node(item)
        # keep only items that contain selected categories
        sampled_data["sub_items"] = [
            item for item in sampled_data["sub_items"] 
            if contains_selected_category(item) or has_products_in_tree(item)
        ]
    else:
        process_node(sampled_data)
    
    # count final sampled products
    final_count = len(extract_products_from_hierarchy(sampled_data))
    total_expected = categories_to_select * products_per_category
    logger.info(f"Per-category hierarchical sampling complete. Final product count: {final_count} (expected up to {total_expected})")
    
    return sampled_data

# main
def main():
    parser = argparse.ArgumentParser(
        description="Extract random samples from crawl data with hierarchical and per-category options",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --retailer amazon --count 10
  %(prog)s --file target_crawl.json --count 5 --format csv
  %(prog)s --retailer walmart --count 20 --output samples.json
  %(prog)s --retailer amazon --preserve-hierarchy --count 100
  %(prog)s --retailer target --per-category --count 5 --products-per-category 3
  %(prog)s --retailer walmart --per-category --count 3 --products-per-category 2 --preserve-hierarchy
  %(prog)s --list-files
        """
    )
    
    # input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--retailer", "-r",
        choices=list(DEFAULT_FILES.keys()),
        help="Retailer to sample from (uses default file mapping)"
    )
    input_group.add_argument(
        "--file", "-f",
        type=Path,
        help="Specific JSON file to sample from"
    )
    input_group.add_argument(
        "--list-files",
        action="store_true",
        help="List available crawl files and exit"
    )
    
    # sampling options
    parser.add_argument(
        "--count", "-c",
        type=int,
        default=10,
        help="Number of samples to extract (default: 10). With --per-category, this is the number of random categories to select."
    )
    
    parser.add_argument(
        "--seed", "-s",
        type=int,
        help="Random seed for reproducible sampling"
    )
    
    # hierarchy preservation option
    parser.add_argument(
        "--preserve-hierarchy",
        action="store_true",
        help="Maintain hierarchical structure in output instead of flattening"
    )
    
    # per-category sampling options
    parser.add_argument(
        "--per-category",
        action="store_true",
        help="Sample products from randomly selected categories (use --count to specify number of categories to select)"
    )
    
    parser.add_argument(
        "--products-per-category",
        type=int,
        default=1,
        help="Number of products to sample from each category (default: 1, only used with --per-category)"
    )
    
    # output options
    parser.add_argument(
        "--format",
        choices=["json", "csv", "table"],
        default="table",
        help="Output format (default: table)"
    )
    
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Output file (default: stdout)"
    )
    
    parser.add_argument(
        "--category-filter",
        help="Only sample from products in categories containing this text"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging (debug level)"
    )
    
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress progress logging (errors only)"
    )
    
    args = parser.parse_args()
    
    # config logging level based on arguments
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    elif args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("Starting sample extraction process...")
    
    # validate argument combinations
    if args.preserve_hierarchy and args.format == "csv":
        logger.error("CSV format is not supported with --preserve-hierarchy")
        sys.exit(1)
    
    if args.preserve_hierarchy and args.format == "table" and not args.output:
        logger.error("Table format cannot display hierarchical data. Use --output with JSON format or switch to --format json")
        sys.exit(1)
    
    # handle list files
    if args.list_files:
        list_available_files()
        return
    
    # determine input file
    if args.retailer:
        input_file = Path(DEFAULT_FILES[args.retailer])
        logger.info(f"Using default file for {args.retailer}: {input_file}")
    else:
        input_file = args.file
        logger.info(f"Using specified file: {input_file}")
    
    if not input_file.exists():
        logger.error(f"File not found: {input_file}")
        if args.retailer:
            logger.info("Try running with --list-files to see available files")
        sys.exit(1)
    
    # set random seed if provided
    if args.seed:
        logger.info(f"Setting random seed to: {args.seed}")
        random.seed(args.seed)
    
    # load data
    data = load_crawl_data(input_file)
    
    # determine sampling mode
    if args.per_category:
        logger.info(f"Using per-category sampling mode ({args.products_per_category} products per category)")
        
        if args.preserve_hierarchy:
            logger.info("Per-category sampling with hierarchy preservation")
            sampled_data = sample_per_category_with_hierarchy(data, args.count, args.products_per_category, args.category_filter)
            
            if not sampled_data:
                logger.error("No products found in the sampled data")
                sys.exit(1)
            
            # output the complete hierarchical structure
            if args.format == "json":
                output_hierarchy_as_json(sampled_data, args.output, per_category=True, categories_selected=args.count, products_per_category=args.products_per_category)
            elif args.format == "csv":
                logger.warning("CSV format not supported with hierarchical structure. Flattening output.")
                flattened_products = extract_products_from_hierarchy(sampled_data)
                retailer = get_retailer_from_data(flattened_products)
                formatted_samples = [
                    format_product_for_display(product, retailer)
                    for product in flattened_products
                ]
                output_as_csv(formatted_samples, args.output)
            else:  # table
                logger.warning("Table format not supported with hierarchical structure. Flattening output.")
                flattened_products = extract_products_from_hierarchy(sampled_data)
                retailer = get_retailer_from_data(flattened_products)
                formatted_samples = [
                    format_product_for_display(product, retailer)
                    for product in flattened_products
                ]
                if args.output:
                    logger.warning("Table format cannot be written to file, using JSON hierarchy instead")
                    output_hierarchy_as_json(sampled_data, args.output, per_category=True, categories_selected=args.count, products_per_category=args.products_per_category)
                else:
                    output_as_table(formatted_samples, per_category=True)
        else:
            # standard per-category sampling (flat output)
            sampled_products = sample_per_category(data, args.count, args.products_per_category, args.category_filter)
            
            if not sampled_products:
                logger.error("No products found in the data")
                sys.exit(1)
            
            retailer = get_retailer_from_data(sampled_products)
            
            # format products for output
            formatted_samples = [
                format_product_for_display(product, retailer)
                for product in sampled_products
            ]
            
            logger.info(f"Successfully sampled products from {retailer} ({len(formatted_samples)} total products)")
            
            # output results
            if args.format == "json":
                output_as_json(formatted_samples, args.output, per_category=True)
            elif args.format == "csv":
                output_as_csv(formatted_samples, args.output)
            else:  # table
                if args.output:
                    logger.warning("Table format cannot be written to file, using JSON instead")
                    output_as_json(formatted_samples, args.output, per_category=True)
                else:
                    output_as_table(formatted_samples, per_category=True)
    
    elif args.preserve_hierarchy:
        logger.info(f"Using hierarchical sampling mode ({args.count} total products)")
        
        # sample while preserving hierarchy
        sampled_hierarchy = sample_hierarchy_preserving(data, args.count, args.category_filter)
        
        # for table/csv output, we need to flatten
        if args.format in ["table", "csv"]:
            flattened_products = extract_products_from_hierarchy(sampled_hierarchy)
            
            if not flattened_products:
                logger.error("No products found in the sampled data")
                sys.exit(1)
            
            retailer = get_retailer_from_data(flattened_products)
            
            formatted_samples = [
                format_product_for_display(product, retailer)
                for product in flattened_products
            ]
            
            if args.format == "csv":
                output_as_csv(formatted_samples, args.output)
            else:  # table
                if args.output:
                    logger.warning("Table format cannot be written to file, using JSON instead")
                    output_as_json(formatted_samples, args.output)
                else:
                    output_as_table(formatted_samples)
        else:
            # JSON output with full hierarchy
            output_hierarchy_as_json(sampled_hierarchy, args.output, per_category=True, categories_selected=args.count, products_per_category=args.products_per_category)
    
    else:
        logger.info(f"Using standard sampling mode ({args.count} products)")
        
        # standard flat sampling (original behavior)
        all_products = extract_products_from_hierarchy(data)
        
        if not all_products:
            logger.error("No products found in the data")
            sys.exit(1)
        
        retailer = get_retailer_from_data(all_products)
        
        # apply category filter if specified
        if args.category_filter:
            logger.info(f"Applying category filter: '{args.category_filter}'")
            original_count = len(all_products)
            filtered_products = [
                p for p in all_products 
                if args.category_filter.lower() in p.get("category", "").lower()
            ]
            logger.info(f"Category filter reduced products from {original_count} to {len(filtered_products)}")
            all_products = filtered_products
        
        if not all_products:
            logger.error("No products remaining after filtering")
            sys.exit(1)
        
        # sample products
        sample_count = min(args.count, len(all_products))
        logger.info(f"Sampling {sample_count} products from {len(all_products)} available products...")
        
        sampled_products = random.sample(all_products, sample_count)
        logger.info("Product sampling complete")
        
        # format products for output
        logger.info("Formatting products for output...")
        formatted_samples = [
            format_product_for_display(product, retailer)
            for product in sampled_products
        ]
        
        logger.info(f"Successfully sampled {sample_count} products from {retailer}")
        
        # output in requested format
        if args.format == "json":
            output_as_json(formatted_samples, args.output)
        elif args.format == "csv":
            output_as_csv(formatted_samples, args.output)
        else:  # table
            if args.output:
                logger.warning("Table format cannot be written to file, using JSON instead")
                output_as_json(formatted_samples, args.output)
            else:
                output_as_table(formatted_samples)
    
    logger.info("Sample extraction process complete!")

if __name__ == "__main__":
    main()