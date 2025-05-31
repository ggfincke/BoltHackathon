import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://www.walmart.com/")
    page.get_by_role("button", name="Departments ").click()
    page.get_by_role("button", name="Grocery").click()
    page.get_by_role("link", name="All Grocery").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Press & Hold Human Challenge").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Press & Hold Human Challenge").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Human Challenge completed,").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Press & Hold Human Challenge").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Press & Hold Human Challenge").click()
    page.locator("iframe[src=\"about\\:blank\"]").content_frame.get_by_role("button", name="Human Challenge completed,").click()
    page.close()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
