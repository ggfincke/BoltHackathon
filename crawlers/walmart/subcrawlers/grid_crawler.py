# TODO: add proxy support, concurrency
import logging
import random
import time
import json
import re
from pathlib import Path
from typing import List, Dict, Set, Optional, Callable, Any, Tuple
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

# check if page is blocked
def _is_blocked_page(driver) -> bool:
    current_url = driver.current_url.lower()
    return any(keyword in current_url for keyword in ['blocked', 'challenge', 'captcha'])

# safely close driver
def _safe_close_driver(driver, logger):
    try:
        if driver:
            driver.quit()
    except Exception as e:
        logger.debug(f"Error closing driver: {e}")

# navigate to URL with automatic browser relaunching when blocked
def _safe_navigate_with_relaunch(driver, url, logger, use_safari=False, proxy_manager=None, max_retries=3) -> Tuple[bool, webdriver.Remote]:
    current_driver = driver
    
    for attempt in range(max_retries):
        try:
            logger.debug(f"Navigating to: {url} (attempt {attempt + 1})")
            current_driver.get(url)
            
            # wait for page to load
            WebDriverWait(current_driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # check if we're blocked
            if _is_blocked_page(current_driver):
                logger.warning(f"Detected blocked page: {current_driver.current_url}")
                logger.info(f"Relaunching browser (attempt {attempt + 1}/{max_retries})")
                
                # close current driver
                _safe_close_driver(current_driver, logger)
                
                # wait a bit before relaunching
                relaunch_delay = random.uniform(3, 8)
                logger.info(f"Waiting {relaunch_delay:.1f}s before relaunching...")
                time.sleep(relaunch_delay)
                
                # create new driver
                current_driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
                
                # try navigation again with new driver
                logger.info("Retrying navigation with fresh browser...")
                current_driver.get(url)
                
                # wait for page to load
                WebDriverWait(current_driver, 15).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # check again if still blocked
                if _is_blocked_page(current_driver):
                    logger.warning("Still blocked after relaunch, will retry...")
                    continue
            
            # wait for final page state
            WebDriverWait(current_driver, 10).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            
            # successful navigation
            logger.info("Successfully navigated to page")
            return True, current_driver
            
        except Exception as e:
            logger.warning(f"Navigation attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                # close and relaunch for any error
                logger.info("Relaunching browser due to error...")
                _safe_close_driver(current_driver, logger)
                
                relaunch_delay = random.uniform(2, 5)
                time.sleep(relaunch_delay)
                
                current_driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
                continue
            else:
                logger.error(f"Failed to navigate to {url} after {max_retries} attempts")
                return False, current_driver
    
    return False, current_driver

# extract Walmart item ID from a product card
def _get_product_id_from_card(card) -> Optional[str]:
    # First try to get from data-item-id attribute
    product_id = card.get_attribute('data-item-id')
    if product_id:
        return product_id
    
    # Fallback: extract from URL if data attribute not available
    try:
        link = card.find_element(By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR)
        href = link.get_attribute('href')
        if href:
            return _extract_walmart_id_from_url(href)
    except:
        pass
    
    return None

def _extract_walmart_id_from_url(url: str) -> Optional[str]:
    """Extract Walmart item ID from URL like https://www.walmart.com/ip/.../19758064"""
    if not url:
        return None
    
    import re
    
    # Pattern to match Walmart URLs ending with item ID
    pattern = r'/ip/[^/]+/(\d+)(?:\?.*)?$'
    match = re.search(pattern, url)
    
    if match:
        return match.group(1)
    
    # Alternative pattern for other Walmart URL formats
    pattern2 = r'/(\d+)(?:\?.*)?$'
    match2 = re.search(pattern2, url)
    
    if match2:
        return match2.group(1)
    
    return None

# extract product URL from a product card element
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

# extract product title from a product card element
def _extract_product_title(card) -> str:
    try:
        return card.find_element(By.CSS_SELECTOR, PRODUCT_TITLE_SELECTOR).text.strip()
    except NoSuchElementException:
        return "Unknown Title"

# extract product price from a product card element
def _extract_product_price(card) -> str:
    try:
        # first try the main price element
        price_element = card.find_element(By.CSS_SELECTOR, PRODUCT_PRICE_SELECTOR)
        price_text = price_element.text.strip()
        
        # clean up the price text
        if price_text:
            # split by newlines and take the first meaningful price
            lines = [line.strip() for line in price_text.split('\n') if line.strip()]
            
            for line in lines:
                # look for lines that start with $ and contain a proper price format
                if line.startswith('$'):
                    # improved regex pattern to match proper price formats
                    price_match = re.match(r'(\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', line)
                    if price_match:
                        return price_match.group(1)
                
                # handle "current price $X.XX" format
                if 'current price' in line.lower():
                    price_match = re.search(r'current price (\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', line.lower())
                    if price_match:
                        return price_match.group(1)
            
            # if no clean price found, try to extract with improved pattern
            price_match = re.search(r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?', price_text)
            if price_match:
                return price_match.group(0)
        
        # fallback: try alternative price selectors
        alternative_selectors = [
            '[data-automation-id="product-price"] span[itemprop="price"]',
            '[data-automation-id="product-price"] span:first-child', 
            'span[itemprop="price"]',
            '.price-current',
            '.price-group .price-current',
            '[aria-label*="current price"]',
            '[data-automation-id="product-price"] [data-testid="price-current"]',
            '.price-display .price-current'
        ]
        
        for selector in alternative_selectors:
            try:
                alt_element = card.find_element(By.CSS_SELECTOR, selector)
                alt_text = alt_element.text.strip()
                if alt_text and alt_text.startswith('$'):
                    # clean up alternative text with improved regex
                    price_match = re.match(r'(\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', alt_text)
                    if price_match:
                        return price_match.group(1)
            except NoSuchElementException:
                continue
        
        # last resort: try to find any decimal price pattern in the entire card text
        try:
            full_card_text = card.text
            # look for proper decimal prices in the full text
            decimal_price_match = re.search(r'\$\d{1,3}(?:,\d{3})*\.\d{2}', full_card_text)
            if decimal_price_match:
                return decimal_price_match.group(0)
        except:
            pass
                
        return "Unknown Price"
        
    except NoSuchElementException:
        return "Unknown Price"

# Additional helper function to validate and clean extracted prices
def _validate_and_clean_price(price_str: str) -> str:
    """
    Validate that the extracted price makes sense and clean it if needed.
    This helps catch cases where price extraction goes wrong.
    """
    if not price_str or price_str == "Unknown Price":
        return "Unknown Price"
    
    # Remove $ sign for validation
    clean_price = price_str.replace('$', '').replace(',', '')
    
    try:
        price_float = float(clean_price)
        
        # Basic validation - grocery items shouldn't be over $500 or under $0.01
        if price_float > 500.00:
            # Likely a formatting error like $4998 instead of $49.98
            # Try to fix common patterns
            price_str_digits = clean_price.replace('.', '')
            if len(price_str_digits) >= 3:
                # Insert decimal point before last 2 digits
                fixed_price = price_str_digits[:-2] + '.' + price_str_digits[-2:]
                fixed_float = float(fixed_price)
                if 0.01 <= fixed_float <= 500.00:
                    return f"${fixed_float:.2f}"
            
            # If we can't fix it, mark as unknown
            return "Unknown Price"
        
        elif price_float < 0.01:
            return "Unknown Price"
        
        else:
            # Price seems reasonable, format it properly
            return f"${price_float:.2f}"
            
    except ValueError:
        return "Unknown Price"

# scroll down the page to load all products
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

# click load more button
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

# click the "Next Page" chevron on the pagination
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
                
                # check for blocking after page navigation
                if _is_blocked_page(driver):
                    logging.getLogger(__name__).warning("Detected blocked page after pagination")
                    return False
                
                return True

        return False  

    except Exception as exc:
        logging.error(f"Pagination error: {exc}")
        return False

# extract just product URLs from pages 
def _extract_urls(driver: webdriver.Remote, url: str, max_pages: int, logger, use_safari=False, proxy_manager=None) -> Tuple[List[str], webdriver.Remote]:
    logger.info(f"Extracting URLs from Walmart: {url}")
    all_urls = []
    
    # navigate to the starting URL using safe navigation with relaunch
    success, driver = _safe_navigate_with_relaunch(driver, url, logger, use_safari, proxy_manager)
    if not success:
        logger.error(f"Failed to navigate to starting URL: {url}")
        return all_urls, driver
    
    try:
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
                # scroll again after load more
                _scroll_page(driver)  
            
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
    
    return all_urls, driver

# extract full product data from pages (for JSON output)
def _extract_full(driver: webdriver.Remote, url: str, max_pages: int, logger, use_safari=False, proxy_manager=None) -> Tuple[List[Dict[str, Any]], webdriver.Remote]:
    logger.info(f"Extracting full Walmart product data from {url}")
    all_products = []
    
    # navigate to starting URL using safe navigation with relaunch
    success, driver = _safe_navigate_with_relaunch(driver, url, logger, use_safari, proxy_manager)
    if not success:
        logger.error(f"Failed to navigate to starting URL: {url}")
        return all_products, driver
    
    try:
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
                
                # extract and validate price
                raw_price = _extract_product_price(card)
                validated_price = _validate_and_clean_price(raw_price)
                
                product_data = {
                    "wm_item_id": product_id,
                    "title": _extract_product_title(card),
                    "price": validated_price,
                    "url": product_url
                }
                
                # log if price was corrected
                if raw_price != validated_price and validated_price != "Unknown Price":
                    logger.info(f"Price corrected for {product_data['title']}: {raw_price} -> {validated_price}")
                
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
                
    return all_products, driver

# * main - crawl product grids from a list of starting URLs & return products found
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
        driver = None
        try:
            logger.info(f"Processing Walmart URL: {url}")
            driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
            url_results, driver = extract_fn(driver, url, max_depth, logger, use_safari, proxy_manager)
            results.extend(url_results)
            logger.info(f"Completed Walmart URL: {url}, extracted {len(url_results)} items")
        except Exception as e:
            logger.error(f"Error processing Walmart URL {url}: {e}")
        finally:
            _safe_close_driver(driver, logger)
    
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