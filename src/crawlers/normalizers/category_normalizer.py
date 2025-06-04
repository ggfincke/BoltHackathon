import os
import logging
import json
import re
from typing import List, Dict, Any, Optional, Set, Tuple
from supabase import Client

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
        
        # load existing categories from database
        self._load_existing_categories()
    
    # load main category hierarchy
    def _load_main_hierarchy(self):
        try:
            with open('categories.json', 'r') as f:
                self.main_hierarchy = json.load(f)
            self.logger.info("Loaded main category hierarchy")
        except Exception as e:
            self.logger.error(f"Failed to load main hierarchy: {e}")
            self.main_hierarchy = {"departments": []}
    
    # load retailer-specific hierarchies
    def _load_retailer_hierarchies(self):
        self.retailer_hierarchies = {}
        
        # files from sources
        hierarchy_files = {
            'amazon': 'crawlers/amazon/amazon_grocery_hierarchy.json',
            'target': 'crawlers/target/target_grocery_hierarchy.json', 
            'walmart': 'crawlers/walmart/walmart_grocery_hierarchy.json'
        }
        
        # load hierarchies
        for retailer, file_path in hierarchy_files.items():
            try:
                if os.path.exists(file_path):
                    with open(file_path, 'r') as f:
                        self.retailer_hierarchies[retailer] = json.load(f)
                    self.logger.info(f"Loaded {retailer} hierarchy")
                else:
                    self.logger.warning(f"Hierarchy file not found: {file_path}")
            except Exception as e:
                self.logger.error(f"Failed to load {retailer} hierarchy: {e}")
                self.retailer_hierarchies[retailer] = {"departments": []}
    
    # build searchable indexes of all categories & paths
    def _build_category_index(self):
        self.category_paths = {}  # category_name -> [full_path_list]
        self.category_slugs = {}  # category_name -> slug
        
        # build index for main hierarchy
        self._index_hierarchy_recursive(self.main_hierarchy.get('departments', []), [])
        
        # build mapping from retailer categories to main hierarchy
        self.retailer_category_map = {}
        for retailer in ['amazon', 'target', 'walmart']:
            self.retailer_category_map[retailer] = {}
            retailer_hierarchy = self.retailer_hierarchies.get(retailer, {})
            self._build_retailer_mapping(retailer, retailer_hierarchy.get('departments', []))
    
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
    
    # build mapping from retailer categories to main hierarchy categories
    def _build_retailer_mapping(self, retailer: str, departments: List[Dict]):
        self._map_retailer_recursive(retailer, departments)
    
    # recursively map retailer categories to main hierarchy
    def _map_retailer_recursive(self, retailer: str, items: List[Dict]):
        for item in items:
            retailer_category = item.get('name', '')
            if retailer_category:
                # find best match in main hierarchy
                best_match = self._find_best_category_match(retailer_category)
                if best_match:
                    self.retailer_category_map[retailer][retailer_category.lower()] = best_match
                
                # recurse into sub_items
                sub_items = item.get('sub_items', [])
                if sub_items:
                    self._map_retailer_recursive(retailer, sub_items)
    
    # find the best matching category in main hierarchy
    def _find_best_category_match(self, retailer_category: str) -> Optional[str]:
        retailer_lower = retailer_category.lower()
        
        # first try exact match
        for main_category in self.category_paths.keys():
            if main_category.lower() == retailer_lower:
                return main_category
        
        # try fuzzy matching - look for categories that contain key words
        retailer_words = set(retailer_lower.split())
        
        best_match = None
        best_score = 0
        
        for main_category in self.category_paths.keys():
            main_words = set(main_category.lower().split())
            
            # calculate word overlap
            overlap = len(retailer_words & main_words)
            if overlap > 0:
                # prefer more specific (deeper) categories
                paths = self.category_paths[main_category]
                max_depth = max(len(path) for path in paths) if paths else 0
                
                # score = word_overlap + depth_bonus
                score = overlap + (max_depth * 0.1)
                
                if score > best_score:
                    best_score = score
                    best_match = main_category
        
        return best_match
    
    # load existing categories from database to avoid creating duplicates
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
    
    # normalize & detect categories for a product
    def normalize_category(self, product_name: str, product_url: str, retailer_name: str, 
                          raw_category: str = None) -> List[str]:        
        categories = []
        
        # 1. try to map raw category if provided
        if raw_category:
            mapped_category = self._map_retailer_category(raw_category, retailer_name)
            if mapped_category:
                categories.append(mapped_category)
        
        # 2. extract category from url (if we can parse retailer-specific info)
        url_category = self._extract_category_from_url(product_url, retailer_name)
        if url_category and url_category not in categories:
            categories.append(url_category)
        
        # 3. infer category from product name
        inferred_categories = self._infer_categories_from_name(product_name)
        for cat in inferred_categories:
            if cat not in categories:
                categories.append(cat)
        
        # 4. find the most specific (lowest level) categories that exist in database
        existing_categories = []
        for category_name in categories:
            slug = self.category_slugs.get(category_name)
            if slug and slug in self._category_cache:
                existing_categories.append(category_name)
        
        # 5. if no existing categories found, crawl up hierarchy to find parent
        if not existing_categories:
            for category_name in categories:
                parent_category = self._find_existing_parent_category(category_name)
                if parent_category and parent_category not in existing_categories:
                    existing_categories.append(parent_category)
        
        # 6. fallback to groceries if it exists in database
        if not existing_categories:
            if 'groceries' in self._category_cache:
                existing_categories.append('Groceries')
        
        return existing_categories[:3]  # limit to top 3
    
    # map retailer-specific category to main hierarchy category
    def _map_retailer_category(self, raw_category: str, retailer_name: str) -> Optional[str]:
        retailer_name = retailer_name.lower()
        raw_category_lower = raw_category.lower().strip()
        
        # use pre-built mapping
        retailer_map = self.retailer_category_map.get(retailer_name, {})
        
        # direct mapping
        if raw_category_lower in retailer_map:
            return retailer_map[raw_category_lower]
        
        # fuzzy matching within retailer map
        for retailer_cat, main_cat in retailer_map.items():
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
            
            # check if all words from category are in product name
            if all(word in product_name_lower for word in category_words):
                matched_categories.append(category_name)
        
        # sort by specificity (deeper categories first)
        matched_categories.sort(key=lambda cat: max(len(path) for path in self.category_paths[cat]), reverse=True)
        
        return matched_categories
    
    # find the nearest parent category that exists in database
    def _find_existing_parent_category(self, category_name: str) -> Optional[str]:
        if category_name not in self.category_paths:
            return None
        
        # get all paths for this category
        paths = self.category_paths[category_name]
        
        # for each path, walk up the hierarchy to find existing parent
        for path in paths:
            for i in range(len(path) - 1, 0, -1):  # walk backwards up the path
                parent_name = path[i - 1]
                parent_slug = self.category_slugs.get(parent_name)
                if parent_slug and parent_slug in self._category_cache:
                    return parent_name
        
        return None
    
    # get category IDs for existing categories only - never create new ones
    def get_or_create_categories(self, category_names: List[str]) -> List[str]:
        category_ids = []
        
        for category_name in category_names:
            slug = self.category_slugs.get(category_name)
            if slug and slug in self._category_cache:
                category_ids.append(self._category_cache[slug])
            else:
                self.logger.warning(f"Category not found in database: {category_name}")
        
        return category_ids
    
    # create URL-friendly slug from name
    def _create_slug(self, name: str) -> str:
        # convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[\s_-]+', '-', slug)
        slug = slug.strip('-')
        
        # truncate if too long
        return slug[:255] 