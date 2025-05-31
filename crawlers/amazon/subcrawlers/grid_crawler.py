# imports
import json, random, logging, asyncio
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError, Page
from .async_playwright_captcha_solver import PlaywrightCaptchaSolver
from urllib.parse import urljoin, urlparse

# import constants from base crawler
from ...base_crawler import CONCURRENCY, GRID_HOVER_DELAY_RANGE

# semaphore for throttling
SEM = asyncio.Semaphore(CONCURRENCY)

# track unique products
SEEN_ASINS: set[str] = set()

# pagination selectors
NEXT_ARROW = "a.s-pagination-next"
NEXT_ARROW_ACTIVE = "a.s-pagination-next:not(.s-pagination-disabled)"
NEXT_ARROW_DISABLED = "a.s-pagination-next.s-pagination-disabled"

# config logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

# * helper funcs
# adds random delay (set in constants)
async def _rand_delay(page: Page):
    await page.wait_for_timeout(random.randint(*GRID_HOVER_DELAY_RANGE))

# scrolls down in chunks until no new content height appears
async def _scroll_until_stable(page: Page, step_px: int = 2_000, pause_ms: int = 500):
    prev_height = 0
    while True:
        height = await page.evaluate("document.body.scrollHeight")
        if height == prev_height:
            # nothing new got added -> done
            break
        prev_height = height
        await page.evaluate(f"window.scrollBy(0, {step_px})")
        await page.wait_for_timeout(pause_ms)

# checks for and solves any CAPTCHA challenges
async def _solve_captcha_if_needed(page) -> bool:
    # if a CAPTCHA is detected, attempt to solve it 
    if await page.query_selector("#captchacharacters") or "validateCaptcha" in page.url:
        logging.info("CAPTCHA detected, attempting to solve…")
        solver = PlaywrightCaptchaSolver(output_dir="captcha_output",
                                       save_debug_output=True)
        if not await solver.solve_captcha(page):
            logging.error("CAPTCHA solve failed")
            return False
        await page.wait_for_url(lambda url: "validateCaptcha" not in url,
                              timeout=15_000)
        await page.wait_for_selector("#nav-logo-sprites", timeout=10_000)
        logging.info("CAPTCHA solved successfully")
    return True

# shorten the URL to the product
def _shorten_amazon_url(url: str) -> str:
    if not url:
        return url
        
    parsed = urlparse(url)
    path = parsed.path
    
    # extract ASIN from path if present
    asin = None
    if '/dp/' in path:
        asin = path.split('/dp/')[1].split('/')[0]
    elif '/gp/product/' in path:
        asin = path.split('/gp/product/')[1].split('/')[0]
    
    if asin:
        # construct minimal product URL
        return f"https://www.amazon.com/dp/{asin}"
    
# extract full product data from a page
async def _extract_full(page: Page, logger) -> list[dict]:
    logger.info(f"\n{'='*80}\nProcessing page\nURL: {page.url}")
    
    # get all product cards (get grid items)
    product_cards = await page.query_selector_all(".s-result-item[data-asin]")
    page_results = []

    # extract product data from each card
    for card in product_cards:
        try:
            # get ASIN from card
            asin = await card.get_attribute("data-asin")
            if not asin or asin in SEEN_ASINS:
                continue

            # get anchor element
            anchor = await card.query_selector("a.a-link-normal[href]")
            if not anchor:
                continue

            # get href from anchor
            href = await anchor.get_attribute("href") or ""
            if href.startswith("/sspa/"):
                continue          

            # get product URL
            product_url = urljoin(page.url, href) if href else None
            if product_url:
                product_url = _shorten_amazon_url(product_url)

            # get title
            title_elem = await anchor.query_selector("h2 span") \
                        or await card.query_selector("h2 span")   
            title = await title_elem.inner_text() if title_elem else "Unknown Title"

            # get price
            price_elem = await card.query_selector(".a-price .a-offscreen")
            price = await price_elem.inner_text() if price_elem else "Unknown Price"

            # add to results
            page_results.append({
                "asin": asin,
                "title": title,
                "price": price,
                "url": product_url,
            })
            SEEN_ASINS.add(asin)          
        except Exception as e:
            logger.error(f"Error extracting product data: {e}")

    logger.info(f"Extracted {len(page_results)} products from page")
    return page_results

# extract URLs from a product page (memory efficient)
async def _extract_urls(page: Page, logger) -> list[str]:
    logger.info(f"Extracting URLs from {page.url}")
    urls = []
    
    # get all product cards (get grid items)
    product_cards = await page.query_selector_all(".s-result-item[data-asin]")
    
    # extract URLs from each card
    for card in product_cards:
        try:
            # get ASIN from card
            asin = await card.get_attribute("data-asin")
            if not asin or asin in SEEN_ASINS:
                continue

            # get anchor element
            anchor = await card.query_selector("a.a-link-normal[href]")
            if not anchor:
                continue

            # get href from anchor
            href = await anchor.get_attribute("href") or ""
            if href.startswith("/sspa/"):
                continue          

            # get product URL
            product_url = urljoin(page.url, href) if href else None
            if product_url:
                product_url = _shorten_amazon_url(product_url)
                urls.append(product_url)
                SEEN_ASINS.add(asin)
                
        except Exception as e:
            logger.error(f"Error extracting URL: {e}")
            
    logger.info(f"Extracted {len(urls)} URLs from page")
    return urls


