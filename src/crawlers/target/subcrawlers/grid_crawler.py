# TODO: add proxy support, concurrency
import logging
import random
import time
import json
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any
from urllib.parse import urljoin, urlparse
import re

import undetected_chromedriver as uc
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
from selenium.webdriver.safari.service import Service as SafariService
from selenium.webdriver.safari.options import Options as SafariOptions

# import constants from base crawler
from ...base_crawler import GRID_HOVER_DELAY_RANGE

# tracking seen TCINs to avoid dupes
SEEN_TCINS: Set[str] = set()

# selectors for Target product grid
PRODUCT_GRID_SELECTOR = '[data-test="product-grid"]'
PRODUCT_CARD_SELECTOR = '[data-test="@web/site-top-of-funnel/ProductCardWrapper"]'
PRODUCT_TITLE_SELECTOR = '[data-test="product-title"]'
PRODUCT_PRICE_SELECTOR = '[data-test="current-price"]'
PRODUCT_LINK_SELECTOR = 'a[data-test="product-title"]'
NEXT_BUTTON_SELECTOR = '[data-test="next"]'
PRODUCT_TCIN_ATTRIBUTE = 'data-focusid'
TCIN_PATTERN = r'(\d+)_product_card'

# * helper funcs
# check if URL already exists in listings
def _url_exists_in_database(url: str, supabase_client = None) -> bool:
    if not supabase_client:
        return False
    
    try:
        result = supabase_client.table('listings')\
            .select('id')\
            .eq('url', url)\
            .limit(1)\
            .execute()
        return len(result.data) > 0
    except Exception as e:
        logging.error(f"Error checking URL existence: {e}")
        return False

# setup driver; either Chrome or Safari (safari seems better at avoiding detection)
def _setup_driver(use_safari: bool = False, proxy_manager = None) -> webdriver.Remote:
    # setup Safari driver
    if use_safari:
        options = SafariOptions()
        service = SafariService()
        driver = webdriver.Safari(service=service, options=options)
    # setup Chrome driver (undetected-chromedriver)
    else:
        options = uc.ChromeOptions()
        
        # add proxy if available
        proxy = proxy_manager.get_proxy() if proxy_manager else None
        if proxy:
            options.add_argument(f'--proxy-server={proxy}')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument("--log-level=3")
        
        driver = uc.Chrome(options=options)
    
    return driver

# add random delay to avoid detection
def _random_delay(min_seconds=None, max_seconds=None):
    if min_seconds is None or max_seconds is None:
        min_seconds, max_seconds = GRID_HOVER_DELAY_RANGE
    
    # convert ms to seconds
    delay = random.uniform(min_seconds/1000, max_seconds/1000)
    time.sleep(delay)

# extract TCIN from a product card
def _get_tcin_from_card(card_element) -> Optional[str]:
    try:
        # try to get TCIN from data-focusid attribute
        focusid = card_element.get_attribute(PRODUCT_TCIN_ATTRIBUTE)
        if focusid and '_product_card' in focusid:
            return focusid.split('_product_card')[0]
    except Exception as e:
        logging.error(f"Error extracting TCIN: {e}")
    return None

# extract product URL from a product card
def _extract_product_url(driver, card) -> Optional[str]:
    # CRITICAL: ensure card is fully loaded before ANY extraction
    try:
        driver.execute_script(
            "arguments[0].scrollIntoView({block:'center'});", card
        )
        # wait for elements to be present
        WebDriverWait(card, 2).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR))
        )
    except (TimeoutException, NoSuchElementException):
        pass
    
    # method 1: build URL directly from TCIN (most reliable)
    tcin = _get_tcin_from_card(card)
    if tcin:
        return _build_target_url_from_tcin(tcin)
    
    # method 2: extract from href and normalize (fallback)
    try:
        link = card.find_element(By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR)
        href = link.get_attribute('href')
        if href:
            full_url = urljoin("https://www.target.com", href)
            return _shorten_target_url(full_url)
    except NoSuchElementException:
        pass
    
    return None

# extract product title from a card element
def _extract_product_title(card_element) -> str:
    try:
        # get title element
        title_element = card_element.find_element(By.CSS_SELECTOR, PRODUCT_TITLE_SELECTOR)
        return title_element.text.strip()
    except (NoSuchElementException, StaleElementReferenceException):
        return "Unknown Title"

# extract product price from a card element
def _extract_product_price(card_element) -> str:
    try:
        # get price element
        price_element = card_element.find_element(By.CSS_SELECTOR, PRODUCT_PRICE_SELECTOR)
        return price_element.text.strip()
    except (NoSuchElementException, StaleElementReferenceException):
        return "Unknown Price"

