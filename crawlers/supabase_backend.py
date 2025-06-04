# supabase_backend.py
import os
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from supabase import create_client, Client
from crawlers.base_crawler import OutputBackend, ProductRecord

# supabase backend for storing crawler data directly to db
class SupabaseBackend(OutputBackend):    
    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        self.logger = logging.getLogger(__name__)
        
        # use env or provided values
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and key must be provided via parameters or environment variables")
        
        # init supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.logger.info("Supabase backend initialized")
        
        # cache for retailers to avoid repeated lookups
        self._retailer_cache = {}
        self._category_cache = {}
        self._brand_cache = {}
    
    # send records to supabase
    def send(self, records) -> None:
        if not records:
            self.logger.warning("No records to send to Supabase")
            return
        
        # ensure records is a list
        if not isinstance(records, list):
            records = [records]
        
        self.logger.info(f"Processing {len(records)} records for Supabase")
        
        # process different types of records
        for record in records:
            try:
                if isinstance(record, ProductRecord):
                    self._process_product_record(record)
                elif isinstance(record, dict):
                    self._process_raw_dict(record)
                elif isinstance(record, str):
                    self._process_url_record(record)
                else:
                    self.logger.warning(f"Unknown record type: {type(record)}")
            except Exception as e:
                self.logger.error(f"Error processing record: {e}")
                continue
        
        self.logger.info(f"Successfully processed {len(records)} records")
    
    # process a ProductRecord object & insert into database
    def _process_product_record(self, record: ProductRecord) -> None:
        try:
            # get or create retailer
            retailer_id = self._get_or_create_retailer(record.retailer_id)
            
            # extract product information
            product_data = {
                'name': record.title,
                'slug': self._create_slug(record.title),
                'description': None,  
                'is_active': True
            }
            
            # create or get product
            product_id = self._get_or_create_product(product_data, record)
            
            # create listing
            listing_data = {
                'product_id': product_id,
                'retailer_id': retailer_id,
                'sku': getattr(record, 'asin', None) or getattr(record, 'tcin', None) or getattr(record, 'wm_item_id', None),
                'url': str(record.url),
                'price': float(str(record.price).replace('$', '').replace(',', '')) if record.price and record.price != 'Unknown Price' else None,
                'currency': 'USD',
                'in_stock': True,
                'last_checked': datetime.utcnow().isoformat()
            }
            
            self._upsert_listing(listing_data)
            
        except Exception as e:
            self.logger.error(f"Error processing ProductRecord: {e}")
            raise
    
    # process a raw dictionary from grid crawlers
    def _process_raw_dict(self, record: dict) -> None:
        try:
            # determine retailer based on record structure
            retailer_id = self._determine_retailer_from_dict(record)
            
            if not retailer_id:
                self.logger.warning(f"Could not determine retailer for record: {record}")
                return
            
            # extract product info
            product_data = {
                'name': record.get('title', 'Unknown Product'),
                'slug': self._create_slug(record.get('title', 'Unknown Product')),
                'description': None,
                'is_active': True
            }
            
            # create or get product
            product_id = self._get_or_create_product_from_dict(product_data, record)
            
            # create listing
            listing_data = {
                'product_id': product_id,
                'retailer_id': retailer_id,
                'sku': record.get('asin') or record.get('tcin') or record.get('wm_item_id'),
                'url': record.get('url'),
                'price': self._parse_price(record.get('price')),
                'currency': 'USD',
                'in_stock': True,
                'last_checked': datetime.utcnow().isoformat()
            }
            
            self._upsert_listing(listing_data)
            
        except Exception as e:
            self.logger.error(f"Error processing raw dict: {e}")
            raise
    
    # process a URL-only record (minimal processing)
    def _process_url_record(self, url: str) -> None:
        # for URL-only records, we might just log them or store them in a separate table
        # this is mainly for the Redis-like functionality
        self.logger.debug(f"Processing URL record: {url}")
        # could implement URL queue table if needed
    
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
    
    # get or create product in database
    def _get_or_create_product(self, product_data: dict, record: ProductRecord) -> str:
        try:
            # try to find existing product by name (you might want to improve this logic)
            result = self.supabase.table('products').select('id').eq('slug', product_data['slug']).execute()
            
            if result.data:
                return result.data[0]['id']
            else:
                # create new product
                result = self.supabase.table('products').insert(product_data).execute()
                return result.data[0]['id']
                
        except Exception as e:
            self.logger.error(f"Error getting/creating product: {e}")
            raise
    
    # get or create product from raw dictionary
    def _get_or_create_product_from_dict(self, product_data: dict, record: dict) -> str:
        try:
            # similar to above but for dict records
            result = self.supabase.table('products').select('id').eq('slug', product_data['slug']).execute()
            
            if result.data:
                return result.data[0]['id']
            else:
                result = self.supabase.table('products').insert(product_data).execute()
                return result.data[0]['id']
                
        except Exception as e:
            self.logger.error(f"Error getting/creating product from dict: {e}")
            raise
    
    # upsert listing in database
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

# factory function to create Supabase backend
def create_supabase_backend(supabase_url: str = None, supabase_key: str = None) -> SupabaseBackend:
    # create supabase backend
    return SupabaseBackend(supabase_url, supabase_key)