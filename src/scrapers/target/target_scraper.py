# imports 
from selenium import webdriver
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
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


# wait times (in seconds) - TODO: needs tuned
WAIT_LONG = 8    
WAIT_MEDIUM = 5
WAIT_SHORT = 2     

# target scraper
class TargetScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None, use_safari=False):
        super().__init__(proxy_manager, logger, use_safari)
        self.retailer_id = 2 
    
    # extract rating & review count from page
    def get_rating_reviews(self, driver):
        try:
            self.logger.info("Starting rating/reviews extraction")
            
            # wait until at least one screen-reader span is in the DOM
            self.logger.debug("Waiting for ScreenReaderOnly spans to load...")
            WebDriverWait(driver, WAIT_LONG).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "span[class*='ScreenReaderOnly']")
                )
            )
            self.logger.debug("ScreenReaderOnly spans found in DOM")

            # check every screen-reader span first
            spans = driver.find_elements(By.CSS_SELECTOR, "span[class*='ScreenReaderOnly']")
            self.logger.info(f"Found {len(spans)} ScreenReaderOnly spans")
            
            # fallback to all spans if needed
            if not spans:
                self.logger.warning("No ScreenReaderOnly spans found, falling back to all spans")
                spans = driver.find_elements(By.CSS_SELECTOR, "span")
                self.logger.info(f"Found {len(spans)} total spans as fallback")

            pattern = re.compile(r"([\d.]+)\s*out of 5 stars\s*with\s*([\d,]+)\s*reviews", re.I)
            self.logger.debug(f"Using regex pattern: {pattern.pattern}")

            for i, span in enumerate(spans):
                txt = span.get_attribute("innerText") or ""
                if txt.strip():
                    self.logger.debug(f"Span {i+1}/{len(spans)} text: '{txt.strip()}'")
                
                m = pattern.search(txt)
                if m:
                    rating_str = m.group(1)
                    reviews_str = m.group(2)
                    self.logger.info(f"Pattern matched! Rating string: '{rating_str}', Reviews string: '{reviews_str}'")
                    
                    try:
                        rating = Decimal(rating_str)
                        reviews = int(reviews_str.replace(",", ""))
                        self.logger.info(f"Successfully extracted rating={rating}, reviews={reviews}")
                        return rating, reviews
                    except (ValueError, TypeError) as parse_error:
                        self.logger.error(f"Failed to parse rating/reviews: {parse_error}")
                        continue

            self.logger.warning("Rating text pattern not found in any span")
            
            # log sample span texts for debugging
            sample_texts = []
            for span in spans[:5]:
                txt = span.get_attribute("innerText") or ""
                if txt.strip():
                    sample_texts.append(txt.strip()[:100])
            
            if sample_texts:
                self.logger.debug(f"Sample span texts for debugging: {sample_texts}")
            
            return None, None

        except TimeoutException as te:
            self.logger.warning(f"Timeout waiting for rating elements: {te}")
            return None, None
        except Exception as e:
            self.logger.error(f"Unexpected error extracting rating/reviews: {e}")
            return None, None

    # extract UPC from specifications section
    def get_upc(self, driver):
        try:
            # expand the specifications accordion if needed
            try:
                spec_btn = driver.find_element(
                    By.CSS_SELECTOR, "button[href='#Specifications-accordion-scroll-id']"
                )
                if spec_btn.get_attribute("aria-expanded") != "true":
                    driver.execute_script(
                        "arguments[0].scrollIntoView({block:'center'});", spec_btn
                    )
                    driver.execute_script("arguments[0].click();", spec_btn)
            except NoSuchElementException:
                pass

            # wait until UPC text appears in DOM
            WebDriverWait(driver, WAIT_MEDIUM).until(
                lambda d: "UPC" in d.page_source
            )

            # scan all div elements for UPC row
            for div in driver.find_elements(By.CSS_SELECTOR, "div"):
                text = div.text.strip()
                if text.startswith("UPC"):
                    m = re.search(r'UPC[:\s-]*([0-9]{12,})', text)
                    if m:
                        upc_value = m.group(1)
                        return upc_value

            return None

        except Exception as e:
            return None

    # check if sold by Target
    def is_sold_by_target(self, driver):
        return self.get_seller_type(driver) == "target"
    
    # check if sold by third party
    def is_sold_by_third_party(self, driver):
        return self.get_seller_type(driver) == "third_party"
    
    # get seller type (Target or third party)
    def get_seller_type(self, driver):
        try:
            # check seller section
            seller_elements = driver.find_elements(By.CSS_SELECTOR, "[data-test='targetPlusExtraInfoSection']")
            if seller_elements:
                seller_text = seller_elements[0].text.lower()
                if "sold & shipped by" in seller_text and "target" not in seller_text:
                    return "third_party"
                
            # check older seller section as fallback
            older_seller_elements = driver.find_elements(By.CSS_SELECTOR, "[data-test='soldAndShippedByMessage']")
            if older_seller_elements:
                seller_text = older_seller_elements[0].text.lower()
                if "target" in seller_text or "sold by target" in seller_text:
                    return "target"
                else:
                    return "third_party"
            
            # default to target if can't find seller info
            return "target"
            
        except Exception as e:
            return "target"
    
    # extract price from page
    def get_price(self, driver):
        try:
            # get price from main product block
            price_element = WebDriverWait(driver, WAIT_MEDIUM).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="product-price"]'))
            )
            raw = price_element.text.replace('$','').replace(',','').strip()
            return Decimal(raw)
        
        # fallback price element
        except (TimeoutException, NoSuchElementException, ValueError):
            try:
                fallback = WebDriverWait(driver, WAIT_SHORT).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '.styles__StyledPriceText-sc-__sc-17hp6jc-0'))
                )
                raw = fallback.text.replace('$','').replace(',','').strip()
                return Decimal(raw)
            except:
                return None
    
    # check stock availability
    def check_stock(self, driver):
        try:
            # only check stock for Target-sold items
            if self.get_seller_type(driver) != "target":
                return False
                
            # ensure on shipping tab
            if not self.switch_to_shipping(driver):
                return False
                
            # find add to cart button
            try:
                add_to_cart_button = WebDriverWait(driver, WAIT_MEDIUM).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="shippingButton"]'))
                )
                
                # check if button is disabled
                return not add_to_cart_button.get_attribute("disabled")
                
            except (NoSuchElementException, TimeoutException):
                return False
                
        except Exception as e:
            return False
    
    # switch to shipping tab for stock check
    def switch_to_shipping(self, driver):
        try:
            # check if shipping tab exists
            shipping_tabs = driver.find_elements(By.CSS_SELECTOR, '[data-test="fulfillment-cell-shipping"]')
            if not shipping_tabs:
                return True  
            
            # wait for shipping fulfillment tab
            shipping_tab = WebDriverWait(driver, WAIT_MEDIUM).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-test="fulfillment-cell-shipping"]'))
            )
            
            # click the shipping tab
            driver.execute_script("arguments[0].scrollIntoView(true);", shipping_tab)
            driver.execute_script("arguments[0].click();", shipping_tab)

            return True
        except Exception as e:
            return False
    
    # extract hero image URL
    def get_image_url(self, driver):
        try:
            # wait for hero image with Target URL pattern
            hero_img = WebDriverWait(driver, WAIT_MEDIUM).until(
                lambda d: next(
                    (
                        img for img in d.find_elements(By.CSS_SELECTOR, "img[srcset]")
                        if "Target/GUEST_" in img.get_attribute("srcset")
                    ),
                    None,
                )
            )

            # parse srcset to get largest image
            srcset = hero_img.get_attribute("srcset")
            if srcset:
                biggest = srcset.split(",")[-1].strip().split(" ")[0]
                return biggest

            # fallback to src attribute
            src = hero_img.get_attribute("src")
            return src

        except Exception as e:
            return None
    
    # scrape product data from Target page
    def scrape_product(self, url):
        driver = self.get_driver(headless=False)
        try:
            driver.get(url)
            
            # wait for product page to load
            product_name_el = WebDriverWait(driver, WAIT_LONG).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="product-title"]'))
            )
            product_name = product_name_el.text.strip()

            # get price
            price = self.get_price(driver)

            # check stock status
            in_stock = self.check_stock(driver)
            
            # check for third-party seller
            third_party_seller = not in_stock and self.is_sold_by_third_party(driver)

            # get image url
            image_url = self.get_image_url(driver)
            
            # get additional data points
            rating, review_count = self.get_rating_reviews(driver)
            upc = self.get_upc(driver)
            
            product_data = {
                "name": product_name,
                "price": price,
                "url": url,
                "in_stock": in_stock,
                "image_url": image_url,
                "third_party_seller": third_party_seller,
                "rating": rating,
                "review_count": review_count,
                "upc": upc
            }
            
            # return data mapped to database structure
            return self.map_to_database(product_data, self.retailer_id)
            
        except Exception as e:
            return None
            
        finally:
            pass

