"""
Supabase backend implementation for storing crawler data directly to database.

This module provides the SupabaseBackend class that implements the OutputBackend
interface for sending crawler data to a Supabase database. Includes automatic
category normalization, UPC lookup, and database management for products,
listings, and related entities.
"""

import os
import logging
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from supabase import create_client, Client
from .base_crawler import OutputBackend, ProductRecord
from .normalizers.category_normalizer import CategoryNormalizer
from .upc_lookup import create_upc_manager, UPCManager, FailedUPCManager, create_failed_upc_manager

# * Module-level constants *

# retailer UUID mapping
RETAILER_UUID_MAP = {
    "1": "00000000-0000-0000-0000-000000000001",  # Amazon
    "2": "00000000-0000-0000-0000-000000000002",  # Target  
    "3": "00000000-0000-0000-0000-000000000003",  # Walmart
    "amazon": "00000000-0000-0000-0000-000000000001",
    "target": "00000000-0000-0000-0000-000000000002",
    "walmart": "00000000-0000-0000-0000-000000000003"
}

# default currency
DEFAULT_CURRENCY = "USD"

# Retailer detection patterns
RETAILER_URL_PATTERNS = {
    'amazon.com': 1,
    'target.com': 2, 
    'walmart.com': 3
}

# * Module-level utility functions *

# * Utility functions *

# resolve retailer UUID
def resolve_retailer_uuid(retailer_identifier) -> str:
    retailer_key = str(retailer_identifier).lower()
    return RETAILER_UUID_MAP.get(retailer_key, retailer_identifier)

# detect retailer from record
def detect_retailer_from_record(record: dict) -> Optional[str]:
    # check for retailer-specific IDs first
    if 'asin' in record:
        return resolve_retailer_uuid(1)  # Amazon
    elif 'tcin' in record:
        return resolve_retailer_uuid(2)  # Target
    elif 'wm_item_id' in record:
        return resolve_retailer_uuid(3)  # Walmart
    
    # fallback to URL pattern matching
    url = record.get('url', '')
    for pattern, retailer_id in RETAILER_URL_PATTERNS.items():
        if pattern in url:
            return resolve_retailer_uuid(retailer_id)
    
    return None

# parse price string to float
def parse_price(price_str) -> Optional[float]:
    if not price_str or price_str == 'Unknown Price':
        return None
    
    try:
        # remove currency symbols & commas
        clean_price = str(price_str).replace('$', '').replace(',', '').strip()
        return float(clean_price)
    except (ValueError, TypeError):
        return None

# create URL-friendly slug from name
def create_slug(name: str) -> str:
    # convert to lowercase & replace spaces/special chars w/ hyphens
    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = slug.strip('-')
    
    # truncate if too long
    return slug[:255]

# * Supabase backend class *