# scroll down the page to ensure all products are loaded
def _scroll_page(driver):
    try:
        # get initial page height
        last_height = driver.execute_script("return document.body.scrollHeight")
        
        while True:
            # Scroll down
            driver.execute_script("window.scrollBy(0, 800);")
            
            # Wait for page to load
            _random_delay(500, 1000)
            
            # Calculate new scroll height and compare with last scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                # If heights are the same, we've reached the bottom
                break
            last_height = new_height
            
    except Exception as e:
        logging.error(f"Error scrolling page: {e}")

# navigate to the next results page
def _go_to_next_page(driver) -> bool:
    try:
        # wait until *any* next button is present
        buttons = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, NEXT_BUTTON_SELECTOR))
        )

        # pick the first one that is actually enabled / clickable
        btn = None
        for b in buttons:
            # skip ghost or true-disabled arrows
            if b.get_attribute("disabled") or b.get_attribute("aria-disabled") == "true":
                continue
            btn = b
            break
        # no usable arrow -> last page
        if btn is None:
            return False

        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
        time.sleep(0.4)          # tiny pause so IntersectionObserver inside the page fires (to load more products)

        href = btn.get_attribute("href")
        if href:
            # link variant -> just load it
            driver.get(href)
        else:
            # button variant -> click via JS to avoid overlay / sticky header collisions
            driver.execute_script("arguments[0].click();", btn)

        # give React a moment to swap the grid (to load more products)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_GRID_SELECTOR))
        )
        return True

    except TimeoutException:
        return False
    except Exception as exc:
        logging.error(f"Error navigating to next page: {exc}")
        return False

# extract just product URLs from pages (for Redis output)
def _extract_urls(driver: webdriver.Remote, url: str, max_pages: int, logger) -> List[str]:
    # logger
    logger.info(f"Extracting URLs from {url}")
    all_urls = []
    
    # navigate to the starting URL
    try:
        driver.get(url)
        
        # process pages
        for page_num in range(max_pages):
            logger.info(f"Processing page {page_num + 1}/{max_pages}")
            
            # wait for product grid to load
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_GRID_SELECTOR))
                )
            except TimeoutException:
                logger.warning("Timed out waiting for product grid")
                break
            
            # allow dynamic content to load
            _random_delay(1000, 2000)
            
            # scroll down to load all products
            _scroll_page(driver)
            
            # get all product cards
            product_cards = driver.find_elements(By.CSS_SELECTOR, PRODUCT_CARD_SELECTOR)
            logger.info(f"Found {len(product_cards)} product cards on page {page_num + 1}")
            
            # extract URLs from each card
            page_urls = []
            for card in product_cards:
                tcin = _get_tcin_from_card(card)
                if not tcin or tcin in SEEN_TCINS:
                    continue
                
                product_url = _extract_product_url(driver, card)
                if product_url:
                    page_urls.append(product_url)
                    SEEN_TCINS.add(tcin)
            
            # add to results
            all_urls.extend(page_urls)
            logger.info(f"Extracted {len(page_urls)} unique URLs from page {page_num + 1}")
            
            # check if there are more pages
            if not _go_to_next_page(driver):
                logger.info("No more pages available")
                break
            
            # random delay b/w pages
            _random_delay(2000, 4000)
            
    # handle errors
    except Exception as e:
        logger.error(f"Error extracting URLs: {e}")
    
    return all_urls

# extract full product data from pages (for JSON output)
def _extract_full(driver: webdriver.Remote, url: str, max_pages: int, logger, supabase_client = None) -> List[Dict[str, Any]]:
    # logger
    logger.info(f"Extracting full product data from {url}")
    all_products = []
    
    # navigate to starting URL
    try:
        driver.get(url)
        
        # process pages
        for page_num in range(max_pages):
            logger.info(f"Processing page {page_num + 1}/{max_pages}")
            
            # wait for product grid to load
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_GRID_SELECTOR))
                )
            except TimeoutException:
                logger.warning("Timed out waiting for product grid")
                break
            
            # allow dynamic content to load
            _random_delay(1000, 2000)
            
            # scroll down to load all products
            _scroll_page(driver)
            
            # get all product cards
            product_cards = driver.find_elements(By.CSS_SELECTOR, PRODUCT_CARD_SELECTOR)
            logger.info(f"Found {len(product_cards)} product cards on page {page_num + 1}")
            
            # extract data from each card
            page_products = []
            for card in product_cards:
                tcin = _get_tcin_from_card(card)
                if not tcin or tcin in SEEN_TCINS:
                    continue
                
                product_url = _extract_product_url(driver, card)  
                if not product_url:
                    continue
                
                # check if URL exists in database before processing
                if supabase_client and _url_exists_in_database(product_url, supabase_client):
                    logger.info(f"Skipping existing product: {product_url}")
                    # mark as seen to avoid reprocessing
                    SEEN_TCINS.add(tcin)
                    continue
                
                product_data = {
                    "tcin": tcin,
                    "title": _extract_product_title(card),
                    "price": _extract_product_price(card),
                    "url": product_url
                }
                
                page_products.append(product_data)
                SEEN_TCINS.add(tcin)
            
            all_products.extend(page_products)
            logger.info(f"Extracted {len(page_products)} unique products from page {page_num + 1}")
            
            # check if more pages
            if not _go_to_next_page(driver):
                logger.info("No more pages available")
                break
            
            # random delay b/w pages
            _random_delay(2000, 4000)
            
    # handle errors
    except Exception as e:
        logger.error(f"Error extracting product data: {e}")
                
    return all_products

