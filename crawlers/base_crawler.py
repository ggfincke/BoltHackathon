# imports
import logging
import json
import os
import redis
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence, Union, List
from dataclasses import dataclass
from pydantic import BaseModel, HttpUrl
from django.conf import settings

# Crawler constants - can be overridden by environment variables or subclasses
DEFAULT_MAX_DEPTH = int(os.getenv("CRAWLER_MAX_DEPTH", 10))
DEFAULT_CONCURRENCY = int(os.getenv("CRAWLER_CONCURRENCY", 3))
DEFAULT_HOVER_DELAY_RANGE = (
    int(os.getenv("CRAWLER_HOVER_DELAY_MIN", 350)),
    int(os.getenv("CRAWLER_HOVER_DELAY_MAX", 500))
)
DEFAULT_GRID_HOVER_DELAY_RANGE = (
    int(os.getenv("CRAWLER_GRID_HOVER_DELAY_MIN", 500)),
    int(os.getenv("CRAWLER_GRID_HOVER_DELAY_MAX", 750))
)

# Active constants (can be modified at runtime)
MAX_DEPTH = DEFAULT_MAX_DEPTH
CONCURRENCY = DEFAULT_CONCURRENCY
HOVER_DELAY_RANGE = DEFAULT_HOVER_DELAY_RANGE
GRID_HOVER_DELAY_RANGE = DEFAULT_GRID_HOVER_DELAY_RANGE

# Target - a category to crawl
@dataclass
class Target:
    name: str
    url:  str

# ProductRecord - used as standard output for JSON file backend
class ProductRecord(BaseModel):
    retailer_id: int
    asin: str | None = None
    tcin: str | None = None
    title: str
    price: str
    url: HttpUrl

# UrlRecord - simplified record for URL-only mode
class UrlRecord(BaseModel):
    retailer_id: int
    url: HttpUrl

# Output back-ends - send product records to a "backend" (e.g. file, Redis, etc.)
class OutputBackend(ABC):
    @abstractmethod
    def send(self, records) -> None: 
        ...

