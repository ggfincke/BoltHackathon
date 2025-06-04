"""
Crawler Command Line Interface with Supabase Support

This script provides a unified interface to run different retailer crawlers
with various configurations and output modes, including Supabase database storage.

Usage:
    python crawl.py --retailer amazon --mode full --output-backend supabase
    python crawl.py --retailer target --mode urls-only --category "Beverages" --output-backend json
    python crawl.py --retailer walmart --mode full --category "Snacks" --output-backend supabase
    python crawl.py --retailer amazon --mode full --hierarchical --max-pages 10 --output-backend supabase
"""

import argparse
import logging
import sys
import os
from pathlib import Path
import json

# add crawlers directory to path
sys.path.append(str(Path(__file__).parent / "crawlers"))

# import crawler classes
from crawlers.amazon.amazon_crawler import AmazonCrawler
from crawlers.target.target_crawler import TargetCrawler
from crawlers.walmart.walmart_crawler import WalmartCrawler
from crawlers.base_crawler import (
    JsonFileBackend, 
    create_redis_backend,
    create_redis_client
)

# import Supabase backend
try:
    from supabase_backend import create_supabase_backend
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("Warning: Supabase backend not available. Install supabase-py: pip install supabase")

# retailer configs
RETAILER_CONFIG = {
    "amazon": {
        "class": AmazonCrawler,
        "retailer_id": 1,
        "description": "Amazon product crawler",
        "default_hierarchy_file": "crawlers/amazon/amazon_grocery_hierarchy.json"
    },
    "target": {
        "class": TargetCrawler,
        "retailer_id": 2,
        "description": "Target product crawler",
        "default_hierarchy_file": "crawlers/target/target_grocery_hierarchy.json"
    },
    "walmart": {
        "class": WalmartCrawler,
        "retailer_id": 3,
        "description": "Walmart product crawler",
        "default_hierarchy_file": "crawlers/walmart/walmart_grocery_hierarchy.json"
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

# create output backend w/ supabase support
def create_output_backend(backend_type: str, mode: str, retailer_id: int, 
                         hierarchical: bool = False, output_file: str = None):    
    # supabase
    if backend_type == 'supabase':
        if not SUPABASE_AVAILABLE:
            raise ValueError("Supabase backend not available. Install supabase-py: pip install supabase")
        return create_supabase_backend()
    
    # json
    elif backend_type == 'json':
        prefix = output_file or ("hierarchical_crawl" if hierarchical else "product_crawl")
        return JsonFileBackend(prefix=prefix, hierarchical=hierarchical)
    
    # redis (Django app) 
    elif backend_type == 'redis':
        return create_redis_backend(retailer_id)

    # auto-select
    elif backend_type == 'auto':
        # hierarchical
        if hierarchical:
            if SUPABASE_AVAILABLE:
                return create_supabase_backend()
            else:
                prefix = output_file or "hierarchical_crawl"
                return JsonFileBackend(prefix=prefix, hierarchical=True)
        # urls-only
        elif mode == "urls-only":
            if output_file:
                # use JSON backend for file output in URL mode
                return JsonFileBackend(prefix=output_file, hierarchical=False)
            else:
                # use Redis backend for URL-only mode
                return create_redis_backend(retailer_id)
        # full mode
        else: 
            # supabase if available, otherwise json
            if SUPABASE_AVAILABLE:
                return create_supabase_backend()
            else:
                prefix = output_file or "product_crawl"
                return JsonFileBackend(prefix=prefix, hierarchical=False)
    
    else:
        raise ValueError(f"Unknown backend type: {backend_type}")

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

# test supabase connection
def test_supabase_connection():
    if not SUPABASE_AVAILABLE:
        return False, "Supabase backend not available"
    
    try:
        backend = create_supabase_backend()
        result = backend.supabase.table('retailers').select('id').limit(1).execute()
        return True, "Supabase connection successful"
    except Exception as e:
        return False, f"Supabase connection failed: {e}"

# main function
def main():
    parser = argparse.ArgumentParser(
        description="Unified crawler interface for multiple retailers with Supabase support",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --retailer amazon --mode full --output-backend supabase
  %(prog)s --retailer target --mode urls-only --category "Beverages" --output-backend json
  %(prog)s --retailer walmart --mode full --category "Snacks" --output-backend auto
  %(prog)s --retailer amazon --mode full --hierarchical --max-pages 5 --output-backend supabase
  %(prog)s --retailer target --mode urls-only --hierarchical --output hierarchy_urls --output-backend json
  %(prog)s --retailer walmart --department "Walmart Grocery" --hierarchical --output-backend auto
  %(prog)s --retailer amazon --from-hierarchy-file --mode full --concurrency 10 --output-backend supabase
  %(prog)s --list-retailers
  %(prog)s --test-supabase
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
        "--output-backend", "-b",
        choices=["supabase", "json", "redis", "auto"],
        default="auto",
        help="Output backend (default: auto - chooses best based on mode)"
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
        "--concurrency",
        type=int,
        default=5,
        help="Number of concurrent grid crawlers (default: 5, only applies to hierarchy file mode)"
    )
    
    parser.add_argument(
        "--output", "-o",
        help="Output file prefix (optional, only used with JSON backend)"
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
        
        print(f"\nAvailable output backends:")
        print(f"  supabase: Store data directly in Supabase database {'✓' if SUPABASE_AVAILABLE else '✗ (not installed)'}")
        print(f"  json: Store data in JSON files")
        print(f"  redis: Store URLs in Redis queue")
        print(f"  auto: Automatically choose best backend")
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
        success, message = test_supabase_connection()
        if success:
            print(f"✅ {message}")
        else:
            print(f"❌ {message}")
            sys.exit(1)
        return
    
    # validate required arguments
    if not args.retailer:
        parser.error("--retailer is required (use --list-retailers to see options)")
    
    # set up logging
    logger = setup_logging(args.log_level)
    
    try:
        # validate retailer
        validate_retailer(args.retailer)
        
        # get retailer configuration
        retailer_config = RETAILER_CONFIG[args.retailer]
        crawler_class = retailer_config["class"]
        retailer_id = retailer_config["retailer_id"]
        
        # create output backend
        backend = create_output_backend(
            backend_type=args.output_backend,
            mode=args.mode,
            retailer_id=retailer_id,
            hierarchical=args.hierarchical,
            output_file=args.output
        )
        
        logger.info(f"Using {type(backend).__name__} as output backend")
        
        # create crawler
        crawler = crawler_class(
            retailer_id=retailer_id,
            logger=logger,
            category=args.category,
            department=args.department,
            urls_only=(args.mode == "urls-only"),
            hierarchical=args.hierarchical,
            output_backend=backend
        )
        crawler.max_pages = args.max_pages
        crawler.concurrency = args.concurrency
        
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
            logger.info(f"Starting hierarchy file crawl with {args.concurrency} concurrent workers")
            if args.category:
                logger.info(f"Filtering to category: {args.category}")
            if args.department:
                logger.info(f"Filtering to department: {args.department}")
                
            crawler.crawl_from_hierarchy_file(
                hierarchy_file=hierarchy_file,
                max_pages_per_cat=args.max_pages,
                category_filter=args.category,
                department_filter=args.department,
                concurrency=args.concurrency
            )
        else:
            # regular mode (category/department based)
            crawler.crawl(max_pages_per_cat=args.max_pages)
            
        logger.info("Crawling completed successfully!")
            
    except Exception as e:
        logger.error(f"Crawler failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()