# Supabase backend for storing crawler data directly to db
class SupabaseBackend(OutputBackend):    
    def __init__(self, supabase_url: str = None, supabase_key: str = None, 
                 enable_upc_lookup: bool = True, crawl_category=None,
                 upc_concurrency: int = 4):
        self.logger = logging.getLogger(__name__)
        
        # use env or provided values
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and key must be provided via parameters or environment variables")
        
        # init supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.logger.info("Supabase backend initialized")
        
        # store the crawl category for use in category normalization
        self.crawl_category = crawl_category
        if self.crawl_category:
            self.logger.info(f"✅ Crawl category parameter set to: '{self.crawl_category}'")
            self.logger.info("This category will be used for ALL products instead of individual product categories")
        else:
            self.logger.info("No crawl category parameter set - will use individual product categories")
        
        # init category normalizer
        self.category_normalizer = CategoryNormalizer(self.supabase)
        
        # store UPC concurrency setting & create factory params
        self.upc_concurrency = upc_concurrency
        self._upc_factory_params = {
            'logger': self.logger,
            'supabase_client': self.supabase,
            'max_workers': self.upc_concurrency
        }
        
        # init UPC manager w/ supabase client for failed lookup storage
        self.enable_upc_lookup = enable_upc_lookup
        if self.enable_upc_lookup:
            self.upc_manager = create_upc_manager(**self._upc_factory_params)
            self.failed_upc_manager = create_failed_upc_manager(supabase_client=self.supabase, logger=self.logger)
            self.logger.info("UPC lookup enabled with failed lookup storage")
        else:
            self.upc_manager = None
            self.failed_upc_manager = None
            self.logger.info("UPC lookup disabled")
        
        # caches for retailers, brands, etc.
        self._retailer_cache = {}
        self._brand_cache = {}
        self._product_cache = {}
        
        # create thread-local storage so each UPC worker thread can keep 
        # its own UPCManager instance (and therefore its own browser driver) 
        import threading  
        self._thread_local = threading.local()

        # keep strong refs to all thread-specific managers so the main
        # thread can explicitly clean them up after work completes
        self._created_upc_managers: list["UPCManager"] = []
    
    # send records to supabase
    def send(self, records) -> None:
        if not records:
            self.logger.warning("No records to send to Supabase")
            return
        
        # ensure records is a list
        if not isinstance(records, list):
            records = [records]
        
        self.logger.info(f"Processing {len(records)} records for Supabase")
        
        # separate records by type for potential concurrent processing
        product_records = []
        other_records = []
        for record in records:
            if isinstance(record, ProductRecord):
                product_records.append(record)
            else:
                other_records.append(record)

        success_count = 0

        # concurrent processing for ProductRecord objects if UPC lookup enabled & concurrency >1
        if product_records:
            if self.enable_upc_lookup and self.upc_concurrency > 1:
                from concurrent.futures import ThreadPoolExecutor, as_completed
                self.logger.info(f"🔍 Processing {len(product_records)} product records concurrently with {self.upc_concurrency} UPC workers")
                with ThreadPoolExecutor(max_workers=self.upc_concurrency) as executor:
                    future_to_record = {executor.submit(self._process_product_record, pr): pr for pr in product_records}
                    for future in as_completed(future_to_record):
                        pr = future_to_record[future]
                        try:
                            future.result()
                            success_count += 1
                        except Exception as e:
                            self.logger.error(f"Error processing product record {pr.title}: {e}")
            else:
                # fallback to sequential processing
                for pr in product_records:
                    try:
                        self._process_product_record(pr)
                        success_count += 1
                    except Exception as e:
                        self.logger.error(f"Error processing product record {pr.title}: {e}")

        # process other record types sequentially
        for i, record in enumerate(other_records):
            try:
                if isinstance(record, dict):
                    if self._validate_dict_record(record):
                        self._process_raw_dict(record)
                        success_count += 1
                    else:
                        self.logger.warning(f"Invalid dict record at index {i}: {record}")
                elif isinstance(record, str):
                    if record.startswith('http'):
                        self._process_url_record(record)
                        success_count += 1
                    else:
                        self.logger.warning(f"Invalid string record at index {i}: {record}")
                else:
                    self.logger.error(f"Unknown record type at index {i}: {type(record)} - {record}")
            except Exception as e:
                self.logger.error(f"Error processing record {i+1}: {e}")
                self.logger.debug(f"Problematic record: {record}")

        self.logger.info(f"Successfully processed {success_count}/{len(records)} records")

        # clean up UPC manager instances created in worker threads
        for mgr in list(self._created_upc_managers):
            try:
                mgr.cleanup()
            except Exception as e:
                self.logger.warning(f"Error cleaning up UPC manager: {e}")
        self._created_upc_managers.clear()

    # validate dict record has required fields
    def _validate_dict_record(self, record):
        if not isinstance(record, dict):
            return False
        
        # check at least one of the required fields
        required_fields = ['title', 'name', 'url', 'asin', 'tcin', 'wm_item_id']
        has_required_field = any(field in record for field in required_fields)
        
        if not has_required_field:
            self.logger.warning(f"Dict record missing required fields. Has: {list(record.keys())}")
            return False
        
        return True
    
    # * Record processing methods *
    
    # process a ProductRecord object w/ category normalization & insert into database
    def _process_product_record(self, record: ProductRecord) -> None:
        try:
            # get retailer info
            retailer_info = self._get_retailer_info(record.retailer_id)
            retailer_name = retailer_info.get('name', 'unknown') if retailer_info else 'unknown'
            
            # prioritize record's category field over command-line category parameter
            raw_category = getattr(record, 'category', None) or self.crawl_category
            
            # debug logging for category processing
            self._log_category_debug(record.title, retailer_name, getattr(record, 'category', None), raw_category)
            
            # normalize categories using hierarchy
            category_names = self.category_normalizer.normalize_category(
                product_name=record.title,
                product_url=str(record.url),
                retailer_name=retailer_name,
                raw_category=raw_category
            )
            
            # debug logging for normalization results
            self.logger.debug(f"Normalized category names: {category_names}")
            
            # get category IDs for existing categories only
            category_ids = self.category_normalizer.get_or_create_categories(category_names)
            
            # debug logging for category IDs
            self.logger.debug(f"Category IDs assigned: {category_ids}")
            self.logger.debug(f"=== END CATEGORY PROCESSING DEBUG ===")
            
            # get brand ID (consolidated logic)
            brand_id = self._get_brand_id(record.title, getattr(record, 'brand_name', None) or getattr(record, 'brand', None))
            
            # create product data
            product_data = {
                'name': record.title,
                'slug': create_slug(record.title),
                'description': getattr(record, 'description', None),
                'brand_id': brand_id,
                'is_active': True
            }
            
            # get retailer-specific ID for deduplication
            retailer_specific_id = getattr(record, 'asin', None) or getattr(record, 'tcin', None) or getattr(record, 'wm_item_id', None)
            
            # get or create product (unified method)
            product_id = self._get_or_create_product_unified(product_data, retailer_specific_id)
            
            # assign categories to product
            if category_ids:
                self._assign_product_categories(product_id, category_ids)
                self.logger.info(f"Assigned categories {category_names} to product: {record.title}")
            else:
                self.logger.warning(f"No categories assigned to product: {record.title}")
            
            # create listing - note: retailer_specific_id is NOT the same as UPC
            listing_data = self._build_listing_data(
                product_id=product_id,
                retailer_id=self._get_or_create_retailer(record.retailer_id),
                retailer_specific_id=retailer_specific_id,
                url=str(record.url),
                price=record.price
            )
            
            try:
                listing_id = self._upsert_listing(listing_data)
                self.logger.debug(f"Processed product: {record.title} -> Categories: {category_names}")
                
                # UPC lookup (only for new listings)
                if self.enable_upc_lookup and self.upc_manager and listing_id:
                    self._perform_delayed_upc_lookup(product_id, listing_id, record.title, str(record.url), retailer_name)
                    
            except ValueError as e:
                if "Duplicate listing" in str(e):
                    # handle dupe listing w/ UPC lookup & potential merging
                    self._handle_duplicate_listing(
                        product_id=product_id,
                        product_name=record.title,
                        product_url=str(record.url),
                        retailer_name=retailer_name,
                        listing_data=listing_data
                    )
                    return
                else:
                    raise
            
        except Exception as e:
            self.logger.error(f"Error processing ProductRecord: {e}")
            raise
    
    # process a raw dictionary w/ category normalization
    def _process_raw_dict(self, record: dict) -> None:
        try:
            # validate input
            if not isinstance(record, dict):
                raise ValueError(f"Expected dict, got {type(record)}: {record}")        
            
            # log record structure for debugging
            self.logger.debug(f"Processing dict record with keys: {list(record.keys())}")
            
            # determine retailer
            retailer_id = detect_retailer_from_record(record)
            if not retailer_id:
                self.logger.warning(f"Could not determine retailer for record with keys: {list(record.keys())}")
                return
            
            # get retailer info
            retailer_info = self._get_retailer_info(retailer_id)
            retailer_name = retailer_info.get('name', 'unknown') if retailer_info else 'unknown'
            
            # use safe getter methods for all record access
            product_title = record.get('title') or record.get('name') or 'Unknown Product'
            product_url = record.get('url', '')
            
            # prioritize record's category field over command-line category parameter
            raw_category = record.get('category') or self.crawl_category
            
            # debug logging for category processing
            self._log_category_debug(product_title, retailer_name, record.get('category'), raw_category)
            
            # normalize categories using hierarchy
            category_names = self.category_normalizer.normalize_category(
                product_name=product_title,
                product_url=product_url,
                retailer_name=retailer_name,
                raw_category=raw_category
            )
            
            # debug logging for normalization results
            self.logger.debug(f"Normalized category names: {category_names}")
            
            # get category IDs for existing categories only
            category_ids = self.category_normalizer.get_or_create_categories(category_names)
            
            # debug logging for category IDs
            self.logger.debug(f"Category IDs assigned: {category_ids}")
            self.logger.debug(f"=== END CATEGORY PROCESSING DEBUG ===")
            
            # get brand ID
            brand_id = self._get_brand_id(product_title, record.get('brand_name') or record.get('brand'))
            
            # create product data 
            product_data = {
                'name': product_title,
                'slug': create_slug(product_title),
                'description': record.get('description'),
                'brand_id': brand_id,
                'is_active': True
            }
            
            # get retailer-specific ID for deduplication
            retailer_specific_id = record.get('asin') or record.get('tcin') or record.get('wm_item_id')
            
            # get or create product
            product_id = self._get_or_create_product_unified(product_data, retailer_specific_id)
            
            # assign categories
            if category_ids:
                self._assign_product_categories(product_id, category_ids)
                self.logger.info(f"Assigned categories {category_names} to product: {product_title}")
            else:
                self.logger.warning(f"No categories assigned to product: {product_title}")
            
            # create listing - note: retailer_specific_id is NOT the same as UPC
            listing_data = self._build_listing_data(
                product_id=product_id,
                retailer_id=retailer_id,
                retailer_specific_id=retailer_specific_id,
                url=record.get('url'),
                price=record.get('price')
            )
            
            try:
                listing_id = self._upsert_listing(listing_data)
                self.logger.debug(f"Processed dict product: {product_title} -> Categories: {category_names}")
                
                # UPC lookup (only for new listings)
                if self.enable_upc_lookup and self.upc_manager and listing_id:
                    self._perform_delayed_upc_lookup(product_id, listing_id, product_title, product_url, retailer_name)
                    
            except ValueError as e:
                if "Duplicate listing" in str(e):
                    # handle dupe listing w/ UPC lookup & potential merging
                    self._handle_duplicate_listing(
                        product_id=product_id,
                        product_name=product_title,
                        product_url=product_url,
                        retailer_name=retailer_name,
                        listing_data=listing_data
                    )
                    return
                else:
                    raise
            
        except Exception as e:
            self.logger.error(f"Error processing raw dict: {e}")
            self.logger.debug(f"Record that caused error: {record}")
            raise
    
    # * Consolidated helper methods *
    
    # log category processing debug
    def _log_category_debug(self, product_title: str, retailer_name: str, record_category: str, raw_category: str) -> None:
        self.logger.debug(f"=== CATEGORY PROCESSING DEBUG ===")
        self.logger.debug(f"Product: {product_title}")
        self.logger.debug(f"Retailer: {retailer_name}")
        self.logger.debug(f"Crawl category parameter: {self.crawl_category}")
        self.logger.debug(f"Record category field: {record_category}")
        self.logger.debug(f"Final raw_category used: {raw_category}")
    
    # get brand ID
    def _get_brand_id(self, product_name: str, brand_name: str = None) -> Optional[str]:
        if brand_name:
            return self._get_or_create_brand(brand_name)
        return None
    
    # build listing data
    def _build_listing_data(self, product_id: str, retailer_id: str, retailer_specific_id: str, 
                           url: str, price) -> dict:
        return {
            'product_id': product_id,
            'retailer_id': retailer_id,
            'retailer_specific_id': retailer_specific_id,
            'url': url,
            'price': parse_price(price),
            'currency': DEFAULT_CURRENCY,
            'in_stock': True,
            'last_checked': datetime.utcnow().isoformat()
        }
    
    # assign categories to a product
    def _assign_product_categories(self, product_id: str, category_ids: List[str]) -> None:
        try:
            for i, category_id in enumerate(category_ids):
                # check if assignment already exists
                existing = self.supabase.table('product_categories')\
                    .select('id')\
                    .eq('product_id', product_id)\
                    .eq('category_id', category_id)\
                    .execute()
                
                if not existing.data:
                    # create new assignment
                    assignment = {
                        'product_id': product_id,
                        'category_id': category_id,
                        # first category is primary
                        'is_primary': (i == 0)
                    }
                    
                    self.supabase.table('product_categories').insert(assignment).execute()
                    
        except Exception as e:
            self.logger.error(f"Error assigning categories to product {product_id}: {e}")
    
    # * Brand management methods *
    
    # get or create brand in database
    def _get_or_create_brand(self, brand_name: str) -> str:
        if brand_name in self._brand_cache:
            return self._brand_cache[brand_name]
        
        brand_slug = create_slug(brand_name)
        
        try:
            # try to find existing brand
            result = self.supabase.table('brands').select('id').eq('slug', brand_slug).execute()
            
            if result.data:
                brand_id = result.data[0]['id']
                self._brand_cache[brand_name] = brand_id
                return brand_id
            
            # create new brand
            brand_data = {
                'name': brand_name,
                'slug': brand_slug,
                'is_active': True
            }
            
            result = self.supabase.table('brands').insert(brand_data).execute()
            if result.data:
                brand_id = result.data[0]['id']
                self._brand_cache[brand_name] = brand_id
                self.logger.info(f"Created new brand: {brand_name}")
                return brand_id
                
        except Exception as e:
            self.logger.error(f"Error getting/creating brand {brand_name}: {e}")
        
        return None
    
    # * Retailer management methods *
    
    # get retailer info from cache or database
    def _get_retailer_info(self, retailer_id) -> Optional[dict]:
        uuid_value = resolve_retailer_uuid(retailer_id)
        
        if uuid_value in self._retailer_cache:
            return self._retailer_cache[uuid_value]
        
        try:
            result = self.supabase.table('retailers').select('*').eq('id', uuid_value).execute()
            if result.data:
                retailer_info = result.data[0]
                self._retailer_cache[uuid_value] = retailer_info
                return retailer_info
        except Exception as e:
            self.logger.error(f"Error getting retailer info: {e}")
        
        return None
    
    # get or create retailer in database
    def _get_or_create_retailer(self, retailer_identifier) -> str:
        uuid_value = resolve_retailer_uuid(retailer_identifier)
        
        try:
            # verify retailer exists
            result = self.supabase.table('retailers').select('id').eq('id', uuid_value).execute()
            if result.data:
                return uuid_value
            else:
                self.logger.error(f"Retailer with UUID {uuid_value} not found in database")
                return None
        except Exception as e:
            self.logger.error(f"Error getting retailer info: {e}")
            return None
    
    # * Product management methods *
    
    # unified product creation with better deduplication
    def _get_or_create_product_unified(self, product_data: dict, retailer_specific_id: str = None) -> str:
        try:
            # 1. EXACT slug match
            result = self.supabase.table('products').select('id').eq('slug', product_data['slug']).execute()
            if result.data:
                self.logger.debug(f"Found existing product by slug: {product_data['slug']}")
                return result.data[0]['id']
            
            # 2. EXACT retailer-specific ID match (ASIN, TCIN, etc.)
            if retailer_specific_id:
                existing_listing = self.supabase.table('listings')\
                    .select('product_id')\
                    .eq('retailer_specific_id', retailer_specific_id)\
                    .execute()
                
                if existing_listing.data:
                    self.logger.debug(f"Found existing product by retailer ID: {retailer_specific_id}")
                    return existing_listing.data[0]['product_id']
            
            # 3. create new product if no exact matches found
            result = self.supabase.table('products').insert(product_data).execute()
            self.logger.debug(f"Created new product: {product_data['name']}")
            return result.data[0]['id']
                
        except Exception as e:
            self.logger.error(f"Error getting/creating product: {e}")
            raise
    
    # * Listing management methods *
    
    def _has_retailer_duplicate_listing(self, product_id: str, retailer_id: str, retailer_specific_id: str = None) -> Tuple[bool, Optional[dict]]:
        try:
            # check for EXACT retailer_specific_id match (like ASIN)
            if retailer_specific_id:
                existing_by_retailer_id = self.supabase.table('listings')\
                    .select('id, url, location_id, product_id')\
                    .eq('retailer_id', retailer_id)\
                    .eq('retailer_specific_id', retailer_specific_id)\
                    .execute()
                
                if existing_by_retailer_id.data:
                    existing_listing = existing_by_retailer_id.data[0]
                    
                    # Get context for logging
                    retailer_info = self._get_retailer_info(retailer_id)
                    retailer_name = retailer_info.get('name', 'Unknown') if retailer_info else 'Unknown'
                    
                    product_result = self.supabase.table('products')\
                        .select('name')\
                        .eq('id', existing_listing['product_id'])\
                        .execute()
                    product_name = product_result.data[0]['name'] if product_result.data else 'Unknown Product'
                    
                    return True, {
                        'retailer_name': retailer_name,
                        'product_name': product_name,
                        'existing_url': existing_listing.get('url', 'Unknown URL')
                    }
            
            return False, None
                
        except Exception as e:
            self.logger.error(f"Error checking for duplicate listings: {e}")
            return False, None
    
    # upsert listing & return listing ID if successful
    def _upsert_listing(self, listing_data: dict) -> Optional[str]:
        try:
            # ensure location_id is included for the constraint
            if 'location_id' not in listing_data:
                listing_data['location_id'] = None
            
            # check if retailer already has a listing for this product (business rule)
            has_duplicate, duplicate_info = self._has_retailer_duplicate_listing(
                listing_data['product_id'], 
                listing_data['retailer_id'],
                listing_data.get('retailer_specific_id')
            )
            
            if has_duplicate and duplicate_info:
                self.logger.warning(f"Retailer '{duplicate_info['retailer_name']}' already has a listing "
                                  f"with same retailer_specific_id for product '{duplicate_info['product_name']}'. "
                                  f"Existing listing URL: {duplicate_info['existing_url']}. "
                                  f"Skipping duplicate listing creation.")
                raise ValueError(f"Duplicate listing: {duplicate_info['retailer_name']} already has a listing for '{duplicate_info['product_name']}'")
            
            # use correct constraint fields that match the database schema
            result = self.supabase.table('listings').upsert(
                listing_data,
                on_conflict='product_id,retailer_id,location_id'  
            ).execute()
            
            listing_id = None
            if result.data:
                listing_id = result.data[0]['id']
                
                # add price history if price exists
                if listing_data.get('price'):
                    price_history_data = {
                        'listing_id': listing_id,
                        'price': listing_data['price'],
                        'currency': listing_data.get('currency', DEFAULT_CURRENCY),
                        'timestamp': listing_data.get('last_checked')
                    }
                    
                    self.supabase.table('price_histories').insert(price_history_data).execute()
            
            return listing_id
                
        except Exception as e:
            self.logger.error(f"Error upserting listing: {e}")
            raise
    
    # * Delayed UPC lookup methods *
    
    # perform delayed UPC lookup after listing creation
    def _perform_delayed_upc_lookup(self, product_id: str, listing_id: str, product_name: str, 
                                   product_url: str, retailer_name: str) -> None:
        try:
            # check if new listing
            if self._listing_exists_with_url(product_url, listing_id):
                self.logger.info(f"Skipping UPC lookup for existing product URL: {product_url}")
                return
            
            # perform UPC lookup using the thread-local manager
            upc_manager = self._get_thread_upc_manager()
            upc_result = upc_manager.lookup_upc(
                product_name=product_name,
                retailer_source=retailer_name,
                original_url=product_url,
            )
            
            if upc_result and upc_result.upc:
                # update both product & listing w/ UPC
                self._update_product_upc(product_id, upc_result.upc)
                self._update_listing_upc(listing_id, upc_result.upc)
                self.logger.info(f"✓ Added UPC {upc_result.upc} to product after listing creation: {product_name}")
            else:
                self.logger.debug(f"No UPC found for new product: {product_name}")
                
        except Exception as e:
            self.logger.error(f"Error in delayed UPC lookup for {product_name}: {e}")
    
    # check if listing already exists w/ URL
    def _listing_exists_with_url(self, url: str, exclude_listing_id: str = None) -> bool:
        try:
            query = self.supabase.table('listings').select('id').eq('url', url)
            
            # exclude current listing from check
            if exclude_listing_id:
                query = query.neq('id', exclude_listing_id)
            
            result = query.limit(1).execute()
            return len(result.data) > 0
        except Exception as e:
            self.logger.error(f"Error checking existing URL: {e}")
            return False
    
    # update product w/ UPC
    def _update_product_upc(self, product_id: str, upc: str) -> None:
        try:
            self.supabase.table('products')\
                .update({'upc': upc})\
                .eq('id', product_id)\
                .execute()
            self.logger.debug(f"Updated product {product_id} with UPC: {upc}")
        except Exception as e:
            self.logger.error(f"Error updating product UPC: {e}")
    
    # update listing w/ UPC
    def _update_listing_upc(self, listing_id: str, upc: str) -> None:
        try:
            self.supabase.table('listings')\
                .update({'upc': upc})\
                .eq('id', listing_id)\
                .execute()
            self.logger.debug(f"Updated listing {listing_id} with UPC: {upc}")
        except Exception as e:
            self.logger.error(f"Error updating listing UPC: {e}")
    
    # * Utility methods *
    
    # process a URL-only record (minimal processing)
    def _process_url_record(self, url: str) -> None:
        self.logger.debug(f"Processing URL record: {url}")

    # get thread-local UPC manager
    def _get_thread_upc_manager(self):
        if not hasattr(self._thread_local, "upc_manager"):
            # reuse factory params but with max_workers=1 for thread-local instance
            thread_params = self._upc_factory_params.copy()
            thread_params['max_workers'] = 1
            
            mgr = create_upc_manager(**thread_params)
            self._thread_local.upc_manager = mgr

            # record for later cleanup (main thread context)
            self._created_upc_managers.append(mgr)

        return self._thread_local.upc_manager

    # handle dupe listing w/ UPC lookup & potential merging
    def _handle_duplicate_listing(self, product_id: str, product_name: str, product_url: str, retailer_name: str, listing_data: dict) -> None:
        try:
            self.logger.info(f"🔍 Handling duplicate listing for product: {product_name}")
            
            # get existing product info
            existing_product = self.supabase.table('products')\
                .select('id, name, upc, description, brand_id')\
                .eq('id', product_id)\
                .execute()
            
            if not existing_product.data:
                self.logger.warning(f"Could not find existing product {product_id}")
                return
            
            product_data = existing_product.data[0]
            existing_upc = product_data.get('upc')
            
            # if existing product doesn't have UPC, perform lookup
            if not existing_upc and self.enable_upc_lookup and self.upc_manager:
                self.logger.info(f"Performing UPC lookup for duplicate product: {product_name}")
                
                upc_manager = self._get_thread_upc_manager()
                upc_result = upc_manager.lookup_upc(
                    product_name=product_name,
                    retailer_source=retailer_name,
                    original_url=product_url,
                )
                
                if upc_result and upc_result.upc:
                    # update existing product w/ found UPC
                    self._update_product_upc(product_id, upc_result.upc)
                    existing_upc = upc_result.upc
                    self.logger.info(f"✓ Added UPC {upc_result.upc} to existing product: {product_name}")
                    
                    # check for other products w/ same UPC for potential merging
                    products_with_same_upc = self.find_products_by_upc(upc_result.upc)
                    
                    if len(products_with_same_upc) > 1:
                        # multiple products found w/ same UPC - merge them
                        product_ids = [p['id'] for p in products_with_same_upc if p['id'] != product_id]
                        
                        if product_ids:
                            # use the oldest product as primary (or the one w/ most data)
                            primary_product = min(products_with_same_upc, key=lambda p: p['created_at'])
                            duplicate_ids = [p['id'] for p in products_with_same_upc if p['id'] != primary_product['id']]
                            
                            if self.merge_products(primary_product['id'], duplicate_ids):
                                self.logger.info(f"✓ Merged {len(duplicate_ids)} duplicate products with UPC {upc_result.upc}")
                else:
                    self.logger.debug(f"No UPC found for duplicate product: {product_name}")
            else:
                if existing_upc:
                    self.logger.debug(f"Product {product_name} already has UPC: {existing_upc}")
                else:
                    self.logger.debug(f"UPC lookup disabled or no UPC manager available")
            
            # continue to suppress duplicate listing creation
            self.logger.info(f"Skipped creating duplicate listing for product: {product_name}")
                
        except Exception as e:
            self.logger.error(f"Error handling duplicate listing for {product_name}: {e}")

    # * UPC-based product management methods *
    
    # find all products that have the given UPC
    def find_products_by_upc(self, upc_code: str) -> List[dict]:
        try:
            result = self.supabase.table('products')\
                .select('id, name, description, brand_id, created_at')\
                .eq('upc', upc_code)\
                .execute()
            
            return result.data if result.data else []
        except Exception as e:
            self.logger.error(f"Error finding products by UPC {upc_code}: {e}")
            return []
    
    # merge multiple product records into a primary product
    def merge_products(self, primary_product_id: str, duplicate_product_ids: List[str]) -> bool:
        try:
            # get primary product info for logging & updating
            primary_result = self.supabase.table('products')\
                .select('name, description, brand_id')\
                .eq('id', primary_product_id)\
                .execute()
            
            if not primary_result.data:
                self.logger.error(f"Could not find primary product {primary_product_id}")
                return False
                
            primary_product = primary_result.data[0]
            primary_name = primary_product['name']
            
            for duplicate_id in duplicate_product_ids:
                # get duplicate product info for logging
                duplicate_result = self.supabase.table('products')\
                    .select('name, description, brand_id')\
                    .eq('id', duplicate_id)\
                    .execute()
                
                if duplicate_result.data:
                    duplicate_product = duplicate_result.data[0]
                    duplicate_name = duplicate_product['name']
                    
                    # update primary product w/ enhanced data if available
                    updates = {}
                    if not primary_product.get('description') and duplicate_product.get('description'):
                        updates['description'] = duplicate_product['description']
                    if not primary_product.get('brand_id') and duplicate_product.get('brand_id'):
                        updates['brand_id'] = duplicate_product['brand_id']
                    
                    if updates:
                        self.supabase.table('products')\
                            .update(updates)\
                            .eq('id', primary_product_id)\
                            .execute()
                        self.logger.debug(f"Enhanced primary product {primary_name} with data from {duplicate_name}")
                        # update local copy of primary product data
                        primary_product.update(updates)
                    
                    # reassign all listings from duplicate to primary product
                    self.supabase.table('listings')\
                        .update({'product_id': primary_product_id})\
                        .eq('product_id', duplicate_id)\
                        .execute()
                    
                    # reassign product category associations
                    self.supabase.table('product_categories')\
                        .update({'product_id': primary_product_id})\
                        .eq('product_id', duplicate_id)\
                        .execute()
                    
                    # mark dupe product as inactive instead of deleting
                    self.supabase.table('products')\
                        .update({'is_active': False})\
                        .eq('id', duplicate_id)\
                        .execute()
                    
                    self.logger.info(f"✓ Merged product '{duplicate_name}' into '{primary_name}'")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error merging products: {e}")
            return False

    # trigger UPC lookup for existing listings that lack UPCs
    def trigger_upc_lookup_for_existing_listings(self, retailer_id: str = None, limit: int = 100) -> Dict[str, Any]:
        try:
            # build query for listings w/o UPCs
            query = self.supabase.table('listings')\
                .select('id, product_id, url, products(name, upc)')\
                .is_('upc', 'null')\
                .limit(limit)
            
            if retailer_id:
                query = query.eq('retailer_id', retailer_id)
            
            result = query.execute()
            
            if not result.data:
                return {
                    "success": True,
                    "message": "No listings found without UPCs",
                    "processed": 0,
                    "successful": 0
                }
            
            processed = 0
            successful = 0
            
            for listing in result.data:
                if not listing.get('products') or not listing['products'].get('name'):
                    continue
                    
                product_name = listing['products']['name']
                product_upc = listing['products'].get('upc')
                listing_id = listing['id']
                product_id = listing['product_id']
                
                # skip if product already has UPC
                if product_upc:
                    self._update_listing_upc(listing_id, product_upc)
                    successful += 1
                    processed += 1
                    continue
                
                # perform UPC lookup
                if self.enable_upc_lookup and self.upc_manager:
                    try:
                        upc_manager = self._get_thread_upc_manager()
                        upc_result = upc_manager.lookup_upc(
                            product_name=product_name,
                            original_url=listing['url']
                        )
                        
                        if upc_result and upc_result.upc:
                            # update both product & listing
                            self._update_product_upc(product_id, upc_result.upc)
                            self._update_listing_upc(listing_id, upc_result.upc)
                            successful += 1
                            self.logger.info(f"✓ Added UPC {upc_result.upc} to existing listing: {product_name}")
                        
                        processed += 1
                        
                    except Exception as e:
                        self.logger.error(f"Error performing UPC lookup for {product_name}: {e}")
                        processed += 1
            
            return {
                "success": True,
                "processed": processed,
                "successful": successful,
                "failed": processed - successful
            }
            
        except Exception as e:
            self.logger.error(f"Error triggering UPC lookup for existing listings: {e}")
            return {
                "success": False,
                "error": str(e),
                "processed": 0,
                "successful": 0
            }

# * Factory functions *

# factory function to create supabase backend
def create_supabase_backend(supabase_url: str = None, supabase_key: str = None, enable_upc_lookup: bool = True, crawl_category=None, upc_concurrency: int = 4) -> SupabaseBackend:
    return SupabaseBackend(supabase_url, supabase_key, enable_upc_lookup, crawl_category, upc_concurrency)
