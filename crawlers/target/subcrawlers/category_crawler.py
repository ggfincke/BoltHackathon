# backend/scraping/crawlers/target/subcrawlers/category_crawler.py

# imports   
import re, json, random, logging, asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError

# import constants from base crawler
from ...base_crawler import MAX_DEPTH, CONCURRENCY, HOVER_DELAY_RANGE

# semaphore for throttling
SEM = asyncio.Semaphore(CONCURRENCY)

# Target-specific selectors
LOAD_MORE_SELECTOR = "[data-test='loadMoreRecommendations']"
RAW_BUBCAT_LINKS = "a[data-lnk][href*='/c/']"
CATEGORY_NAME_SELECTOR = "[data-test='bubcatItemTitleComponent'] span"
PRODUCT_GRID_MARKER = "[data-module-type='ListingPageProductListCards']"

# URLs
START_URL = "https://www.target.com/c/grocery/-/N-5xt1a"

# * helper funcs
# adds random delay (set in constants)
async def _rand_delay(page: Page):
    await page.wait_for_timeout(random.randint(*HOVER_DELAY_RANGE))

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
    # Remove any count indicators like "(123)"
    return re.sub(r'\s*\(\d+\)\s*$', '', text).strip()

# util to expand all "Show all XX" buttons
async def _click_all_show_buttons(page: Page):
    # selector
    selector = f"{LOAD_MORE_SELECTOR}[aria-label^='Show all']"

    # loop until no more show all buttons
    while True:
        # wait for any collapsed button to be present, if none appear, done
        try:
            await page.wait_for_selector(selector, timeout=2_000)
        except PlaywrightTimeoutError:
            break 

        # count how many are currently on the page
        btns = page.locator(selector)
        for i in range(await btns.count()):
            btn = btns.nth(i)
            if not await btn.is_visible():
                continue
            try:
                # scroll into view & click
                await btn.scroll_into_view_if_needed()
                await btn.click()
                await page.wait_for_load_state("networkidle")
                await _rand_delay(page)
            except Exception as e:
                # button may disappear b/w locating & clicking – ignore & continue
                print(f"⚠️  could not click a Show-all button: {e}")

# extract clean bubcat links
async def _extract_bubcat_links(page: Page):
    # get all bubcat links
    links = []
    for link in await page.query_selector_all(RAW_BUBCAT_LINKS):
        data_lnk = (await link.get_attribute("data-lnk")) or ""
        # real categories start with c_bubcat_
        if not data_lnk.startswith("c_bubcat_"):
            continue

        # title <span>; if missing, fall back to data_lnk
        name_el = await link.query_selector(CATEGORY_NAME_SELECTOR)
        name = (
            _clean_category_name(await name_el.inner_text())
            if name_el else
            _clean_category_name(data_lnk.replace("c_bubcat_", "").replace("_", " "))
        )

        # if no name, skip
        if not name:
            continue

        # strip off any query string so /c/foo/-/N-xxx?type=products -> /c/foo/-/N-xxx
        href = (await link.get_attribute("href")) or ""
        if not href:
            continue
        clean_url = href.split("?")[0]
        if not clean_url.startswith("http"):
            clean_url = "https://www.target.com" + clean_url

        links.append((name, clean_url))
    return links

# * async crawler; recursive DFS
async def _crawl_category_async(page: Page, node_json, depth, visited, q, logger):
    if depth > MAX_DEPTH:
        logger.info(f"Max depth reached at: {_get_category_path(node_json)}")
        return

    # get current category
    current_category = node_json.get("name", "Root")
    category_path = _get_category_path(node_json)
    logger.info(f"\n{'='*80}\nProcessing: {category_path} (depth {depth})\nURL: {page.url}")

    # expand "Show all …"
    await _click_all_show_buttons(page)

    # collect real bubcat links
    bubcats = await _extract_bubcat_links(page)
    logger.info(f"Found {len(bubcats)} subcategories in {current_category}")

    # LEAF = no bubcats & product grid in view
    if not bubcats and await page.locator(PRODUCT_GRID_MARKER).count() > 0:
        logger.info(f"Leaf reached (product grid): {_get_category_path(node_json)}")
        return

    # enqueue children
    for name, url in bubcats:
        if url in visited:
            continue
        visited.add(url)
        child = {
            "name": name,
            "link_url": url,
            "sub_items": [],
            "parent": node_json,
        }
        node_json.setdefault("sub_items", []).append(child)

        if depth < MAX_DEPTH:
            await q.put((child, url, depth + 1))

# worker coroutine
async def _worker(playwright, context, q, visited, logger):
    # loop until the queue is empty
    while True:
        # get the next category
        node_json, url, depth = await q.get()
        page = None  # define page variable at the top
        try:
            # throttle
            async with SEM:
                page = await context.new_page()
                await page.goto(url, timeout=15000)
                
                # wait for page to load
                await page.wait_for_load_state("networkidle")
                
                # root page -> give JS time
                if depth == 0:
                    await page.wait_for_timeout(2000)
                
                # crawl the category
                await _rand_delay(page)
                await _crawl_category_async(page, node_json, depth, visited, q, logger)
        except Exception as e:
            logger.error(f"Error processing URL {url}: {e}")
        finally:
            # close page
            if page and not page.is_closed():
                await page.close()
            q.task_done()

# * main crawl - crawl a category starting from the given URL and return the category tree as JSON
async def crawl_category(start_url: str = START_URL, max_depth: int = MAX_DEPTH, logger=None) -> dict:
    # logger
    if logger is None:
        logger = logging.getLogger(__name__)
    
    # root JSON (top-level category)
    root_json = {
        "name": "Target Grocery",
        "link_url": start_url,
        "sub_items": []
    }
    
    # visited URLs
    visited = set([start_url])
    # queue
    q = asyncio.Queue()
    # put the root category on the queue
    await q.put((root_json, start_url, 0))

    # launch browser
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()

        workers = [asyncio.create_task(_worker(p, context, q, visited, logger))
                   for _ in range(CONCURRENCY)]

        # wait for crawl to finish
        await q.join()
        for w in workers: w.cancel()

        # close browser
        await context.close()
        await browser.close()

    # prune parent refs to write to JSON
    logger.info("Crawl finished, pruning parent refs...")
    _strip_parent_refs(root_json)
    return root_json

# * testing entry point
async def main():
    # setup logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger(__name__)
    
    # run the crawl
    result = await crawl_category(START_URL, logger=logger)
    
    # save results
    out = Path("target_grocery_hierarchy.json")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    logger.info(f"Saved -> {out.resolve()}")

if __name__ == "__main__":
    asyncio.run(main())