# JSON file backend - send product records to a JSON file
class JsonFileBackend(OutputBackend):
    def __init__(self, prefix: str = "crawl", hierarchical: bool = False):
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self._path = Path(f"{prefix}_{ts}.json")
        self.hierarchical = hierarchical

    def send(self, records) -> None:
        if self.hierarchical:
            # Expect a single hierarchical structure (dict) - write as formatted JSON
            with self._path.open("w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, ensure_ascii=False, default=str)
        else:
            # Original behavior - using ND-JSON (one line per record)
            with self._path.open("a", encoding="utf-8") as f:
                for r in records:
                    # ProductRecord for JSON output
                    if isinstance(r, ProductRecord):
                        f.write(r.model_dump_json() + "\n")
                    # URL string in URL-only mode
                    elif isinstance(r, str):
                        f.write(json.dumps({"url": r}) + "\n")

# Redis backend - send just URLs to Redis (memory efficient)
class RedisBackend(OutputBackend):
    def __init__(self, redis_client, retailer_id: int, key: str = "crawl_urls_queue"):
        self._r = redis_client
        self._key = key
        self.retailer_id = retailer_id

    # send URLs to Redis
    def send(self, urls: Sequence[str]) -> None:
        # push as a simple JSON record w/ retailer_id
        pipe = self._r.pipeline()
        # push each URL to Redis
        for url in urls:
            record = {"retailer_id": self.retailer_id, "url": url}
            pipe.rpush(self._key, json.dumps(record))
        pipe.execute()

# helper func to create Redis client from env variables
def create_redis_client():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

# helper func to create Redis backend
def create_redis_backend(retailer_id: int, queue_key: str = "crawl_urls_queue"):
    redis_client = create_redis_client()
    return RedisBackend(redis_client, retailer_id, queue_key)

# Base crawler - abstract base class for all crawlers
class BaseCrawler(ABC):
    def __init__(self, retailer_id: int, output_backend: OutputBackend = None, logger: logging.Logger = None, 
                 urls_only: bool = False, hierarchical: bool = False, department: str = None, category: str = None):
        self.retailer_id = retailer_id
        self.logger = logger or logging.getLogger(self.__class__.__name__)
        self.urls_only = urls_only
        self.hierarchical = hierarchical
        self.department = department
        self.category = category
        self.max_pages = 5  # default value
        self.concurrency = CONCURRENCY  # default value
        
        # if hierarchical mode, force JSON backend
        if hierarchical:
            if output_backend is None:
                self.logger.info("Hierarchical mode detected, using JSON file backend")
                output_backend = JsonFileBackend(hierarchical=True)
            elif not isinstance(output_backend, JsonFileBackend):
                self.logger.warning("Hierarchical mode requires JsonFileBackend, switching to JSON file backend")
                output_backend = JsonFileBackend(hierarchical=True)
            else:
                output_backend.hierarchical = True
        # if in URL-only mode & no output backend specified, use RedisBackend
        elif urls_only and output_backend is None:
            self.logger.info("URL-only mode detected, using Redis backend")
            output_backend = create_redis_backend(retailer_id)
        # if in full mode & no output backend specified, use JsonFileBackend
        elif not urls_only and output_backend is None:
            self.logger.info("Full mode detected, using JSON file backend")
            output_backend = JsonFileBackend()

        self._out = output_backend

    # load hierarchy from JSON file
    def _load_hierarchy_file(self, hierarchy_file: Path) -> dict:
        try:
            with hierarchy_file.open('r', encoding='utf-8') as f:
                hierarchy = json.load(f)
            self.logger.info(f"Successfully loaded hierarchy from {hierarchy_file}")
            return hierarchy
        except Exception as e:
            self.logger.error(f"Failed to load hierarchy file {hierarchy_file}: {e}")
            raise

    # extract all leaf category URLs from a hierarchy
    def _extract_leaf_urls(self, hierarchy: dict) -> List[str]:
        leaf_urls = []
        
        def walk_hierarchy(node):
            # if node has sub_items, recurse into them
            if node.get("sub_items"):
                for child in node["sub_items"]:
                    walk_hierarchy(child)
            else:
                # this is a leaf node - collect the URL
                if "link_url" in node:
                    leaf_urls.append(node["link_url"])
                    
        walk_hierarchy(hierarchy)
        return leaf_urls

    # filter hierarchy based on category/department filters
    def _filter_hierarchy(self, hierarchy: dict, category_filter: str = None, department_filter: str = None) -> dict:
        if not (category_filter or department_filter):
            return hierarchy
            
        def find_matching_node(node, target_name):
            # check if this node matches
            node_name = node.get("name") or node.get("department_name")
            if node_name == target_name:
                return node
                
            # recurse into sub_items
            if node.get("sub_items"):
                for child in node["sub_items"]:
                    result = find_matching_node(child, target_name)
                    if result:
                        return result
                        
            return None
        
        # find the target node
        target_name = category_filter or department_filter
        filtered_node = find_matching_node(hierarchy, target_name)
        
        if not filtered_node:
            self.logger.warning(f"Filter '{target_name}' not found in hierarchy")
            return hierarchy
            
        self.logger.info(f"Filtered hierarchy to: {target_name}")
        return filtered_node

    # main method to crawl from hierarchy file
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, max_pages_per_cat: int = 5, 
                                 category_filter: str = None, department_filter: str = None,
                                 concurrency: int = 5) -> None:
        # load hierarchy
        hierarchy = self._load_hierarchy_file(hierarchy_file)
        
        # apply filters if specified
        if category_filter or department_filter:
            hierarchy = self._filter_hierarchy(hierarchy, category_filter, department_filter)
        
        # extract all leaf URLs
        leaf_urls = self._extract_leaf_urls(hierarchy)
        self.logger.info(f"Found {len(leaf_urls)} leaf categories to crawl")
        
        if not leaf_urls:
            self.logger.warning("No leaf categories found to crawl")
            return
            
        # crawl all grids concurrently
        self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)

    # main method - orchestrate a crawl
    def crawl(self, max_pages_per_cat: int = 5, category_filter: str = None, department_filter: str = None) -> None:
        # hierarchical mode - build complete category tree with products
        if self.hierarchical:
            self.logger.info("Starting hierarchical crawl")
            hierarchy = self._scrape_hierarchy(max_pages_per_cat, category_filter, department_filter)
            if hierarchy:
                self.logger.info("Sending hierarchical data to output backend")
                self._out.send(hierarchy)
            return

        # original flat mode - use department or category filter
        targets = self._resolve_targets(category_filter, department_filter)
        self.logger.info("Resolved %s target categories", len(targets))

        # scrape each target
        for t in targets:
            try:
                if self.urls_only:
                    # URL-only mode (memory efficient)
                    urls = self._scrape_category_urls_only(t.url, max_pages_per_cat)
                    self.logger.info("Found %s URLs in %s (%s)", len(urls), t.name, t.url)
                    # ensure there are urls to send
                    if urls:
                        self._out.send(urls)
                else:
                    # full product mode
                    products = self._scrape_category(t.url, max_pages_per_cat)
                    self.logger.info("Found %s products in %s (%s)", len(products), t.name, t.url)
                    # ensure there are products to send
                    if products:
                        self._out.send(products)
            except Exception as e:
                self.logger.error("Failed to scrape %s: %s", t.name, e)

    # abstract methods that must be implemented by subclasses
    @abstractmethod
    def _resolve_targets(self, category_filter: str | None, department_filter: str | None) -> list[Target]:
        ...

    @abstractmethod
    def _scrape_category(self, url: str, max_pages: int) -> list[ProductRecord]: 
        ...

    @abstractmethod  
    def _scrape_category_urls_only(self, url: str, max_pages: int) -> list[str]:
        ...

    @abstractmethod
    def _scrape_hierarchy(self, max_pages_per_cat: int, category_filter: str = None, department_filter: str = None) -> dict:
        ...

    @abstractmethod
    def _crawl_grids_concurrent(self, grid_urls: List[str], max_pages_per_cat: int, concurrency: int) -> None:
        ...

def main():
    crawler = BaseCrawler(retailer_id=1, output_backend=JsonFileBackend(hierarchical=True), logger=logging.getLogger("BaseCrawler"), urls_only=False, hierarchical=True)

if __name__ == "__main__":
    main()
