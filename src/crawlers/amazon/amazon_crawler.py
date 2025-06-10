# imports
import json
import os
import asyncio
from pathlib import Path
from typing import List

# relative import
from ..base_crawler import BaseCrawler, ProductRecord, Target, create_redis_client, create_redis_backend, MAX_DEPTH, CONCURRENCY

# import the captcha solver from subcrawlers
from .subcrawlers.category_crawler import crawl_category
from .subcrawlers.grid_crawler import crawl_grid

# Amazon Crawler
class AmazonCrawler(BaseCrawler):
    def __init__(self, retailer_id, logger=None, category=None, department=None, output_backend=None, urls_only=False, hierarchical=False):
        super().__init__(retailer_id, output_backend, logger, urls_only, hierarchical, department, category)
        self.base_url = "https://www.amazon.com"
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.logger.info("AmazonCrawler initialized. Playwright will be launched as needed.")
    
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
        
        # extract leaf URLs for crawling
        leaf_urls = self._extract_leaf_urls(hierarchy)
        self.logger.info(f"Found {len(leaf_urls)} leaf categories to crawl")
        
        if not leaf_urls:
            self.logger.warning("No leaf categories found to crawl")
            return
        
        # crawl all URLs concurrently
        self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)
    
    # build complete Amazon category hierarchy
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
    
    # crawl a single category
    def _crawl_single_category(self, max_pages: int) -> None:
        # for single category, we need to construct the URL or use predefined mappings
        # this is a simplified implementation - you might want to add category URL mapping
        category_url = self._get_category_url(self.category)
        
        if self.urls_only:
            urls = self._scrape_category_urls_only(category_url, max_pages)
            self.output_backend.send(urls)
        else:
            products = self._scrape_category(category_url, max_pages)
            self.output_backend.send(products)
    
    # map category name to Amazon URL
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
    
    # load hierarchy from JSON file
    def _load_hierarchy_file(self, hierarchy_file: Path) -> dict:
        try:
            with hierarchy_file.open('r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load hierarchy file {hierarchy_file}: {e}")
            raise
    
    # filter hierarchy by category or department
    def _filter_hierarchy(self, hierarchy: dict, category_filter: str = None, department_filter: str = None) -> dict:
        # simplified implementation
        if not category_filter and not department_filter:
            return hierarchy
        
        # might need to implement specific filtering logic
        return hierarchy
    
    # extract all leaf node URLs from hierarchy
    def _extract_leaf_urls(self, hierarchy: dict) -> List[str]:
        leaf_urls = []
        
        def extract_recursive(node):
            if isinstance(node, dict):
                if "sub_items" in node:
                    # if node has children
                    if node["sub_items"]:  
                        for child in node["sub_items"]:
                            extract_recursive(child)
                    # leaf node (products)
                    else:  
                        if "link_url" in node:
                            leaf_urls.append(self._normalize_url(node["link_url"]))
                # direct leaf node
                elif "link_url" in node:  
                    leaf_urls.append(self._normalize_url(node["link_url"]))
            elif isinstance(node, list):
                for item in node:
                    extract_recursive(item)
        
        extract_recursive(hierarchy)
        return leaf_urls
    
    # normalize URL to full Amazon URL
    def _normalize_url(self, url: str) -> str:
        if url.startswith('http'):
            return url
        else:
            return f"https://www.amazon.com{url}"
    
    # scrape products from a category URL
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
        
        # convert to ProductRecord objects
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
    
    # populate leaf nodes in hierarchy with product data
    def _populate_leaf_nodes_with_products(self, node: dict, max_pages: int) -> None:
        if "sub_items" in node and node["sub_items"]:
            # has children - recurse
            for child in node["sub_items"]:
                self._populate_leaf_nodes_with_products(child, max_pages)
        else:
            # leaf node - add products
            if "link_url" in node:
                self.logger.info(f"Crawling products for leaf node: {node.get('name')}")
                url = self._normalize_url(node["link_url"])
                products = self._scrape_category(url, max_pages)
                node["products"] = [p.model_dump() for p in products]
    
    # crawl multiple grid URLs concurrently
    def _crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int) -> None:
        self.logger.info(f"Starting concurrent grid crawling for {len(grid_urls)} categories with concurrency={concurrency}")
        
        # run async concurrent crawl
        results = self.loop.run_until_complete(
            self._async_crawl_grids_concurrent(grid_urls, max_pages_per_cat, concurrency)
        )
        
        # send results to output backend
        if results:
            self.logger.info(f"Collected {len(results)} total items from concurrent crawling")
            self.output_backend.send(results)
        else:
            self.logger.warning("No results collected from concurrent crawling")
    
    # async method to crawl multiple grids concurrently
    async def _async_crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int):
        # split URLs into batches for processing
        batch_size = max(1, len(grid_urls) // concurrency)
        batches = [grid_urls[i:i + batch_size] for i in range(0, len(grid_urls), batch_size)]
        
        self.logger.info(f"Split {len(grid_urls)} URLs into {len(batches)} batches")
        
        # create tasks for each batch
        tasks = []
        for i, batch in enumerate(batches):
            task = asyncio.create_task(
                self._crawl_batch(batch, max_pages_per_cat, f"batch_{i}")
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
    
    # crawl a batch of URLs
    async def _crawl_batch(self, urls: List[str], max_pages: int, batch_name: str):
        self.logger.info(f"Processing {batch_name} with {len(urls)} URLs")
        
        try:
            if self.urls_only:
                # extract URLs only
                results = await crawl_grid(
                    start_urls=urls,
                    max_depth=max_pages,
                    concurrency=min(CONCURRENCY, len(urls)),
                    extract_urls_only=True,
                    logger=self.logger
                )
            else:
                # extract full product data
                raw_results = await crawl_grid(
                    start_urls=urls,
                    max_depth=max_pages,
                    concurrency=min(CONCURRENCY, len(urls)),
                    extract_urls_only=False,
                    logger=self.logger
                )
                
                # convert to ProductRecord objects
                results = [
                    ProductRecord(
                        retailer_id=self.retailer_id,
                        asin=item.get("asin"),
                        title=item["title"],
                        price=item["price"],
                        url=item["url"],
                    )
                    for item in raw_results
                ]
            
            self.logger.info(f"Batch {batch_name} completed: {len(results)} items")
            return results
            
        except Exception as e:
            self.logger.error(f"Error in batch {batch_name}: {e}")
            return []