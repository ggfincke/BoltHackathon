"""
Giant Eagle UPC Filler Script

This script queries all products with UPCs from the database and attempts to 
create Giant Eagle listings by constructing URLs from UPCs and using the 
Giant Eagle scraper to check if products exist.

URL Pattern: https://www.gianteagle.com/settlers-ridge/search/product/{padded_upc}
where UPC is padded to 14 digits with leading zeros.

Example Usage:
    python scripts/giant_eagle_filler.py --max-products 100 --batch-size 100 --delay 0.5 --offset 0 --log-level DEBUG --dry-run
"""

import os
import sys
import logging
import time
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import argparse

# handle imports 
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, os.path.join(project_root, 'src'))

# imports
from crawlers.supabase_backend import SupabaseBackend, resolve_retailer_uuid
from scrapers.giant_eagle.ge_scraper import GiantEagleScraper

class GiantEagleFiller:
    def __init__(self, supabase_backend: SupabaseBackend, logger: logging.Logger, 
                 batch_size: int = 100, delay_between_requests: float = 2.0):
        self.backend = supabase_backend
        self.logger = logger
        self.batch_size = batch_size
        self.delay = delay_between_requests
        self.scraper = GiantEagleScraper(logger=logger)
        
        # Giant Eagle retailer UUID (Giant Eagle is retailer ID 4)
        self.ge_retailer_id = resolve_retailer_uuid(4)
        
        # stats tracking
        self.stats = {
            'total_upcs_processed': 0,
            'valid_urls_found': 0,
            'successful_listings_created': 0,
            'failed_scrapes': 0,
            'skipped_existing_listings': 0,
            'errors': 0
        }
        
        self.start_time = datetime.now()

    # construct giant eagle url from upc
    def construct_giant_eagle_url(self, upc: str) -> str:
        # clean UPC (remove any non-digit characters; shouldn't be needed, but just in case)
        clean_upc = ''.join(filter(str.isdigit, upc))
        
        # pad to 14 digits with leading zeros
        padded_upc = clean_upc.zfill(14)
        
        return f"https://www.gianteagle.com/settlers-ridge/search/product/{padded_upc}"

    # get products with upcs
    def get_products_with_upcs(self, limit: int = None, offset: int = 0) -> List[Dict]:
        """Fetch products that have UPCs using paginated (blocking) requests.

        Supabase/PostgREST caps any single request to 1 000 rows.  This helper
        mirrors the pagination logic from `scripts/update.py`, retrieving data
        in 1 000-row blocks so we never exceed that limit.  It still honours the
        caller-supplied *limit* (if provided) as well as the instance
        *batch_size* when *limit* is None.
        """

        try:
            base_query = (
                self.backend.supabase.table('products')
                .select('id, name, slug, upc')
                .not_.is_('upc', 'null')
                .neq('upc', '')
                .eq('is_active', True)
                .order('created_at')
            )

            PAGE_SIZE = 1000  # PostgREST hard cap per request

            rows: List[Dict] = []
            remaining = limit  # None means "no explicit limit – fetch as needed"
            current_offset = offset

            while True:
                # determine how many rows to request in this page
                if remaining is not None:
                    if remaining <= 0:
                        break
                    fetch_size = min(PAGE_SIZE, remaining)
                else:
                    # honour self.batch_size but never exceed page size cap
                    fetch_size = min(PAGE_SIZE, self.batch_size)

                # PostgREST ranges are inclusive
                page_query = base_query.range(current_offset, current_offset + fetch_size - 1)

                result = page_query.execute()

                if not result.data:
                    # no more rows available
                    break

                rows.extend(result.data)

                # if we received fewer rows than requested, we've reached the end
                if len(result.data) < fetch_size:
                    break

                # prepare for next page
                current_offset += fetch_size
                if remaining is not None:
                    remaining -= fetch_size

            # safety: trim any over-fetch in the last page
            if limit is not None and len(rows) > limit:
                rows = rows[:limit]

            return rows

        except Exception as e:
            self.logger.error(f"Error fetching products with UPCs: {e}")
            return []

    # check if a giant eagle listing already exists for this product
    def check_existing_listing(self, product_id: str) -> bool:
        try:
            result = self.backend.supabase.table('listings')\
                .select('id')\
                .eq('product_id', product_id)\
                .eq('retailer_id', self.ge_retailer_id)\
                .limit(1)\
                .execute()
            
            return len(result.data) > 0 if result.data else False
            
        except Exception as e:
            self.logger.error(f"Error checking existing listing for product {product_id}: {e}")
            # assume it exists to avoid duplicates on error
            return True

    # create a new listing from scraped giant eagle data
    def create_listing_from_scraped_data(self, product_id: str, scraped_data: Dict) -> bool:
        # create listing data
        try:
            listing_data = {
                'product_id': product_id,
                'retailer_id': self.ge_retailer_id,
                'url': scraped_data['url'],
                'price': float(scraped_data['price']) if scraped_data.get('price') else None,
                'currency': 'USD',
                'in_stock': scraped_data.get('in_stock', True),
                'image_url': scraped_data.get('image_url'),
                'rating': float(scraped_data['rating']) if scraped_data.get('rating') else None,
                'review_count': int(scraped_data['review_count']) if scraped_data.get('review_count') else None,
                'upc': scraped_data.get('upc'),
                'availability_status': 'in_stock' if scraped_data.get('in_stock', True) else 'out_of_stock',
                'last_checked': datetime.now().isoformat()
            }
            
            # remove None values
            listing_data = {k: v for k, v in listing_data.items() if v is not None}
            
            result = self.backend.supabase.table('listings').insert(listing_data).execute()
            
            if result.data:
                listing_id = result.data[0]['id']
                self.logger.info(f"✓ Created Giant Eagle listing {listing_id} for product {product_id}")
                
                # add price history if price exists
                if listing_data.get('price'):
                    price_history_data = {
                        'listing_id': listing_id,
                        'price': listing_data['price'],
                        'currency': 'USD',
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    self.backend.supabase.table('price_histories').insert(price_history_data).execute()
                
                return True
            else:
                self.logger.error(f"Failed to create listing for product {product_id}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error creating listing for product {product_id}: {e}")
            return False

    # process a single product: construct URL, scrape, and create listing if product exists
    def process_product(self, product: Dict) -> bool:
        # get product id, name, upc
        product_id = product['id']
        product_name = product['name']
        upc = product['upc']
        
        try:
            # check if listing already exists
            if self.check_existing_listing(product_id):
                self.logger.debug(f"Skipping {product_name} - Giant Eagle listing already exists")
                self.stats['skipped_existing_listings'] += 1
                return True
            
            # construct giant eagle url
            ge_url = self.construct_giant_eagle_url(upc)
            self.logger.info(f"Checking Giant Eagle for: {product_name} (UPC: {upc})")
            self.logger.debug(f"Giant Eagle URL: {ge_url}")
            
            # scrape product
            scraped_data = self.scraper.scrape_product(ge_url)
            
            if scraped_data and scraped_data.get('name'):
                self.logger.info(f"✓ Found on Giant Eagle: {scraped_data['name']}")
                self.stats['valid_urls_found'] += 1
                
                # create listing
                if self.create_listing_from_scraped_data(product_id, scraped_data):
                    self.stats['successful_listings_created'] += 1
                else:
                    self.stats['errors'] += 1
                    
            else:
                self.logger.debug(f"Product not found on Giant Eagle: {product_name}")
                self.stats['failed_scrapes'] += 1
            
            # add delay b/w requests
            time.sleep(self.delay)
            return True
            
        except Exception as e:
            self.logger.error(f"Error processing product {product_name}: {e}")
            self.stats['errors'] += 1
            return False

    # run filler
    def run_filler(self, max_products: int = None, start_offset: int = 0) -> Dict:
        # logging
        self.logger.info("🛒 Starting Giant Eagle UPC Filler")
        self.logger.info(f"Batch size: {self.batch_size}, Delay: {self.delay}s")
        
        # process max products or all products
        if max_products:
            self.logger.info(f"Processing max {max_products} products starting from offset {start_offset}")
        else:
            self.logger.info(f"Processing all products starting from offset {start_offset}")
        
        # init counters
        processed_count = 0
        current_offset = start_offset
        
        try:
            # process products
            while True:
                # get batch of products
                limit = None
                if max_products:
                    remaining = max_products - processed_count
                    if remaining <= 0:
                        break
                    limit = min(self.batch_size, remaining)
                
                products = self.get_products_with_upcs(limit=limit, offset=current_offset)
                
                if not products:
                    self.logger.info("No more products to process")
                    break
                
                self.logger.info(f"Processing batch of {len(products)} products (offset: {current_offset})")
                
                # process each product in the batch
                for product in products:
                    self.process_product(product)
                    self.stats['total_upcs_processed'] += 1
                    processed_count += 1
                
                current_offset += len(products)
                
                # print progress every 10 batches
                if (current_offset // self.batch_size) % 10 == 0:
                    self.print_progress()
                
                # break if we've processed all requested products
                if max_products and processed_count >= max_products:
                    break
                    
        except KeyboardInterrupt:
            self.logger.info("Process interrupted by user")
        except Exception as e:
            self.logger.error(f"Unexpected error in filler process: {e}")
            self.stats['errors'] += 1
        
        finally:
            self.scraper.close_driver()
        
        return self.get_final_stats()

    # print progress
    def print_progress(self):
        # print current processing statistics
        elapsed = datetime.now() - self.start_time
        self.logger.info(f"Progress - Processed: {self.stats['total_upcs_processed']}, "
                        f"Found: {self.stats['valid_urls_found']}, "
                        f"Created: {self.stats['successful_listings_created']}, "
                        f"Elapsed: {elapsed}")

    # get final stats
    def get_final_stats(self) -> Dict:
        elapsed = datetime.now() - self.start_time
        
        stats = self.stats.copy()
        stats.update({
            'elapsed_time': str(elapsed),
            'success_rate': (self.stats['successful_listings_created'] / max(1, self.stats['total_upcs_processed'])) * 100,
            'found_rate': (self.stats['valid_urls_found'] / max(1, self.stats['total_upcs_processed'])) * 100
        })
        
        return stats

    # print final summary
    def print_final_summary(self):
        stats = self.get_final_stats()
        elapsed = datetime.now() - self.start_time
        
        self.logger.info("\n" + "="*60)
        self.logger.info("🛒 GIANT EAGLE FILLER SUMMARY")
        self.logger.info("="*60)
        self.logger.info(f"Total UPCs Processed:     {stats['total_upcs_processed']}")
        self.logger.info(f"Products Found on GE:     {stats['valid_urls_found']}")
        self.logger.info(f"Listings Created:         {stats['successful_listings_created']}")
        self.logger.info(f"Failed Scrapes:           {stats['failed_scrapes']}")
        self.logger.info(f"Existing Listings Skipped: {stats['skipped_existing_listings']}")
        self.logger.info(f"Errors:                   {stats['errors']}")
        self.logger.info(f"Success Rate:             {stats['success_rate']:.1f}%")
        self.logger.info(f"Found Rate:               {stats['found_rate']:.1f}%")
        self.logger.info(f"Total Time:               {elapsed}")
        self.logger.info("="*60)

# main
def main():
    # arg parser
    parser = argparse.ArgumentParser(description="Giant Eagle UPC Filler Script")
    parser.add_argument('--max-products', type=int, help='Maximum number of products to process')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for processing')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests (seconds)')
    parser.add_argument('--offset', type=int, default=0, help='Starting offset for product queries')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='Logging level')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be processed without scraping')
    
    args = parser.parse_args()
    
    # setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'giant_eagle_filler_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        ]
    )
    logger = logging.getLogger(__name__)
    
    try:
        # init supabase backend (disable upc lookup for this script)
        backend = SupabaseBackend(enable_upc_lookup=False)
        
        # init filler
        filler = GiantEagleFiller(
            supabase_backend=backend,
            logger=logger,
            batch_size=args.batch_size,
            delay_between_requests=args.delay
        )
        
        if args.dry_run:
            logger.info("DRY RUN: Showing products that would be processed")
            products = filler.get_products_with_upcs(limit=min(10, args.max_products or 10))
            for product in products:
                ge_url = filler.construct_giant_eagle_url(product['upc'])
                logger.info(f"Would process: {product['name']} (UPC: {product['upc']}) -> {ge_url}")
            return
        
        # run filler
        stats = filler.run_filler(max_products=args.max_products, start_offset=args.offset)
        filler.print_final_summary()
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 