# imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options
from decimal import Decimal
import time
import random
import os 
import undetected_chromedriver as uc
import sys

# handle imports based on how script is being run
try:
    # when imported as a module within the package (via Docker)
    from ..base_scraper import BaseScraper
    from .amazon_captcha_solver import AmazonCaptchaSolver

except ImportError:
    # when run as a standalone script (via terminal)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir) 
    sys.path.insert(0, parent_dir)
    from base_scraper import BaseScraper
    from amazon_captcha_solver import AmazonCaptchaSolver

# amazon scraper
class AmazonScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None, use_safari=False):
        super().__init__(proxy_manager, logger, use_safari)
        output_dir = os.path.join("scrapers", "amazon", "output")
        self.captcha_solver = AmazonCaptchaSolver(output_dir=output_dir)
        # set retailer id
        self.retailer_id = 1 
    
    # Amazon specific - check if captcha is present
    def is_captcha_present(self, driver):
        captcha_indicators = [
            "//form[contains(@action, 'validateCaptcha')]",
            "//input[@id='captchacharacters']",
            "//form[contains(@action, '/errors/validateCaptcha')]",
            "//div[contains(text(), 'Enter the characters you see below')]",
            "//div[contains(text(), 'Type the characters you see in this image')]"
        ]
        
        for indicator in captcha_indicators:
            try:
                if driver.find_elements(By.XPATH, indicator):
                    return True
            except:
                pass
        
        return False
        
    # handle captcha
    def handle_captcha(self, driver):
        self.logger.warning("CAPTCHA detected! Attempting to solve with EasyOCR...")
        return self.captcha_solver.solve_captcha_with_fallback(driver)
    
    # check if sold by Amazon
    def is_sold_by_amazon(self, driver):
        return self.get_seller_type(driver) == "amazon"
    
    # Amazon specific - check if sold by third party
    def is_sold_by_third_party(self, driver):
        return self.get_seller_type(driver) == "third_party"
    
    # get seller type (Amazon or third party)
    def get_seller_type(self, driver):
        try:
            # Amazon seller element
            seller_elements = driver.find_elements(By.CSS_SELECTOR, ".offer-display-feature-text-message")
            for element in seller_elements:
                if element.text.strip():
                    if "amazon.com" in element.text.lower():
                        return "amazon"
                    else:
                        return "third_party"
                    
            # check "merchant-info" text (older pages)
            try:
                merchant_info = driver.find_element(By.ID, "merchant-info")
                if merchant_info.text.strip():
                    if "amazon.com" in merchant_info.text.lower():
                        return "amazon"
                    else:
                        return "third_party"
            except NoSuchElementException:
                pass
                
            # potential alt location
            try:
                seller_info = driver.find_element(By.CSS_SELECTOR, "#tabular-buybox-container .tabular-buybox-text")
                if seller_info.text.strip():
                    if "amazon" in seller_info.text.lower():
                        return "amazon"
                    else:
                        return "third_party"
            except:
                pass
                
            # seller profile link
            try:
                seller_link = driver.find_element(By.CSS_SELECTOR, "#sellerProfileTriggerId")
                if seller_link.text.strip():
                    if "amazon" in seller_link.text.lower():
                        return "amazon"
                    else:
                        return "third_party"
            except:
                pass
                
            # default to unknown if no seller information is found
            return "unknown"
                
        except Exception as e:
            self.logger.error(f"Error checking seller type: {e}")
            return "unknown"
    
    # get price
    def get_price(self, driver):
        try:
            # price from Buy Box
            price_whole = driver.find_element(By.CLASS_NAME, "a-price-whole").text.strip().replace(',', '')
            price_fraction = driver.find_element(By.CLASS_NAME, "a-price-fraction").text.strip()
            return Decimal(f"{price_whole}.{price_fraction}")
        except NoSuchElementException:
            try:
                # alternative price element
                price_element = driver.find_element(By.CLASS_NAME, "a-price")
                price_text = price_element.text.replace('$', '').replace(',', '')
                return Decimal(price_text) if price_text else None
            except (NoSuchElementException, ValueError):
                return None
    
    # check stock
    def check_stock(self, driver):
        try:
            # check if sold by Amazon.com
            if self.get_seller_type(driver) != "amazon":
                return False
                
            # availability section
            availability = driver.find_element(By.ID, "availability")
            availability_text = availability.text.lower()
            if "in stock" in availability_text:
                return True
                
            # buy now button existence
            try:
                buy_now = driver.find_element(By.ID, "buy-now-button")
                if buy_now.is_displayed():
                    return True
            except NoSuchElementException:
                pass

            # add to cart button
            try:
                add_to_cart = driver.find_element(By.ID, "add-to-cart-button")
                if add_to_cart.is_displayed():
                    return True
            except NoSuchElementException:
                pass

            return False

        except NoSuchElementException:
            return False
    
    # get image url
    def get_image_url(self, driver):
        try:
            image_element = driver.find_element(By.ID, "landingImage")
            image_url = image_element.get_attribute('src')
            return image_url
        except (NoSuchElementException, TimeoutException):
            try:
                # alt image selector
                image_element = driver.find_element(By.CSS_SELECTOR, "#imgTagWrapperId img")
                image_url = image_element.get_attribute('src')
                return image_url
            except:
                pass
    
    # scrape a product from Amazon
    def scrape_product(self, url, max_retries=3):
        driver = self.get_driver()
        retry_count = 0

        while retry_count < max_retries:
            try:
                if retry_count > 0:
                    self.close_driver()
                    driver = self.get_driver()
                self.random_delay(2, 5)

                driver.get(url)
                
                if self.is_captcha_present(driver):
                    if not self.handle_captcha(driver):
                        self.logger.warning(f"Captcha handling failed, retrying... ({retry_count+1}/{max_retries})")
                        retry_count += 1
                        time.sleep(10)
                        continue
                
                # wait for the product page to load
                wait = WebDriverWait(driver, 10)
                try:
                    product_name_element = wait.until(EC.presence_of_element_located((By.ID, "productTitle")))
                    product_name = product_name_element.text.strip()
                except (TimeoutException, NoSuchElementException):
                    self.logger.error("Could not find product title")
                    retry_count += 1
                    continue
                
                # get price
                price = self.get_price(driver)
                if not price:
                    self.logger.warning("Could not find price")
                    retry_count += 1
                    continue
                
                # check stock status
                in_stock = self.check_stock(driver)
                
                # check for third-party seller (if not in stock from Amazon)
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
                self.logger.error(f"Error scraping Amazon product: {e}")
                retry_count += 1
                time.sleep(10)
                

            finally:
                pass
        
        self.logger.error(f"Failed to scrape Amazon product after {max_retries} attempts")
        return None

# test case 
if __name__ == "__main__":
    url = "https://www.amazon.com/Pokemon-TCG-Scarlet-Surging-Booster/dp/B0DDYZX1TB/"
    # url = "https://www.amazon.com/PlayStation-5-Pro-Console/dp/B0DGY63Z2H"
    try:
        scraper = AmazonScraper()
        product_data = scraper.scrape_product(url)
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