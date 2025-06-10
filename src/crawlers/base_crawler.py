"""
Base crawler functionality and common classes for all retailer crawlers.

This module provides the base crawler class, data models, and backend interfaces
that all retailer-specific crawlers inherit from. Includes factory functions for
JSON, Redis, and Supabase backends.
"""

import os
import json
import redis
import logging
import asyncio
import copy
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, NamedTuple
from pydantic import BaseModel, Field
from urllib.parse import urlparse

# env variables w/ defaults
MAX_DEPTH = int(os.getenv("CRAWLER_MAX_DEPTH", "10"))
CONCURRENCY = int(os.getenv("CRAWLER_CONCURRENCY", "3"))
GRID_HOVER_DELAY_RANGE = (1.0, 3.0)
HOVER_DELAY_RANGE = (0.5, 1.5)

# * Data models *

# Product record data model
class ProductRecord(BaseModel):
    retailer_id: int
    asin: Optional[str] = None
    tcin: Optional[str] = None
    wm_item_id: Optional[str] = None
    title: str
    price: str
    url: str
    category: Optional[str] = None
    description: Optional[str] = None

# Target category for crawling (used for hierarchical mode) 
class Target(NamedTuple):
    name: str
    url: str

class OutputBackend(ABC):    
    @abstractmethod
    def send(self, records) -> None:
        pass

class ResultCollector:
    def __init__(self):
        self.results = []
    
    def send(self, records):
        if isinstance(records, list):
            self.results.extend(records)
        else:
            self.results.append(records)

