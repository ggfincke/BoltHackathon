"""
Crawler Command Line Interface

This script provides a unified interface to run different retailer crawlers
with various configurations and output modes.

Usage:
    python scripts/crawl.py --retailer amazon --mode full
    python scripts/crawl.py --retailer target --mode urls-only --category "Beverages"
    python scripts/crawl.py --retailer walmart --mode full --category "Snacks"
    python scripts/crawl.py --retailer amazon --mode full --hierarchical --max-pages 10
    python scripts/crawl.py --retailer target --from-hierarchy-file hierarchy.json --mode urls-only
    python scripts/crawl.py --retailer walmart --from-hierarchy-file --category "Beverages" --mode full
    python scripts/crawl.py --retailer amazon --from-hierarchy-file --category "Marshmallows" --mode full
    python scripts/crawl.py --retailer target --backend supabase --mode full --category "Snacks"
    python scripts/crawl.py --retailer amazon --backend supabase --mode full --hierarchical

    test 
    python scripts/crawl.py --retailer walmart --from-hierarchy-file "" --category "Beverages" --mode full --backend supabase --max-pages 1 --crawler-concurrency 1 --upc-concurrency 6

Main usage (supabase):
    python scripts/crawl.py --retailer amazon --from-hierarchy-file "" --mode full --backend supabase --max-pages 15 --crawler-concurrency 4 --upc-concurrency 6
    python scripts/crawl.py --retailer target --from-hierarchy-file "" --mode full --backend supabase --max-pages 15 --crawler-concurrency 1 --upc-concurrency 6
    python scripts/crawl.py --retailer walmart --from-hierarchy-file "" --mode full --backend supabase --max-pages 15 --crawler-concurrency 1 --upc-concurrency 4

"""

import sys
import os
import argparse
import asyncio
import redis
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# load from .env
load_dotenv(override=True)

# src dir to Python path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src'))

from crawlers.amazon.amazon_crawler import AmazonCrawler
from crawlers.target.target_crawler import TargetCrawler
from crawlers.walmart.walmart_crawler import WalmartCrawler
from crawlers.base_crawler import (
    JsonFileBackend, 
    create_redis_backend,
    create_redis_client,
    create_supabase_backend
)



# retailer configurations
RETAILER_CONFIG = {
    "amazon": {
        "class": AmazonCrawler,
        "retailer_id": 1,
        "description": "Amazon product crawler",
        "default_hierarchy_file": "data/processed/simplified_amazon.json"
    },
    "target": {
        "class": TargetCrawler,
        "retailer_id": 2,
        "description": "Target product crawler",
        "default_hierarchy_file": "data/processed/simplified_target.json"
    },
    "walmart": {
        "class": WalmartCrawler,
        "retailer_id": 3,
        "description": "Walmart product crawler",
        "default_hierarchy_file": "data/processed/simplified_walmart.json"
    }
}

# logging config
def setup_logging(level: str = "INFO") -> logging.Logger:
    log_level = getattr(logging, level.upper(), logging.INFO)
    
    # formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    
    # logger
    logger = logging.getLogger("CrawlerCLI")
    logger.setLevel(log_level)
    logger.addHandler(console_handler)
    
    return logger

# create output backend based on config
def create_backend(backend_type, mode, hierarchical, retailer_id, output_file, 
                  supabase_url, supabase_key, enable_upc_lookup, category, upc_concurrency=4):    
    # supabase backend
    if backend_type == "supabase":
        return create_supabase_backend(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            enable_upc_lookup=enable_upc_lookup,
            crawl_category=category,
            upc_concurrency=upc_concurrency
        )
    # hierarchical mode (JSON)
    elif hierarchical:
        # hierarchical structure always uses JSON backend
        prefix = output_file or "hierarchical_crawl"
        return JsonFileBackend(prefix=prefix, hierarchical=True)
    # urls-only mode (JSON)
    elif mode == "urls-only":
        if backend_type == "redis":
            # use Redis backend for URL-only mode
            return create_redis_backend(retailer_id)
        else:
            # use JSON backend for file output in URL mode
            prefix = output_file or "urls_crawl"
            return JsonFileBackend(prefix=prefix, hierarchical=False)
    # full mode (default)
    else:  
        if backend_type == "redis":
            return create_redis_backend(retailer_id)
        else:
            prefix = output_file or "product_crawl"
            return JsonFileBackend(prefix=prefix, hierarchical=False)

