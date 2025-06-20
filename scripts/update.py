"""
Update Script

This script updates existing product listings by calling scrapers on products 
from Supabase and updating listings with fresh data from the scrapers.
Also updates live prices and inserts new entries into price history.

Example Usage:
    python scripts/update.py --retailer amazon --max-products 100
    python scripts/update.py --retailer target --category "Beverages" --max-products 50
    python scripts/update.py --retailer walmart --brand "Coca-Cola" --days-since-update 7
    python scripts/update.py --retailer amazon --product-id "12345678-1234-1234-1234-123456789012"
    python scripts/update.py --all-retailers --max-products 25 --priority-only
    python scripts/update.py --retailer target --stale-only --days-since-update 3
    python scripts/update.py --retailer amazon --priority-only --max-products 200
    python scripts/update.py --all-retailers --priority-only --track-only

Normal usage:
    python scripts/update.py --retailer amazon
    python scripts/update.py --retailer target
    python scripts/update.py --retailer walmart
"""

import sys
import os
import argparse
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from dotenv import load_dotenv
from decimal import Decimal
import re

# load environment variables
load_dotenv(override=True)

# add src dir to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src'))

# import required modules
from supabase import create_client
from scrapers import AmazonScraper, TargetScraper, WalmartScraper

# create a slug from a product name
def create_slug(name: str) -> str:
    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = slug.strip('-')
    return slug[:255]

