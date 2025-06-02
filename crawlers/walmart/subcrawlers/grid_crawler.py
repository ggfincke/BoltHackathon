# TODO: add proxy support, concurrency
import logging
import random
import time
import json
import re
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any
from urllib.parse import urljoin, urlparse

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

# GRID_HOVER_DELAY_RANGE = (500, 750)

# tracking seen product IDs to avoid dupes
SEEN_PRODUCT_IDS: Set[str] = set()

# selectors for Walmart product grid
PRODUCT_GRID_SELECTOR = '[data-testid="item-stack"]'
PRODUCT_CARD_SELECTOR = 'div[role="group"][data-item-id]'
PRODUCT_TITLE_SELECTOR = '[data-automation-id="product-title"]'
PRODUCT_PRICE_SELECTOR = '[data-automation-id="product-price"]'
PRODUCT_LINK_SELECTOR = 'a[link-identifier]'
NEXT_BUTTON_SELECTOR = 'a[data-testid="NextPage"][aria-label="Next Page"]'
ALT_NEXT_SELECTORS = [
    'a[aria-label="Next Page"]',
    '[role="button"][data-testid="NextPage"]',
    'li[aria-label="Next"] a',
]
LOAD_MORE_SELECTOR = 'button[data-automation-id="load-more"]'
PRODUCT_ID_PATTERN = r'/ip/[^/]+/(\d+)'
WM_ITEM_ID_PATTERN = r'data-item-id="(\d+)"'

# * helper funcs
# setup driver; either Chrome or Safari (Chrome w/ UC works better for Walmart)
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
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        driver = uc.Chrome(options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

# add random delay to avoid detection
def _random_delay(min_seconds=None, max_seconds=None):
    if min_seconds is None or max_seconds is None:
        min_seconds, max_seconds = GRID_HOVER_DELAY_RANGE
    
    # convert ms to seconds
    delay = random.uniform(min_seconds/1000, max_seconds/1000)
    time.sleep(delay)

# extract Walmart item ID from a product card or URL
def _get_product_id_from_card(card) -> Optional[str]:
    return card.get_attribute('data-item-id')

# extract product URL from a product card
def _extract_product_url(driver, card) -> Optional[str]:
    try:
        link = card.find_element(By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR)
    except NoSuchElementException:
        return None

    href = link.get_attribute('href')
    if not href:
        return None

    parsed = urlparse(href)
    return f'{parsed.scheme}://{parsed.netloc}{parsed.path}'

# extract product title from a card element
def _extract_product_title(card) -> str:
    try:
        return card.find_element(By.CSS_SELECTOR, PRODUCT_TITLE_SELECTOR).text.strip()
    except NoSuchElementException:
        return "Unknown Title"

# extract product price from a card element
def _extract_product_price(card) -> str:
    try:
        return card.find_element(By.CSS_SELECTOR, PRODUCT_PRICE_SELECTOR).text.strip()
    except NoSuchElementException:
        return "Unknown Price"

# scroll down the page to ensure all products are loaded
def _scroll_page(driver):
    try:
        # get initial page height
        last_height = driver.execute_script("return document.body.scrollHeight")
        
        while True:
            # scroll down
            driver.execute_script("window.scrollBy(0, 800);")
            
            # wait for page to load
            _random_delay(500, 1000)
            
            # calc new scroll height & compare w/ last scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                # if heights are the same, we've reached the bottom
                break
            last_height = new_height
            
    except Exception as e:
        logging.error(f"Error scrolling page: {e}")

# check for & click load more button
def _click_load_more(driver) -> bool:
    try:
        # look for load more button
        load_more_button = driver.find_element(By.CSS_SELECTOR, LOAD_MORE_SELECTOR)
        if load_more_button.is_displayed() and load_more_button.is_enabled():
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", load_more_button)
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", load_more_button)
            time.sleep(2)  # wait for new products to load
            return True
    except:
        pass
    return False

# click the "Next Page" chevron
def _go_to_next_page(driver: webdriver.Remote) -> bool:
    try:
        # make sure pagination is in view
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight - 400);")

        # try the primary selector first
        next_btns = driver.find_elements(By.CSS_SELECTOR, NEXT_BUTTON_SELECTOR)

        # fall back to alternates if needed
        if not next_btns:
            for sel in ALT_NEXT_SELECTORS:
                next_btns = driver.find_elements(By.CSS_SELECTOR, sel)
                if next_btns:
                    break

        # no button? on final page
        if not next_btns:
            return False

        # pick first visible / enabled anchor
        for btn in next_btns:
            if btn.is_displayed() and btn.is_enabled():
                driver.execute_script("arguments[0].click();", btn)
                # wait until *new* grid loads
                WebDriverWait(driver, 12).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, PRODUCT_CARD_SELECTOR)
                    )
                )
                return True

        return False  

    except Exception as exc:
        logging.error(f"Pagination error: {exc}")
        return False