# build the URL from the TCIN
def _build_target_url_from_tcin(tcin: str) -> str:
    return f"https://www.target.com/p/-/A-{tcin}"

# shorten the URL to the product (to avoid dupes)
def _shorten_target_url(url: str) -> str:
    if not url:
        return url
        
    # match Target product URLs with TCIN (A-numbers)
    pattern = r'https://www\.target\.com/p/[^/]*(/\-/A-\d+)(?:[#?].*)?'
    match = re.search(pattern, url)
    
    if match:
        tcin_part = match.group(1)  # /-/A-number
        # construct minimal product URL
        return f"https://www.target.com/p{tcin_part}"
    
    # fallback pattern for URLs that might not have product names
    pattern2 = r'(https://www\.target\.com/p/).*?(/\-/A-\d+)(?:[#?].*)?'
    match2 = re.search(pattern2, url)
    
    if match2:
        base_url = match2.group(1)  # https://www.target.com/p/
        tcin_part = match2.group(2)  # /-/A-number
        return f"{base_url}{tcin_part}"
    
    # fallback to original if no match
    return url 

# * main - crawl product grids from a list of starting URLs and return the products found
def crawl_grid(start_urls: List[str], max_depth: int = 5, extract_urls_only: bool = False,
               use_safari: bool = False, proxy_manager = None, logger = None, supabase_client = None) -> List:
    # logger
    if logger is None:
        logger = logging.getLogger(__name__)
    
    # results container
    results = []
    
    # extract function to use
    extract_fn = _extract_urls if extract_urls_only else _extract_full
    
    # process each URL
    for url in start_urls:
        try:
            logger.info(f"Processing URL: {url}")
            driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
            
            # call extract function
            if extract_urls_only:
                url_results = extract_fn(driver, url, max_depth, logger)
            else:
                url_results = extract_fn(driver, url, max_depth, logger, supabase_client)
            
            results.extend(url_results)
            logger.info(f"Completed URL: {url}, extracted {len(url_results)} items")
        except Exception as e:
            logger.error(f"Error processing URL {url}: {e}")
        finally:
            if driver:
                driver.quit()
    
    return results

# testing entry point
if __name__ == "__main__":
    # test URL normalization first
    test_urls = [
        "https://www.target.com/p/kinder-bueno-minis-candy-share-pack-5-7oz/-/A-80321287#lnk=sametab",
        "https://www.target.com/p/some-product-name/-/A-12345678?ref=target",
        "https://www.target.com/p/-/A-87654321",
        "https://www.target.com/p/long-product-name-here/-/A-11111111",
    ]
    
    print("Target URL Normalization Test:")
    for url in test_urls:
        shortened = _shorten_target_url(url)
        print(f"Original:  {url}")
        print(f"Shortened: {shortened}")
        print("---")
    
    # all should normalize to: https://www.target.com/p/-/A-{tcin}
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)
    
    # test URLs for crawling
    crawl_test_urls = [
        "https://www.target.com/c/frozen-single-serve-meals-foods-grocery/-/N-wdysv",
        "https://www.target.com/c/cookies-snacks-grocery/-/N-54v3e"
    ]
    
    # test w/ URL-only extraction
    urls_only = crawl_grid(crawl_test_urls, max_depth=2, extract_urls_only=True, use_safari=True, logger=logger)

    # clear seen TCINs
    SEEN_TCINS.clear()

    # test w/ full extraction
    full_data = crawl_grid(crawl_test_urls, max_depth=2, extract_urls_only=False, use_safari=True, logger=logger)

    # save results
    Path("target_urls.json").write_text(json.dumps(urls_only, indent=2, ensure_ascii=False))
    Path("target_products.json").write_text(json.dumps(full_data, indent=2, ensure_ascii=False))
    logger.info("Saved results to JSON files")

    logger.info(f"Extracted {len(urls_only)} unique product URLs")