class ProductUpdater:
    def __init__(self, supabase_client, logger: logging.Logger, scraper_concurrency: int = 5):
        self.supabase = supabase_client
        self.logger = logger
        self.scraper_concurrency = scraper_concurrency
        
        # init scrapers
        self.scrapers = {
            'amazon': AmazonScraper(),
            'target': TargetScraper(), 
            'walmart': WalmartScraper()
        }
        
        # stats tracking
        self.stats = {
            'total_processed': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'price_changes': 0,
            'new_price_histories': 0,
            'no_change': 0
        }

    # close scrapers
    def close_scrapers(self):
        for scraper in self.scrapers.values():
            try:
                scraper.close_driver()
            except Exception:
                pass

    # clone a product w/ a new UPC (used for UPC reconciliation)
    # TODO: should be removed once we have a better way to handle UPCs
    def _clone_product_with_new_upc(self, product_id: str, upc: str) -> Optional[str]:
        try:
            prod_result = self.supabase.table('products').select('*').eq('id', product_id).execute()
            if not prod_result.data:
                self.logger.error(f"Could not fetch product {product_id} for cloning")
                return None

            prod = prod_result.data[0]
            new_data = {
                'name': prod['name'],
                'slug': create_slug(f"{prod['name']}-{upc}"),
                'description': prod.get('description'),
                'brand_id': prod.get('brand_id'),
                'weight': prod.get('weight'),
                'dimensions': prod.get('dimensions'),
                'upc': upc,
                'is_active': True
            }

            insert_res = self.supabase.table('products').insert(new_data).execute()
            if not insert_res.data:
                self.logger.error("Failed to insert cloned product")
                return None

            new_id = insert_res.data[0]['id']

            # copy category assignments
            cat_result = self.supabase.table('product_categories').select('category_id,is_primary').eq('product_id', product_id).execute()
            if cat_result.data:
                for cat in cat_result.data:
                    try:
                        self.supabase.table('product_categories').insert({
                            'product_id': new_id,
                            'category_id': cat['category_id'],
                            'is_primary': cat.get('is_primary', False)
                        }).execute()
                    except Exception as e:
                        self.logger.error(f"Error copying category {cat['category_id']} to cloned product: {e}")

            return new_id
        except Exception as e:
            self.logger.error(f"Error cloning product {product_id}: {e}")
            return None

    # get products to update (from supabase)
    def get_products_to_update(self, 
                             retailer: Optional[str] = None,
                             category: Optional[str] = None,
                             brand: Optional[str] = None,
                             product_id: Optional[str] = None,
                             max_products: int = 100,
                             days_since_update: int = 1,
                             stale_only: bool = False,
                             priority_only: bool = False,
                             track_only: bool = False) -> List[Dict]:
        self.logger.info("querying products for update...")
        
        try:
            # build base query
            query = self.supabase.table('listings').select('''
                id,
                product_id,
                retailer_id,
                url,
                price,
                updated_at,
                product:products(id, name, slug, upc),
                retailer:retailers(id, name, slug)
            ''')
            
            # apply filters
            if product_id:
                query = query.eq('product_id', product_id)
            
            if retailer:
                # get retailer ID first
                retailer_result = self.supabase.table('retailers').select('id').eq('slug', retailer).execute()
                if retailer_result.data:
                    retailer_id = retailer_result.data[0]['id']
                    query = query.eq('retailer_id', retailer_id)
                else:
                    self.logger.error(f"Retailer '{retailer}' not found")
                    return []
            
            if category:
                # join w/ product categories to filter by category
                category_result = self.supabase.table('categories').select('id').ilike('name', f'%{category}%').execute()
                if category_result.data:
                    category_ids = [cat['id'] for cat in category_result.data]
                    # get products in these categories
                    product_cat_result = self.supabase.table('product_categories').select('product_id').in_('category_id', category_ids).execute()
                    if product_cat_result.data:
                        product_ids = [pc['product_id'] for pc in product_cat_result.data]
                        query = query.in_('product_id', product_ids)
                    else:
                        self.logger.warning(f"No products found in category '{category}'")
                        return []
                else:
                    self.logger.error(f"Category '{category}' not found")
                    return []
            
            if brand:
                # join w/ brands to filter by brand
                brand_result = self.supabase.table('brands').select('id').ilike('name', f'%{brand}%').execute()
                if brand_result.data:
                    brand_ids = [b['id'] for b in brand_result.data]
                    # get products w/ these brands
                    product_result = self.supabase.table('products').select('id').in_('brand_id', brand_ids).execute()
                    if product_result.data:
                        product_ids = [p['id'] for p in product_result.data]
                        query = query.in_('product_id', product_ids)
                    else:
                        self.logger.warning(f"No products found for brand '{brand}'")
                        return []
                else:
                    self.logger.error(f"Brand '{brand}' not found")
                    return []
            
            # apply stale only filter
            if stale_only:
                # only get listings that haven't been updated in X days
                cutoff_date = (datetime.now() - timedelta(days=days_since_update)).isoformat()
                query = query.lt('updated_at', cutoff_date)
            
            # apply priority only filter
            if priority_only:
                # priority products - those w/ recent price history activity or user tracking; for now prioritizing products updated in the last 30 days
                recent_date = (datetime.now() - timedelta(days=30)).isoformat()
                query = query.gte('updated_at', recent_date)
            
            # apply track only filter
            if track_only:
                # only products that are being tracked by users (have baskets or alerts); eventually need to join w/ user_baskets
                pass
            
            # apply limit & ordering
            query = query.order('updated_at', desc=False).limit(max_products)
            
            # execute query
            result = query.execute()
            
            if result.data:
                self.logger.info(f"Found {len(result.data)} products to update")
                return result.data
            else:
                self.logger.warning("No products found matching criteria")
                return []
                
        except Exception as e:
            self.logger.error(f"Error querying products: {e}")
            return []

    # update a single listing using appropriate scraper
    async def update_single_listing(self, listing: Dict) -> bool:
        try:
            listing_id = listing['id']
            product_name = listing['product']['name'] if listing['product'] else 'Unknown'
            retailer_slug = listing['retailer']['slug'] if listing['retailer'] else 'unknown'
            url = listing['url']
            current_price = listing['price']
            
            self.logger.info(f"Updating {retailer_slug} listing for: {product_name}")
            
            # get appropriate scraper
            if retailer_slug not in self.scrapers:
                self.logger.error(f"No scraper available for retailer: {retailer_slug}")
                return False
            
            scraper = self.scrapers[retailer_slug]
            
            # scrape fresh data
            scraped_data = scraper.scrape_product(url)
            
            if not scraped_data:
                self.logger.warning(f"Failed to scrape data for {url}")
                self.stats['failed_updates'] += 1
                return False
            
            # extract updated fields
            new_price = scraped_data.get('price')
            new_title = scraped_data.get('title')
            new_rating = scraped_data.get('rating')
            new_review_count = scraped_data.get('review_count')
            new_availability = scraped_data.get('availability', 'in_stock')
            new_image_url = scraped_data.get('images', [None])[0]
            new_upc = scraped_data.get('upc')
            
            # prepare update data
            update_data = {
                'updated_at': datetime.now().isoformat()
            }
            
            # only update fields that have values
            if new_title:
                update_data['title'] = new_title
            if new_rating:
                update_data['rating'] = float(new_rating)
            if new_review_count:
                update_data['review_count'] = int(new_review_count)
            if new_availability:
                update_data['availability_status'] = new_availability
            if new_image_url:
                update_data['image_url'] = new_image_url

            # handle UPC reconciliation
            existing_upc = listing['product'].get('upc') if listing.get('product') else None
            if new_upc and new_upc != existing_upc:
                # check how many listings reference this product
                listing_count_res = self.supabase.table('listings').select('id').eq('product_id', listing['product_id']).execute()
                listing_count = len(listing_count_res.data) if listing_count_res.data else 0

                if listing_count > 1:
                    # create new product and move listing
                    new_product_id = self._clone_product_with_new_upc(listing['product_id'], new_upc)
                    if new_product_id:
                        update_data['product_id'] = new_product_id
                        update_data['upc'] = new_upc
                        listing['product_id'] = new_product_id
                        self.logger.info(f"Created new product {new_product_id} for UPC {new_upc}")
                else:
                    # update product UPC in place
                    try:
                        self.supabase.table('products').update({'upc': new_upc}).eq('id', listing['product_id']).execute()
                        update_data['upc'] = new_upc
                        self.logger.info(f"Updated UPC for product {listing['product_id']} to {new_upc}")
                    except Exception as e:
                        self.logger.error(f"Failed to update UPC for product {listing['product_id']}: {e}")
            elif new_upc:
                update_data['upc'] = new_upc
            
            # handle price update
            price_changed = False
            if new_price:
                try:
                    # parse new price
                    if isinstance(new_price, str):
                        new_price_value = float(new_price.replace('$', '').replace(',', ''))
                    else:
                        new_price_value = float(new_price)
                    
                    update_data['price'] = new_price_value
                    
                    # check if price changed
                    if current_price:
                        old_price = float(current_price)
                        # price change
                        if abs(new_price_value - old_price) > 0.01:
                            price_changed = True
                            self.stats['price_changes'] += 1
                            self.logger.info(f"Price changed: ${old_price:.2f} → ${new_price_value:.2f}")
                    else:
                        # first time we have a price
                        price_changed = True
                        
                except (ValueError, TypeError) as e:
                    self.logger.warning(f"Could not parse price '{new_price}': {e}")
            
            # update listing in database
            try:
                self.supabase.table('listings').update(update_data).eq('id', listing_id).execute()
                self.logger.debug(f"Successfully updated listing {listing_id}")
            except Exception as e:
                self.logger.error(f"Failed to update listing {listing_id}: {e}")
                self.stats['failed_updates'] += 1
                return False
            
            # insert price history if price changed or this is a significant update
            if price_changed and new_price:
                price_history_data = {
                    'listing_id': listing_id,
                    'price': new_price_value,
                    'timestamp': datetime.now().isoformat()
                }
                
                history_result = self.supabase.table('price_histories').insert(price_history_data).execute()
                
                if history_result.data:
                    self.stats['new_price_histories'] += 1
                    self.logger.info(f"Added price history entry: ${new_price_value:.2f}")
                else:
                    self.logger.warning(f"Failed to insert price history for listing {listing_id}")
            
            if price_changed:
                self.stats['successful_updates'] += 1
            else:
                self.stats['no_change'] += 1
                
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating listing {listing.get('id', 'unknown')}: {e}")
            self.stats['failed_updates'] += 1
            return False

    # update multiple listings w/ concurrency control
    async def update_listings_batch(self, listings: List[Dict]) -> None:
        semaphore = asyncio.Semaphore(self.scraper_concurrency)
        
        async def update_with_semaphore(listing):
            async with semaphore:
                return await self.update_single_listing(listing)
        
        tasks = [update_with_semaphore(listing) for listing in listings]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # count results
        for result in results:
            self.stats['total_processed'] += 1
            if isinstance(result, Exception):
                self.logger.error(f"Task failed with exception: {result}")
                self.stats['failed_updates'] += 1

    # print update summary statistics
    def print_summary(self):
        self.logger.info("="*50)
        self.logger.info("UPDATE SUMMARY")
        self.logger.info("="*50)
        self.logger.info(f"Total processed: {self.stats['total_processed']}")
        self.logger.info(f"Successful updates: {self.stats['successful_updates']}")
        self.logger.info(f"Failed updates: {self.stats['failed_updates']}")
        self.logger.info(f"No changes: {self.stats['no_change']}")
        self.logger.info(f"Price changes detected: {self.stats['price_changes']}")
        self.logger.info(f"New price history entries: {self.stats['new_price_histories']}")
        
        if self.stats['total_processed'] > 0:
            success_rate = (self.stats['successful_updates'] / self.stats['total_processed']) * 100
            self.logger.info(f"Success rate: {success_rate:.1f}%")