# * Base crawler class that all retailer crawlers inherit from *
class BaseCrawler(ABC):
    def __init__(self, retailer_id: int, output_backend: OutputBackend = None, 
                 logger: logging.Logger = None, urls_only: bool = False, 
                 hierarchical: bool = False, department: str = None, 
                 category: str = None):
        self.retailer_id = retailer_id
        self.output_backend = output_backend
        self._out = output_backend 
        self.logger = logger or logging.getLogger(__name__)
        self.urls_only = urls_only
        self.hierarchical = hierarchical
        self.department = department
        self.category = category
        self.max_pages = 5
        self.concurrency = CONCURRENCY
        
        # init event loop for async operations
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
    
    # main crawl method (implemented in retailer's crawler)
    @abstractmethod
    def crawl(self, max_pages_per_cat: int = 5) -> None:
        pass
    
    # crawl from a pre-built hierarchy file
    @abstractmethod
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, 
                                max_pages_per_cat: int = 5,
                                category_filter: str = None,
                                department_filter: str = None,
                                concurrency: int = 5) -> None:
        """Crawl from a pre-built hierarchy file."""
        pass
        
    # load hierarchy from JSON file
    def _load_hierarchy_file(self, hierarchy_file: Path) -> dict:
        try:
            with hierarchy_file.open('r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load hierarchy file {hierarchy_file}: {e}")
            raise
    
    # extract all leaf node URLs from hierarchy
    def _extract_leaf_urls(self, hierarchy: dict) -> List[str]:
        leaf_urls = []
        
        def walk_hierarchy(node):
            # handle root level w/ "departments"
            if isinstance(node, dict) and "departments" in node:
                for dept in node["departments"]:
                    walk_hierarchy(dept)
                return
            
            # handle regular nodes w/ "sub_items"
            if isinstance(node, dict):
                sub_items = node.get("sub_items")
                if sub_items and len(sub_items) > 0:
                    for child in sub_items:
                        walk_hierarchy(child)
                else:
                    # leaf node - collect the URL
                    if "link_url" in node:
                        url = self._normalize_url(node["link_url"])
                        leaf_urls.append(url)
                        category_name = node.get('name', 'Unknown')
                        self.logger.debug(f"Found leaf URL: {url} (category: {category_name})")
            elif isinstance(node, list):
                for item in node:
                    walk_hierarchy(item)
        
        walk_hierarchy(hierarchy)
        return leaf_urls
    
    # normalize URL to full URL
    def _normalize_url(self, url: str) -> str:
        if url.startswith('http'):
            return url
        else:
            # default normalization - subclasses should override
            return url
    
    # filter hierarchy by category/department
    def _filter_hierarchy(self, hierarchy: dict, category_filter: str = None, 
                         department_filter: str = None) -> dict:
        if not (category_filter or department_filter):
            return hierarchy
            
        target_name = category_filter or department_filter
        self.logger.info(f"Filtering hierarchy for: {target_name}")
        
        # recursively find a node that matches the target name
        def find_matching_node(node, target_name):
            if isinstance(node, dict):
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
            elif isinstance(node, list):
                for item in node:
                    result = find_matching_node(item, target_name)
                    if result:
                        return result
                        
            return None
        
        # search in departments first if they exist
        if "departments" in hierarchy:
            for department in hierarchy["departments"]:
                # check if this department matches
                dept_name = department.get("department_name") or department.get("name")
                if dept_name == target_name:
                    self.logger.info(f"Found matching department: {target_name}")
                    return department
                
                # search within this department
                result = find_matching_node(department, target_name)
                if result:
                    self.logger.info(f"Found '{target_name}' within department: {dept_name}")
                    return result
        
        # search the entire hierarchy
        filtered_node = find_matching_node(hierarchy, target_name)
        
        if not filtered_node:
            self.logger.warning(f"Filter '{target_name}' not found in hierarchy")
            self._print_available_categories(hierarchy)
            return hierarchy
            
        self.logger.info(f"Successfully filtered hierarchy to: {target_name}")
        return filtered_node
    
    # print available categories for debugging
    def _print_available_categories(self, hierarchy: dict, max_items: int = 50):
        categories = []
        
        def collect_categories(node, depth=0):
            if len(categories) >= max_items:
                return
                
            if isinstance(node, dict):
                name = node.get("name") or node.get("department_name")
                if name:
                    categories.append("  " * depth + name)
                
                if node.get("sub_items"):
                    for child in node["sub_items"]:
                        collect_categories(child, depth + 1)
            elif isinstance(node, list):
                for item in node:
                    collect_categories(item, depth)
        
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
    
    # create hierarchical output structure w/ results attached
    def _create_hierarchical_output(self, filtered_hierarchy: dict, results: list, 
                                  category_filter: str = None, department_filter: str = None) -> dict:
        # copy hierarchy to avoid modifying the original
        output_hierarchy = copy.deepcopy(filtered_hierarchy)
        
        # attach results to leaf nodes
        def attach_results_to_leaves(node):
            if isinstance(node, dict):
                # has children - recurse
                sub_items = node.get("sub_items")
                if sub_items and len(sub_items) > 0:
                    for child in sub_items:
                        attach_results_to_leaves(child)
                else:
                    # leaf node - attach results
                    if self.urls_only:
                        # urls only mode
                        node["product_urls"] = [
                            str(r) if isinstance(r, str) 
                            else str(r.url) if hasattr(r, 'url') 
                            else str(r) 
                            for r in results
                        ]
                    else:
                        # full mode - convert to expected format
                        products = []
                        for r in results:
                            if hasattr(r, 'model_dump'):
                                products.append(r.model_dump())
                            elif isinstance(r, dict):
                                products.append(r)
                            else:
                                products.append(r)
                        
                        node["products"] = products
            elif isinstance(node, list):
                for item in node:
                    attach_results_to_leaves(item)
        
        # handle different hierarchy structures
        if "departments" in output_hierarchy:
            for dept in output_hierarchy["departments"]:
                attach_results_to_leaves(dept)
        else:
            attach_results_to_leaves(output_hierarchy)
        
        self.logger.info(f"Created hierarchical output with {len(results)} total items")
        return output_hierarchy
    
    # populate leaf nodes in hierarchy w/ product data
    def _populate_leaf_nodes_with_products(self, node: dict, max_pages: int) -> None:
        if isinstance(node, dict):
            if node.get("sub_items"):
                # has children - recurse
                for child in node["sub_items"]:
                    self._populate_leaf_nodes_with_products(child, max_pages)
            else:
                # Leaf node - add products
                if "link_url" in node:
                    self.logger.info(f"Crawling products for leaf node: {node.get('name')}")
                    url = self._normalize_url(node["link_url"])
                    products = self._scrape_category(url, max_pages)
                    if products:
                        node["products"] = [p.model_dump() for p in products]
        elif isinstance(node, list):
            for item in node:
                self._populate_leaf_nodes_with_products(item, max_pages)
        
    # * Abstract methods for retailer-specific logic *
    
    # scrape products from a category url
    @abstractmethod
    def _scrape_category(self, url: str, max_pages: int) -> List[ProductRecord]:
        pass
    
    # scrape only urls from a category
    @abstractmethod  
    def _scrape_category_urls_only(self, url: str, max_pages: int) -> List[str]:
        pass
    
    @abstractmethod
    def _get_category_url(self, category: str) -> str:
        pass
    

    # * Common utility methods *
    
    # setup result collection for hierarchical mode
    def _setup_hierarchical_collection(self):
        original_backend = self._out
        collector = ResultCollector()
        self._out = collector
        return original_backend, collector
    
    # restore backend and send hierarchical results
    def _restore_backend_and_send_hierarchical(self, original_backend, collector, 
                                             hierarchy, category_filter=None, department_filter=None):
        self._out = original_backend
        hierarchical_output = self._create_hierarchical_output(
            hierarchy, collector.results, category_filter, department_filter
        )
        self.logger.info("Sending hierarchical structure to output backend")
        self._out.send(hierarchical_output)

# * Backend implementations *

# JSON file output backend
class JsonFileBackend(OutputBackend):
    
    def __init__(self, prefix: str = "output", hierarchical: bool = False):
        self.hierarchical = hierarchical
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{prefix}_{timestamp}.json"
        self._path = Path(filename)
        self.logger = logging.getLogger(__name__)
    
    def send(self, records) -> None:
        """Send records to JSON file."""
        self.logger.debug(f"JsonFileBackend.send() called with {len(records) if hasattr(records, '__len__') else 'unknown'} records")
        
        if self.hierarchical:
            # Single hierarchical structure
            with self._path.open("w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, ensure_ascii=False, default=str)
            self.logger.info(f"Wrote hierarchical data to {self._path}")
        else:
            # ND-JSON format (one line per record)
            records_written = 0
            with self._path.open("a", encoding="utf-8") as f:
                for r in records:
                    if hasattr(r, 'model_dump_json'):  # ProductRecord
                        f.write(r.model_dump_json() + "\n")
                        records_written += 1
                    elif isinstance(r, str):  # URL string
                        f.write(json.dumps({"url": r}) + "\n")
                        records_written += 1
                    elif isinstance(r, dict):  # Raw dict
                        f.write(json.dumps(r, default=str) + "\n")
                        records_written += 1
                    else:
                        self.logger.warning(f"Skipping unknown record type: {type(r)}")
            
            self.logger.info(f"Wrote {records_written} records to {self._path}")

# Redis output backend
class RedisBackend(OutputBackend):    
    def __init__(self, redis_client, retailer_id: int):
        self.redis_client = redis_client
        self.retailer_id = retailer_id
        self.logger = logging.getLogger(__name__)
    
    # send records to Redis
    def send(self, records) -> None:
        try:
            pipeline = self.redis_client.pipeline()
            queue_name = f"crawl_urls:{self.retailer_id}"
            
            urls_added = 0
            for record in records:
                if isinstance(record, str):
                    pipeline.lpush(queue_name, record)
                    urls_added += 1
                elif hasattr(record, 'url'):
                    pipeline.lpush(queue_name, record.url)
                    urls_added += 1
                elif isinstance(record, dict) and 'url' in record:
                    pipeline.lpush(queue_name, record['url'])
                    urls_added += 1
                else:
                    self.logger.warning(f"Skipping record without URL: {type(record)}")
            
            pipeline.execute()
            self.logger.info(f"Added {urls_added} URLs to Redis queue: {queue_name}")
            
        except Exception as e:
            self.logger.error(f"Failed to send records to Redis: {e}")
            raise

# * Utility functions for backend creation *
# create redis client w/ connection pooling
def create_redis_client() -> redis.Redis:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(redis_url, decode_responses=True)

# create redis backend for the given retailer
def create_redis_backend(retailer_id: int) -> RedisBackend:
    client = create_redis_client()
    return RedisBackend(client, retailer_id)

# create supabase backend w/ optional UPC lookup
def create_supabase_backend(supabase_url: str = None, supabase_key: str = None, 
                           enable_upc_lookup: bool = True) -> OutputBackend:
    try:
        from .supabase_backend import SupabaseBackend
        return SupabaseBackend(supabase_url, supabase_key, enable_upc_lookup)
    except ImportError as e:
        raise ImportError(f"SupabaseBackend requires additional dependencies: {e}")

# create json file backend
def create_json_backend(prefix: str = "output", hierarchical: bool = False) -> JsonFileBackend:
    return JsonFileBackend(prefix, hierarchical)