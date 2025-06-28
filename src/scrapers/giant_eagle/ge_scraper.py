from selenium import webdriver
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from decimal import Decimal
import re
import time
import os
import sys
import logging

# handle imports based on how script is being run
try:
    # when imported as a module within the package (via Docker)
    from ..base_scraper import BaseScraper
except ImportError:
    # when run as a standalone script (via terminal)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir) 
    sys.path.insert(0, parent_dir)
    from base_scraper import BaseScraper

# wait times (in seconds)
WAIT_LONG = 10    
WAIT_MEDIUM = 5
WAIT_SHORT = 2     

# giant eagle scraper
class GiantEagleScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None, use_safari=False):
        super().__init__(proxy_manager, logger, use_safari)
        # giant eagle is retailer id 4
        self.retailer_id = 4  

    # check if sold by Giant Eagle
    def is_sold_by_giant_eagle(self, driver):
        return True
    
    # check if sold by third party
    def is_sold_by_third_party(self, driver):
        return False
    
    # get seller type (always Giant Eagle)
    def get_seller_type(self, driver):
        # Giant Eagle doesn't have third-party listings
        return "giant_eagle"

    # extract product name
    def get_product_name(self, driver):
        selectors = [
            "h1.ProductDetailMainCard_title",
            "h1[data-testid='product-title']",
            "h1.product-title",
            ".product-name h1",
        ]
        for sel in selectors:
            try:
                el = WebDriverWait(driver, WAIT_MEDIUM).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                )
                if el.text.strip():
                    return el.text.strip()
            except (TimeoutException, NoSuchElementException):
                continue
        # final fallback: <meta property="og:title">
        try:
            meta = driver.find_element(By.CSS_SELECTOR, "meta[property='og:title']")
            return meta.get_attribute("content").strip()
        except NoSuchElementException:
            return None

    # extract price from page
    def get_price(self, driver):
        # first try a tight selector (faster if it exists)
        try:
            # stable base class
            el = driver.find_element(By.CSS_SELECTOR, "span.sc-cGQErq")  
            return Decimal(el.text.replace("$", "").strip())
        except (NoSuchElementException, ValueError):
            pass

        # generic fallback: first <span> on the page that looks like $4.89
        try:
            el = driver.find_element(
                By.XPATH,
                "//span[contains(text(),'$') and string-length(normalize-space())<10]"
            )
            price = re.search(r"\$?\s*([\d,.]+)", el.text)
            if price:
                return Decimal(price.group(1).replace(",", ""))
        except (NoSuchElementException, ValueError):
            return None

    # check stock status
    def check_stock(self, driver):
        # Add-to-cart button is the ground truth
        btns = driver.find_elements(By.CSS_SELECTOR,
                                    "button[data-test-id='QuantityPicker_atc']")
        if btns and btns[0].is_enabled():
            return True

        # any explicit OOS message?
        oos = driver.find_elements(
            By.XPATH,
            "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),"
            " 'out of stock') or contains(., 'unavailable')]"
        )
        return not bool(oos)

    # get image url
    def get_image_url(self, driver):
        try:
            img = driver.find_element(By.CSS_SELECTOR, "img[data-index='0']")
            return img.get_attribute("src")
        except NoSuchElementException:
            # fallback – first product image with an alt that matches the title
            try:
                img = driver.find_element(
                    By.XPATH,
                    "//img[contains(@alt, 'Milk') or contains(@alt, \"%\")]"
                )
                return img.get_attribute("src")
            except NoSuchElementException:
                return None

    # extract rating and review count
    def get_rating_reviews(self, driver):
        try:
            # look for rating element
            temp_element = driver.find_elements(By.CSS_SELECTOR, "[data-testid='rating'], .rating-display, .product-rating")
            if temp_element:
                rating_text = temp_element[0].text.strip()
                # extract rating number
                rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                if rating_match:
                    rating = Decimal(rating_match.group(1))
                    
                    # look for review count
                    temp_element = driver.find_elements(By.CSS_SELECTOR, "[data-testid='review-count'], .review-count, .reviews-count")
                    if temp_element:
                        review_text = temp_element[0].text.strip()
                        review_match = re.search(r'(\d+)', review_text)
                        if review_match:
                            review_count = int(review_match.group(1))
                            return rating, review_count
                    
                    return rating, None

        except Exception as e:
            self.logger.error(f"Error extracting rating/reviews: {e}")

        return None, None

    # dismiss cookie banner
    def dismiss_cookies(self, driver):
        try:
            btn = driver.find_element(
                By.XPATH,
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),'accept')]"
            )
            btn.click()
            # small pause so the DOM settles
            time.sleep(0.5)          
        except NoSuchElementException:
            pass

    # extract UPC from product details
    def get_upc(self, driver):
        # Primary: look for the SKU/UPC header block
        try:
            upc_box = driver.find_element(
                By.XPATH,
                "//h3[normalize-space()='SKU' or normalize-space()='UPC']"
                "/following-sibling::div[1]"
            )
            code = upc_box.text.strip()
            if re.fullmatch(r"\d{12,15}", code):
                return code
        except NoSuchElementException:
            pass

        # Fallback: any standalone 12-15-digit element
        try:
            lone_digits = driver.find_element(
                By.XPATH,
                "//div[translate(text(),'0123456789','')='' "
                "and string-length(normalize-space())>=12]"
            ).text.strip()
            if re.fullmatch(r"\d{12,15}", lone_digits):
                return lone_digits
        except NoSuchElementException:
            pass

        return None

    # main scraping method
    def scrape_product(self, url):
        driver = self.get_driver()
        
        try:
            self.logger.info(f"Scraping Giant Eagle product: {url}")
            driver.get(url)
            
            # wait for page to load
            WebDriverWait(driver, WAIT_LONG).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # dismiss cookie banner
            self.dismiss_cookies(driver)
            
            # add random delay to avoid detection
            self.random_delay(2, 4)

            # extract product information
            product_name = self.get_product_name(driver)
            if not product_name:
                self.logger.error("Could not extract product name - invalid product page")
                return None

            price = self.get_price(driver)
            in_stock = self.check_stock(driver)
            image_url = self.get_image_url(driver)
            rating, review_count = self.get_rating_reviews(driver)
            upc = self.get_upc(driver)

            # compile scraped data
            scraped_data = {
                'name': product_name,
                'price': price,
                'url': url,
                'in_stock': in_stock,
                'image_url': image_url,
                'rating': rating,
                'review_count': review_count,
                'upc': upc,
                'seller_type': self.get_seller_type(driver)
            }

            self.logger.info(f"Successfully scraped Giant Eagle product: {product_name}")
            return scraped_data

        except TimeoutException:
            self.logger.error(f"Timeout loading Giant Eagle product page: {url}")
            return None
        except Exception as e:
            self.logger.error(f"Error scraping Giant Eagle product {url}: {e}")
            return None
        finally:
            self.close_driver()

# test function for standalone usage
if __name__ == "__main__":
    # setup logging
    logging.basicConfig(level=logging.INFO)
    
    # test URL - update with actual Giant Eagle product URL
    test_url = "https://www.gianteagle.com/settlers-ridge/search/product/00020471120199"
    
    scraper = GiantEagleScraper()
    result = scraper.scrape_product(test_url)
    
    if result:
        print(f"Product: {result['name']}")
        print(f"Price: ${result['price']}")
        print(f"In Stock: {result['in_stock']}")
        print(f"Image URL: {result['image_url']}")
        print(f"Rating: {result['rating']}")
        print(f"Review Count: {result['review_count']}")
        print(f"UPC: {result['upc']}")
        print(f"Seller Type: {result['seller_type']}")
    else:
        print("Failed to scrape product")
