# imports   
import re, json, random, logging, time
from pathlib import Path
from typing import List, Dict, Set, Optional, Tuple
from urllib.parse import urljoin

# have to use undetected_chromedriver bc selenium/playwright get identified by walmart
import undetected_chromedriver as uc
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
from selenium.webdriver.safari.service import Service as SafariService
from selenium.webdriver.safari.options import Options as SafariOptions

MAX_DEPTH = 10
CONCURRENCY = 1
HOVER_DELAY_RANGE = (700, 1000)
GRID_HOVER_DELAY_RANGE = (1000, 1500)

# Walmart-specific selectors
CATEGORY_GRID_CONTAINER = "div[role='list'][id*='Grid']" 
CATEGORY_GRID_ITEMS = "div[role='listitem'][id^='GridColumn-']" 
RAW_CATEGORY_LINKS = "div[role='listitem'][id^='GridColumn-'] a"  
CATEGORY_NAME_SELECTOR = "span, div" 
PRODUCT_GRID_MARKER = "[data-automation-id='product-tile']"   
LOAD_MORE_SELECTOR = "button[aria-label*='Show'], button[aria-label*='Load']" 

CATEGORY_TILE_LINK   = "div[role='listitem'][id^='GridColumn-'] > a[href]"
CATEGORY_TILE_IMG    = "img[alt]"
SCROLL_PAUSE_MS      = 300          
MAX_SCROLL_ATTEMPTS  = 3            
SCROLL_CHUNK = 800          
SCROLL_WAIT  = 0.25         
MAX_HYDRATE_SCROLLS = 5     
VALID_HREF_RE = re.compile(r"/(?:cp|browse)/[^?#]+")

# urls
START_URL = "https://www.walmart.com/cp/food/976759?povid=GlobalNav_rWeb_Grocery_GroceryShopAll" 

def _setup_driver(use_safari: bool = True, proxy_manager = None) -> webdriver.Remote:
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
        
        # additional anti-detection measures
        options.add_argument('--disable-blink-features=AutomationControlled')

        driver = uc.Chrome(options=options)
        
        # Execute script to remove webdriver property
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

# add random delay to avoid detection
def _random_delay(min_seconds=None, max_seconds=None):
    if min_seconds is None or max_seconds is None:
        min_seconds, max_seconds = HOVER_DELAY_RANGE
    
    # convert ms to seconds
    delay = random.uniform(min_seconds/1000, max_seconds/1000)
    time.sleep(delay)

def _is_blocked_page(driver) -> bool:
    """Check if current page is a blocked/challenge page."""
    current_url = driver.current_url.lower()
    return any(keyword in current_url for keyword in ['blocked', 'challenge', 'captcha'])

def _safe_close_driver(driver, logger):
    """Safely close a driver instance."""
    try:
        if driver:
            driver.quit()
    except Exception as e:
        logger.debug(f"Error closing driver: {e}")

def _safe_navigate_with_relaunch(driver, url, logger, use_safari=True, proxy_manager=None, max_retries=3) -> Tuple[bool, webdriver.Remote]:
    """
    Navigate to URL with automatic browser relaunching when blocked.
    Returns: (success, driver) where driver might be a new instance if relaunched.
    """
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

# gets the category path (used for logging)
def _get_category_path(node_json):
    path, current = [], node_json
    while current:
        if "name" in current:
            path.append(current["name"])
        current = current.get("parent")
    return " > ".join(reversed(path))

# strips parent refs
def _strip_parent_refs(node):
    # if it's a dict
    if isinstance(node, dict):
        node.pop("parent", None)
        # walk every field, not just 'sub_items'
        for value in node.values():
            _strip_parent_refs(value)
    # if it's a list
    elif isinstance(node, list):
        for item in node:
            _strip_parent_refs(item)

# extract clean category name
def _clean_category_name(text):
    # Remove any count indicators like "(123)" and clean whitespace
    cleaned = re.sub(r'\s*\(\d+\)\s*$', '', text).strip()
    # Remove any additional Walmart-specific formatting
    cleaned = re.sub(r'\s*\|\s*Walmart.*$', '', cleaned, flags=re.IGNORECASE)
    return cleaned