# extract just product URLs from pages (for Redis output)
def _extract_urls(driver: webdriver.Remote, url: str, max_pages: int, logger) -> List[str]:
    logger.info(f"Extracting URLs from Walmart: {url}")
    all_urls = []
    
    # navigate to the starting URL
    try:
        driver.get(url)
        
        # wait for page to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # process pages
        for page_num in range(max_pages):
            logger.info(f"Processing Walmart page {page_num + 1}/{max_pages}")
            
            # wait for product grid to load
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_GRID_SELECTOR))
                )
            except TimeoutException:
                logger.warning("Timed out waiting for Walmart product grid")
                break
            
            # allow dynamic content to load
            _random_delay(1000, 2000)
            
            # scroll down to load all products and try load more
            _scroll_page(driver)
            
            # try to click load more button
            load_more_clicked = _click_load_more(driver)
            if load_more_clicked:
                _scroll_page(driver)  # Scroll again after load more
            
            # get all product cards
            product_cards = driver.find_elements(By.CSS_SELECTOR, PRODUCT_CARD_SELECTOR)
            logger.info(f"Found {len(product_cards)} Walmart product cards on page {page_num + 1}")
            
            # extract URLs from each card
            page_urls = []
            for card in product_cards:
                product_id = _get_product_id_from_card(card)
                if not product_id or product_id in SEEN_PRODUCT_IDS:
                    continue
                
                product_url = _extract_product_url(driver, card)
                if product_url:
                    page_urls.append(product_url)
                    SEEN_PRODUCT_IDS.add(product_id)
            
            # add to results
            all_urls.extend(page_urls)
            logger.info(f"Extracted {len(page_urls)} unique URLs from Walmart page {page_num + 1}")
            
            # check if there are more pages
            if not _go_to_next_page(driver):
                logger.info("No more Walmart pages available")
                break
            
            # random delay between pages
            _random_delay(2000, 4000)
            
    except Exception as e:
        logger.error(f"Error extracting Walmart URLs: {e}")
    
    return all_urls

# extract full product data from pages (for JSON output)
def _extract_full(driver: webdriver.Remote, url: str, max_pages: int, logger) -> List[Dict[str, Any]]:
    logger.info(f"Extracting full Walmart product data from {url}")
    all_products = []
    
    # navigate to starting URL
    try:
        driver.get(url)
        
        # wait for page to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # process pages
        for page_num in range(max_pages):
            logger.info(f"Processing Walmart page {page_num + 1}/{max_pages}")
            
            # wait for product grid to load
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_GRID_SELECTOR))
                )
            except TimeoutException:
                logger.warning("Timed out waiting for Walmart product grid")
                break
            
            # allow dynamic content to load
            _random_delay(1000, 2000)
            
            # scroll down to load all products
            _scroll_page(driver)
            
            # try to click load more button
            load_more_clicked = _click_load_more(driver)
            if load_more_clicked:
                _scroll_page(driver)  # Scroll again after load more
            
            # get all product cards
            product_cards = driver.find_elements(By.CSS_SELECTOR, PRODUCT_CARD_SELECTOR)
            logger.info(f"Found {len(product_cards)} Walmart product cards on page {page_num + 1}")
            
            # extract data from each card
            page_products = []
            for card in product_cards:
                product_id = _get_product_id_from_card(card)
                if not product_id or product_id in SEEN_PRODUCT_IDS:
                    continue
                
                product_url = _extract_product_url(driver, card)
                if not product_url:
                    continue
                
                product_data = {
                    "wm_item_id": product_id,
                    "title": _extract_product_title(card),
                    "price": _extract_product_price(card),
                    "url": product_url
                }
                
                page_products.append(product_data)
                SEEN_PRODUCT_IDS.add(product_id)
            
            all_products.extend(page_products)
            logger.info(f"Extracted {len(page_products)} unique Walmart products from page {page_num + 1}")
            
            # check if more pages
            if not _go_to_next_page(driver):
                logger.info("No more Walmart pages available")
                break
            
            # random delay between pages
            _random_delay(2000, 4000)
            
    except Exception as e:
        logger.error(f"Error extracting Walmart product data: {e}")
                
    return all_products

# * main - crawl product grids from a list of starting URLs and return the products found
def crawl_grid(start_urls: List[str], max_depth: int = 5, extract_urls_only: bool = False,
               use_safari: bool = False, proxy_manager = None, logger = None) -> List:
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
            logger.info(f"Processing Walmart URL: {url}")
            driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
            url_results = extract_fn(driver, url, max_depth, logger)
            results.extend(url_results)
            logger.info(f"Completed Walmart URL: {url}, extracted {len(url_results)} items")
        except Exception as e:
            logger.error(f"Error processing Walmart URL {url}: {e}")
        finally:
            if driver:
                driver.quit()
    
    return results

# testing entry point
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)
    
    # test URLs - using some Walmart grocery categories
    test_urls = [
        "https://www.walmart.com/browse/food/packaged-meals-side-dishes/976759_976794_5614446",
        "https://www.walmart.com/browse/food/health-inspired-meals/976759_976791_6259087_3243369",
    ]
    
    # test with URL-only extraction
    urls_only = crawl_grid(test_urls, max_depth=2, extract_urls_only=True, use_safari=False, logger=logger)

    # clear seen product IDs
    SEEN_PRODUCT_IDS.clear()

    # test with full extraction
    full_data = crawl_grid(test_urls, max_depth=2, extract_urls_only=False, use_safari=False, logger=logger)

    # save results
    Path("walmart_urls.json").write_text(json.dumps(urls_only, indent=2, ensure_ascii=False))
    Path("walmart_products.json").write_text(json.dumps(full_data, indent=2, ensure_ascii=False))
    logger.info("Saved Walmart results to JSON files")

    logger.info(f"Extracted {len(urls_only)} unique Walmart product URLs")