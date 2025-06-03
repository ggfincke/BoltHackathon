#!/usr/bin/env python3
"""
Random Sample Script for Crawl Data

Extracts random samples from hierarchical crawl JSON files.
Supports Amazon, Target, and Walmart crawl outputs.

Usage:
    python sample.py --retailer amazon --count 10
    python sample.py --file amazon_crawl.json --count 5 --format csv
    python sample.py --retailer target --count 20 --output samples.json
    python sample.py --list-files
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

# extract products from hierarchy
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
    
    # add retailer-specific IDs
    if retailer == "amazon":
        formatted["asin"] = product.get("asin")
    elif retailer == "target":
        formatted["tcin"] = product.get("tcin")
    elif retailer == "walmart":
        formatted["wm_item_id"] = product.get("wm_item_id")
    
    return formatted

# output as json
def output_as_json(samples: List[Dict[str, Any]], output_file: Optional[Path] = None):
    logger.info(f"Formatting {len(samples)} samples as JSON...")
    
    output_data = {
        "sample_info": {
            "timestamp": datetime.now().isoformat(),
            "sample_count": len(samples),
            "retailer": samples[0]["retailer"] if samples else "unknown"
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
def output_as_table(samples: List[Dict[str, Any]]):
    if not samples:
        logger.warning("No samples to display")
        return
    
    logger.info(f"Formatting {len(samples)} samples as table...")
    
    # define column widths
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
                retailer = get_retailer_from_data(products)
                print(f"  {file} ({len(products)} products, {retailer})")
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

# main
def main():
    parser = argparse.ArgumentParser(
        description="Extract random samples from crawl data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --retailer amazon --count 10
  %(prog)s --file target_crawl.json --count 5 --format csv
  %(prog)s --retailer walmart --count 20 --output samples.json
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
        help="Number of samples to extract (default: 10)"
    )
    
    parser.add_argument(
        "--seed", "-s",
        type=int,
        help="Random seed for reproducible sampling"
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
    
    # load and process data
    data = load_crawl_data(input_file)
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
    # table format (in terminal)
    else:  
        if args.output:
            logger.warning("Table format cannot be written to file, using JSON instead")
            output_as_json(formatted_samples, args.output)
        else:
            output_as_table(formatted_samples)
    
    logger.info("Sample extraction process complete!")

if __name__ == "__main__":
    main()