# util to expand all "Show more" or "Load more" buttons
def _click_all_show_buttons(driver, logger):
    # look for load more buttons within or near the category grid
    selectors_to_try = [
        LOAD_MORE_SELECTOR,
        "button[aria-label*='Show more']",
        "button[aria-label*='Load more']", 
        "button[aria-label*='View all']",
        "a[aria-label*='Show more']",
        "a[aria-label*='Load more']",
        "a[aria-label*='View all']",
        # look for buttons near the grid
        f"{CATEGORY_GRID_CONTAINER} ~ button",
        f"{CATEGORY_GRID_CONTAINER} button"
    ]
    
    # track how many buttons we've clicked to prevent infinite loops
    max_clicks = 10
    clicks_made = 0
    
    for selector in selectors_to_try:
        if clicks_made >= max_clicks:
            break
            
        while clicks_made < max_clicks:
            try:
                # wait for any show more button to be present
                buttons = driver.find_elements(By.CSS_SELECTOR, selector)
                if not buttons:
                    break
                    
                buttons_clicked_this_round = 0
                
                for button in buttons:
                    try:
                        if not button.is_displayed() or not button.is_enabled():
                            continue
                            
                        # check if button text suggests it's a "show more" type button
                        button_text = button.text.lower()
                        aria_label = (button.get_attribute("aria-label") or "").lower()
                        
                        if any(phrase in button_text + " " + aria_label for phrase in 
                               ["show", "load", "more", "all", "expand", "view"]):
                            
                            # scroll into view & click
                            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
                            time.sleep(0.5)  # small delay for scroll
                            
                            # try clicking the button
                            driver.execute_script("arguments[0].click();", button)
                            buttons_clicked_this_round += 1
                            clicks_made += 1
                            
                            logger.debug(f"Clicked button: {button_text or aria_label}")
                            
                            # wait for content to load
                            time.sleep(2)
                            _random_delay(500, 1000)
                            
                    except Exception as e:
                        # button may disappear between locating & clicking – ignore & continue
                        logger.debug(f"Could not click button: {e}")
                
                # if no buttons were clicked this round with this selector, try next selector
                if buttons_clicked_this_round == 0:
                    break
                    
            except Exception as e:
                logger.debug(f"Error with selector {selector}: {e}")
                break
    
    logger.debug(f"Clicked {clicks_made} show-more buttons total")

# extract clean walmart category links
def _extract_walmart_category_links(driver, logger, parent_node=None):
    """Return [(name, url), …] for the current hub-and-spoke grid."""
    links = []

    # wait until at least one anchor appears
    try:
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, f"{CATEGORY_GRID_ITEMS} a[href]")
            )
        )
    except TimeoutException:
        logger.debug("Timed out waiting for hydrated anchors")
        return links

    # 2. Scroll the grid so every virtual tile gets hydrated
    try:
        grid = driver.find_element(By.CSS_SELECTOR, CATEGORY_GRID_CONTAINER)
        for _ in range(MAX_SCROLL_ATTEMPTS):
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", grid)
            time.sleep(SCROLL_PAUSE_MS / 1000)
    except:
        pass

    # before extracting links - scroll the viewport for lazy-loaded content
    for _ in range(MAX_SCROLL_ATTEMPTS):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(SCROLL_WAIT)

    # 3. Iterate over _actual_ tiles (ignore marketing cards automatically)
    for tile_link in driver.find_elements(By.CSS_SELECTOR, CATEGORY_TILE_LINK):
        try:
            href = tile_link.get_attribute("href") or ""
            if not VALID_HREF_RE.search(href):
                continue        # skip marketing / promo cards
            
            url = href if href.startswith("http") else urljoin("https://www.walmart.com", href)

            # -------- choose the name --------
            # 1️⃣ visible caption (what users see)
            name = (tile_link.text or "").strip()

            # 2️⃣ fallback – img alt
            if not name:
                img = tile_link.find_elements(By.CSS_SELECTOR, CATEGORY_TILE_IMG)
                if img:
                    name = img[0].get_attribute("alt") or ""

            name = _clean_category_name(name)
            
            # Strip parent prefix when designer stuffs it into the alt
            if parent_node:
                parent = parent_node.get("name", "").lower()
                if name.lower().startswith(parent + " "):
                    name = name[len(parent):].lstrip()
            
            if not name:
                continue

            if name and url and "walmart.com" in url:
                links.append((name, url))
                logger.debug(f"✓ {name} -> {url}")

        except StaleElementReferenceException:
            continue

    logger.info(f"Collected {len(links)} sub-categories")
    return links

# check if we've reached a leaf page (has product grid, no more subcategories)
def _is_leaf_page(driver, logger):
    try:
        anchors = driver.find_elements(
            By.CSS_SELECTOR, f"{CATEGORY_GRID_ITEMS} a[href]"
        )
        product_tiles = driver.find_elements(By.CSS_SELECTOR, PRODUCT_GRID_MARKER)

        logger.debug(
            f"Leaf check: anchors={len(anchors)}, products={len(product_tiles)}"
        )
        return len(anchors) == 0
    except Exception as e:
        logger.debug(f"Leaf check failed: {e}")
        return True  # safest default

