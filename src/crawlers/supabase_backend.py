# supabase_backend.py
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

# Supabase backend for storing crawler data directly to db
class SupabaseBackend(OutputBackend):    
    def __init__(self, supabase_url: str = None, supabase_key: str = None, enable_upc_lookup: bool = True):
        self.logger = logging.getLogger(__name__)
        
        # use env or provided values
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and key must be provided via parameters or environment variables")
        
        # init supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.logger.info("Supabase backend initialized")
        
        # init category normalizer
        self.category_normalizer = CategoryNormalizer(self.supabase)
        
        # init UPC manager w/ supabase client for failed lookup storage
        self.enable_upc_lookup = enable_upc_lookup
        if self.enable_upc_lookup:
            self.upc_manager = create_upc_manager(logger=self.logger, supabase_client=self.supabase)
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
    
    # send records to Supabase
    def send(self, records) -> None:
        if not records:
            self.logger.warning("No records to send to Supabase")
            return
        
        # ensure records is a list
        if not isinstance(records, list):
            records = [records]
        
        self.logger.info(f"Processing {len(records)} records for Supabase")
        
        # process different types of records
        success_count = 0
        for record in records:
            try:
                if isinstance(record, ProductRecord):
                    self._process_product_record(record)
                    success_count += 1
                elif isinstance(record, dict):
                    self._process_raw_dict(record)
                    success_count += 1
                elif isinstance(record, str):
                    self._process_url_record(record)
                    success_count += 1
                else:
                    self.logger.warning(f"Unknown record type: {type(record)}")
            except Exception as e:
                self.logger.error(f"Error processing record: {e}")
                continue
        
        self.logger.info(f"Successfully processed {success_count}/{len(records)} records")
    
    # process a ProductRecord object w/ category normalization & insert into database
    def _process_product_record(self, record: ProductRecord) -> None:
        try:
            # get retailer info
            retailer_info = self._get_retailer_info(record.retailer_id)
            retailer_name = retailer_info.get('name', 'unknown') if retailer_info else 'unknown'
            
            # normalize categories using hierarchy
            category_names = self.category_normalizer.normalize_category(
                product_name=record.title,
                product_url=str(record.url),
                retailer_name=retailer_name,
                raw_category=getattr(record, 'category', None)
            )
            
            # get category IDs for existing categories only
            category_ids = self.category_normalizer.get_or_create_categories(category_names)
            
            # extract/detect brand
            brand_id = self._extract_and_create_brand(record.title)
            
            # lookup UPC if enabled
            upc = None
            if self.enable_upc_lookup and self.upc_manager:
                try:
                    upc_result = self.upc_manager.lookup_upc(
                        product_name=record.title,
                        retailer_source=retailer_name,
                        original_url=str(record.url)
                    )
                    if upc_result and upc_result.upc:
                        upc = upc_result.upc
                        self.logger.info(f"Found UPC {upc} for product: {record.title}")
                except Exception as e:
                    self.logger.error(f"UPC lookup failed for {record.title}: {e}")
            
            # create product w/ data
            product_data = {
                'name': record.title,
                'slug': self._create_slug(record.title),
                'description': getattr(record, 'description', None),
                'brand_id': brand_id,
                'upc': upc, 
                'is_active': True
            }
            
            # get or create product
            product_id = self._get_or_create_product(product_data, record)
            
            # assign categories to product
            if category_ids:
                self._assign_product_categories(product_id, category_ids)
            
            # create listing - note: retailer_specific_id is NOT the same as UPC
            listing_data = {
                'product_id': product_id,
                'retailer_id': self._get_or_create_retailer(record.retailer_id),
                'retailer_specific_id': getattr(record, 'asin', None) or getattr(record, 'tcin', None) or getattr(record, 'wm_item_id', None),
                'upc': upc, 
                'url': str(record.url),
                'price': self._parse_price(record.price),
                'currency': 'USD',
                'in_stock': True,
                'last_checked': datetime.utcnow().isoformat()
            }
            
            self._upsert_listing(listing_data)
            
            self.logger.debug(f"Processed product: {record.title} -> Categories: {category_names}")
            
        except Exception as e:
            self.logger.error(f"Error processing ProductRecord: {e}")
            raise
    
    # process a raw dictionary w/ category normalization
    def _process_raw_dict(self, record: dict) -> None:
        try:
            # determine retailer
            retailer_id = self._determine_retailer_from_dict(record)
            if not retailer_id:
                self.logger.warning(f"Could not determine retailer for record: {record}")
                return
            
            retailer_info = self._get_retailer_info(retailer_id)
            retailer_name = retailer_info.get('name', 'unknown') if retailer_info else 'unknown'
            
            # normalize categories using hierarchy
            category_names = self.category_normalizer.normalize_category(
                product_name=record.get('title', 'Unknown Product'),
                product_url=record.get('url', ''),
                retailer_name=retailer_name,
                raw_category=record.get('category')
            )
            
            # get category IDs for existing categories only
            category_ids = self.category_normalizer.get_or_create_categories(category_names)
            
            # extract brand
            brand_id = self._extract_and_create_brand(record.get('title', ''))
            
            # lookup UPC if enabled
            upc = None
            if self.enable_upc_lookup and self.upc_manager:
                try:
                    upc_result = self.upc_manager.lookup_upc(
                        product_name=record.get('title', 'Unknown Product'),
                        retailer_source=retailer_name,
                        original_url=record.get('url', '')
                    )
                    if upc_result and upc_result.upc:
                        upc = upc_result.upc
                        self.logger.info(f"Found UPC {upc} for product: {record.get('title')}")
                except Exception as e:
                    self.logger.error(f"UPC lookup failed for {record.get('title')}: {e}")
            
            # create product
            product_data = {
                'name': record.get('title', 'Unknown Product'),
                'slug': self._create_slug(record.get('title', 'Unknown Product')),
                'description': record.get('description'),
                'brand_id': brand_id,
                'upc': upc,
                'is_active': True
            }
            
            product_id = self._get_or_create_product_from_dict(product_data, record)
            
            # assign categories
            if category_ids:
                self._assign_product_categories(product_id, category_ids)
            
            # create listing - note: retailer_specific_id is NOT the same as UPC
            listing_data = {
                'product_id': product_id,
                'retailer_id': retailer_id,
                'retailer_specific_id': record.get('asin') or record.get('tcin') or record.get('wm_item_id'),
                'upc': upc,  # UPC is now populated from UPC lookup service
                'url': record.get('url'),
                'price': self._parse_price(record.get('price')),
                'currency': 'USD',
                'in_stock': True,
                'last_checked': datetime.utcnow().isoformat()
            }
            
            self._upsert_listing(listing_data)
            
            self.logger.debug(f"Processed dict product: {record.get('title')} -> Categories: {category_names}")
            
        except Exception as e:
            self.logger.error(f"Error processing raw dict: {e}")
            raise
    
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
                        'is_primary': (i == 0)  # First category is primary
                    }
                    
                    self.supabase.table('product_categories').insert(assignment).execute()
                    
        except Exception as e:
            self.logger.error(f"Error assigning categories to product {product_id}: {e}")
    
    # extract brand from product name and create if needed
    def _extract_and_create_brand(self, product_name: str) -> Optional[str]:
        if not product_name:
            return None
        
        # simple brand extraction - common brand patterns
        brand_patterns = [
            # capitalized words at start
            r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)', 
            # all caps words
            r'\b([A-Z]{2,})\b',  
        ]
        
        # try each pattern
        for pattern in brand_patterns:
            match = re.search(pattern, product_name)
            if match:
                brand_name = match.group(1).strip()
                # if brand name is valid, get or create brand
                if len(brand_name) > 1 and brand_name not in ['THE', 'AND', 'OR']:
                    return self._get_or_create_brand(brand_name)
        
        return None
    
    # get or create brand in database
    def _get_or_create_brand(self, brand_name: str) -> str:
        if brand_name in self._brand_cache:
            return self._brand_cache[brand_name]
        
        brand_slug = self._create_slug(brand_name)
        
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
    
    # get retailer info from cache or database
    def _get_retailer_info(self, retailer_id) -> Optional[dict]:
        if retailer_id in self._retailer_cache:
            return self._retailer_cache[retailer_id]
        
        try:
            result = self.supabase.table('retailers').select('*').eq('id', retailer_id).execute()
            if result.data:
                retailer_info = result.data[0]
                self._retailer_cache[retailer_id] = retailer_info
                return retailer_info
        except Exception as e:
            self.logger.error(f"Error getting retailer info: {e}")
        
        return None
    
    # get or create retailer in database
    def _get_or_create_retailer(self, retailer_identifier) -> str:
        # check cache first
        if retailer_identifier in self._retailer_cache:
            return self._retailer_cache[retailer_identifier]
        
        # map retailer IDs to names (based on crawler config)
        retailer_map = {
            1: {'name': 'Amazon', 'slug': 'amazon', 'website_url': 'https://www.amazon.com'},
            2: {'name': 'Target', 'slug': 'target', 'website_url': 'https://www.target.com'},
            3: {'name': 'Walmart', 'slug': 'walmart', 'website_url': 'https://www.walmart.com'}
        }
        
        if isinstance(retailer_identifier, int) and retailer_identifier in retailer_map:
            retailer_info = retailer_map[retailer_identifier]
        else:
            # handle string identifiers or create generic retailer
            retailer_info = {
                'name': str(retailer_identifier),
                'slug': self._create_slug(str(retailer_identifier)),
                'website_url': None
            }
        
        try:
            # try to get existing retailer
            result = self.supabase.table('retailers').select('id').eq('slug', retailer_info['slug']).execute()
            
            if result.data:
                retailer_id = result.data[0]['id']
            else:
                # create new retailer
                result = self.supabase.table('retailers').insert(retailer_info).execute()
                retailer_id = result.data[0]['id']
            
            # cache result
            self._retailer_cache[retailer_identifier] = retailer_id
            return retailer_id
            
        except Exception as e:
            self.logger.error(f"Error getting/creating retailer: {e}")
            raise
    
    # product creation with better deduplication
    def _get_or_create_product(self, product_data: dict, record: ProductRecord) -> str:
        try:
            # try to find existing product by slug first
            result = self.supabase.table('products').select('id').eq('slug', product_data['slug']).execute()
            
            if result.data:
                return result.data[0]['id']
            
            # try to find by similar name (simple fuzzy matching)
            similar_products = self.supabase.table('products')\
                .select('id, name')\
                .ilike('name', f"%{product_data['name'][:20]}%")\
                .execute()
            
            # if similar product is found, return id
            if similar_products.data:
                # more sophisticated matching here
                self.logger.debug(f"Found similar product for: {product_data['name']}")
                return similar_products.data[0]['id']
            
            # create new product
            result = self.supabase.table('products').insert(product_data).execute()
            return result.data[0]['id']
                
        except Exception as e:
            self.logger.error(f"Error getting/creating product: {e}")
            raise
    
    # product creation from dict w/ better deduplication
    def _get_or_create_product_from_dict(self, product_data: dict, record: dict) -> str:
        try:
            # similar logic as above but for dict records
            result = self.supabase.table('products').select('id').eq('slug', product_data['slug']).execute()
            
            if result.data:
                return result.data[0]['id']
            
            # try retailer-specific ID matching if available
            retailer_specific_id = record.get('asin') or record.get('tcin') or record.get('wm_item_id')
            if retailer_specific_id:
                existing_listing = self.supabase.table('listings')\
                    .select('product_id')\
                    .eq('retailer_specific_id', retailer_specific_id)\
                    .execute()
                
                if existing_listing.data:
                    return existing_listing.data[0]['product_id']
            
            # create new product
            result = self.supabase.table('products').insert(product_data).execute()
            return result.data[0]['id']
                
        except Exception as e:
            self.logger.error(f"Error getting/creating product from dict: {e}")
            raise
    
    # upsert listing
    def _upsert_listing(self, listing_data: dict) -> None:
        try:
            # use upsert to handle duplicates
            result = self.supabase.table('listings').upsert(
                listing_data,
                on_conflict='product_id,retailer_id'
            ).execute()
            
            # add price history if price exists
            if listing_data.get('price') and result.data:
                listing_id = result.data[0]['id']
                price_history_data = {
                    'listing_id': listing_id,
                    'price': listing_data['price'],
                    'currency': listing_data['currency'],
                    'timestamp': listing_data['last_checked']
                }
                
                self.supabase.table('price_histories').insert(price_history_data).execute()
                
        except Exception as e:
            self.logger.error(f"Error upserting listing: {e}")
            raise
    
    # determine retailer from record structure
    def _determine_retailer_from_dict(self, record: dict) -> Optional[str]:
        if 'asin' in record:
            return self._get_or_create_retailer(1)  # Amazon
        elif 'tcin' in record:
            return self._get_or_create_retailer(2)  # Target
        elif 'wm_item_id' in record:
            return self._get_or_create_retailer(3)  # Walmart
        else:
            # try to determine from URL
            url = record.get('url', '')
            if 'amazon.com' in url:
                return self._get_or_create_retailer(1)
            elif 'target.com' in url:
                return self._get_or_create_retailer(2)
            elif 'walmart.com' in url:
                return self._get_or_create_retailer(3)
        
        return None
    
    # parse price string to float
    def _parse_price(self, price_str) -> Optional[float]:
        if not price_str or price_str == 'Unknown Price':
            return None
        
        try:
            # remove currency symbols and commas
            clean_price = str(price_str).replace('$', '').replace(',', '').strip()
            return float(clean_price)
        except (ValueError, TypeError):
            return None
    
    # create URL-friendly slug from name
    def _create_slug(self, name: str) -> str:
        import re
        
        # convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[\s_-]+', '-', slug)
        slug = slug.strip('-')
        
        # truncate if too long
        return slug[:255]
    
    # process a URL-only record (minimal processing)
    def _process_url_record(self, url: str) -> None:
        self.logger.debug(f"Processing URL record: {url}")

# factory function to create Supabase backend
def create_supabase_backend(supabase_url: str = None, supabase_key: str = None, enable_upc_lookup: bool = True) -> SupabaseBackend:
    return SupabaseBackend(supabase_url, supabase_key, enable_upc_lookup)