# get list of available retailers
def get_available_retailers():
    return list(RETAILER_CONFIG.keys())

# validate that the retailer is supported
def validate_retailer(retailer: str):
    if retailer not in RETAILER_CONFIG:
        available = ", ".join(get_available_retailers())
        raise ValueError(f"Unsupported retailer '{retailer}'. Available retailers: {available}")

# validate hierarchy file exists
def validate_hierarchy_file(file_path: str) -> Path:
    path = Path(file_path)
    if not path.exists():
        raise ValueError(f"Hierarchy file not found: {file_path}")
    if not path.suffix.lower() == '.json':
        raise ValueError(f"Hierarchy file must be a JSON file: {file_path}")
    return path

# validate numeric parameters
def validate_numeric_parameters(max_pages: int, crawler_concurrency: int, upc_concurrency: int):
    if max_pages <= 0:
        raise ValueError(f"max-pages must be positive, got: {max_pages}")
    if crawler_concurrency <= 0:
        raise ValueError(f"crawler-concurrency must be positive, got: {crawler_concurrency}")
    if upc_concurrency <= 0:
        raise ValueError(f"upc-concurrency must be positive, got: {upc_concurrency}")

# validate flag combinations
def validate_flag_combinations(args):
    # validate category/department are only used w/ appropriate modes
    if not args.from_hierarchy_file and not args.hierarchical:
        if not (args.category or args.department):
            raise ValueError("Category or department must be specified for non-hierarchical crawls. "
                           "Use --category, --department, --hierarchical, or --from-hierarchy-file")
    
    # validate mutually exclusive flags
    if args.enable_upc_lookup and args.disable_upc_lookup:
        raise ValueError("Cannot specify both --enable-upc-lookup and --disable-upc-lookup")
    
    # validate backend-specific requirements
    if args.backend == "redis" and args.output:
        raise ValueError("Cannot specify --output with Redis backend (Redis doesn't use file output)")

# validate category exists in hierarchy
def validate_category_in_hierarchy(hierarchy: dict, category: str, retailer: str) -> bool:
    def search_in_node(node, target_name):
        if isinstance(node, dict):
            # check if this node matches
            node_name = node.get("name") or node.get("department_name")
            if node_name and node_name.lower() == target_name.lower():
                return True
            
            # recurse into sub_items
            if node.get("sub_items"):
                for child in node["sub_items"]:
                    if search_in_node(child, target_name):
                        return True
                        
            # check entry_point_categories if they exist
            if node.get("entry_point_categories"):
                for child in node["entry_point_categories"]:
                    if search_in_node(child, target_name):
                        return True
        elif isinstance(node, list):
            for item in node:
                if search_in_node(item, target_name):
                    return True
        return False
    
    # search in departments if they exist
    if "departments" in hierarchy:
        for department in hierarchy["departments"]:
            if search_in_node(department, category):
                return True
    
    # search in sub_items if they exist (for Walmart structure)
    if "sub_items" in hierarchy:
        if search_in_node(hierarchy["sub_items"], category):
            return True
    
    # search the entire hierarchy as fallback
    return search_in_node(hierarchy, category)

# get available categories from hierarchy for error messages
def get_available_categories(hierarchy: dict, max_items: int = 20) -> list:
    categories = []
    
    def collect_from_node(node, depth=0):
        if len(categories) >= max_items:
            return
            
        if isinstance(node, dict):
            name = node.get("name") or node.get("department_name")
            if name:
                categories.append(name)
            
            # limit depth to avoid too many categories
            if node.get("sub_items") and depth < 3:
                for child in node["sub_items"]:
                    collect_from_node(child, depth + 1)
                    
            if node.get("entry_point_categories") and depth < 3:
                for child in node["entry_point_categories"]:
                    collect_from_node(child, depth + 1)
        elif isinstance(node, list):
            for item in node:
                collect_from_node(item, depth)
    
    if "departments" in hierarchy:
        for dept in hierarchy["departments"]:
            collect_from_node(dept)
    elif "sub_items" in hierarchy:
        collect_from_node(hierarchy["sub_items"])
    else:
        collect_from_node(hierarchy)
    
    return categories[:max_items]