# main crawling logic - recursive DFS with driver replacement handling
def _crawl_category_recursive(driver, node_json, depth, visited, logger, max_depth, use_safari=True, proxy_manager=None):
    if depth > max_depth:
        logger.info(f"Max depth reached at: {_get_category_path(node_json)}")
        return driver

    # get current category
    current_category = node_json.get("name", "Root")
    category_path = _get_category_path(node_json)
    logger.info(f"\n{'='*80}\nProcessing: {category_path} (depth {depth})\nURL: {driver.current_url}")

    try:
        # wait for page to be ready
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # give time for dynamic content
        WebDriverWait(driver, 5).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        
        # check if this is a leaf page
        if _is_leaf_page(driver, logger):
            logger.info(f"Leaf reached (product grid): {_get_category_path(node_json)}")
            return driver
        
        # extract subcategory links
        subcategory_links = _extract_walmart_category_links(driver, logger, node_json)
        logger.info(f"Found {len(subcategory_links)} subcategories in {current_category}")
        
        # if no subcategories found, treat as leaf
        if not subcategory_links:
            logger.info(f"No subcategories found, treating as leaf: {_get_category_path(node_json)}")
            return driver
        
        # process each subcategory
        for name, url in subcategory_links:
            if url in visited:
                logger.debug(f"Already visited: {url}")
                continue
                
            visited.add(url)
            
            # create child node
            child = {
                "name": name,
                "link_url": url,
                "sub_items": [],
                "parent": node_json,
            }
            node_json.setdefault("sub_items", []).append(child)
            
            # recurse into child if within depth limit
            if depth < max_depth:
                try:
                    logger.info(f"Navigating to subcategory: {name} ({url})")
                    
                    # use safe navigation with automatic browser relaunching
                    success, driver = _safe_navigate_with_relaunch(
                        driver, url, logger, use_safari, proxy_manager
                    )
                    
                    if not success:
                        logger.error(f"Failed to navigate to subcategory: {name}")
                        continue
                    
                    # recursive call (driver might have been replaced)
                    driver = _crawl_category_recursive(
                        driver, child, depth + 1, visited, logger, max_depth, use_safari, proxy_manager
                    )
                    
                except Exception as e:
                    logger.error(f"Error crawling subcategory {name}: {e}")
                    continue
            else:
                logger.debug(f"Skipping {name} due to depth limit")
                
    except Exception as e:
        logger.error(f"Error processing category {current_category}: {e}")
    
    return driver

# * main crawl - crawl a category starting from the given URL and return the category tree as JSON
def crawl_category(start_url: str = START_URL, max_depth: int = MAX_DEPTH, 
                  use_safari: bool = True, proxy_manager = None, logger=None) -> dict:
    # logger
    if logger is None:
        logger = logging.getLogger(__name__)
    
    # root JSON (top-level category)
    root_json = {
        "name": "Walmart Grocery",
        "link_url": start_url,
        "sub_items": []
    }
    
    # visited URLs
    visited = set([start_url])
    
    # setup driver
    driver = None
    try:
        driver = _setup_driver(use_safari=use_safari, proxy_manager=proxy_manager)
        
        # navigate to starting URL
        logger.info(f"Starting Walmart category crawl from: {start_url}")
        
        # use safe navigation with automatic browser relaunching
        success, driver = _safe_navigate_with_relaunch(
            driver, start_url, logger, use_safari, proxy_manager
        )
        
        if not success:
            logger.error(f"Failed to navigate to starting URL: {start_url}")
            return root_json
        
        # start recursive crawling (driver might be replaced during crawling)
        driver = _crawl_category_recursive(
            driver, root_json, 0, visited, logger, max_depth, use_safari, proxy_manager
        )
        
    except Exception as e:
        logger.error(f"Error during category crawl: {e}")
        
    finally:
        _safe_close_driver(driver, logger)

    # prune parent refs to prepare for JSON serialization
    logger.info("Crawl finished, pruning parent refs...")
    _strip_parent_refs(root_json)
    return root_json

# * testing entry point
def main():
    # setup logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)
    
    # run the crawl
    result = crawl_category(START_URL, max_depth=3, use_safari=False, logger=logger)
    
    # save results
    out = Path("walmart_grocery_hierarchy.json")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    logger.info(f"Saved -> {out.resolve()}")

if __name__ == "__main__":
    main()