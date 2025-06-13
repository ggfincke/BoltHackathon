"""
Amazon crawler implementation for extracting product data.

This module provides the AmazonCrawler class that extends BaseCrawler
to crawl Amazon's grocery categories and extract product information.
Supports hierarchical crawling, category filtering, and async URL extraction.
"""

import json
import os
import asyncio
from pathlib import Path
from typing import List, Dict

from ..base_crawler import BaseCrawler, ProductRecord, Target, create_redis_client, create_redis_backend, MAX_DEPTH, CONCURRENCY
from .subcrawlers.category_crawler import crawl_category
from .subcrawlers.grid_crawler import crawl_grid

# * Amazon crawler class *

# amazon crawler
class AmazonCrawler(BaseCrawler):
    def __init__(self, retailer_id, logger=None, category=None, department=None, output_backend=None, urls_only=False, hierarchical=False):
        super().__init__(retailer_id, output_backend, logger, urls_only, hierarchical, department, category)
        self.base_url = "https://www.amazon.com"
        self._load_category_config()
        self.logger.info("AmazonCrawler initialized. Playwright will be launched as needed.")
    
    # * Config & util methods *
    # load category config from json file
    def _load_category_config(self):
        config_path = os.getenv("AMZ_CATEGORY_CONFIG") or "data/processed/simplified_amazon.json"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.category_config = json.load(f)
            self.logger.info("Successfully loaded Amazon category configuration from processed hierarchy")
        except Exception as e:
            # fallbcack - old location (if processed file doesn't exist)
            fallback_path = Path(__file__).parent / "amazon_grocery_hierarchy.json"
            try:
                with open(fallback_path, 'r', encoding='utf-8') as f:
                    self.category_config = json.load(f)
                self.logger.warning(f"Using fallback hierarchy file: {fallback_path}")
            except Exception as e2:
                self.logger.error(f"Failed to load Amazon category configuration: {e}, fallback: {e2}")
                self.category_config = {"departments": []}
    
    # map category name to amazon URL
    def _get_category_url(self, category: str) -> str:
        category_mappings = {
            "Beverages": "https://www.amazon.com/s?k=beverages&i=wholefoods",
            "Snacks": "https://www.amazon.com/s?k=snacks&i=wholefoods",
            "Dairy": "https://www.amazon.com/s?k=dairy&i=wholefoods",
            "Produce": "https://www.amazon.com/s?k=produce&i=wholefoods",
        }
        
        if category in category_mappings:
            return category_mappings[category]
        else:
            # fallback: search for the category term
            return f"https://www.amazon.com/s?k={category.lower()}&i=wholefoods"
        
    # normalize URL to full Amazon URL (override base method)
    def _normalize_url(self, url: str) -> str:
        if url.startswith('http'):
            return url
        else:
            return f"https://www.amazon.com{url}"
    
    # * Category scraping methods *
    
    # scrape products from a category URL w/ specified subcategory
    def _scrape_category_with_subcategory(self, url: str, subcategory: str, max_pages: int) -> List[ProductRecord]:
        self.logger.info(f"Crawling products from {url} (subcategory: {subcategory})")
        
        # use grid crawler to get product data
        raw_products = self.loop.run_until_complete(
            crawl_grid(
                start_urls=[url],
                max_depth=max_pages,
                concurrency=CONCURRENCY,
                extract_urls_only=False,
                logger=self.logger
            )
        )
        
        # convert to ProductRecord objects w/ provided subcategory
        return [
            ProductRecord(
                retailer_id=self.retailer_id,
                asin=item.get("asin"),
                title=item["title"],
                price=item["price"],
                url=item["url"],
                category=subcategory,
            )
            for item in raw_products
        ]
    
    # scrape products from a category URL (legacy method for backward compatibility)
    def _scrape_category(self, url: str, max_pages: int) -> List[ProductRecord]:
        self.logger.info(f"Crawling products from {url}")
        
        # use grid crawler to get product data
        raw_products = self.loop.run_until_complete(
            crawl_grid(
                start_urls=[url],
                max_depth=max_pages,
                concurrency=CONCURRENCY,
                extract_urls_only=False,
                logger=self.logger
            )
        )
        
        # convert to ProductRecord objects w/o subcategory (legacy method)
        return [
            ProductRecord(
                retailer_id=self.retailer_id,
                asin=item.get("asin"),
                title=item["title"],
                price=item["price"],
                url=item["url"],
            )
            for item in raw_products
        ]
    
    # scrape only URLs from a category
    def _scrape_category_urls_only(self, url: str, max_pages: int) -> List[str]:
        self.logger.info(f"Crawling URLs only from {url}")
        
        urls = self.loop.run_until_complete(
            crawl_grid(
                start_urls=[url],
                max_depth=max_pages,
                concurrency=CONCURRENCY,
                extract_urls_only=True,
                logger=self.logger
            )
        )
        
        self.logger.info(f"Found {len(urls)} URLs")
        return urls
    
    # * Concurrent crawling methods *
    
    # crawl multiple grid URLs concurrently with category information
    def _crawl_grids_concurrent_with_categories(self, url_category_pairs: List[Dict[str, str]], max_pages_per_cat: int, concurrency: int) -> None:
        self.logger.info(f"Starting concurrent grid crawling for {len(url_category_pairs)} categories with concurrency={concurrency}")
        
        # run async concurrent crawl
        results = self.loop.run_until_complete(
            self._async_crawl_grids_concurrent_with_categories(url_category_pairs, max_pages_per_cat, concurrency)
        )
        
        # send results to output backend
        if results:
            self.logger.info(f"Collected {len(results)} total items from concurrent crawling")
            self.output_backend.send(results)
        else:
            self.logger.warning("No results collected from concurrent crawling")
    
    # async method to crawl multiple grids concurrently with category information
    async def _async_crawl_grids_concurrent_with_categories(self, url_category_pairs: List[Dict[str, str]], max_pages_per_cat: int, concurrency: int):
        # split URL-category pairs into batches for processing
        batch_size = max(1, len(url_category_pairs) // concurrency)
        batches = [url_category_pairs[i:i + batch_size] for i in range(0, len(url_category_pairs), batch_size)]
        
        self.logger.info(f"Split {len(url_category_pairs)} URL-category pairs into {len(batches)} batches")
        
        # create tasks for each batch
        tasks = []
        for i, batch in enumerate(batches):
            task = asyncio.create_task(
                self._crawl_batch_with_categories(batch, max_pages_per_cat, f"batch_{i}")
            )
            tasks.append(task)
        
        # wait for all batches to complete
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # collect all results
        all_results = []
        for result in batch_results:
            if isinstance(result, Exception):
                self.logger.error(f"Batch failed: {result}")
            elif result:
                all_results.extend(result)
        
        return all_results
    
    # crawl a batch of URL-category pairs
    async def _crawl_batch_with_categories(self, url_category_pairs: List[Dict[str, str]], max_pages: int, batch_name: str):
        self.logger.info(f"Processing {batch_name} with {len(url_category_pairs)} URL-category pairs")
        
        try:
            if self.urls_only:
                # extract URLs only
                urls = [pair['url'] for pair in url_category_pairs]
                results = await crawl_grid(
                    start_urls=urls,
                    max_depth=max_pages,
                    concurrency=min(CONCURRENCY, len(urls)),
                    extract_urls_only=True,
                    logger=self.logger
                )
            else:
                # extract full product data
                all_results = []
                for pair in url_category_pairs:
                    url = pair['url']
                    category = pair['category']
                    
                    self.logger.info(f"Crawling {url} for category: {category}")
                    
                    raw_results = await crawl_grid(
                        start_urls=[url],
                        max_depth=max_pages,
                        # one url at a time for now 
                        concurrency=1, 
                        extract_urls_only=False,
                        logger=self.logger
                    )
                    
                    # convert to ProductRecord objects w/ subcategory from hierarchy
                    for item in raw_results:
                        product_record = ProductRecord(
                            retailer_id=self.retailer_id,
                            asin=item.get("asin"),
                            title=item["title"],
                            price=item["price"],
                            url=item["url"],
                            category=category,
                        )
                        all_results.append(product_record)
                
                results = all_results
            
            self.logger.info(f"Batch {batch_name} completed: {len(results)} items")
            return results
            
        except Exception as e:
            self.logger.error(f"Error in batch {batch_name}: {e}")
            return []
    
    # legacy method for backward compatibility
    def _crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int) -> None:
        self.logger.info(f"Starting concurrent grid crawling for {len(grid_urls)} categories with concurrency={concurrency}")
        
        # convert URLs to URL-category pairs with unknown categories
        url_category_pairs = [{'url': url, 'category': None} for url in grid_urls]
        
        # use the new method
        self._crawl_grids_concurrent_with_categories(url_category_pairs, max_pages_per_cat, concurrency)
    
    # * Hierarchical crawling methods *
    
    # build complete amazon category hierarchy
    def _crawl_hierarchical(self, max_pages: int) -> None:
        start_url = "https://www.amazon.com/s?i=wholefoods&ref=nb_sb_noss"
        
        # build hierarchy using category crawler
        self.logger.info(f"Building Amazon hierarchy from: {start_url}")
        hierarchy = self.loop.run_until_complete(
            crawl_category(start_url, max_depth=MAX_DEPTH, logger=self.logger)
        )
        
        if not self.urls_only:
            # populate hierarchy with product data
            self.logger.info("Populating hierarchy with product data...")
            self._populate_leaf_nodes_with_products(hierarchy, max_pages)
        
        # output hierarchy
        self.logger.info("Sending hierarchy to output backend...")
        self.output_backend.send(hierarchy)
    
    # populate leaf nodes w/ products (override to include subcategory)
    def _populate_leaf_nodes_with_products(self, node: dict, max_pages: int) -> None:
        if isinstance(node, dict):
            if node.get("sub_items"):
                # has children - recurse
                for child in node["sub_items"]:
                    self._populate_leaf_nodes_with_products(child, max_pages)
            else:
                # Leaf node - add products
                if "link_url" in node:
                    category_name = node.get('name')
                    self.logger.info(f"Crawling products for leaf node: {category_name}")
                    url = self._normalize_url(node["link_url"])
                    
                    # crawl products w/ subcategory context
                    products = self._scrape_category(url, max_pages)
                    if products:
                        node["products"] = [p.model_dump() for p in products]
        elif isinstance(node, list):
            for item in node:
                self._populate_leaf_nodes_with_products(item, max_pages)
    
    # crawl a single category
    def _crawl_single_category(self, max_pages: int) -> None:
        # for single category, need the URL or predefined mappings
        category_url = self._get_category_url(self.category)
        
        if self.urls_only:
            urls = self._scrape_category_urls_only(category_url, max_pages)
            self.output_backend.send(urls)
        else:
            products = self._scrape_category(category_url, max_pages)
            self.output_backend.send(products)
    
    # * Main interface methods *
    
    # main crawl method - builds hierarchy or crawls specific category
    def crawl(self, max_pages_per_cat: int = 5) -> None:
        self.max_pages = max_pages_per_cat
        
        if self.hierarchical:
            # build complete hierarchy
            self.logger.info(f"Starting hierarchical crawl for Amazon (max_pages: {max_pages_per_cat})")
            self._crawl_hierarchical(max_pages_per_cat)
        else:
            # single category crawl
            if self.category:
                self.logger.info(f"Starting single category crawl for: {self.category}")
                self._crawl_single_category(max_pages_per_cat)
            else:
                self.logger.error("No category specified for non-hierarchical crawl")
                raise ValueError("Category must be specified for non-hierarchical crawls")
    
    # crawl from a pre-built hierarchy file
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, 
                                max_pages_per_cat: int = 5,
                                category_filter: str = None,
                                department_filter: str = None,
                                concurrency: int = 5) -> None:
        self.logger.info(f"Starting Amazon crawl from hierarchy file: {hierarchy_file}")
        
        # load hierarchy
        hierarchy = self._load_hierarchy_file(hierarchy_file)
        self.logger.info(f"Loaded Amazon hierarchy: {hierarchy.get('name', 'Unknown')}")
        
        # apply filters if specified
        if category_filter or department_filter:
            self.logger.info(f"Applying filters: category='{category_filter}', department='{department_filter}'")
            hierarchy = self._filter_hierarchy(hierarchy, category_filter, department_filter)
        
        # extract leaf URLs with their category information
        leaf_url_category_pairs = self._extract_leaf_urls_with_categories(hierarchy)
        self.logger.info(f"Found {len(leaf_url_category_pairs)} leaf categories to crawl")
        
        if not leaf_url_category_pairs:
            self.logger.warning("No leaf categories found to crawl")
            return
        
        # log the categories that will be crawled
        for pair in leaf_url_category_pairs:
            self.logger.info(f"Will crawl category '{pair['category']}' from URL: {pair['url']}")
        
        # crawl all URL-category pairs concurrently
        self._crawl_grids_concurrent_with_categories(leaf_url_category_pairs, max_pages_per_cat, concurrency)