async def main():
    parser = argparse.ArgumentParser(description="Update existing product listings with fresh scraper data")
    
    # retailer selection
    parser.add_argument(
        "--retailer", "-r",
        choices=["amazon", "target", "walmart"],
        help="Specific retailer to update (optional)"
    )
    
    parser.add_argument(
        "--all-retailers",
        action="store_true",
        help="Update products from all retailers"
    )
    
    # filtering options
    parser.add_argument(
        "--category", "-c",
        help="Filter by category name (optional)"
    )
    
    parser.add_argument(
        "--brand", "-b",
        help="Filter by brand name (optional)"
    )
    
    parser.add_argument(
        "--product-id",
        help="Update specific product by ID (optional)"
    )
    
    # update behavior
    parser.add_argument(
        "--max-products", "-p",
        type=int,
        default=100,
        help="Maximum number of products to update (default: 100)"
    )
    
    parser.add_argument(
        "--days-since-update",
        type=int,
        default=1,
        help="Only update products not updated in X days (default: 1)"
    )
    
    parser.add_argument(
        "--stale-only",
        action="store_true",
        help="Only update products that haven't been updated recently"
    )
    
    parser.add_argument(
        "--priority-only",
        action="store_true",
        help="Only update high-priority products (recently active)"
    )
    
    parser.add_argument(
        "--track-only",
        action="store_true",
        help="Only update products being tracked by users"
    )
    
    # performance options
    parser.add_argument(
        "--scraper-concurrency",
        type=int,
        default=5,
        help="Number of concurrent scrapers (default: 5)"
    )
    
    # supabase configuration
    parser.add_argument(
        "--supabase-url",
        help="Supabase project URL (can also be set via SUPABASE_URL env var)"
    )
    
    parser.add_argument(
        "--supabase-key",
        help="Supabase API key (can also be set via SUPABASE_ANON_KEY env var)"
    )
    
    parser.add_argument(
        "--log-level", "-l",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be updated without making changes"
    )

    args = parser.parse_args()
    
    # setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    # validate arguments
    if not args.retailer and not args.all_retailers:
        logger.error("Must specify either --retailer or --all-retailers")
        sys.exit(1)
    
    if args.retailer and args.all_retailers:
        logger.error("Cannot specify both --retailer and --all-retailers")
        sys.exit(1)
    
    # setup supabase
    supabase_url = args.supabase_url or os.getenv('SUPABASE_URL')
    supabase_key = args.supabase_key or os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL and API key must be provided via arguments or environment variables")
        sys.exit(1)
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # init updater
    updater = ProductUpdater(supabase, logger, args.scraper_concurrency)
    
    # determine retailers to process
    retailers_to_process = []
    if args.all_retailers:
        retailers_to_process = ['amazon', 'target', 'walmart']
    else:
        retailers_to_process = [args.retailer]
    
    # process each retailer
    for retailer in retailers_to_process:
        logger.info(f"Processing retailer: {retailer}")
        
        # get products to update
        products = updater.get_products_to_update(
            retailer=retailer,
            category=args.category,
            brand=args.brand,
            product_id=args.product_id,
            max_products=args.max_products,
            days_since_update=args.days_since_update,
            stale_only=args.stale_only,
            priority_only=args.priority_only,
            track_only=args.track_only
        )
        
        if not products:
            logger.info(f"No products found for {retailer}")
            continue
        
        if args.dry_run:
            logger.info(f"DRY RUN: Would update {len(products)} products for {retailer}")
            # show first 5 products
            for product in products[:5]:
                product_name = product['product']['name'] if product['product'] else 'Unknown'
                logger.info(f"  - {product_name} (ID: {product['id']})")
            if len(products) > 5:
                logger.info(f"  ... and {len(products) - 5} more")
            continue
        
        # update products
        logger.info(f"Updating {len(products)} products for {retailer}")
        await updater.update_listings_batch(products)
    
    # print final summary and clean up
    updater.print_summary()
    updater.close_scrapers()

if __name__ == "__main__":
    asyncio.run(main())