# crawl product grids from a list of starting URLs and return the products found
async def _crawl_grid_pages(
    page: Page,
    start_url: str,
    collector: list,
    extract_fn,                 # callable(Page, logger) -> list[T]
    max_depth: int,
    logger,
):
    # navigate to the starting URL
    await page.goto(start_url, timeout=30_000)
    
    # solve initial captcha if needed
    if not await _solve_captcha_if_needed(page):
        logger.error("Failed to solve initial captcha")
        return

    # wait for the page to load
    await page.wait_for_timeout(1000)
    await page.reload()
    await page.wait_for_timeout(1000)

    # wait for the product grid to load
    current_depth = 0
    
    # wait for the product grid to load
    try:
        await page.wait_for_selector(".s-result-item[data-asin]", timeout=10_000)
    except TimeoutError:
        logger.warning("Timed-out waiting for product grid – page may be empty.")

    # scroll until stable
    await _scroll_until_stable(page)
    
    # extract product data
    collector.extend(await extract_fn(page, logger))
    
    # loop through pages
    while current_depth < max_depth:
        # scroll to the bottom of the page
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(800)

        # check if we've reached the last page
        if await page.locator(NEXT_ARROW_DISABLED).count():
            logger.info("Reached last page (arrow disabled)")
            break

        # get next arrow
        next_arrow = page.locator(NEXT_ARROW).first
        if not await next_arrow.count():
            logger.info("Next arrow not found – stopping")
            break

        # scroll into view and click
        await next_arrow.scroll_into_view_if_needed()
        await next_arrow.click()

        # wait for the product grid to load
        await page.wait_for_selector(".s-result-item[data-asin]", timeout=60_000)
        await _scroll_until_stable(page)

        # solve captcha if needed
        if not await _solve_captcha_if_needed(page):
            logger.error("Failed to solve captcha after navigation")
            break

        # increment depth
        current_depth += 1
        logger.info(f"Current depth: {current_depth}/{max_depth}")
        
        # extract product data
        collector.extend(await extract_fn(page, logger))

# worker coroutine to process URLs from the queue 
async def _worker(context, url_queue, results, extract_fn, max_depth, logger):
    # worker loop
    while True:
        # get URL from queue
        url = await url_queue.get()
        try:
            # create new page
            async with SEM:
                page = await context.new_page()
                await _crawl_grid_pages(page, url, results, extract_fn, max_depth, logger)
                await page.close()
        except Exception as e:
            logger.error(f"Error processing URL {url}: {e}")
        # mark task as done
        finally:
            url_queue.task_done()

# * main - crawl product grids from a list of starting URLs and return the products found
async def crawl_grid(start_urls: list[str], max_depth: int = 5, concurrency: int = CONCURRENCY, extract_urls_only: bool = False,logger=None) -> list:
    # logger
    if logger is None:
        logger = logging.getLogger(__name__)
    
    # results list
    results = []
    
    # queue for URLs
    url_queue = asyncio.Queue()
    
    # add all URLs to queue
    for url in start_urls:
        await url_queue.put(url)
    
    # extract function to use
    extract_fn = _extract_urls if extract_urls_only else _extract_full
    
    # launch browser
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        
        # create workers
        workers = [
            asyncio.create_task(_worker(context, url_queue, results, extract_fn, max_depth, logger))
            for _ in range(concurrency)
        ]
        
        # wait for all URLs to be processed
        await url_queue.join()
        
        # cancel workers
        for w in workers:
            w.cancel()
        
        # close browser
        await context.close()
        await browser.close()
    
    return results

# * testing entry point
async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)
    
    # test URLs, testing concurrency
    test_urls = [
        "https://www.amazon.com/s?k=marshmallows",
        "https://www.amazon.com/s?k=chocolate"
    ]
    
    # test both URL-only & full extraction
    urls_only = await crawl_grid(test_urls, extract_urls_only=True, logger=logger)
    full_data = await crawl_grid(test_urls, extract_urls_only=False, logger=logger)
    
    # save results
    Path("amazon_urls.json").write_text(json.dumps(urls_only, indent=2, ensure_ascii=False))
    Path("amazon_products.json").write_text(json.dumps(full_data, indent=2, ensure_ascii=False))
    logger.info("Saved results to JSON files")

if __name__ == "__main__":
    asyncio.run(main())

