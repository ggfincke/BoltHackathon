# imports
import logging
import json
import os
import redis
import copy
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence, Union, List
from dataclasses import dataclass
from pydantic import BaseModel, HttpUrl
from django.conf import settings

# crawler constants
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

# active constants (can be modified at runtime)
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
    wm_item_id: str | None = None
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
        logger = logging.getLogger("JsonFileBackend")
        
        logger.debug(f"JsonFileBackend.send() called with {len(records) if hasattr(records, '__len__') else 'unknown'} records")
        logger.debug(f"Records type: {type(records)}")
        
        if self.hierarchical:
            # single hierarchical structure (dict) - write as formatted JSON
            with self._path.open("w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, ensure_ascii=False, default=str)
            logger.info(f"Wrote hierarchical data to {self._path}")
        else:
            # (original behavior) using ND-JSON (one line per record)
            records_written = 0
            with self._path.open("a", encoding="utf-8") as f:
                for r in records:
                    try:
                        # ProductRecord for JSON output (Pydantic models)
                        if hasattr(r, 'model_dump_json'):
                            f.write(r.model_dump_json() + "\n")
                            records_written += 1
                        # URL string in URL-only mode
                        elif isinstance(r, str):
                            f.write(json.dumps({"url": r}) + "\n")
                            records_written += 1
                        # Handle raw dicts from grid crawler (NEW FIX)
                        elif isinstance(r, dict):
                            f.write(json.dumps(r, default=str) + "\n")
                            records_written += 1
                            logger.debug(f"Wrote raw dict: {r.get('title', r.get('asin', r.get('tcin', r.get('wm_item_id', 'Unknown'))))}")
                        else:
                            logger.warning(f"Skipping unknown record type: {type(r)} - {r}")
                    except Exception as e:
                        logger.error(f"Error writing record: {e}, record: {r}")
            
            logger.info(f"Wrote {records_written} records to {self._path}")

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
        self.max_pages = 5  
        self.concurrency = CONCURRENCY  
        
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

    # filter hierarchy based on category/department filters
    def _filter_hierarchy(self, hierarchy: dict, category_filter: str = None, department_filter: str = None) -> dict:
        if not (category_filter or department_filter):
            return hierarchy

        self.logger.info(f"Filtering hierarchy for category='{category_filter}', department='{department_filter}'")
        
        # recursively find a node that matches the target name
        def find_matching_node(node, target_name):
            # check if this node matches
            node_name = node.get("name") or node.get("department_name")
            if node_name == target_name:
                self.logger.info(f"Found matching node: {node_name}")
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
        
        # search in departments first
        if "departments" in hierarchy:
            for department in hierarchy["departments"]:
                # check if this department matches
                if department.get("department_name") == target_name or department.get("name") == target_name:
                    self.logger.info(f"Found matching department: {target_name}")
                    return department
                
                # search within this department
                result = find_matching_node(department, target_name)
                if result:
                    self.logger.info(f"Found '{target_name}' within department: {department.get('department_name', 'Unknown')}")
                    return result
        
        # if not found in departments structure, search the entire hierarchy
        filtered_node = find_matching_node(hierarchy, target_name)
        
        if not filtered_node:
            self.logger.warning(f"Filter '{target_name}' not found in hierarchy")
            # print available categories for debugging
            self._print_available_categories(hierarchy)
            return hierarchy
            
        self.logger.info(f"Successfully filtered hierarchy to: {target_name}")
        return filtered_node

    # print available categories for debugging
    def _print_available_categories(self, hierarchy: dict, max_items: int = 50):
        categories = []
        
        # collect categories from hierarchy
        def collect_categories(node, depth=0):
            if len(categories) >= max_items:
                return
                
            name = node.get("name") or node.get("department_name")
            if name:
                categories.append("  " * depth + name)
            
            if node.get("sub_items"):
                for child in node["sub_items"]:
                    collect_categories(child, depth + 1)
        
        # collect categories from departments
        if "departments" in hierarchy:
            for dept in hierarchy["departments"]:
                collect_categories(dept)
        else:
            collect_categories(hierarchy)
        
        self.logger.info(f"Available categories (showing first {min(len(categories), max_items)}):")
        for cat in categories[:max_items]:
            self.logger.info(cat)
        
        if len(categories) > max_items:
            self.logger.info(f"... and {len(categories) - max_items} more categories")

    # extract leaf URLs from hierarchy
    def _extract_leaf_urls(self, hierarchy: dict) -> List[str]:
        leaf_urls = []
        
        def walk_hierarchy(node):
            # handle the root level w/ "departments"  
            if "departments" in node:
                for dept in node["departments"]:
                    walk_hierarchy(dept)
                return
            
            # handle regular nodes w/ "sub_items"
            sub_items = node.get("sub_items")
            if sub_items and len(sub_items) > 0:
                for child in sub_items:
                    walk_hierarchy(child)
            else:
                # leaf node (no sub_items or empty sub_items) - collect the URL
                if "link_url" in node:
                    leaf_urls.append(node["link_url"])
                    category_name = node.get('name', 'Unknown')
                    self.logger.debug(f"Found leaf URL: {node['link_url']} (category: {category_name})")
                        
        walk_hierarchy(hierarchy)
        return leaf_urls

    # crawl from hierarchy file w/ optional filtering
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, max_pages_per_cat: int = 5, 
                                category_filter: str = None, department_filter: str = None,
                                concurrency: int = 5) -> None:        
        # load hierarchy
        hierarchy = self._load_hierarchy_file(hierarchy_file)
        self.logger.info(f"Loaded hierarchy with {len(hierarchy.get('departments', []))} departments")

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
        
        # log the number of leaf URLs found
        if category_filter or department_filter:
            self.logger.info(f"After filtering to '{category_filter or department_filter}': found {len(leaf_urls)} leaf categories to crawl")
        else:
            self.logger.info(f"Found {len(leaf_urls)} leaf categories to crawl")
        
        # if no leaf URLs found, log a warning and return
        if not leaf_urls:
            self.logger.warning("No leaf categories found to crawl")
            return
        
        # store original output backend (for later)
        original_backend = self._out
        
        # temp collector for hierarchical mode
        if self.hierarchical:
            # collect results to attach to hierarchy later
            collected_results = []
            
            # temp backend that just collects results
            class ResultCollector:
                def __init__(self):
                    self.results = []
                
                def send(self, records):
                    if isinstance(records, list):
                        self.results.extend(records)
                    else:
                        self.results.append(records)
            
            collector = ResultCollector()
            self._out = collector
            
            # crawl w/ the collector backend
            self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)
            
            # restore original backend
            self._out = original_backend
            
            # create hierarchical structure w/ results
            hierarchical_output = self._create_hierarchical_output(hierarchy, collector.results, category_filter, department_filter)
            
            # send hierarchical structure to the real backend
            self.logger.info("Sending hierarchical structure to output backend")
            self._out.send(hierarchical_output)
        else:
            # non-hierarchical mode - crawl normally
            self._crawl_grids_concurrent(leaf_urls, max_pages_per_cat, concurrency)

    # create hierarchical output structure w/ results attached
    def _create_hierarchical_output(self, filtered_hierarchy: dict, results: list, category_filter: str = None, department_filter: str = None) -> dict:
        # copy hierarchy (avoid modifying the original)
        output_hierarchy = copy.deepcopy(filtered_hierarchy)
        
        # find leaf nodes & attach results
        def attach_results_to_leaves(node):
            sub_items = node.get("sub_items")
            if sub_items and len(sub_items) > 0:
                # has children - recurse (find leaf nodes)
                for child in sub_items:
                    attach_results_to_leaves(child)
            else:
                # leaf node - attach results
                if self.urls_only:
                    # URLs only mode
                    node["product_urls"] = [str(r) if isinstance(r, str) else str(r.url) if hasattr(r, 'url') else str(r) for r in results]
                else:
                    # full mode
                    node["products"] = [r.model_dump() if hasattr(r, 'model_dump') else r for r in results]
        
        # handle different hierarchy structures (departments or not)
        if "departments" in output_hierarchy:
            for dept in output_hierarchy["departments"]:
                attach_results_to_leaves(dept)
        else:
            attach_results_to_leaves(output_hierarchy)
        
        self.logger.info(f"Created hierarchical output with {len(results)} total items")
        return output_hierarchy

    # main method - orchestrate a crawl
    def crawl(self, max_pages_per_cat: int = 5, category_filter: str = None, department_filter: str = None) -> None:
        # hierarchical mode - build complete category tree w/ products
        if self.hierarchical:
            self.logger.info("Starting hierarchical crawl")
            hierarchy = self._scrape_hierarchy(max_pages_per_cat, category_filter, department_filter)
            if hierarchy:
                self.logger.info("Sending hierarchical data to output backend")
                self._out.send(hierarchy)
            return

        # flat mode - use department or category filter
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