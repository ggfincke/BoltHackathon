"""
Base crawler functionality and common classes for all retailer crawlers.

This module provides the base crawler class, data models, and backend interfaces
that all retailer-specific crawlers inherit from.
"""

import os
import json
import redis
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, NamedTuple
from pydantic import BaseModel, Field
from urllib.parse import urlparse

# Environment variables with defaults
MAX_DEPTH = int(os.getenv("CRAWLER_MAX_DEPTH", "10"))
CONCURRENCY = int(os.getenv("CRAWLER_CONCURRENCY", "3"))
GRID_HOVER_DELAY_RANGE = (1.0, 3.0)
HOVER_DELAY_RANGE = (0.5, 1.5)

# Data models
class ProductRecord(BaseModel):
    """Product record data model."""
    retailer_id: int
    asin: Optional[str] = None
    tcin: Optional[str] = None
    wm_item_id: Optional[str] = None
    title: str
    price: str
    url: str
    category: Optional[str] = None
    description: Optional[str] = None

class Target(NamedTuple):
    """Target category for crawling."""
    name: str
    url: str

# Abstract base classes
class OutputBackend(ABC):
    """Abstract base class for output backends."""
    
    @abstractmethod
    def send(self, records) -> None:
        """Send records to the backend."""
        pass

class BaseCrawler(ABC):
    """Base crawler class that all retailer crawlers inherit from."""
    
    def __init__(self, retailer_id: int, output_backend: OutputBackend = None, 
                 logger: logging.Logger = None, urls_only: bool = False, 
                 hierarchical: bool = False, department: str = None, 
                 category: str = None):
        self.retailer_id = retailer_id
        self.output_backend = output_backend
        self.logger = logger or logging.getLogger(__name__)
        self.urls_only = urls_only
        self.hierarchical = hierarchical
        self.department = department
        self.category = category
        self.max_pages = 5
        self.concurrency = CONCURRENCY
    
    @abstractmethod
    def crawl(self, max_pages_per_cat: int = 5) -> None:
        """Main crawl method that each retailer implements."""
        pass
    
    @abstractmethod
    def crawl_from_hierarchy_file(self, hierarchy_file: Path, 
                                max_pages_per_cat: int = 5,
                                category_filter: str = None,
                                department_filter: str = None,
                                concurrency: int = 5) -> None:
        """Crawl from a pre-built hierarchy file."""
        pass

# Backend implementations
class JsonFileBackend(OutputBackend):
    """JSON file output backend."""
    
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

class RedisBackend(OutputBackend):
    """Redis output backend for URL storage."""
    
    def __init__(self, redis_client, retailer_id: int):
        self.redis_client = redis_client
        self.retailer_id = retailer_id
        self.logger = logging.getLogger(__name__)
    
    def send(self, records) -> None:
        """Send records to Redis."""
        count = 0
        for record in records:
            if isinstance(record, str):  # URL
                self.redis_client.lpush(f"product_urls:{self.retailer_id}", record)
                count += 1
            elif hasattr(record, 'url'):  # ProductRecord or dict with URL
                url = record.url if hasattr(record, 'url') else record.get('url')
                if url:
                    self.redis_client.lpush(f"product_urls:{self.retailer_id}", url)
                    count += 1
        
        self.logger.info(f"Sent {count} URLs to Redis")

# Utility functions
def create_redis_client() -> redis.Redis:
    """Create Redis client from environment variables."""
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    return redis.from_url(redis_url)

def create_redis_backend(retailer_id: int) -> RedisBackend:
    """Create Redis backend with default client."""
    redis_client = create_redis_client()
    return RedisBackend(redis_client, retailer_id)