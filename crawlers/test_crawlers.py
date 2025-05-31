# backend/scraping/crawlers/test_crawlers.py

"""
USAGE:

in a terminal, run:

python -m backend.scraping.crawlers.test_crawlers

as well as any of the following optional arguments:

--category: the category to crawl (default: Marshmallows)
--max-pages: the maximum number of pages to crawl per category (default: 5)
--max-depth: the maximum depth for crawling (default: 5)
--hover-delay-min: the minimum hover delay in ms (default: 1000)
--hover-delay-max: the maximum hover delay in ms (default: 2000)
--grid-hover-delay-min: the minimum hover delay for grid in ms (default: 1000)
--grid-hover-delay-max: the maximum hover delay for grid in ms (default: 2000)
--concurrency: the number of concurrent crawlers (default: 3)
"""


# imports
import logging
import argparse
from .amazon.amazon_crawler import AmazonCrawler
from .amazon.subcrawlers.constants import (
    MAX_DEPTH, HOVER_DELAY_RANGE, CONCURRENCY,
    GRID_HOVER_DELAY_RANGE
)
from .target.target_crawler import TargetCrawler
from .target.subcrawlers.constants import (
    MAX_DEPTH, HOVER_DELAY_RANGE, CONCURRENCY,
    GRID_HOVER_DELAY_RANGE
)

# parse command line arguments
def parse_args():
    # setup argument parser
    parser = argparse.ArgumentParser(description='Test crawlers with configurable parameters')
    parser.add_argument('--category', type=str, default="Marshmallows",
                      help='Target category to crawl (default: Marshmallows)')
    parser.add_argument('--max-pages', type=int, default=5,
                      help='Maximum number of pages to crawl per category (default: 5)')
    
    # crawler configuration arguments
    parser.add_argument('--max-depth', type=int, default=MAX_DEPTH,
                      help=f'Maximum depth for crawling (default: {MAX_DEPTH})')
    parser.add_argument('--hover-delay-min', type=int, default=HOVER_DELAY_RANGE[0],
                      help=f'Minimum hover delay in ms (default: {HOVER_DELAY_RANGE[0]})')
    parser.add_argument('--hover-delay-max', type=int, default=HOVER_DELAY_RANGE[1],
                      help=f'Maximum hover delay in ms (default: {HOVER_DELAY_RANGE[1]})')
    parser.add_argument('--concurrency', type=int, default=CONCURRENCY,
                      help=f'Number of concurrent crawlers (default: {CONCURRENCY})')
    
    # grid crawler specific arguments
    parser.add_argument('--grid-hover-delay-min', type=int, default=GRID_HOVER_DELAY_RANGE[0],
                      help=f'Minimum hover delay for grid in ms (default: {GRID_HOVER_DELAY_RANGE[0]})')
    parser.add_argument('--grid-hover-delay-max', type=int, default=GRID_HOVER_DELAY_RANGE[1],
                      help=f'Maximum hover delay for grid in ms (default: {GRID_HOVER_DELAY_RANGE[1]})')
    
    # output arguments

    return parser.parse_args()

# * Test Amazon crawler
def test_amazon_crawler(category="Marshmallows", max_pages=5, crawler_config=None):
    # setup basic logging for testing
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
    logger = logging.getLogger("AmazonCrawlerTest")

    RETAILER_ID_AMAZON = 1
    
    # update crawler constants if config provided
    if crawler_config:
        from .amazon.subcrawlers.constants import update_constants
        update_constants(crawler_config)
    
    # test w/ specific category from config
    amazon_crawler = AmazonCrawler(
        retailer_id=RETAILER_ID_AMAZON,
        logger=logger,
        category=category
    )

    # run crawl
    amazon_crawler.crawl(max_pages_per_cat=max_pages)

# * Test Target crawler
def test_target_crawler(category="Crackers", max_pages=5, crawler_config=None):
    # setup basic logging for testing
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
    logger = logging.getLogger("TargetCrawlerTest")

    RETAILER_ID_TARGET = 2

    # update crawler constants if config provided
    if crawler_config:
        from .target.subcrawlers.constants import update_constants
        update_constants(crawler_config)

    # test w/ specific category from config (if provided)
    target_crawler = TargetCrawler(
        retailer_id=RETAILER_ID_TARGET,
        logger=logger,
        category=category
    )   

    # run crawl
    target_crawler.crawl(max_pages_per_cat=max_pages)

if __name__ == "__main__":
    args = parse_args()
    
    # create crawler configuration dictionary
    crawler_config = {
        'MAX_DEPTH': args.max_depth,
        'HOVER_DELAY_RANGE': (args.hover_delay_min, args.hover_delay_max),
        'CONCURRENCY': args.concurrency,
        'GRID_HOVER_DELAY_RANGE': (args.grid_hover_delay_min, args.grid_hover_delay_max)
    }
    
    # test amazon crawler
    test_amazon_crawler(
        category=args.category,
        max_pages=args.max_pages,
        crawler_config=crawler_config
    ) 

    # test target crawler
    test_target_crawler(
        category=args.category,
        max_pages=args.max_pages,
        crawler_config=crawler_config
    )