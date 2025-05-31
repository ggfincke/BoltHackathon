# imports
import json
import os
import asyncio
from pathlib import Path

# relative import
from ..base_crawler import BaseCrawler, ProductRecord, Target, create_redis_client, create_redis_backend, MAX_DEPTH, CONCURRENCY

# import from subcrawlers
from .subcrawlers.category_crawler import crawl_category
from .subcrawlers.grid_crawler import crawl_grid

# Target Crawler
class TargetCrawler(BaseCrawler):
    def __init__(self, retailer_id, logger=None, category=None, output_backend=None, urls_only=False, hierarchical=False):
        super().__init__(retailer_id, output_backend, logger, urls_only, hierarchical)
        self.base_url = "https://www.target.com"
        self.logger.info("TargetCrawler initialized. Playwright will be launched as needed.")
        self.logger.info(f"Mode: {'Hierarchical' if hierarchical else 'URL-only' if urls_only else 'Full product data'}")
        self._load_category_config()
        # target category
        self.target_category = category
        # reuse one loop
        self.loop = asyncio.get_event_loop()

    # * helper methods
    # load category config from json file
    def _load_category_config(self):
        config_path = os.getenv("TARGET_CATEGORY_CONFIG") or Path(__file__).parent / "target_grocery_hierarchy.json"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.category_config = json.load(f)
            self.logger.info("Successfully loaded category configuration")
        except Exception as e:
            self.logger.error(f"Failed to load category configuration: {e}")
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

    # return a list of dicts [{"name": "Beverages", "start_url": etc.} depending on self.target_category (one) or all departments (many)
    def _resolve_targets(self, category_filter: str | None = None) -> list[Target]:
        # prefer the explicit argument, fall back to self.target_category
        cat = category_filter or self.target_category

        # targeted crawl
        if cat:
            node = self._find_category_in_config(cat)
            if not node:
                self.logger.error("Category '%s' not found", cat)
                return []
            return [Target(node["name"], node["link_url"])]

        # full crawl
        targets: list[Target] = []
        for dept in self.category_config["departments"]:
            for entry in dept["entry_point_categories"]:
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

    # scrape hierarchical structure with products attached to leaf nodes
    def _scrape_hierarchy(self, max_pages_per_cat: int, category_filter: str = None) -> dict:
        # resolve target nodes
        target_nodes = self._resolve_targets(category_filter)
        if not target_nodes:
            self.logger.error("No target categories found to crawl")
            return {}

        # if multiple targets, create a root node to contain them
        if len(target_nodes) > 1:
            root = {
                "name": "Target Categories", 
                "link_url": self.base_url,
                "sub_items": []
            }
        else:
            root = None

        # process each target node
        for target in target_nodes:
            self.logger.info(f"Building category hierarchy for: {target.name}")
            
            # use category crawler to build hierarchy
            cat_hierarchy = self.loop.run_until_complete(
                crawl_category(
                    start_url=target.url,
                    max_depth=MAX_DEPTH,
                    logger=self.logger
                )
            )
            
            # populate leaf nodes with product URLs
            self._populate_leaf_nodes_with_products(cat_hierarchy, max_pages_per_cat)
            
            # add to root or return directly
            if root:
                root["sub_items"].append(cat_hierarchy)
            else:
                root = cat_hierarchy

        return root

    # recursively find leaf nodes and populate them with product URLs
    def _populate_leaf_nodes_with_products(self, node: dict, max_pages: int):
        # if node has sub_items, recurse into them
        if node.get("sub_items"):
            for child in node["sub_items"]:
                self._populate_leaf_nodes_with_products(child, max_pages)
        else:
            # this is a leaf node - populate with products
            if "link_url" in node:
                self.logger.info(f"Scraping products for leaf category: {node['name']}")
                try:
                    # get product URLs for this category
                    urls = crawl_grid(
                        start_urls=[node["link_url"]],
                        max_depth=max_pages,
                        extract_urls_only=True,
                        logger=self.logger
                    )
                    # attach URLs to this node
                    node["product_urls"] = urls
                    self.logger.info(f"Found {len(urls)} products in {node['name']}")
                except Exception as e:
                    self.logger.error(f"Error scraping products for {node['name']}: {e}")
                    node["product_urls"] = []