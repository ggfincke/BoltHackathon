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
    def __init__(self, retailer_id: int, output_backend: OutputBackend = None, logger: logging.Logger = None, urls_only: bool = False, hierarchical: bool = False):
        self.retailer_id = retailer_id
        self.logger = logger or logging.getLogger(self.__class__.__name__)
        self.urls_only = urls_only
        self.hierarchical = hierarchical
        
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

    # main method - orchestrate a crawl
    def crawl(self, max_pages_per_cat: int = 5, category_filter: str = None) -> None:
        # hierarchical mode - build complete category tree with products
        if self.hierarchical:
            self.logger.info("Starting hierarchical crawl")
            hierarchy = self._scrape_hierarchy(max_pages_per_cat, category_filter)
            if hierarchy:
                self.logger.info("Sending hierarchical data to output backend")
                self._out.send(hierarchy)
            return

        # original flat mode
        targets = self._resolve_targets(category_filter)
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
                self.logger.error(f"Error scraping category '{t.name}' ({t.url}): {e}", exc_info=True)
                # continue...

    # abstract methods - supplied by crawler
    # resolve targets (from a category filter)
    @abstractmethod
    def _resolve_targets(self, category_filter: str | None) -> list[Target]:
        ...

    # scrape a category
    @abstractmethod
    def _scrape_category(self, url: str, max_pages: int) -> list[ProductRecord]: 
        ...

    # scrape a category (URLs only)
    @abstractmethod  
    def _scrape_category_urls_only(self, url: str, max_pages: int) -> list[str]:
        ...

    # scrape hierarchical structure with products attached to leaf nodes
    @abstractmethod
    def _scrape_hierarchy(self, max_pages_per_cat: int, category_filter: str = None) -> dict:
        ...


def main():
    crawler = BaseCrawler(retailer_id=1, output_backend=JsonFileBackend(hierarchical=True), logger=logging.getLogger("BaseCrawler"), urls_only=False, hierarchical=True)

if __name__ == "__main__":
    main()
