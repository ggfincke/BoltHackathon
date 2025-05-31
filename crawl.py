"""
Crawler Command Line Interface

This script provides a unified interface to run different retailer crawlers
with various configurations and output modes.

Usage:
    python crawl.py --retailer amazon --mode full
    python crawl.py --retailer target --mode urls-only --category "Beverages"
    python crawl.py --retailer amazon --mode full --hierarchical --max-pages 10
"""

import argparse
import logging
import sys
import os
from pathlib import Path

# add the crawlers directory to the Python path
sys.path.append(str(Path(__file__).parent / "crawlers"))

# import crawler classes
from crawlers.amazon.amazon_crawler import AmazonCrawler
from crawlers.target.target_crawler import TargetCrawler
from crawlers.base_crawler import (
    JsonFileBackend, 
    create_redis_backend,
    create_redis_client
)

# retailer configurations
RETAILER_CONFIG = {
    "amazon": {
        "class": AmazonCrawler,
        "retailer_id": 1,
        "description": "Amazon product crawler"
    },
    "target": {
        "class": TargetCrawler,
        "retailer_id": 2,
        "description": "Target product crawler"
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

# create output backend
def create_output_backend(mode: str, retailer_id: int, hierarchical: bool = False, output_file: str = None):
    if hierarchical:
        # hierarchical structure always uses JSON backend
        prefix = output_file or "hierarchical_crawl"
        return JsonFileBackend(prefix=prefix, hierarchical=True)
    elif mode == "urls-only":
        if output_file:
            # use JSON backend for file output in URL mode
            return JsonFileBackend(prefix=output_file, hierarchical=False)
        else:
            # use Redis backend for URL-only mode
            return create_redis_backend(retailer_id)
    # full mode (default)
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

def main():
    parser = argparse.ArgumentParser(
        description="Unified crawler interface for multiple retailers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --retailer amazon --mode full
  %(prog)s --retailer target --mode urls-only --category "Beverages"
  %(prog)s --retailer amazon --mode full --hierarchical --max-pages 5
  %(prog)s --retailer target --mode urls-only --hierarchical --output hierarchy_urls
  %(prog)s --list-retailers
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
        "--hierarchical",
        action="store_true",
        help="Build hierarchical category structure (works with both modes)"
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
        "--output", "-o",
        help="Output file prefix (optional)"
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
    
    args = parser.parse_args()
    
    # handle utility commands
    if args.list_retailers:
        print("Available retailers:")
        for retailer, config in RETAILER_CONFIG.items():
            print(f"  {retailer}: {config['description']} (ID: {config['retailer_id']})")
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
        output_backend = create_output_backend(args.mode, retailer_id, args.hierarchical, args.output)
        
        # determine crawler options
        urls_only = args.mode == "urls-only"
        hierarchical = args.hierarchical
        
        mode_desc = f"{args.mode} mode"
        if hierarchical:
            mode_desc += " with hierarchical structure"
        
        logger.info(f"Starting {args.retailer} crawler in {mode_desc}")
        if args.category:
            logger.info(f"Target category: {args.category}")
        logger.info(f"Max pages per category: {args.max_pages}")
        
        # create & run crawler
        crawler = crawler_class(
            retailer_id=retailer_id,
            logger=logger,
            category=args.category,
            output_backend=output_backend,
            urls_only=urls_only,
            hierarchical=hierarchical
        )
        
        # run crawl
        crawler.crawl(
            max_pages_per_cat=args.max_pages,
            category_filter=args.category
        )
        
        logger.info("Crawl completed successfully")
        
    except KeyboardInterrupt:
        logger.info("Crawl interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Crawl failed: {e}", exc_info=args.log_level == "DEBUG")
        sys.exit(1)

if __name__ == "__main__":
    main() 