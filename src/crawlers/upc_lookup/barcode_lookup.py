"""
BarcodeLookup.com UPC lookup service implementation.

This module provides the BarcodeLookupService class that implements the
BaseUPCLookup interface for looking up UPC codes using the BarcodeLookup.com
website. Uses Selenium with undetected Chrome driver for web scraping.
"""

import re
import random
import time
import string
from typing import Optional
from difflib import SequenceMatcher

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

from .base_upc_lookup import BaseUPCLookup, UPCResult

# * BarcodeLookup service class *

# barcodeLookup.com UPC lookup service implementation
class BarcodeLookupService(BaseUPCLookup):
    def __init__(self, max_pages: int = 4, similarity_threshold: float = 0.45, 
                 headless: bool = True, logger=None):
        super().__init__(logger)
        self.max_pages = max_pages
        self.similarity_threshold = similarity_threshold
        self.headless = headless
        self.driver = None
        self.wait = None
        
    # * Driver management methods *
        
    # driver setup
    def _setup_driver(self):
        if self.driver is None:
            try:
                opts = uc.ChromeOptions()
                if self.headless:
                    opts.add_argument("--headless=new")
                opts.add_argument("--no-sandbox")
                opts.add_argument("--disable-dev-shm-usage")
                opts.add_argument("--disable-gpu")
                
                self.driver = uc.Chrome(options=opts)
                self.wait = WebDriverWait(self.driver, 10)
                self.logger.info("BarcodeLookup driver initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize BarcodeLookup driver: {e}")
                self.driver = None
    
    # * Text processing methods *
    
    # normalize text for similarity comparison
    def _normalize_text(self, text: str) -> list[str]:
        remove = str.maketrans("", "", string.punctuation)
        return text.lower().translate(remove).split()
    
    # calc similarity b/w query & title using hybrid approach
    def _calculate_similarity(self, query: str, title: str) -> float:
        tok_query, tok_title = set(self._normalize_text(query)), set(self._normalize_text(title))
        if not tok_query or not tok_title:
            return 0.0
        
        # Jaccard similarity (intersection / union)
        jaccard = len(tok_query & tok_title) / len(tok_query | tok_title)
        
        # Sequence similarity (ratio of matching characters)
        seq_ratio = SequenceMatcher(None, query.lower(), title.lower()).ratio()
        
        # Weighted combination (60% Jaccard, 40% Sequence)
        return 0.6 * jaccard + 0.4 * seq_ratio
    
    # * Main lookup methods *
    
    # lookup UPC for a product name
    def lookup_upc(self, product_name: str) -> UPCResult:
        if not product_name or not product_name.strip():
            return UPCResult(
                upc=None,
                confidence_score=0.0,
                source_service=self.service_name,
                product_title=""
            )
        
        self._setup_driver()
        if not self.driver:
            return UPCResult(
                upc=None,
                confidence_score=0.0,
                source_service=self.service_name,
                product_title=product_name,
                metadata={"error": "Driver initialization failed"}
            )
        
        try:
            return self._perform_lookup(product_name)
        except Exception as e:
            self.logger.error(f"UPC lookup failed for '{product_name}': {e}")
            return UPCResult(
                upc=None,
                confidence_score=0.0,
                source_service=self.service_name,
                product_title=product_name,
                metadata={"error": str(e)}
            )
    
    # perform the actual UPC lookup
    def _perform_lookup(self, product_name: str) -> UPCResult:
        # search page
        self.driver.get("https://www.barcodelookup.com/")
        time.sleep(random.uniform(2.0, 3.0))
        
        # submit search
        try:
            search_box = self.driver.find_element(By.NAME, "search-input")
            search_box.clear()
            search_box.send_keys(product_name)
            
            submit_btn = self.driver.find_element(By.CSS_SELECTOR, "form.search-bar button.btn-search")
            submit_btn.click()
        except Exception as e:
            raise Exception(f"Failed to submit search: {e}")
        
        current_page = 1
        best_upc, best_score, best_title = None, 0.0, ""
        
        # search through pages
        while current_page <= self.max_pages:
            try:
                # wait for results
                self.wait.until(EC.presence_of_element_located((By.ID, "product-search-results")))
                items = self.driver.find_elements(By.CSS_SELECTOR, "#product-search-results li")
                
                for item in items:
                    try:
                        title_el = item.find_element(By.CSS_SELECTOR, ".product-search-item-text p")
                        title = title_el.text.strip()
                        
                        # extract UPC
                        upc_match = re.search(r"Barcode:\s*(\d+)", item.text)
                        if not upc_match:
                            continue
                        
                        upc = upc_match.group(1)
                        score = self._calculate_similarity(product_name, title)
                        
                        if score > best_score:
                            best_score, best_upc, best_title = score, upc, title
                        
                    except Exception as e:
                        self.logger.debug(f"Error processing search result item: {e}")
                        continue
                
                # early break
                if best_score >= self.similarity_threshold:
                    break
                
                # go to next page
                try:
                    next_btn = self.driver.find_element(
                        By.CSS_SELECTOR, "ul.pagination a[aria-label='Next']"
                    )
                    next_btn.click()
                    current_page += 1
                    time.sleep(random.uniform(1.5, 2.5))
                except Exception:
                    # no more pages
                    break
                    
            except TimeoutException:
                self.logger.warning(f"Timeout waiting for search results on page {current_page}")
                break
        
        # return    
        return UPCResult(
            upc=best_upc if best_score >= self.similarity_threshold else None,
            confidence_score=best_score,
            source_service=self.service_name,
            product_title=best_title or product_name,
            metadata={
                "pages_searched": current_page,
                "threshold": self.similarity_threshold
            }
                    )
    
    # * Service management methods *
    
    # check if the service is available
    def is_available(self) -> bool:
        try:
            self._setup_driver()
            if not self.driver:
                return False
            
            # try to access the main page
            self.driver.get("https://www.barcodelookup.com/")
            return "barcodelookup" in self.driver.current_url.lower()
        except Exception as e:
            self.logger.error(f"BarcodeLookup availability check failed: {e}")
            return False
    
    def cleanup(self) -> None:
        # clean up driver resources
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("BarcodeLookup driver closed")
            except Exception as e:
                self.logger.error(f"Error closing BarcodeLookup driver: {e}")
            finally:
                self.driver = None
                self.wait = None