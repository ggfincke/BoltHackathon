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

# price extraction constants
PRICE_SELECTORS = [
    '[data-testid="current-price"]',
    '[data-automation-id="current-price"]',
    '[data-fs-element="price"]',
    'span[itemprop="price"]',
]

# product name selectors
NAME_SELECTORS = [
    "h1[itemprop='name']",
    "h1[data-automation-id='product-title']",
    "meta[property='og:title']",
    "meta[name='twitter:title']",
]

_PRICE_NUM_RE = re.compile(r'(\d[\d.,]*)')   # first numeric chunk

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

# clean price - extract the first numeric token from the string & convert to Decimal
def _clean_price(raw: str) -> Decimal | None:
    if not raw:
        return None
    m = _PRICE_NUM_RE.search(raw)
    if m:
        return Decimal(m.group(1).replace(',', ''))
    return None

# walmart scraper
class WalmartScraper(BaseScraper):
    def __init__(self, proxy_manager=None, logger=None, use_safari=False):
        super().__init__(proxy_manager, logger, use_safari)
        # set retailer id
        self.retailer_id = 3
     
     # check if this is a real product page
    def _is_real_pdp(self, driver) -> bool:
        """        
        - must have an <h1> with text
        - must have an Add-to-Cart button *or* "Out of stock" badge
        """
        return bool(driver.find_elements(By.CSS_SELECTOR, "h1[itemprop='name']")) and (
            driver.find_elements(By.CSS_SELECTOR, "[data-automation-id='atc']") or
            driver.find_elements(By.XPATH, "//*[contains(text(),'Out of stock')]")
        ) 
    
    # check if sold by Walmart
    def is_sold_by_walmart(self, driver):
        return self.get_seller_type(driver) == "walmart"

    # check if sold by third party
    def is_sold_by_third_party(self, driver):
        return self.get_seller_type(driver) == "third_party"
    
    # get seller type (Walmart or third party)
    def get_seller_type(self, driver, default="walmart"):
        # try to detect whether the buy-box is Walmart or 3P
        elements = driver.find_elements(
            By.CSS_SELECTOR, '[data-testid="product-seller-info"]'
        )
        # badge absent -> treat as Walmart
        if not elements:
            self.logger.debug("Seller badge not present; assuming Walmart.")
            return default

        seller_text = elements[0].text.lower()
        if "walmart.com" in seller_text or "sold and shipped by walmart" in seller_text:
            return "walmart"
        return "third_party"

    # check if shipping is available (kept for potential niche cases)
    def is_shipping_available(self, driver):
        # try:
        #     # check for shipping availability indicators
        #     shipping_element = driver.find_elements(By.CSS_SELECTOR, "[data-testid='shipping-tile']")
        #     if shipping_element:                      
        #         shipping = WebDriverWait(driver, 10).until(
        #             EC.presence_of_element_located((By.CSS_SELECTOR, '[data-seo-id="fulfillment-shipping-intent"]'))
        #         )
        #         # button is disabled
        #         if "Out of stock" in shipping.text:
        #             return False  
        #     
        #         # shipping available
        #         return True
        #     
        #     # not available
        #     return False
        # 
        # except (NoSuchElementException, TimeoutException) as e:
        #     self.logger.error(f"Error checking shipping: {e}")
        #     return False
        pass  # commented out - no longer used in main flow

    # determining in stock status - this is the only thing that really matters
    def check_stock(self, driver):
        try:
            btn = WebDriverWait(driver, 8).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "[data-automation-id='atc']")
                )
            )
            # disabled buttons carry aria-disabled="true" OR a disabled attr.
            disabled = btn.get_attribute("aria-disabled") == "true" or \
                       btn.get_attribute("disabled") is not None
            return not disabled
        except (TimeoutException, NoSuchElementException):
            return False

    # extract product name
    def get_product_name(self, driver):
        for sel in NAME_SELECTORS:
            try:
                if sel.startswith("meta"):
                    content = driver.find_element(By.CSS_SELECTOR, sel).get_attribute("content")
                    if content:
                        return content.strip()
                else:
                    text = driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                    if text:
                        return text
            except NoSuchElementException:
                continue
        # fail
        return None

    # extracting price
    def get_price(self, driver):
        # 1️⃣ text-based selectors
        for sel in PRICE_SELECTORS:
            try:
                txt = driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                price = _clean_price(txt)
                if price is not None:
                    return price
            except NoSuchElementException:
                continue

        # 2️⃣ look for a `content="2.50"` attr on itemprop=price
        try:
            price_attr = driver.find_element(
                By.CSS_SELECTOR, 'span[itemprop="price"][content]'
            ).get_attribute("content")
            price = _clean_price(price_attr)
            if price is not None:
                return price
        except NoSuchElementException:
            pass

        # 3️⃣ last-ditch: schema-org JSON
        try:
            schema = driver.find_element(By.CSS_SELECTOR,
                'script[data-seo-id="schema-org-product"][type="application/ld+json"]')
            data = json.loads(schema.get_attribute("innerHTML"))
            return Decimal(str(data["offers"]["price"]))
        except Exception:
            self.logger.info("Price not found – treating as out-of-stock")
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

    # switch to shipping fulfillment if present
    def switch_to_shipping_if_present(self, driver):
        try:
            tile = driver.find_element(By.CSS_SELECTOR, '[data-testid="shipping-tile"]')
            if "disabled" not in tile.get_attribute("class"):
                tile.click()
                time.sleep(0.5)          # tiny debounce
        except NoSuchElementException:
            # tile isn't on this SKU – it's fine, just continue with pickup/delivery
            pass

    # get UPC/GTIN string from Walmart's schema-org script tag
    def get_upc(self, driver):
        # 1️⃣ schema-org json
        try:
            data = json.loads(driver.find_element(
                By.CSS_SELECTOR,
                "script[data-seo-id='schema-org-product'][type='application/ld+json']"
            ).get_attribute("innerHTML"))
            return str(data.get("gtin13") or data.get("sku"))
        except NoSuchElementException:
            pass

        # 2️⃣ specifications table
        try:
            rows = driver.find_elements(
                By.CSS_SELECTOR,
                "[data-automation-id='product-specs'] tr"
            )
            for row in rows:
                if "UPC" in row.text:
                    upc = row.text.split()[-1]
                    return upc
        except NoSuchElementException:
            pass

        return None

    # scrape a product from Walmart
    def scrape_product(self, url):
        driver = self.get_driver(headless=False)
        try:
            # initialise CAPTCHA solver to reuse same Selenium session
            captcha_solver = WalmartCAPTCHASolver(driver=driver)

            driver.get(url)
            
            # check if this is a real product page
            if not self._is_real_pdp(driver):
                self.logger.warning("Stub or redirect page – skipping")
                # abort the scrape gracefully
                return None          
            
            # optionally switch to shipping fulfillment
            self.switch_to_shipping_if_present(driver)
                    
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

            # check for critical missing fields
            critical = {"name": product_name, "price": price}
            missing = [k for k,v in critical.items() if v is None]
            if missing:
                self.logger.warning(f"Missing {', '.join(missing)} – skipping listing")
                return None

            product_data = {
                "name":  product_name,
                "price": price,
                "url":   url,
                "in_stock": in_stock,
                "image_url": image_url,
                "third_party_seller": third_party_seller,
                "rating": rating,
                "review_count": review_count,
                "upc": upc,
            }
            
            # return data mapped to database structure
            return self.map_to_database(product_data, self.retailer_id)
            
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
                print(f"Name: {product_data['product_data']['name']}")
                
                if product_data['listing_data'].get('price'):
                    print(f"Price: ${product_data['listing_data']['price']}")
                else:
                    print("Price: Not found")
                    
                print(f"In Stock: {'Yes' if product_data['listing_data'].get('in_stock') else 'No'}")
                
                if product_data['listing_data'].get('image_url'):
                    print(f"Image URL: {product_data['listing_data']['image_url']}")
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
                    
                print(f"Third Party Seller: {'Yes' if product_data['listing_data'].get('third_party_seller') else 'No'}")
            except KeyError as ke:
                print(f"Missing expected data field: {ke}")
                print(f"Available data: {product_data}")
        else:
            print("Failed to fetch product data")
    except Exception as e:
        print(f"Error in main: {e}")