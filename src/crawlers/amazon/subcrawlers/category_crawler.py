# imports   
import re, json, random, logging, asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page
from .async_playwright_captcha_solver import PlaywrightCaptchaSolver

# import constants from base crawler
from ...base_crawler import MAX_DEPTH, CONCURRENCY, HOVER_DELAY_RANGE

# semaphore for throttling
SEM = asyncio.Semaphore(CONCURRENCY)

# selectors
SUB_LINK_SELECTOR = 'a.a-link-emphasis[href*="node="][class*="a-size-base"][class*="a-text-normal"]'
PRODUCT_GRID_MARKER = "#search span.rush-component"

# URLs
START_URL = (
    "https://www.amazon.com/fmc/everyday-essentials-category?"
    "node=16310101&ref_=eemb_redirect_grocery"
) 

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

# shorten the URL to the node
def _shorten_url(url):
    match = re.search(r"(https://www\.amazon\.com/s\?)[^ ]*?node=(\d+)", url)
    if match:
        return f"{match.group(1)}node={match.group(2)}"
    match = re.search(r"(https://www\.amazon\.com/fmc/[^?]*)[^ ]*?node=(\d+)", url)
    if match:
        return f"{match.group(1)}?node={match.group(2)}"
    return url  # fallback to original if no match

# solves captcha if needed
async def _solve_captcha_if_needed(page: Page) -> bool:
    # captcha detected
    if await page.query_selector("#captchacharacters") or "validateCaptcha" in page.url:
        logging.info("CAPTCHA detected, attempting to solve…")
        solver = PlaywrightCaptchaSolver(output_dir="captcha_output", save_debug_output=True)
        # solve captcha
        if not await solver.solve_captcha(page):
            logging.error("CAPTCHA solve failed")
            return False
        # wait for captcha to be solved
        await page.wait_for_url(lambda url: "validateCaptcha" not in url,
                                timeout=15_000)
        # wait for logo to load
        await page.wait_for_selector("#nav-logo-sprites", timeout=10_000)
        logging.info("CAPTCHA solved successfully")
    return True

# * async crawler; recursive DFS
async def _crawl_category_async(page: Page, node_json, depth, visited, q, logger):
    # max depth reached
    if depth > MAX_DEPTH:
        logger.info(f"Max depth reached at: {_get_category_path(node_json)}")
        return

    # get current category
    current_category = node_json.get("name", "Root")
    category_path    = _get_category_path(node_json)
    logger.info(f"\n{'='*80}\nProcessing: {category_path} (depth {depth})\nURL: {page.url}")

    # get all subcategories
    snapshots = []
    for el in await page.query_selector_all(SUB_LINK_SELECTOR):
        href = await el.get_attribute("href") or ""
        # no href
        if not href:
            continue
        # full URL
        full_url = href if href.startswith("http") else "https://www.amazon.com" + href
        # already visited
        if full_url in visited: 
            continue
        # text
        text = (await el.inner_text()).strip()
        # append to snapshots
        snapshots.append((text, full_url))

    # no subcategories found
    logger.info(f"Found {len(snapshots)} subcategories in {current_category}")
    if not snapshots:
        return

    # process each subcategory
    for link_text, link_url in snapshots:
        visited.add(link_url)
        link_name = re.sub(r"^See\s+", "", link_text)
        child = {
            "name":      link_name,
            "link_url":  _shorten_url(link_url),
            "sub_items": [],
            "parent":    node_json,
        }
        node_json.setdefault("sub_items", []).append(child)

        # only enqueue them for a deeper crawl if depth cap not reached 
        if depth < MAX_DEPTH:
            await q.put((child, link_url, depth + 1))

# worker coroutine
async def _worker(playwright, context, q, visited, logger):
    # Create a single page for this worker
    page = await context.new_page()
    try:
        # loop until the queue is empty
        while True:
            # get the next category
            node_json, url, depth = await q.get()
            try:
                # throttle
                async with SEM:
                    await page.goto(url, timeout=30_000)
                    # captcha detected
                    if not await _solve_captcha_if_needed(page):
                        q.task_done()
                        continue
                    # root page -> give JS time
                    if depth == 0:
                        await page.wait_for_timeout(2000)
                        await page.reload()
                        await page.wait_for_timeout(2000)

                    # crawl the category
                    await _rand_delay(page)
                    await _crawl_category_async(page, node_json, depth, visited, q, logger)
            finally:
                q.task_done()
    finally:
        # Clean up the page when the worker is done
        await page.close()

# * main crawl - crawl a category starting from the given URL and return the category tree as JSON
async def crawl_category(start_url: str, max_depth: int = MAX_DEPTH, logger=None) -> dict:
    # logger
    if logger is None:
        logger = logging.getLogger(__name__)
    
    # root JSON (top-level category)
    root_json = {
        "name": "Amazon Grocery",
        "link_url": _shorten_url(start_url),         
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
    out = Path("amazon_grocery_hierarchy.json")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    logger.info(f"Saved -> {out.resolve()}")

if __name__ == "__main__":
    asyncio.run(main())
