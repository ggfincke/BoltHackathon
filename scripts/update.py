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
    python scripts/update.py --retailer amazon --all
    python scripts/update.py --retailer target --use-safari --all
    python scripts/update.py --retailer walmart --scraper-concurrency 1 --all

With logging:
    python scripts/update.py --retailer amazon --all --log-file logs/update_amazon.log
    python scripts/update.py --all-retailers --priority-only --log-file logs/priority_update.log --log-level DEBUG
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
from collections import defaultdict

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

# setup logging
def setup_logging(log_level: str, log_file: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger(__name__)
    logger.setLevel(getattr(logging, log_level))
    
    # clear any existing handlers
    logger.handlers.clear()
    
    # create formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # console handler (always present)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level))
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # file handler (optional)
    if log_file:
        # ensure log directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
        file_handler.setLevel(getattr(logging, log_level))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        logger.info(f"Logging to file: {log_file}")
    
    return logger

# product updater
class ProductUpdater:
    def __init__(self, supabase_client, logger: logging.Logger, scraper_concurrency: int = 1, use_safari: bool = False, validate_upcs: bool = True, log_file: Optional[str] = None):
        self.supabase = supabase_client
        self.logger = logger
        self.scraper_concurrency = scraper_concurrency
        self.use_safari = use_safari
        self.validate_upcs = validate_upcs
        self.log_file = log_file
        
        # safari driver allows only one concurrent session per machine
        if self.use_safari and self.scraper_concurrency > 1:
            self.logger.warning("Safari driver supports only one concurrent session; reducing scraper_concurrency to 1")
            self.scraper_concurrency = 1
        
        # scraper classes (not instances) - instances will be created per worker (TODO: move to scraper module)
        self.scraper_classes = {
            'amazon': AmazonScraper,
            'target': TargetScraper, 
            'walmart': WalmartScraper
        }
        
        # store scraper instances for cleanup (will be populated during execution)
        self.active_scrapers = []

        # enhanced stats tracking
        self.stats = {
            'total_processed': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'price_changes': 0,
            'new_price_histories': 0,
            'no_change': 0,
            # new UPC-related stats
            'upc_consolidations': 0,
            'upc_updates_in_place': 0,
            'new_products_for_upc': 0,
            'products_merged': 0,
            'listings_consolidated': 0,
            'invalid_upcs_skipped': 0
        }
        
        # track execution details for final summary
        self.execution_start = datetime.now()
        self.processed_listings = []
        self.errors = []

    # close scrapers (TODO: move to scraper module)
    def close_scrapers(self):
        for scraper in self.active_scrapers:
            try:
                scraper.close_driver()
            except Exception:
                pass
        self.active_scrapers.clear()

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

    # validate UPC format & checksum
    def _validate_upc(self, upc: str) -> bool:
        if not upc or not isinstance(upc, str):
            return False
        
        # remove any non-digit characters
        upc_digits = ''.join(filter(str.isdigit, upc))
        
        # UPC-A should be 12 digits, UPC-E should be 8 digits (TODO: add support for UPC-E)
        if len(upc_digits) not in [8, 12]:
            return False
        
        # for UPC-A (12 digits), validate checksum
        if len(upc_digits) == 12:
            try:
                # calc checksum
                odd_sum = sum(int(upc_digits[i]) for i in range(0, 11, 2))
                even_sum = sum(int(upc_digits[i]) for i in range(1, 11, 2))
                checksum = (10 - ((odd_sum * 3 + even_sum) % 10)) % 10
                return checksum == int(upc_digits[11])
            except (ValueError, IndexError):
                return False
        
        # for UPC-E (8 digits), basic format validation
        return True

    # create a new product w/ UPC
    def _create_product_with_upc(self, base_product: Dict, upc: str) -> Optional[str]:
        try:
            new_data = {
                'name': base_product['name'],
                'slug': create_slug(f"{base_product['name']}-{upc}"),
                'description': base_product.get('description'),
                'brand_id': base_product.get('brand_id'),
                'weight': base_product.get('weight'),
                'dimensions': base_product.get('dimensions'),
                'upc': upc,
                'is_active': True
            }

            insert_res = self.supabase.table('products').insert(new_data).execute()
            if not insert_res.data:
                self.logger.error("Failed to insert new product with UPC")
                return None

            new_id = insert_res.data[0]['id']

            # copy category assignments
            cat_result = self.supabase.table('product_categories').select('category_id,is_primary').eq('product_id', base_product['id']).execute()
            if cat_result.data:
                for cat in cat_result.data:
                    try:
                        self.supabase.table('product_categories').insert({
                            'product_id': new_id,
                            'category_id': cat['category_id'],
                            'is_primary': cat.get('is_primary', False)
                        }).execute()
                    except Exception as e:
                        self.logger.error(f"Error copying category {cat['category_id']} to new product: {e}")

            self.stats['new_products_for_upc'] += 1
            return new_id
        except Exception as e:
            self.logger.error(f"Error creating product with UPC {upc}: {e}")
            return None

    # handle UPC reconciliation (consolidate products with same UPC)
    def _handle_upc_reconciliation(self, listing: Dict, new_upc: str) -> Dict[str, Any]:
        update_data = {}
        
        if not new_upc:
            return update_data
        
        # validate UPC if validation is enabled 
        if self.validate_upcs and not self._validate_upc(new_upc):
            self.logger.warning(f"Invalid UPC format: {new_upc}, skipping UPC update")
            self.stats['invalid_upcs_skipped'] += 1
            return update_data
        
        existing_upc = listing['product'].get('upc') if listing.get('product') else None
        
        # if UPC hasn't changed, no action needed
        if new_upc == existing_upc:
            return update_data
        
        # check if another product already has this UPC
        existing_product_result = self.supabase.table('products').select('id,name').eq('upc', new_upc).execute()
        
        if existing_product_result.data:
            # another product already has this UPC - need to consolidate
            existing_product = existing_product_result.data[0]
            existing_product_id = existing_product['id']
            
            if existing_product_id != listing['product_id']:
                # move this listing to the existing product with the UPC
                update_data['product_id'] = existing_product_id
                self.stats['upc_consolidations'] += 1
                self.logger.info(f"Consolidated listing to existing product {existing_product_id} with UPC {new_upc}")
                return update_data
        
        # check how many listings reference the current product
        listing_count_res = self.supabase.table('listings').select('id').eq('product_id', listing['product_id']).execute()
        listing_count = len(listing_count_res.data) if listing_count_res.data else 0
        
        if listing_count > 1:
            # multiple listings reference this product - create new product for this UPC
            new_product_id = self._create_product_with_upc(listing['product'], new_upc)
            if new_product_id:
                update_data['product_id'] = new_product_id
                self.logger.info(f"Created new product {new_product_id} for UPC {new_upc}")
        else:
            # only one listing - update product UPC in place
            try:
                self.supabase.table('products').update({'upc': new_upc}).eq('id', listing['product_id']).execute()
                self.stats['upc_updates_in_place'] += 1
                self.logger.info(f"Updated UPC for product {listing['product_id']} to {new_upc}")
            except Exception as e:
                self.logger.error(f"Failed to update UPC for product {listing['product_id']}: {e}")
        
        return update_data

    # batch UPC reconciliation
    def _batch_upc_reconciliation(self, listings: List[Dict]) -> None:
        self.logger.info(f"Running batch UPC reconciliation on {len(listings)} listings")
        
        # group products by UPC
        upc_groups = defaultdict(list)
        for listing in listings:
            product = listing.get('product')
            if product and product.get('upc'):
                upc_groups[product['upc']].append(listing)
        
        # process groups w/ multiple products
        for upc, group_listings in upc_groups.items():
            if len(group_listings) > 1:
                # get unique products in this UPC group
                product_ids = list(set(listing['product_id'] for listing in group_listings))
                
                if len(product_ids) > 1:
                    self.logger.info(f"Found {len(product_ids)} products with same UPC {upc}, consolidating...")
                    
                    # choose product w/ most listings as target
                    product_listing_counts = defaultdict(int)
                    for listing in group_listings:
                        product_listing_counts[listing['product_id']] += 1
                    
                    target_product_id = max(product_listing_counts.keys(), key=lambda x: product_listing_counts[x])
                    
                    # move all listings to target product
                    for listing in group_listings:
                        if listing['product_id'] != target_product_id:
                            try:
                                self.supabase.table('listings').update({
                                    'product_id': target_product_id
                                }).eq('id', listing['id']).execute()
                                
                                self.stats['listings_consolidated'] += 1
                                self.logger.info(f"Moved listing {listing['id']} to product {target_product_id}")
                            except Exception as e:
                                self.logger.error(f"Failed to move listing {listing['id']}: {e}")
                    
                    # mark duplicate products as inactive
                    for product_id in product_ids:
                        if product_id != target_product_id:
                            try:
                                self.supabase.table('products').update({
                                    'is_active': False
                                }).eq('id', product_id).execute()
                                
                                self.stats['products_merged'] += 1
                                self.logger.info(f"Marked duplicate product {product_id} as inactive")
                            except Exception as e:
                                self.logger.error(f"Failed to deactivate product {product_id}: {e}")

    # get products to update (from supabase)
    def get_products_to_update(
        self,
        retailer: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        product_id: Optional[str] = None,
        max_products: Optional[int] = None,
        days_since_update: int = 1,
        stale_only: bool = False,
        priority_only: bool = False,
        track_only: bool = False,
        all_products: bool = False
    ) -> List[Dict]:
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
            query = query.order('updated_at', desc=False)
            if not all_products and max_products:
                query = query.limit(max_products)
            
            # 2️⃣  Paginate when --all is used (PostgREST caps each call at 1000 rows)
            if all_products:
                page_size = 1000
                offset = 0
                rows: List[Dict] = []
                while True:
                    page = query.range(offset, offset + page_size - 1).execute()
                    if not page.data:
                        break
                    rows.extend(page.data)
                    if len(page.data) < page_size:
                        break
                    offset += page_size
                self.logger.info(f"Found {len(rows)} products to update")
                return rows
            else:
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

    # synchronous version of update_single_listing for use in worker threads
    def _update_single_listing_sync(self, listing: Dict, scraper) -> bool:
        # count every attempt so success-rate denominator is accurate
        self.stats['total_processed'] += 1
        try:
            listing_id = listing['id']
            product_name = listing['product']['name'] if listing['product'] else 'Unknown'
            product_upc = listing['product']['upc'] if listing['product'] and listing['product'].get('upc') else 'N/A'
            retailer_slug = listing['retailer']['slug'] if listing['retailer'] else 'unknown'
            url = listing['url']
            current_price = listing['price']
            
            # scrape fresh data
            scraped_data = scraper.scrape_product(url)
            
            if not scraped_data:
                self.logger.warning(f"Failed to scrape data for {url}")
                self.stats['failed_updates'] += 1
                return False
            
            # extract updated fields - handle nested structure from scrapers
            listing_data = scraped_data.get('listing_data', {})
            product_data = scraped_data.get('product_data', {})
            
            new_price = listing_data.get('price')
            new_title = product_data.get('name')
            new_rating = listing_data.get('rating')
            new_review_count = listing_data.get('review_count')
            new_availability = listing_data.get('availability_status', 'in_stock')
            new_image_url = listing_data.get('image_url')
            new_upc = product_data.get('upc')
            
            # prepare update data
            update_data = {
                'updated_at': datetime.now().isoformat()
            }
            
            # only update fields that have values (note: product name is stored in products table, not listings)
            if new_rating:
                update_data['rating'] = float(new_rating)
            if new_review_count:
                update_data['review_count'] = int(new_review_count)
            if new_availability:
                update_data['availability_status'] = new_availability
            if new_image_url:
                update_data['image_url'] = new_image_url

            # update product name if it has changed and we have a new title
            if new_title and listing.get('product'):
                existing_name = listing['product'].get('name', '')
                if new_title != existing_name:
                    try:
                        product_update_data = {'name': new_title}
                        self.supabase.table('products').update(product_update_data).eq('id', listing['product_id']).execute()
                        self.logger.info(f"Updated product name for {listing['product_id']}: '{existing_name}' → '{new_title}'")
                    except Exception as e:
                        self.logger.error(f"Failed to update product name for {listing['product_id']}: {e}")

            # Handle UPC reconciliation with improved logic
            if new_upc:
                upc_updates = self._handle_upc_reconciliation(listing, new_upc)
                update_data.update(upc_updates)
                
                # If product_id changed, we need to update our listing reference
                if 'product_id' in upc_updates:
                    listing['product_id'] = upc_updates['product_id']
            
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
            
            # determine if any data has changed (not just price)
            data_changed = False
            
            # check if we have meaningful updates beyond just updated_at timestamp
            if len(update_data) > 1:  # more than just 'updated_at'
                data_changed = True
                self.logger.debug(f"Data updated: {list(update_data.keys())}")
            
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
            
            # track stats properly – mark success vs. no-change (total already counted)
            if data_changed:
                self.stats['successful_updates'] += 1
            else:
                self.stats['no_change'] += 1
                
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating listing {listing.get('id', 'unknown')}: {e}")
            self.stats['failed_updates'] += 1
            return False

    # update multiple listings w/ proper concurrency control using worker pool
    async def update_listings_batch(self, listings: List[Dict]) -> None:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import threading
        
        # split listings into batches for concurrent processing
        batch_size = max(1, len(listings) // self.scraper_concurrency)
        batches = [listings[i:i + batch_size] for i in range(0, len(listings), batch_size)]
        
        self.logger.info(f"🔄 Processing {len(listings)} listings in {len(batches)} batches with {self.scraper_concurrency} workers")
        
        # use ThreadPoolExecutor for concurrent processing (since scrapers use Selenium)
        with ThreadPoolExecutor(max_workers=min(self.scraper_concurrency, len(batches))) as executor:
            # submit all batches
            future_to_batch = {
                executor.submit(self._process_listings_batch_sync, batch, i + 1): i + 1 
                for i, batch in enumerate(batches)
            }
            
            # collect results as they complete
            for future in as_completed(future_to_batch):
                batch_num = future_to_batch[future]
                try:
                    batch_results = future.result()
                    self.logger.info(f"Batch {batch_num} completed: {batch_results} listings processed")
                except Exception as e:
                    self.logger.error(f"Batch {batch_num} failed: {e}")
    
    # process a batch of listings synchronously (called by worker threads)
    def _process_listings_batch_sync(self, listings: List[Dict], batch_num: int) -> int:
        self.logger.info(f"Worker {batch_num}: Processing {len(listings)} listings")
        
        # create scrapers for this worker thread
        worker_scrapers = {}
        # track how many listings each scraper has processed so we can recycle drivers
        scraper_counts = defaultdict(int)
        processed_count = 0
        
        try:
            for listing in listings:
                try:
                    listing_id = listing['id']
                    product_name = listing['product']['name'] if listing['product'] else 'Unknown'
                    product_upc = listing['product']['upc'] if listing['product'] and listing['product'].get('upc') else 'N/A'
                    retailer_slug = listing['retailer']['slug'] if listing['retailer'] else 'unknown'
                    url = listing['url']
                    
                    self.logger.info(f"Worker {batch_num}: Updating {retailer_slug} listing for: {product_name} (UPC: {product_upc})")
                    
                    # get or create scraper for this retailer in this worker thread
                    if retailer_slug not in worker_scrapers:
                        if retailer_slug not in self.scraper_classes:
                            self.logger.error(f"No scraper available for retailer: {retailer_slug}")
                            self.stats['failed_updates'] += 1
                            continue
                        
                        scraper_class = self.scraper_classes[retailer_slug]
                        worker_scrapers[retailer_slug] = scraper_class(use_safari=self.use_safari)
                        self.active_scrapers.append(worker_scrapers[retailer_slug])
                    
                    scraper = worker_scrapers[retailer_slug]
                    
                    # increment usage counter and recycle driver every 500 listings to avoid Chrome "tab crashed" errors
                    scraper_counts[retailer_slug] += 1
                    if scraper_counts[retailer_slug] % 500 == 0:
                        self.logger.info(
                            f"Worker {batch_num}: Re-initialising {retailer_slug} driver after {scraper_counts[retailer_slug]} listings"
                        )
                        try:
                            # on next use get_driver() will spawn a fresh browser
                            scraper.close_driver()
                        except Exception:
                            pass
                    
                    # call the synchronous version of update_single_listing
                    success = self._update_single_listing_sync(listing, scraper)
                    processed_count += 1
                    
                    if success:
                        self.logger.debug(f"Worker {batch_num}: Successfully updated listing {listing_id}")
                    else:
                        self.logger.warning(f"Worker {batch_num}: Failed to update listing {listing_id}")
                        
                except Exception as e:
                    self.logger.error(f"Worker {batch_num}: Error processing listing {listing.get('id', 'unknown')}: {e}")
                    self.stats['failed_updates'] += 1
                    
        finally:
            # close scrapers for this worker
            for scraper in worker_scrapers.values():
                try:
                    scraper.close_driver()
                except Exception:
                    pass
        
        self.logger.info(f"Worker {batch_num}: Completed processing {processed_count} listings")
        return processed_count

    # print update summary statistics
    def print_summary(self):
        execution_time = datetime.now() - self.execution_start
        
        self.logger.info("="*50)
        self.logger.info("UPDATE SUMMARY")
        self.logger.info("="*50)
        self.logger.info(f"Execution time: {execution_time}")
        self.logger.info(f"Total processed: {self.stats['total_processed']}")
        self.logger.info(f"Successful updates: {self.stats['successful_updates']}")
        self.logger.info(f"Failed updates: {self.stats['failed_updates']}")
        self.logger.info(f"No changes: {self.stats['no_change']}")
        self.logger.info(f"Price changes detected: {self.stats['price_changes']}")
        self.logger.info(f"New price history entries: {self.stats['new_price_histories']}")
        
        # UPC-related stats
        if any(self.stats[key] > 0 for key in ['upc_consolidations', 'upc_updates_in_place', 'new_products_for_upc', 'products_merged', 'listings_consolidated', 'invalid_upcs_skipped']):
            self.logger.info("="*50)
            self.logger.info("UPC RECONCILIATION SUMMARY")
            self.logger.info("="*50)
            self.logger.info(f"UPC consolidations: {self.stats['upc_consolidations']}")
            self.logger.info(f"UPC updates in place: {self.stats['upc_updates_in_place']}")
            self.logger.info(f"New products for UPC: {self.stats['new_products_for_upc']}")
            self.logger.info(f"Products merged: {self.stats['products_merged']}")
            self.logger.info(f"Listings consolidated: {self.stats['listings_consolidated']}")
            self.logger.info(f"Invalid UPCs skipped: {self.stats['invalid_upcs_skipped']}")
        
        if self.stats['total_processed'] > 0:
            success_rate = (self.stats['successful_updates'] / self.stats['total_processed']) * 100
            self.logger.info(f"Success rate: {success_rate:.1f}%")
        
        # write detailed log summary to file if logging to file
        if self.log_file:
            self._write_log_summary()

    # write detailed log summary to file
    def _write_log_summary(self):
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write("\n" + "="*80 + "\n")
                f.write("DETAILED EXECUTION SUMMARY\n")
                f.write("="*80 + "\n")
                f.write(f"Script: {__file__}\n")
                f.write(f"Start time: {self.execution_start.isoformat()}\n")
                f.write(f"End time: {datetime.now().isoformat()}\n")
                f.write(f"Total execution time: {datetime.now() - self.execution_start}\n")
                f.write(f"Scraper concurrency: {self.scraper_concurrency}\n")
                f.write(f"Safari mode: {self.use_safari}\n")
                f.write(f"UPC validation: {self.validate_upcs}\n")
                f.write("\n")
                
                # detailed stats
                f.write("PROCESSING STATISTICS:\n")
                f.write("-" * 40 + "\n")
                for key, value in self.stats.items():
                    f.write(f"{key.replace('_', ' ').title()}: {value}\n")
                
                if self.stats['total_processed'] > 0:
                    success_rate = (self.stats['successful_updates'] / self.stats['total_processed']) * 100
                    f.write(f"Success Rate: {success_rate:.2f}%\n")
                
                f.write("\n" + "="*80 + "\n")
                f.write("END OF SUMMARY\n")
                f.write("="*80 + "\n")
                
            self.logger.info(f"Detailed log summary written to: {self.log_file}")
            
        except Exception as e:
            self.logger.error(f"Failed to write log summary to file: {e}")

# main function
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
        help="Maximum number of products to update (optional, processes all if not specified)"
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
    
    parser.add_argument(
        "--use-safari",
        action="store_true",
        help="Use Safari driver instead of Chrome (macOS only)"
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
        "--log-file",
        help="Path to log file for detailed output (optional, logs to both console and file)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be updated without making changes"
    )

    # CLI flag definition (just after --max-products block)
    parser.add_argument(
        "--all",
        dest="all_products",
        action="store_true",
        help="Process ALL listings for the selected retailer(s), overriding the 1 000-row API cap"
    )
    
    parser.add_argument(
        "--batch-upc-reconciliation",
        action="store_true",
        help="Run batch UPC reconciliation to merge duplicate products"
    )
    
    parser.add_argument(
        "--upc-validation",
        action="store_true",
        default=True,
        help="Validate UPC formats and checksums during updates (default: True)"
    )

    args = parser.parse_args()
    
    # setup logging
    logger = setup_logging(args.log_level, args.log_file)
    
    # validate arguments
    if not args.retailer and not args.all_retailers:
        logger.error("Must specify either --retailer or --all-retailers")
        sys.exit(1)
    
    if args.retailer and args.all_retailers:
        logger.error("Cannot specify both --retailer and --all-retailers")
        sys.exit(1)
    
    # basic validation
    if args.all_products and args.max_products:
        logger.error("Cannot use --all together with --max-products")
        sys.exit(1)
    
    # setup supabase
    supabase_url = args.supabase_url or os.getenv('SUPABASE_URL')
    supabase_key = args.supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL and API key must be provided via arguments or environment variables")
        sys.exit(1)
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # initialize updater
    updater = ProductUpdater(supabase, logger, args.scraper_concurrency, args.use_safari, args.upc_validation, args.log_file)
    
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
            track_only=args.track_only,
            all_products=args.all_products
        )
        
        if not products:
            logger.info(f"No products found for {retailer}")
            continue
        
        if args.dry_run:
            logger.info(f"DRY RUN: Would update {len(products)} products for {retailer}")
            # show first 5 products
            for product in products[:5]:
                product_name = product['product']['name'] if product['product'] else 'Unknown'
                product_upc = product['product']['upc'] if product['product'] and product['product'].get('upc') else 'N/A'
                logger.info(f"  - {product_name} (UPC: {product_upc}, ID: {product['id']})")
            if len(products) > 5:
                logger.info(f"  ... and {len(products) - 5} more")
            continue
        
        # update products
        logger.info(f"Updating {len(products)} products for {retailer}")
        await updater.update_listings_batch(products)
    
    # run batch UPC reconciliation if requested
    if args.batch_upc_reconciliation:
        logger.info("Running batch UPC reconciliation...")
        for retailer in retailers_to_process:
            logger.info(f"Batch reconciliation for {retailer}")
            # get a sample of products for reconciliation
            sample_products = updater.get_products_to_update(
                retailer=retailer,
                max_products=1000,  # Process in chunks
                all_products=False
            )
            if sample_products:
                updater._batch_upc_reconciliation(sample_products)
    
    # print final summary & clean up
    updater.print_summary()
    updater.close_scrapers()

# standalone function to clean up UPC data across the database
def clean_and_validate_upc_batch():
    import argparse
    import logging
    
    parser = argparse.ArgumentParser(description="Clean and validate UPC data")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--fix-invalid", action="store_true", help="Remove invalid UPC codes")
    
    args = parser.parse_args()
    
    # setup logging & database connection
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # connect to supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    supabase = create_client(supabase_url, supabase_key)
    
    updater = ProductUpdater(supabase, logger)
    
    # get all products w/ UPCs
    result = supabase.table('products').select('id, name, upc').not_.is_('upc', 'null').execute()
    
    invalid_count = 0
    valid_count = 0
    
    for product in result.data:
        upc = product['upc']
        is_valid = updater._validate_upc(upc)
        
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1
            logger.warning(f"Invalid UPC for '{product['name']}': {upc}")
            
            if args.fix_invalid and not args.dry_run:
                # Remove invalid UPC
                supabase.table('products').update({'upc': None}).eq('id', product['id']).execute()
                logger.info(f"Removed invalid UPC for product {product['id']}")
    
    logger.info(f"UPC Validation Summary: {valid_count} valid, {invalid_count} invalid")

if __name__ == "__main__":
    asyncio.run(main())