# test scraper functionality
if __name__ == "__main__":
    # setup logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    
    # disable noisy loggers
    logging.getLogger('selenium').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('undetected_chromedriver').setLevel(logging.WARNING)
    
    try:
        url = "https://www.target.com/p/pok-mon-tcg-sword-shield-ultra-premium-collection-charizard/-/A-93504915#lnk=sametab"
        print(f"Initializing Target scraper...")
        scraper = TargetScraper()
        print(f"Scraping product from: {url}")
        product_data = scraper.scrape_product(url)
        
        if product_data:
            print("\nProduct Details:")
            try:
                print(f"Name: {product_data['product_data']['name']}")
                
                if product_data['listing_data'].get('price'):
                    print(f"Price: ${product_data['listing_data']['price']}")
                else:
                    print("Price: Not found")
                    
                print(f"In Stock: {'Yes' if product_data['listing_data'].get('is_in_stock') else 'No'}")
                
                if product_data['product_data'].get('image'):
                    print(f"Image URL: {product_data['product_data']['image']}")
                else:
                    print("Image URL: Not found")
                
                # display rating if available
                if product_data['listing_data'].get('rating'):
                    print(f"Rating: {product_data['listing_data']['rating']} out of 5")
                else:
                    print("Rating: Not found")
                
                # display review count if available
                if product_data['listing_data'].get('review_count'):
                    print(f"Review Count: {product_data['listing_data']['review_count']}")
                else:
                    print("Review Count: Not found")
                
                # display UPC if available
                if product_data['product_data'].get('upc'):
                    print(f"UPC: {product_data['product_data']['upc']}")
                else:
                    print("UPC: Not found")
                    
                print(f"Third Party Seller: {'Yes' if not product_data['listing_data'].get('is_in_stock') else 'No'}")
            except KeyError as ke:
                print(f"Missing expected data field: {ke}")
                print(f"Available data: {product_data}")
        else:
            print("Failed to fetch product data")
    except Exception as e:
        print(f"Error during test execution: {e}")