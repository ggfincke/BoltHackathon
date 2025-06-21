"""
Category Management Script

This script provides comprehensive category management functionality including:
1. Import hierarchical category structure from categories.json into Supabase
2. Populate categories from retailer hierarchy files 
3. Check category existence and normalization
4. Debug category normalization for specific products

Usage:
    # Import from categories.json
    python scripts/import_categories.py
    python scripts/import_categories.py --categories-file data/processed/categories.json
    python scripts/import_categories.py --dry-run
    
    # Populate from retailer hierarchy
    python scripts/import_categories.py --populate-from-hierarchy amazon
    
    # Check specific category
    python scripts/import_categories.py --check-category "Gummy Candies"
    
    # Debug normalization
    python scripts/import_categories.py --debug-normalization "JOLLY RANCHER Gummies"
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from supabase import create_client
import re
from dotenv import load_dotenv

# load from .env
load_dotenv(override=True)

# add src to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src'))

# import the category normalizer
from src.crawlers.normalizers.category_normalizer import CategoryNormalizer

# import the category importer class
class CategoryImporter:    
    def __init__(self, supabase_client, dry_run=False):
        self.supabase = supabase_client
        self.dry_run = dry_run
        self.logger = logging.getLogger(__name__)
        
        # track created categories to avoid duplicates
        self.created_categories = {}
        self.category_slugs = set()
        
    # create url friendly slug from category name
    def create_slug(self, name: str) -> str:
        # convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        slug = slug.strip('-')
        
        # ensure uniqueness
        original_slug = slug
        counter = 1
        while slug in self.category_slugs:
            slug = f"{original_slug}-{counter}"
            counter += 1
            
        self.category_slugs.add(slug)
        return slug
    
    # create a category in the database and return its ID
    def create_category(self, name: str, parent_id: Optional[str] = None, description: str = None) -> Optional[str]:        
        slug = self.create_slug(name)
        
        category_data = {
            'name': name,
            'slug': slug,
            'description': description,
            'parent_id': parent_id,
            'is_active': True
        }
        
        if self.dry_run:
            self.logger.info(f"[DRY RUN] Would create category: {name} (parent: {parent_id})")
            # generate fake UUID for dry run
            fake_id = f"fake-{len(self.created_categories)}"
            self.created_categories[name] = fake_id
            return fake_id
        
        try:
            # check if category already exists
            query = self.supabase.table('categories')\
                .select('id')\
                .eq('name', name)
            
            if parent_id is None:
                query = query.is_('parent_id', 'null')
            else:
                query = query.eq('parent_id', parent_id)
                
            existing = query.execute()
            
            if existing.data:
                category_id = existing.data[0]['id']
                self.logger.info(f"Category already exists: {name} (ID: {category_id})")
                self.created_categories[name] = category_id
                return category_id
            
            # create new category
            result = self.supabase.table('categories').insert(category_data).execute()
            
            if result.data:
                category_id = result.data[0]['id']
                self.created_categories[name] = category_id
                self.logger.info(f"Created category: {name} (ID: {category_id})")
                return category_id
            else:
                self.logger.error(f"Failed to create category: {name}")
                return None
                
        except Exception as e:
            self.logger.error(f"Error creating category {name}: {e}")
            return None
    
    # process a single category node and its children
    def process_category_node(self, node: Dict[str, Any], parent_id: Optional[str] = None) -> Optional[str]:        
        # get category name - could be 'name' or 'department_name'
        category_name = node.get('name') or node.get('department_name')
        if not category_name:
            self.logger.warning(f"Node missing name: {node}")
            return None
        
        # create category
        category_id = self.create_category(
            name=category_name,
            parent_id=parent_id,
            description=node.get('description')
        )
        
        if not category_id:
            return None
        
        # process sub-items recursively
        sub_items = node.get('sub_items', [])
        for sub_item in sub_items:
            self.process_category_node(sub_item, parent_id=category_id)
        
        return category_id
    
    # import the complete category hierarchy
    def import_categories(self, categories_data: Dict[str, Any]) -> None:        
        self.logger.info("Starting category import...")
        
        # handle root level
        if 'name' in categories_data and categories_data['name']:
            # create root category
            root_id = self.create_category(
                name=categories_data['name'],
                description="Root grocery store category"
            )
        else:
            root_id = None
        
        # process departments
        departments = categories_data.get('departments', [])
        
        for department in departments:
            dept_id = self.process_category_node(department, parent_id=root_id)
            
        self.logger.info(f"Category import completed. Created {len(self.created_categories)} categories.")
    
    # clear all existing categories
    def clear_existing_categories(self) -> None:        
        if self.dry_run:
            self.logger.info("[DRY RUN] Would clear all existing categories")
            return
        
        try:
            # this will cascade delete due to foreign key constraints
            result = self.supabase.table('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            self.logger.info("Cleared existing categories")
        except Exception as e:
            self.logger.error(f"Error clearing categories: {e}")
            raise

    # populate database with categories from hierarchy file
    def populate_categories_from_hierarchy(self, retailer: str) -> None:
        try:
            hierarchy = load_hierarchy_file(retailer)
            categories = extract_all_categories(hierarchy)
            
            self.logger.info(f"Found {len(categories)} categories in {retailer} hierarchy")
            
            created_count = 0
            for category_name in categories:
                if not check_category_exists(self.supabase, category_name, self.logger):
                    # create category using the importer's method
                    category_id = self.create_category(name=category_name)
                    if category_id:
                        created_count += 1
            
            self.logger.info(f"Created {created_count} new categories")
            
        except Exception as e:
            self.logger.error(f"Error populating categories: {e}")

# setup logging configuration
def setup_logging(log_level: str = "INFO") -> None:    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

# load categories from JSON file
def load_categories_json(file_path: str) -> Dict[str, Any]:    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load categories file {file_path}: {e}")
        raise

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

# create supabase client
def create_supabase_client():    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
    
    return create_client(supabase_url, supabase_key)

# main function
def main():
    # parse arguments
    parser = argparse.ArgumentParser(description="Comprehensive Category Management Tool")
    
    # Import categories options
    parser.add_argument(
        "--categories-file", 
        default="data/processed/categories.json",
        help="Path to categories JSON file for import"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true",
        help="Show what would be imported without making changes"
    )
    parser.add_argument(
        "--clear-existing", 
        action="store_true",
        help="Clear existing categories before import (DANGEROUS!)"
    )
    
    # Setup categories options
    parser.add_argument(
        "--populate-from-hierarchy", 
        help="Populate categories from hierarchy file (amazon/target/walmart)"
    )
    parser.add_argument(
        "--check-category", 
        help="Check if specific category exists in database"
    )
    parser.add_argument(
        "--debug-normalization", 
        help="Debug category normalization for a product name"
    )
    parser.add_argument(
        "--retailer", 
        default="amazon", 
        help="Retailer for debugging (default: amazon)"
    )
    parser.add_argument(
        "--raw-category", 
        help="Raw category to test with --debug-normalization"
    )
    
    # General options
    parser.add_argument(
        "--log-level", 
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level"
    )
    
    args = parser.parse_args()
    
    # setup logging
    setup_logging(args.log_level)
    logger = logging.getLogger(__name__)
    
    try:
        # create supabase client
        logger.info("Connecting to Supabase...")
        supabase = create_supabase_client()
        
        # create importer
        importer = CategoryImporter(supabase, dry_run=args.dry_run)
        
        # handle different operations
        if args.check_category:
            check_category_exists(supabase, args.check_category, logger)
            
        elif args.populate_from_hierarchy:
            importer.populate_categories_from_hierarchy(args.populate_from_hierarchy)
            
        elif args.debug_normalization:
            debug_category_normalization(
                supabase, 
                args.debug_normalization, 
                args.retailer, 
                args.raw_category or "Gummy Candies",
                logger
            )
            
        else:
            # default behavior: import from categories file
            logger.info(f"Loading categories from: {args.categories_file}")
            categories_data = load_categories_json(args.categories_file)
            
            # clear existing categories if requested
            if args.clear_existing:
                if args.dry_run:
                    logger.info("[DRY RUN] Would clear existing categories")
                else:
                    logger.warning("Clearing existing categories...")
                    importer.clear_existing_categories()
            
            # import categories
            importer.import_categories(categories_data)
            
            if args.dry_run:
                logger.info("Dry run completed. No changes made to database.")
            else:
                logger.info("Category import completed successfully!")
            
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()