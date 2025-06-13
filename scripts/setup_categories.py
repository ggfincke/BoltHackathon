"""
Category Setup and Debugging Script

1. Adds categories from hierarchy files to the database
2. Checks category normalization and existence in the database

Usage:
    python scripts/setup_categories.py --check-category "Gummy Candies"
    python scripts/setup_categories.py --populate-from-hierarchy amazon
    python scripts/setup_categories.py --debug-normalization "JOLLY RANCHER Gummies"
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from supabase import create_client

# adding project root to path (so we can import from src)
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.crawlers.normalizers.category_normalizer import CategoryNormalizer

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

# load hierarchy file for the given retailer
def load_hierarchy_file(retailer: str) -> dict:    
    hierarchy_files = {
        'amazon': 'data/processed/simplified_amazon.json',
        'target': 'data/processed/simplified_target.json', 
        'walmart': 'data/processed/simplified_walmart.json'
    }
    
    file_path = hierarchy_files.get(retailer.lower())
    if not file_path or not os.path.exists(file_path):
        # try raw data directory
        file_path = f'data/raw/{retailer.lower()}_grocery_hierarchy.json'
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Hierarchy file not found for {retailer}")
    
    with open(file_path, 'r') as f:
        return json.load(f)

# extract all category names from hierarchy
def extract_all_categories(hierarchy: dict) -> list:    
    categories = []
    
    def extract_recursive(items):
        for item in items:
            name = item.get('name', '')
            if name:
                categories.append(name)
            sub_items = item.get('sub_items', [])
            if sub_items:
                extract_recursive(sub_items)
    
    departments = hierarchy.get('departments', [])
    extract_recursive(departments)
    return categories

# check if a category exists in the database
def check_category_exists(supabase, category_name: str, logger):
    try:
        # create slug like the normalizer does
        import re
        slug = re.sub(r'[^a-zA-Z0-9\s]', '', category_name.lower())
        slug = re.sub(r'\s+', '-', slug.strip())
        
        result = supabase.table('categories').select('id, name, slug').eq('slug', slug).execute()
        
        if result.data:
            logger.info(f"✓ Category '{category_name}' exists in database with ID: {result.data[0]['id']}")
            return result.data[0]
        else:
            logger.warning(f"✗ Category '{category_name}' (slug: '{slug}') NOT found in database")
            return None
    except Exception as e:
        logger.error(f"Error checking category '{category_name}': {e}")
        return None

# populate database with categories from hierarchy file
def populate_categories_from_hierarchy(supabase, retailer: str, logger):
    try:
        hierarchy = load_hierarchy_file(retailer)
        categories = extract_all_categories(hierarchy)
        
        logger.info(f"Found {len(categories)} categories in {retailer} hierarchy")
        
        created_count = 0
        for category_name in categories:
            if not check_category_exists(supabase, category_name, logger):
                # create category
                import re
                slug = re.sub(r'[^a-zA-Z0-9\s]', '', category_name.lower())
                slug = re.sub(r'\s+', '-', slug.strip())
                
                category_data = {
                    'name': category_name,
                    'slug': slug,
                    'path': category_name   
                }
                
                try:
                    result = supabase.table('categories').insert(category_data).execute()
                    if result.data:
                        logger.info(f"✓ Created category: {category_name}")
                        created_count += 1
                except Exception as e:
                    logger.error(f"Failed to create category '{category_name}': {e}")
        
        logger.info(f"Created {created_count} new categories")
        
    except Exception as e:
        logger.error(f"Error populating categories: {e}")

# debug category normalization for a specific product
def debug_category_normalization(supabase, product_name: str, retailer: str, category: str, logger):
    try:
        normalizer = CategoryNormalizer(supabase)
        
        logger.info(f"Debugging category normalization for: {product_name}")
        logger.info(f"Retailer: {retailer}, Raw Category: {category}")
        
        # test normalization
        category_names = normalizer.normalize_category(
            product_name=product_name,
            product_url="",
            retailer_name=retailer,
            raw_category=category
        )
        
        logger.info(f"Normalized categories: {category_names}")
        
        # get category IDs
        category_ids = normalizer.get_or_create_categories(category_names)
        logger.info(f"Category IDs: {category_ids}")
        
        # check each category in database
        for cat_name in category_names:
            check_category_exists(supabase, cat_name, logger)
            
    except Exception as e:
        logger.error(f"Error in debug normalization: {e}")

def main():
    parser = argparse.ArgumentParser(description='Category Setup and Debugging Tool')
    parser.add_argument('--check-category', help='Check if specific category exists in database')
    parser.add_argument('--populate-from-hierarchy', help='Populate categories from hierarchy file (amazon/target/walmart)')
    parser.add_argument('--debug-normalization', help='Debug category normalization for a product name')
    parser.add_argument('--retailer', default='amazon', help='Retailer for debugging (default: amazon)')
    parser.add_argument('--raw-category', help='Raw category to test with --debug-normalization')
    
    args = parser.parse_args()
    logger = setup_logging()
    
    # init supabase client
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    if args.check_category:
        check_category_exists(supabase, args.check_category, logger)
    
    elif args.populate_from_hierarchy:
        populate_categories_from_hierarchy(supabase, args.populate_from_hierarchy, logger)
    
    elif args.debug_normalization:
        debug_category_normalization(
            supabase, 
            args.debug_normalization, 
            args.retailer, 
            args.raw_category or "Gummy Candies",
            logger
        )
    
    else:
        logger.info("No action specified. Use --help for options.")

if __name__ == "__main__":
    main()