# validate category/department exists in retailer hierarchy
def validate_category_or_department(retailer: str, category: str = None, department: str = None):
    if not (category or department):
        return
    
    # load the retailer's hierarchy file
    retailer_config = RETAILER_CONFIG[retailer]
    hierarchy_file = retailer_config["default_hierarchy_file"]
    
    if not os.path.exists(hierarchy_file):
        # if default hierarchy file doesn't exist, skip validation
        return
    
    try:
        with open(hierarchy_file, 'r', encoding='utf-8') as f:
            hierarchy = json.load(f)
    except Exception:
        # if we can't load the hierarchy, skip validation
        return
    
    target = category or department
    target_type = "category" if category else "department"
    
    if not validate_category_in_hierarchy(hierarchy, target, retailer):
        available_categories = get_available_categories(hierarchy)
        available_list = "\n  - ".join(available_categories)
        
        # max_items reached
        if len(available_categories) == 20:
            available_list += "\n  ... and more"
        
        raise ValueError(
            f"Invalid {target_type} '{target}' for retailer '{retailer}'.\n"
            f"Available categories include:\n  - {available_list}\n\n"
            f"Use --hierarchical to crawl all categories, or specify a valid {target_type}."
        )

# main function
def main():
    parser = argparse.ArgumentParser(
        description="Unified crawler interface for multiple retailers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --retailer amazon --crawler-concurrency 8 --upc-concurrency 4
  %(prog)s --retailer target --mode urls-only --crawler-concurrency 15 --upc-concurrency 6
  %(prog)s --retailer walmart --crawler-concurrency 3 --upc-concurrency 12
  %(prog)s --retailer amazon --mode full
  %(prog)s --retailer target --mode urls-only --category "Beverages"
  %(prog)s --retailer walmart --mode full --category "Snacks"
  %(prog)s --retailer amazon --mode full --hierarchical --max-pages 5
  %(prog)s --retailer target --mode urls-only --hierarchical --output hierarchy_urls
  %(prog)s --retailer walmart --department "Walmart Grocery" --hierarchical
  %(prog)s --retailer amazon --department "Amazon Grocery" --mode full
  %(prog)s --retailer target --department "Target Grocery" --hierarchical
  %(prog)s --retailer target --from-hierarchy-file hierarchy.json --mode urls-only --max-pages 3
  %(prog)s --retailer walmart --from-hierarchy-file --category "Beverages" --mode full
  %(prog)s --retailer amazon --from-hierarchy-file --category "Marshmallows" --mode full
  %(prog)s --retailer target --backend supabase --mode full --category "Snacks"
  %(prog)s --retailer amazon --backend supabase --mode full --hierarchical
  %(prog)s --retailer walmart --backend supabase --mode full --enable-upc-lookup
  %(prog)s --retailer target --backend redis --mode urls-only
  %(prog)s --list-retailers
  %(prog)s --list-categories amazon
        """
    )
    
    # main args
    parser.add_argument(
        "--retailer", "-r",
        choices=get_available_retailers(),
        help="Retailer to crawl"
    )
    
    parser.add_argument(
        "--mode", "-m",
        choices=["full", "urls-only"],
        default="full",
        help="Crawling mode (default: full)"
    )
    
    parser.add_argument(
        "--backend", "-b",
        choices=["json", "redis", "supabase"],
        default="json",
        help="Output backend to use: json (file), redis (cache), or supabase (database) (default: json)"
    )
    
    parser.add_argument(
        "--hierarchical",
        action="store_true",
        help="Build hierarchical category structure or format output hierarchically"
    )
    
    parser.add_argument(
        "--from-hierarchy-file",
        metavar="FILE",
        help="Load hierarchy from existing JSON file and crawl all leaf categories. "
             "If no file specified, uses default hierarchy file for the retailer. "
             "Can be combined with --category or --department to filter results."
    )
    
    parser.add_argument(
        "--department", "-d",
        help="Specific department to crawl (optional, will crawl all subcategories within)"
    )
    
    parser.add_argument(
        "--category", "-c",
        help="Specific category to crawl (optional)"
    )
    
    parser.add_argument(
        "--max-pages", "-p",
        type=int,
        default=5,
        help="Maximum pages to crawl per category (default: 5)"
    )
    
    parser.add_argument(
        "--crawler-concurrency",
        type=int,
        default=1,
        help="Number of concurrent web scrapers for product extraction (default: 5, "
             "applies to hierarchy file mode and grid crawling)"
    )
    
    parser.add_argument(
        "--upc-concurrency", 
        type=int,
        default=4,
        help="Number of concurrent workers for UPC lookup operations (default: 4, "
             "affects UPC API calls and browser instances)"
    )
    
    parser.add_argument(
        "--concurrency",
        type=int,
        help="[DEPRECATED] Use --crawler-concurrency and --upc-concurrency instead. "
             "If specified, sets both crawler and UPC concurrency to the same value."
    )
    
    parser.add_argument(
        "--output", "-o",
        help="Output file prefix (optional, ignored when using supabase backend)"
    )
    
    # Supabase configuration
    parser.add_argument(
        "--supabase-url",
        help="Supabase project URL (can also be set via SUPABASE_URL env var)"
    )
    
    parser.add_argument(
        "--supabase-key",
        help="Supabase API key (can also be set via SUPABASE_ANON_KEY env var)"
    )
    
    parser.add_argument(
        "--enable-upc-lookup",
        action="store_true",
        default=True,
        help="Enable UPC lookup when using Supabase backend (default: enabled)"
    )
    
    parser.add_argument(
        "--disable-upc-lookup",
        action="store_true",
        help="Disable UPC lookup when using Supabase backend"
    )
    
    parser.add_argument(
        "--log-level", "-l",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )
    
    # utility args
    parser.add_argument(
        "--list-retailers",
        action="store_true",
        help="List available retailers and exit"
    )
    
    parser.add_argument(
        "--list-categories",
        metavar="RETAILER",
        help="List available categories for a specific retailer and exit"
    )
    
    parser.add_argument(
        "--test-redis",
        action="store_true",
        help="Test Redis connection and exit"
    )
    
    parser.add_argument(
        "--test-supabase",
        action="store_true",
        help="Test Supabase connection and exit"
    )
    
    args = parser.parse_args()
    
    # handle utility commands
    if args.list_retailers:
        print("Available retailers:")
        for retailer, config in RETAILER_CONFIG.items():
            print(f"  {retailer}: {config['description']} (ID: {config['retailer_id']})")
            print(f"    Default hierarchy file: {config['default_hierarchy_file']}")
        return
    
    if args.list_categories:
        try:
            validate_retailer(args.list_categories)
            retailer_config = RETAILER_CONFIG[args.list_categories]
            hierarchy_file = retailer_config["default_hierarchy_file"]
            
            if not os.path.exists(hierarchy_file):
                print(f"❌ Hierarchy file not found for {args.list_categories}: {hierarchy_file}")
                sys.exit(1)
            
            with open(hierarchy_file, 'r', encoding='utf-8') as f:
                hierarchy = json.load(f)
            
            categories = get_available_categories(hierarchy, max_items=50)
            print(f"Available categories for {args.list_categories}:")
            for category in categories:
                print(f"  - {category}")
            
            if len(categories) == 50:
                print("  ... and more")
                
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error loading categories: {e}")
            sys.exit(1)
        return
    
    if args.test_redis:
        try:
            redis_client = create_redis_client()
            redis_client.ping()
            print("✅ Redis connection successful")
        except Exception as e:
            print(f"❌ Redis connection failed: {e}")
            sys.exit(1)
        return
    
    if args.test_supabase:
        try:
            supabase_backend = create_supabase_backend(
                supabase_url=args.supabase_url,
                supabase_key=args.supabase_key,
                enable_upc_lookup=False,  
                crawl_category=None  
            )
            print("✅ Supabase connection successful")
        except Exception as e:
            print(f"❌ Supabase connection failed: {e}")
            sys.exit(1)
        return
    
    # validate required arguments
    if not args.retailer:
        parser.error("--retailer is required (use --list-retailers to see options)")
    
    # validate retailer first
    try:
        validate_retailer(args.retailer)
    except ValueError as e:
        parser.error(str(e))
    
    # validate flag combinations
    try:
        validate_flag_combinations(args)
    except ValueError as e:
        parser.error(str(e))
    
    # handle backward compatibility for concurrency
    if args.concurrency is not None:
        print(f"⚠️  WARNING: --concurrency is deprecated. "
              f"Using --crawler-concurrency={args.concurrency} and --upc-concurrency={args.concurrency}")
        crawler_concurrency = args.concurrency
        upc_concurrency = args.concurrency
    else:
        crawler_concurrency = args.crawler_concurrency
        upc_concurrency = args.upc_concurrency
    
    # validate numeric parameters
    try:
        validate_numeric_parameters(args.max_pages, crawler_concurrency, upc_concurrency)
    except ValueError as e:
        parser.error(str(e))
    
    # validate category/department exists in hierarchy
    try:
        validate_category_or_department(args.retailer, args.category, args.department)
    except ValueError as e:
        parser.error(str(e))
    
    # validate Supabase requirements
    if args.backend == "supabase":
        supabase_url = args.supabase_url or os.getenv('SUPABASE_URL')
        supabase_key = args.supabase_key or os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            parser.error("Supabase backend requires --supabase-url and --supabase-key or "
                        "SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
    
    # determine UPC lookup setting
    enable_upc_lookup = args.enable_upc_lookup and not args.disable_upc_lookup
    
    # set up logging
    logger = setup_logging(args.log_level)
    
    # log the concurrency settings
    logger.info(f"🕸️  Crawler concurrency: {crawler_concurrency}")
    logger.info(f"🔍 UPC lookup concurrency: {upc_concurrency}")
    
    try:
        # get retailer configuration
        retailer_config = RETAILER_CONFIG[args.retailer]
        crawler_class = retailer_config["class"]
        retailer_id = retailer_config["retailer_id"]
        
        # create output backend
        backend = create_backend(
            backend_type=args.backend,
            mode=args.mode,
            hierarchical=args.hierarchical,
            retailer_id=retailer_id,
            output_file=args.output,
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key,
            enable_upc_lookup=enable_upc_lookup,
            category=args.category,
            upc_concurrency=upc_concurrency
        )
        
        # log backend info
        backend_info = f"{args.backend} backend"
        if args.backend == "supabase":
            upc_status = "with UPC lookup" if enable_upc_lookup else "without UPC lookup"
            backend_info += f" ({upc_status})"
        logger.info(f"Using {backend_info}")
        
        # create crawler
        crawler = crawler_class(
            retailer_id=retailer_id,
            logger=logger,
            category=args.category,
            department=args.department,
            urls_only=(args.mode == "urls-only"),
            hierarchical=args.hierarchical,
            output_backend=backend,
            crawler_concurrency=crawler_concurrency,
            upc_concurrency=upc_concurrency
        )
        crawler.max_pages = args.max_pages
        
        # handle hierarchy file mode
        if args.from_hierarchy_file is not None:
            if args.from_hierarchy_file == "":
                # use default hierarchy file
                hierarchy_file = retailer_config["default_hierarchy_file"]
                logger.info(f"Using default hierarchy file: {hierarchy_file}")
            else:
                # use specified file
                hierarchy_file = args.from_hierarchy_file
            
            # validate hierarchy file
            hierarchy_file = validate_hierarchy_file(hierarchy_file)
            
            # hierarchy file mode - use the specialized method with filters
            logger.info(f"Starting hierarchy file crawl with {crawler_concurrency} concurrent workers")
            if args.category:
                logger.info(f"Filtering to category: {args.category}")
            if args.department:
                logger.info(f"Filtering to department: {args.department}")
                
            crawler.crawl_from_hierarchy_file(
                hierarchy_file=hierarchy_file,
                max_pages_per_cat=args.max_pages,
                category_filter=args.category,
                department_filter=args.department,
                concurrency=crawler_concurrency
            )
        else:
            # regular mode (category/department based)
            crawler.crawl(max_pages_per_cat=args.max_pages)
            
    except Exception as e:
        logger.error(f"Crawler failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()