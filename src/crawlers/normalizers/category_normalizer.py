"""
Category normalizer for handling category detection, mapping, and normalization.

This module provides the CategoryNormalizer class that handles category
normalization across different retailers, mapping retailer-specific categories
to a standardized hierarchy, and database operations for category management.
"""

import os
import logging
import json
import re
from typing import List, Dict, Any, Optional, Set, Tuple
from supabase import Client

# * Category normalizer class *

# category normalizer - handles category detection, mapping, & normalization
class CategoryNormalizer:
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.logger = logging.getLogger(__name__)
        
        # cache for category lookups from database
        self._category_cache = {}
        self._category_slug_cache = {}
        
        # load category hierarchies
        self._load_main_hierarchy()
        self._load_retailer_hierarchies()
        self._build_category_index()
        
        # load retailer specific -> main category mappings from JSON
        self._load_retailer_mappings()
        
        # load existing categories from database
        self._load_existing_categories()
    
    # * Initialization methods *
    
    # load main category hierarchy
    def _load_main_hierarchy(self):
        try:
            with open('categories.json', 'r') as f:
                self.main_hierarchy = json.load(f)
            self.logger.info("Loaded main category hierarchy")
        except Exception as e:
            self.logger.error(f"Failed to load main hierarchy: {e}")
            self.main_hierarchy = {"departments": []}
    
    # load retailer-specific hierarchies from processed data directory
    def _load_retailer_hierarchies(self):
        self.retailer_hierarchies = {}
        
        # updated paths to use processed hierarchy files from data directory
        hierarchy_files = {
            'amazon': 'data/processed/amazon_grocery_hierarchy.json',
            'target': 'data/processed/target_grocery_hierarchy.json', 
            'walmart': 'data/processed/walmart_grocery_hierarchy.json'
        }
        
        # load hierarchies
        for retailer, file_path in hierarchy_files.items():
            try:
                if os.path.exists(file_path):
                    with open(file_path, 'r') as f:
                        self.retailer_hierarchies[retailer] = json.load(f)
                    self.logger.info(f"Loaded {retailer} simplified hierarchy from {file_path}")
                else:
                    self.logger.warning(f"Simplified hierarchy file not found: {file_path}")
                    self.retailer_hierarchies[retailer] = {"departments": []}
            except Exception as e:
                self.logger.error(f"Failed to load {retailer} simplified hierarchy: {e}")
                self.retailer_hierarchies[retailer] = {"departments": []}
    
    # load existing categories from database
    def _load_existing_categories(self):
        try:
            result = self.supabase.table('categories').select('id, name, slug').execute()
            if result.data:
                for cat in result.data:
                    self._category_cache[cat['slug']] = cat['id']
                    self._category_slug_cache[cat['name']] = cat['slug']
                self.logger.info(f"Loaded {len(result.data)} existing categories from database")
        except Exception as e:
            self.logger.error(f"Failed to load existing categories: {e}")
    
    # * Index building methods *
    
    # build searchable indexes of all categories & paths
    def _build_category_index(self):
        self.category_paths = {}  # category_name -> [full_path_list]
        self.category_slugs = {}  # category_name -> slug
        
        # build index for main hierarchy
        self._index_hierarchy_recursive(self.main_hierarchy.get('departments', []), [])
    
    # recursively index the hierarchy to build category paths
    def _index_hierarchy_recursive(self, items: List[Dict], current_path: List[str]):
        for item in items:
            name = item.get('name', '')
            if name:
                full_path = current_path + [name]
                
                # store path for this category
                if name not in self.category_paths:
                    self.category_paths[name] = []
                self.category_paths[name].append(full_path)
                
                # create slug for this category
                slug = self._create_slug(name)
                self.category_slugs[name] = slug
                
                # recurse into sub_items
                sub_items = item.get('sub_items', [])
                if sub_items:
                    self._index_hierarchy_recursive(sub_items, full_path)
    

    
    # * Main normalization methods *
    
    # normalize & detect categories for a product
    def normalize_category(self, product_name: str, product_url: str, retailer_name: str, 
                          raw_category: str = None) -> List[str]:        
        categories = []
        
        self.logger.info(f"🔍 CATEGORY DEBUG - normalize_category called:")
        self.logger.info(f"  product_name: {product_name}")
        self.logger.info(f"  raw_category: {raw_category}")
        self.logger.info(f"  retailer_name: {retailer_name}")
        
        # 1. try to map raw category if provided
        if raw_category:
            mapped_category = self._map_retailer_category(raw_category, retailer_name)
            self.logger.info(f"  mapped_category result: {mapped_category}")
            if mapped_category:
                categories.append(mapped_category)
        
        # 2. extract category from url
        url_category = self._extract_category_from_url(product_url, retailer_name)
        if url_category and url_category not in categories:
            categories.append(url_category)
        
        # 3. infer category from product name
        inferred_categories = self._infer_categories_from_name(product_name)
        for cat in inferred_categories:
            if cat not in categories:
                categories.append(cat)
        
        # 4. if categories (mapped ones), return them
        # get_or_create_categories handles creating (if they don't exist)
        if categories:
            self.logger.info(f"  final categories list: {categories[:3]}")
            return categories[:3]
        
        # 5. fallback to groceries only if no categories found
        if 'groceries' in self._category_cache:
            self.logger.info(f"  final categories list: ['Groceries']")
            return ['Groceries']
            
        self.logger.info(f"  final categories list: []")
        return []
    
    # * Helper methods *
    
    # map retailer-specific category to main hierarchy category
    def _map_retailer_category(self, raw_category: str, retailer_name: str) -> Optional[str]:
        retailer_name = retailer_name.lower()
        raw_category_lower = raw_category.lower().strip()
        
        # use direct mappings from mappings.py
        retailer_mappings = self.retailer_mappings.get(retailer_name, {})
        
        # direct exact mapping
        if raw_category_lower in retailer_mappings:
            result = retailer_mappings[raw_category_lower]
            return result
        
        # fuzzy matching within retailer mappings
        for retailer_cat, main_cat in retailer_mappings.items():
            if retailer_cat in raw_category_lower or raw_category_lower in retailer_cat:
                return main_cat
        
        return None
    
    # extract category from url using retailer hierarchy
    def _extract_category_from_url(self, url: str, retailer_name: str) -> Optional[str]:
        if not url:
            return None
        
        # this could be enhanced to parse specific URL patterns and match to hierarchy
        # for now, just do basic keyword matching
        return None
    
    # infer categories from product name using main hierarchy
    def _infer_categories_from_name(self, product_name: str) -> List[str]:
        if not product_name:
            return []
        
        product_name_lower = product_name.lower()
        matched_categories = []
        
        # look for category names in product name
        for category_name in self.category_paths.keys():
            category_words = category_name.lower().split()
            
            # check if all words in category name appear in product name
            if all(word in product_name_lower for word in category_words):
                matched_categories.append(category_name)
        
        # rank by specificity (more words = more specific)
        matched_categories.sort(key=lambda x: len(x.split()), reverse=True)
        
        return matched_categories[:5]  # return top 5 matches
    
    # find best matching category in main hierarchy
    def _find_best_main_category_match(self, retailer_category: str) -> Optional[str]:
        retailer_category_lower = retailer_category.lower()
        
        # exact match first
        for main_category in self.category_paths.keys():
            if main_category.lower() == retailer_category_lower:
                return main_category
        
        # enhanced partial matching with better text normalization
        best_match = None
        best_score = 0
        
        for main_category in self.category_paths.keys():
            main_category_lower = main_category.lower()
            
            # normalize text for better matching
            retailer_normalized = self._normalize_category_text(retailer_category_lower)
            main_normalized = self._normalize_category_text(main_category_lower)
            
            # calculate similarity score
            retailer_words = set(retailer_normalized.split())
            main_words = set(main_normalized.split())
            
            # jaccard similarity
            intersection = retailer_words.intersection(main_words)
            union = retailer_words.union(main_words)
            
            if union:
                score = len(intersection) / len(union)
                
                # bonus for key word matches
                key_words = {"gummy", "chewy", "candy", "candies", "chocolate", "snack", "beverage"}
                key_matches = intersection.intersection(key_words)
                if key_matches:
                    score += 0.2 * len(key_matches)  # boost score for key matches
            
            # lowered threshold and added special cases
            if score > best_score and score > 0.2:  # lowered from 0.3 to 0.2
                best_score = score
                best_match = main_category
        
        return best_match

    # normalize category text for better matching
    def _normalize_category_text(self, text: str) -> str:
        # remove special characters
        text = re.sub(r'[&+\-/\\]', ' ', text)
        
        # handle plural/singular forms
        text = re.sub(r'\bcandies\b', 'candy', text)
        text = re.sub(r'\bbeverages\b', 'beverage', text)
        text = re.sub(r'\bsnacks\b', 'snack', text)
        
        # remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    # find existing parent category in database
    def _find_existing_parent_category(self, category_name: str) -> Optional[str]:
        category_paths = self.category_paths.get(category_name, [])
        
        for path in category_paths:
            # traverse path from specific to general
            for i in range(len(path) - 1, -1, -1):
                parent_name = path[i]
                parent_slug = self.category_slugs.get(parent_name)
                if parent_slug and parent_slug in self._category_cache:
                    return parent_name
        
        return None
    
    # create slug from category name
    def _create_slug(self, name: str) -> str:
        # convert to lowercase and replace spaces/special chars w/ hyphens
        slug = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
        slug = re.sub(r'\s+', '-', slug.strip())
        return slug
    
    # * Database operations *
    
    # get or create category in database
    def get_or_create_category(self, category_name: str) -> Optional[int]:
        slug = self.category_slugs.get(category_name)
        if not slug:
            slug = self._create_slug(category_name)
        
        # check cache first
        if slug in self._category_cache:
            return self._category_cache[slug]
        
        try:
            # try to get from database
            result = self.supabase.table('categories').select('id').eq('slug', slug).execute()
            
            if result.data:
                category_id = result.data[0]['id']
                self._category_cache[slug] = category_id
                return category_id
            
            # create new category
            category_data = {
                'name': category_name,
                'slug': slug,
                'path': self._get_category_path_string(category_name)
            }
            
            result = self.supabase.table('categories').insert(category_data).execute()
            if result.data:
                category_id = result.data[0]['id']
                self._category_cache[slug] = category_id
                self.logger.info(f"Created new category: {category_name}")
                return category_id
        
        except Exception as e:
            self.logger.error(f"Failed to get/create category {category_name}: {e}")
        
        return None
    
    # get category path as string
    def _get_category_path_string(self, category_name: str) -> str:
        paths = self.category_paths.get(category_name, [])
        if paths:
            # use the first path
            return ' > '.join(paths[0])
        return category_name
    
    # get or create multiple categories in database
    def get_or_create_categories(self, category_names: List[str]) -> List[str]:
        category_ids = []
        
        for category_name in category_names:
            # skip empty names
            if category_name:
                category_id = self.get_or_create_category(category_name)
                if category_id:
                    category_ids.append(category_id)
        
        return category_ids 

    # load retailer mappings from JSON file
    def _load_retailer_mappings(self):
        mappings_path = "data/processed/retailer_category_mappings.json"
        try:
            if os.path.exists(mappings_path):
                with open(mappings_path, "r") as f:
                    self.retailer_mappings = json.load(f)
                self.logger.info(f"Loaded retailer category mappings from {mappings_path}")
            else:
                self.logger.warning(f"Retailer mappings file not found at {mappings_path}. Falling back to empty mappings.")
                self.retailer_mappings = {}
        except Exception as e:
            self.logger.error(f"Failed to load retailer category mappings: {e}")
            self.retailer_mappings = {} 