# imports 
from selenium import webdriver
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from decimal import Decimal
import time
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

# target scraper
class TargetScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None):
        super().__init__(proxy_manager, logger)
        # set retailer id
        self.retailer_id = 2 
    
    # check if sold by Target
    def is_sold_by_target(self, driver):
        return self.get_seller_type(driver) == "target"
    
    # check if sold by third party
    def is_sold_by_third_party(self, driver):
        return self.get_seller_type(driver) == "third_party"
    
    # get seller type (Target or third party)
    def get_seller_type(self, driver):
        try:
            # seller section
            seller_elements = driver.find_elements(By.CSS_SELECTOR, "[data-test='targetPlusExtraInfoSection']")
            if seller_elements:
                seller_text = seller_elements[0].text.lower()
                # different seller name
                if "sold & shipped by" in seller_text and "target" not in seller_text:
                    return "third_party"
                
            # older seller section (keeping the original checks as fallback)
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
            self.logger.error(f"Error checking seller type: {e}")
            return "target"
    
    # get price
    def get_price(self, driver):
        try:
            # price from main product block
            price_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="product-price"]'))
            )
            raw = price_element.text.replace('$','').replace(',','').strip()
            return Decimal(raw)
        
        # fallback price element from CSS
        except (TimeoutException, NoSuchElementException, ValueError):
            try:
                fallback = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '.styles__StyledPriceText-sc-__sc-17hp6jc-0'))
                )
                raw = fallback.text.replace('$','').replace(',','').strip()
                return Decimal(raw)
            except:
                return None
    
    # check stock
    def check_stock(self, driver):
        try:
            # check if sold by Target directly
            if self.get_seller_type(driver) != "target":
                return False
                
            # ensure on shipping tab
            if not self.switch_to_shipping(driver):
                return False
                
            # find add to cart button
            try:
                add_to_cart_button = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="shippingButton"]'))
                )
                
                # check if button is disabled
                return not add_to_cart_button.get_attribute("disabled")
                
            except (NoSuchElementException, TimeoutException):
                # button not found / timed out
                return False
                
        except Exception as e:
            self.logger.error(f"Error checking stock status: {e}")
            return False
    
    # switch to shipping tab
    def switch_to_shipping(self, driver):
        try:
            # check if shipping tab exists
            shipping_tabs = driver.find_elements(By.CSS_SELECTOR, '[data-test="fulfillment-cell-shipping"]')
            if not shipping_tabs:
                # no shipping tab, online only?
                return True  
            # wait for shipping fulfillment tab to show up
            shipping_tab = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-test="fulfillment-cell-shipping"]'))
            )
            
            # click the shipping tab
            driver.execute_script("arguments[0].scrollIntoView(true);", shipping_tab)
            driver.execute_script("arguments[0].click();", shipping_tab)

            return True
        except Exception as e:
            self.logger.error(f"Error switching to shipping tab: {e}")
            return False
    
    # get image url
    def get_image_url(self, driver):
        try:
            # primary selector for product image 
            image_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "img[data-test='product-image']"))
            )
            return image_element.get_attribute('src')
        except (TimeoutException, NoSuchElementException):
            try:
                # alt selector 
                image_element = driver.find_element(By.CSS_SELECTOR, "img[alt^='PlayStation'], img[alt^='Nintendo'], img[alt^='Xbox'], img[class*='slideDeckPicture']")
                return image_element.get_attribute('src')
            except:
                return None
    
    # scrape a product from Target
    def scrape_product(self, url):
        driver = None
        try:
            driver = self.setup_driver(headless=False)
            driver.get(url)
            
            # wait for product page to load
            product_name_el = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="product-title"]'))
            )
            product_name = product_name_el.text.strip()

            # get price
            price = self.get_price(driver)

            # check stock status
            in_stock = self.check_stock(driver)
            
            # check for third-party seller (if not in stock from Target)
            third_party_seller = False
            if not in_stock:
                third_party_seller = self.is_sold_by_third_party(driver)

            # get image url
            image_url = self.get_image_url(driver)
            
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
            self.logger.error(f"Error scraping Target product: {e}")
            return None
            
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception as e:
                    self.logger.error(f"Error closing driver: {e}")

# test case
if __name__ == "__main__":
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
                    
                # third party seller is not in mapped data structure
                print(f"Third Party Seller: {'Yes' if not product_data['listing_data'].get('is_in_stock') else 'No'}")
            except KeyError as ke:
                print(f"Missing expected data field: {ke}")
                print(f"Available data: {product_data}")
        else:
            print("Failed to fetch product data")
    except Exception as e:
        print(f"Error during test execution: {e}")