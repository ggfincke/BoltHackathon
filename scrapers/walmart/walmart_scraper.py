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
    
# walmart scraper
class WalmartScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None):
        super().__init__(proxy_manager, logger)
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

    # scrape a product from Walmart
    def scrape_product(self, url):
        driver = None
        try:
            driver = self.setup_driver(headless=False)
            driver.get(url)
                    
            # product details
            product_name = self.get_product_name(driver)
            price = self.get_price(driver)
            in_stock = self.check_stock(driver)
            image_url = self.get_image_url(driver)  
            third_party_seller = False

            # check if sold by third party (only if not in stock)
            if not in_stock: 
                third_party_seller = self.is_sold_by_third_party(driver)
                
            product_data = {
                "name": product_name,
                "price": price,
                "url": url,
                "in_stock": in_stock,
                "image_url": image_url,
                "third_party_seller": third_party_seller
            }
            
            # return data mapped to database structure
            return self.map_to_database(product_data, self.retailer_id)
            
        except Exception as e:
            self.logger.error(f"Error scraping Walmart product: {e}")
            return None
            
        finally:
            if driver:
                driver.quit()

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
                print(f"Name: {product_data['product_data']['name']}")
                
                if product_data['listing_data'].get('price'):
                    print(f"Price: ${product_data['listing_data']['price']}")
                else:
                    print("Price: Not found")
                    
                if product_data['product_data'].get('image'):
                    print(f"Image URL: {product_data['product_data']['image']}")
                else:
                    print("Image URL: Not found")
                    
                print(f"In Stock: {'Yes' if product_data['listing_data'].get('is_in_stock') else 'No'}")

                # third party seller is not in mapped data structure
                print(f"Third Party Seller: {'Yes' if not product_data['listing_data'].get('is_in_stock') else 'No'}")
            except KeyError as ke:
                print(f"Missing expected data field: {ke}")
                print(f"Available data: {product_data}")
        else:
            print("Failed to fetch product data")
    except Exception as e:
        print(f"Error in main: {e}")