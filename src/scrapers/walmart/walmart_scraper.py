from selenium import webdriver
# undetected chromedriver works better for walmart
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options
from decimal import Decimal
import time
import re
import os
import sys
import json

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
    
# attempt to import the CAPTCHA solver relative to package structure
try:
    from .walmart_captcha_solver import WalmartCAPTCHASolver
except ImportError:
    # fallback when running as standalone script
    from walmart_captcha_solver import WalmartCAPTCHASolver

# walmart scraper
class WalmartScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None, use_safari=False):
        super().__init__(proxy_manager, logger, use_safari)
        # set retailer id
        self.retailer_id = 3 
    
    # check if sold by Walmart
    def is_sold_by_walmart(self, driver):
        return self.get_seller_type(driver) == "walmart"

    # check if sold by third party
    def is_sold_by_third_party(self, driver):
        return self.get_seller_type(driver) == "third_party"
    
    # get seller type (Walmart or third party)
    def get_seller_type(self, driver):
        try:
            # wait for seller information to be available
            seller_info = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='product-seller-info']"))
            )
            seller_text = seller_info.text.lower()
            if "walmart.com" in seller_text or "sold and shipped by walmart" in seller_text:
                return "walmart"
            # not sold by Walmart
            else:
                return "third_party"
        
        except (NoSuchElementException, TimeoutException) as e:
            self.logger.error(f"Error checking seller: {e}")
            return "walmart"

    # check if shipping is available
    def is_shipping_available(self, driver):
        try:
            # check for shipping availability indicators
            shipping_element = driver.find_elements(By.CSS_SELECTOR, "[data-testid='shipping-tile']")
            if shipping_element:                      
                shipping = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '[data-seo-id="fulfillment-shipping-intent"]'))
                )
                # button is disabled
                if "Out of stock" in shipping.text:
                    return False  
            
                # shipping available
                return True
            
            # not available
            return False
        
        except (NoSuchElementException, TimeoutException) as e:
            self.logger.error(f"Error checking shipping: {e}")
            return False

    # determining in stock status
    def check_stock(self, driver):
        try:
            # check if sold by Walmart.com
            if self.get_seller_type(driver) != "walmart":
                return False
            
            # check if shipping is available
            if not self.is_shipping_available(driver):
                return False
            
            # check if atc button is present
            if driver.find_elements(By.CSS_SELECTOR, "[data-automation-id='atc']"):
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"Error checking stock status: {e}")
            return False

    # extract product name
    def get_product_name(self, driver):
        try:
            # wait for product title to be present
            product_name_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "h1[itemprop='name']"))
            )
            return product_name_element.text.strip()
        
        except Exception as e:
            self.logger.error(f"Error extracting product name: {e}")
            return None

    # extracting price
    def get_price(self, driver):
        try:
            # price 
            price_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-fs-element="price"]'))
            )
            raw = price_element.text.replace('$','').replace(',','').strip()
            return Decimal(raw)

        # fail  
        except (NoSuchElementException, TimeoutException, ValueError) as e:
            self.logger.error(f"Error extracting price: {e}")
            return None
    
    # get image url
    def get_image_url(self, driver):
        try:
            # wait for image to be present
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "img.db[loading='eager']"))
            )

            # all images w/ class 'db' and loading='eager'
            images = driver.find_elements(By.CSS_SELECTOR, "img.db[loading='eager']")

            # filter image 
            for image in images:
                src = image.get_attribute('src')
                if src and "walmartimages.com" in src:
                    return src

            # no image found
            return None
        except Exception as e:
            self.logger.error(f"An error occurred: {e}")
            return None

    # get rating & review count
    def get_rating_reviews(self, driver):
        try:
            WebDriverWait(driver, 10).until(
                lambda d: any("stars out of" in s.text for s in d.find_elements(By.CSS_SELECTOR, "span"))
            )
            
            for span in driver.find_elements(By.CSS_SELECTOR, "span"):
                txt = span.text.strip()
                if "stars out of" in txt and "reviews" in txt:
                    m = re.search(r"([\d.]+)\s*stars\s*out of\s*([\d,]+)\s*reviews", txt, re.I)
                    if m:
                        rating  = Decimal(m.group(1))
                        reviews = int(m.group(2).replace(",", ""))
                        return rating, reviews
            return None, None
        except Exception:
            return None, None

    # get UPC/GTIN string from Walmart's schema-org script tag
    def get_upc(self, driver):
        try:
            script_tag = driver.find_element(
                By.CSS_SELECTOR,
                "script[data-seo-id='schema-org-product'][type='application/ld+json']"
            )
            data = json.loads(script_tag.get_attribute("innerHTML"))
            return str(data.get("gtin13") or data.get("sku"))
        except Exception:
            return None

    # scrape a product from Walmart
    def scrape_product(self, url):
        driver = self.get_driver(headless=False)
        try:
            # initialise CAPTCHA solver to reuse same Selenium session
            captcha_solver = WalmartCAPTCHASolver(driver=driver)

            driver.get(url)
                    
            # if Walmart detected automation and presented a blocking page, attempt to solve
            current = driver.current_url.lower()
            if any(keyword in current for keyword in ["blocked", "challenge", "captcha"]):
                self.logger.info("Encountered Walmart CAPTCHA – attempting automated solve ...")
                if not captcha_solver.solve_captcha():
                    self.logger.error("Unable to solve Walmart CAPTCHA. Aborting scrape.")
                    return None

            # product details
            product_name = self.get_product_name(driver)
            price = self.get_price(driver)
            in_stock = self.check_stock(driver)
            image_url = self.get_image_url(driver)  
            third_party_seller = False

            # check if sold by third party (only if not in stock)
            if not in_stock: 
                third_party_seller = self.is_sold_by_third_party(driver)
                
            # rating / reviews & UPC
            rating, review_count = self.get_rating_reviews(driver)
            upc                = self.get_upc(driver)

            product_data = {
                "name":  product_name,
                "price": price,
                "url":   url,
                "in_stock": in_stock,
                "image_url": image_url,
                "third_party_seller": third_party_seller,
                "rating": rating,
                "review_count": review_count,
                "upc":    upc,
            }
            
            # return data for testing (instead of mapping to database)
            return product_data
            
        except Exception as e:
            self.logger.error(f"Error scraping Walmart product: {e}")
            return None
            
        finally:
            pass

# test case
if __name__ == "__main__":
    test_url = "https://www.walmart.com/ip/Nintendo-OLED-w-White-Joy-Con-White-Nintendo-Switch/910582148"
    # test_url = "https://www.walmart.com/ip/Paldean-Fates-Booster-Bundle/15135758782?classType=REGULAR&from=/search"
    try:
        scraper = WalmartScraper()
        product_data = scraper.scrape_product(test_url)
        if product_data:
            print("\nProduct Details:")
            try:
                print(f"Name: {product_data.get('name', 'Not found')}")
                print(f"Price: ${product_data.get('price', 'Not found')}")
                print(f"Image URL: {product_data.get('image_url', 'Not found')}")
                print(f"In Stock: {'Yes' if product_data.get('in_stock') else 'No'}")
                print(f"Third Party Seller: {'Yes' if product_data.get('third_party_seller') else 'No'}")
                print(f"Rating: {product_data.get('rating', 'Not found')}")
                print(f"Review Count: {product_data.get('review_count', 'Not found')}")
                print(f"UPC: {product_data.get('upc', 'Not found')}")
            except Exception as ke:
                print(f"Error displaying data: {ke}")
                print(f"Available data: {product_data}")
        else:
            print("Failed to fetch product data")
    except Exception as e:
        print(f"Error in main: {e}")