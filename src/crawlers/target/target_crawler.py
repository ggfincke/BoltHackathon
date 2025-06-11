"""
Target crawler implementation for extracting product data.

This module provides the TargetCrawler class that extends BaseCrawler
to crawl Target's grocery categories and extract product information.
Supports hierarchical crawling, category filtering, and URL extraction.
"""

import json
import os
import asyncio
import concurrent.futures
from pathlib import Path
from typing import List

from ..base_crawler import BaseCrawler, ProductRecord, Target, create_redis_client, create_redis_backend, MAX_DEPTH, CONCURRENCY
from .subcrawlers.category_crawler import crawl_category
from .subcrawlers.grid_crawler import crawl_grid

# * Target crawler class *

# target crawler
class TargetCrawler(BaseCrawler):
    def __init__(self, retailer_id, logger=None, category=None, department=None, output_backend=None, urls_only=False, hierarchical=False):
        super().__init__(retailer_id, output_backend, logger, urls_only, hierarchical, department, category)
        self.base_url = "https://www.target.com"
        self.logger.info("TargetCrawler initialized. Playwright will be launched as needed.")
        self.logger.info(f"Mode: {'Hierarchical' if hierarchical else 'URL-only' if urls_only else 'Full product data'}")
        self._load_category_config()
        # target category and department
        self.target_category = category
        self.target_department = department
        # reuse one loop
        self.loop = asyncio.get_event_loop()

    # * Config & util methods *
    # load category config from json file
    def _load_category_config(self):
        config_path = os.getenv("TARGET_CATEGORY_CONFIG") or "data/processed/simplified_target.json"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.category_config = json.load(f)
            self.logger.info("Successfully loaded Target category configuration from processed hierarchy")
        except Exception as e:
            # fallback - old location (if processed file doesn't exist)
            fallback_path = Path(__file__).parent / "target_grocery_hierarchy.json"
            try:
                with open(fallback_path, 'r', encoding='utf-8') as f:
                    self.category_config = json.load(f)
                self.logger.warning(f"Using fallback hierarchy file: {fallback_path}")
            except Exception as e2:
                self.logger.error(f"Failed to load Target category configuration: {e}, fallback: {e2}")
                self.category_config = {"departments": []}

    # find a category in the config
    def _find_category_in_config(self, category_name):
        # find a category by name in the loaded configuration
        def search_categories(categories, name):
            # check current category
            for category in categories:
                if category.get("name") == name or category.get("department_name") == name:
                    return category
                # check sub items
                if "sub_items" in category and category["sub_items"]:
                    result = search_categories(category["sub_items"], name)
                    if result:
                        return result
                # check entry point categories
                if "entry_point_categories" in category and category["entry_point_categories"]:
                    result = search_categories(category["entry_point_categories"], name)
                    if result:
                        return result
            return None
        
        # check if it's a department
        for department in self.category_config.get("departments", []):
            if department.get("department_name") == category_name:
                return department
            
            # check entry point categories
            if "entry_point_categories" in department:
                result = search_categories(department["entry_point_categories"], category_name)
                if result:
                    return result
        
        # if not found in departments, do a broad search
        return search_categories(self.category_config.get("departments", []), category_name)

    # return a list of dicts [{"name": "Beverages", "start_url": etc.} depending on filters or all departments (many)
    def _resolve_targets(self, category_filter: str | None = None, department_filter: str | None = None) -> list[Target]:
        # prefer the explicit arguments, fall back to instance attributes
        cat = category_filter or self.target_category
        dept = department_filter or self.target_department

        # targeted category crawl
        if cat:                     
            node = self._find_category_in_config(cat)
            if not node:
                self.logger.error("Category '%s' not found", cat)
                return []
            return [Target(node.get("name") or node.get("department_name"), node["link_url"])]

        # targeted department crawl (all subcategories within department)
        if dept:                     
            dept_node = self._find_category_in_config(dept)
            if not dept_node:
                self.logger.error("Department '%s' not found", dept)
                return []
            
            # collect all subcategories within this department as targets
            targets = []
            
            # if department has direct sub_items, use those
            if dept_node.get("sub_items"):
                for item in dept_node["sub_items"]:
                    targets.append(Target(item["name"], item["link_url"]))
            
            # if department has entry_point_categories, use those (legacy structure)
            if dept_node.get("entry_point_categories"):
                for entry in dept_node["entry_point_categories"]:
                    targets.append(Target(entry["name"], entry["link_url"]))
                    
            self.logger.info(f"Found {len(targets)} subcategories in department '{dept}'")
            return targets

        # full crawl
        targets: list[Target] = []
        for department in self.category_config["departments"]:
            # if department has direct sub_items, use those
            if department.get("sub_items"):
                for item in department["sub_items"]:
                    targets.append(Target(item["name"], item["link_url"]))
            
            # if department has entry_point_categories, use those (legacy structure)
            if department.get("entry_point_categories"):
                for entry in department["entry_point_categories"]:
                    targets.append(Target(entry["name"], entry["link_url"]))
                    
        return targets

    # extract all leaf category URLs from a category tree
    def _collect_leaf_urls(self, cat_json: dict) -> list[str]:
        urls = []
        def walk(node):
            if node.get("sub_items"):
                for child in node["sub_items"]:
                    walk(child)
            else:
                if "link_url" in node:
                    urls.append(node["link_url"])
        walk(cat_json)
        return urls

    # * Category discovery methods *

    # discover category URLs
    def _discover_category_urls(self) -> list[str]:
        # resolve target nodes
        target_nodes = self._resolve_targets()
        if not target_nodes:
            self.logger.error("No target categories found to crawl")
            return []
            
        # crawl each target node
        all_urls = []
        for node in target_nodes:
            self.logger.info(f"Starting category crawl for: {node.name}")
            cat_json = self.loop.run_until_complete(
                crawl_category(
                    start_url=node.url,
                    max_depth=MAX_DEPTH,
                    logger=self.logger
                )
            )
            urls = self._collect_leaf_urls(cat_json)
            all_urls.extend(urls)
            
        return all_urls

    # * Category scraping methods *

    # scrape a category - full product data (for JSON test output)
    def _scrape_category(self, url: str, max_pages: int) -> list[ProductRecord]:
        # crawl the grid
        raw_products = crawl_grid(
            start_urls=[url],
            max_depth=max_pages,
            extract_urls_only=False,
            logger=self.logger
        )
        
        # convert raw product data to ProductRecord objects
        return [
            ProductRecord(
                retailer_id=self.retailer_id,
                tcin=item["tcin"],
                title=item["title"],
                price=item["price"],
                url=item["url"],
            )
            for item in raw_products
        ]
        
    # scrape a category - URL-only (for Redis)
    def _scrape_category_urls_only(self, url: str, max_pages: int) -> list[str]:
        # crawl the grid for URLs only
        self.logger.info(f"Crawling grid URLs only from {url}")
        urls = crawl_grid(
            start_urls=[url],
            max_depth=max_pages,
            extract_urls_only=True,
            logger=self.logger
        )
        self.logger.info(f"Found {len(urls)} URLs to send to Redis")
        return urls

    # * Concurrent crawling methods *

    # crawl multiple grid URLs concurrently (new method for hierarchy file mode)
    def _crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int) -> None:
        self.logger.info(f"Starting concurrent grid crawling for {len(grid_urls)} categories with concurrency={concurrency}")
        
        # split URLs into batches for concurrent processing
        batch_size = max(1, len(grid_urls) // concurrency)
        batches = [grid_urls[i:i + batch_size] for i in range(0, len(grid_urls), batch_size)]
        
        self.logger.info(f"Processing {len(grid_urls)} URLs in {len(batches)} batches")
        
        # use ThreadPoolExecutor for concurrent processing (since grid_crawler uses Selenium)
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(concurrency, len(batches))) as executor:
            # submit all batches
            future_to_batch = {
                executor.submit(self._process_batch_sync, batch, max_pages_per_cat, i + 1): i + 1 
                for i, batch in enumerate(batches)
            }
            
            # collect results as they complete
            for future in concurrent.futures.as_completed(future_to_batch):
                batch_num = future_to_batch[future]
                try:
                    batch_results = future.result()
                    all_results.extend(batch_results)
                    self.logger.info(f"Batch {batch_num} completed with {len(batch_results)} items")
                except Exception as e:
                    self.logger.error(f"Batch {batch_num} failed: {e}")
        
        # send results to output backend
        if all_results:
            self.logger.info(f"Collected {len(all_results)} total items from concurrent crawling")
            self._out.send(all_results)
        else:
            self.logger.warning("No results collected from concurrent crawling")

    # process a batch of URLs synchronously (for use with ThreadPoolExecutor)
    def _process_batch_sync(self, urls: List[str], max_pages_per_cat: int, batch_num: int):
        self.logger.info(f"Target Batch {batch_num}: Processing {len(urls)} URLs")
        
        try:
            # use existing crawl_grid function with the batch of URLs
            results = crawl_grid(
                start_urls=urls,
                max_depth=max_pages_per_cat,
                extract_urls_only=self.urls_only,
                use_safari=True, 
                proxy_manager=None,
                logger=self.logger
            )
            
            # convert results to expected format if needed
            if not self.urls_only:
                # full mode - convert raw dicts to ProductRecord objects if needed
                converted_results = []
                for item in results:
                    try:
                        if isinstance(item, dict):
                            # convert raw dict to ProductRecord
                            from ..base_crawler import ProductRecord
                            product_record = ProductRecord(
                                retailer_id=self.retailer_id,
                                tcin=item.get("tcin"),
                                title=item.get("title", "Unknown Title"),
                                price=item.get("price", "Unknown Price"),
                                url=item.get("url", "")
                            )
                            converted_results.append(product_record)
                        else:
                            # already a ProductRecord or similar
                            converted_results.append(item)
                    except Exception as e:
                        self.logger.error(f"Error converting Target item to ProductRecord: {e}, item: {item}")
                
                results = converted_results
            
            self.logger.info(f"Target Batch {batch_num}: Found {len(results)} items")
            return results
        except Exception as e:
            self.logger.error(f"Target Batch {batch_num} failed: {e}")
            return []

    # * Hierarchical crawling methods *

    # scrape hierarchical structure with products attached to leaf nodes
    def _scrape_hierarchy(self, max_pages_per_cat: int, category_filter: str = None, department_filter: str = None) -> dict:
        # resolve target nodes
        target_nodes = self._resolve_targets(category_filter, department_filter)
        if not target_nodes:
            self.logger.error("No target categories found to crawl")
            return {}
            
        # crawl each target node
        all_results = {}
        for node in target_nodes:
            self.logger.info(f"Starting hierarchical crawl for: {node.name}")
            cat_json = self.loop.run_until_complete(
                crawl_category(
                    start_url=node.url,
                    max_depth=MAX_DEPTH,
                    logger=self.logger
                )
            )
            
            # populate leaf nodes with products
            self._populate_leaf_nodes_with_products(cat_json, max_pages_per_cat)
            
            # add to results
            all_results[node.name] = cat_json
            
        return all_results

    # crawl from hierarchy file w/ optional filtering
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, max_pages_per_cat: int = 5, 
                                 category_filter: str = None, department_filter: str = None,
                                 concurrency: int = 5) -> None:
        # load hierarchy
        hierarchy = self._load_hierarchy_file(hierarchy_file)
        self.logger.info(f"Loaded Target hierarchy with {len(hierarchy.get('departments', []))} departments")
        
        # apply filters if specified
        original_hierarchy = hierarchy
        if category_filter or department_filter:
            self.logger.info(f"Applying filters: category='{category_filter}', department='{department_filter}'")
            filtered_hierarchy = self._filter_hierarchy(hierarchy, category_filter, department_filter)
            
            # verify filtering worked
            if filtered_hierarchy == hierarchy:
                self.logger.warning("Filtering did not reduce the hierarchy - using full hierarchy")
            else:
                hierarchy = filtered_hierarchy
                self.logger.info("Successfully applied hierarchy filter")
        
        # extract leaf URLs
        leaf_urls = self._extract_leaf_urls(hierarchy)
        
        if category_filter or department_filter:
            self.logger.info(f"After filtering to '{category_filter or department_filter}': found {len(leaf_urls)} leaf categories to crawl")
        else:
            self.logger.info(f"Found {len(leaf_urls)} leaf categories to crawl")
        
        if not leaf_urls:
            self.logger.warning("No leaf categories found to crawl")
            return
        
        # store original output backend
        original_backend = self._out
        
        # temp collector for hierarchical mode
        if self.hierarchical:
            # collect results to attach to hierarchy later
            collected_results = []
            
            # use base crawler's common hierarchical collection methods
            original_backend, collector = self._setup_hierarchical_collection()
            
            # crawl w/ the collector backend
            self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)
            
            # restore backend and send hierarchical results
            self._restore_backend_and_send_hierarchical(original_backend, collector, hierarchy, category_filter, department_filter)
        else:
            # non-hierarchical mode - crawl normally
            self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)

    # * Main interface methods *

    # main crawl method
    def crawl(self, max_pages_per_cat: int = 5) -> None:
        self.max_pages = max_pages_per_cat
        
        if self.hierarchical:
            # hierarchical crawl
            self.logger.info(f"Starting hierarchical crawl for Target (max_pages: {max_pages_per_cat})")
            hierarchy = self._scrape_hierarchy(max_pages_per_cat, self.category, self.department)
            self.output_backend.send(hierarchy)
        else:
            # single category or department crawl
            if self.category or self.department:
                category_urls = self._discover_category_urls()
                if self.urls_only:
                    # extract URLs only
                    all_urls = []
                    for url in category_urls:
                        urls = self._scrape_category_urls_only(url, max_pages_per_cat)
                        all_urls.extend(urls)
                    self.output_backend.send(all_urls)
                else:
                    # extract full product data
                    all_products = []
                    for url in category_urls:
                        products = self._scrape_category(url, max_pages_per_cat)
                        all_products.extend(products)
                    self.output_backend.send(all_products)
            else:
                self.logger.error("No category or department specified for non-hierarchical crawl")
                raise ValueError("Category or department must be specified for non-hierarchical crawls")
    
    def _get_category_url(self, category: str) -> str:
        # map category name to Target URL
        category_node = self._find_category_in_config(category)
        if category_node and "link_url" in category_node:
            return category_node["link_url"]
        else:
            # fallback: construct a search URL
            return f"https://www.target.com/s?searchTerm={category.lower().replace(' ', '+')}"