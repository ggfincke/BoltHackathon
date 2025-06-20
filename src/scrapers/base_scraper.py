# imports
import logging
import time
import random
from abc import ABC, abstractmethod
import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options

# base scraper class - all scrapers inherit from this
class BaseScraper(ABC):
    def __init__(self, proxy_manager=None, logger=None):
        self.proxy_manager = proxy_manager
        self.logger = logger or logging.getLogger(__name__)
    
    # setup driver with anti-detection measures
    def setup_driver(self, headless=True):
        proxy = self.proxy_manager.get_proxy() if self.proxy_manager else None
        
        chrome_options = uc.ChromeOptions()
        if proxy:
            chrome_options.add_argument(f'--proxy-server={proxy}')
        
        if headless:
            chrome_options.add_argument('--headless')
        
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument("--log-level=3")
        
        return uc.Chrome(options=chrome_options)
    
    # each scraper must implement this method, will be different for each retailer
    @abstractmethod
    def scrape_product(self, url):
        pass
    
    # map scraped data to database model format
    def map_to_database(self, scraped_data, retailer_id):
        return {
            'product_data': {
                'name': scraped_data['name'],
                'image': scraped_data.get('image_url', None),
                'upc': scraped_data.get('upc', None),
            },
            'listing_data': {
                'retailer_id': retailer_id,
                'url': scraped_data['url'],
                'price': scraped_data['price'],
                'in_stock': scraped_data['in_stock'],
                'currency': 'USD',
                'image_url': scraped_data.get('image_url', None),
                'rating': scraped_data.get('rating', None),
                'review_count': scraped_data.get('review_count', None),
                'availability_status': self._determine_availability_status(
                    scraped_data.get('in_stock', True), 
                    scraped_data.get('availability_status', None),
                    scraped_data.get('stock_quantity', None)
                ),
                'stock_quantity': scraped_data.get('stock_quantity', None)
            }
        }
    
    # helper method to determine availability status from various inputs
    def _determine_availability_status(self, in_stock, availability_status=None, stock_quantity=None):
        # if explicit availability status is provided, use it (if valid)
        valid_statuses = ['in_stock', 'out_of_stock', 'limited_stock', 'backorder', 'discontinued']
        if availability_status and availability_status.lower() in valid_statuses:
            return availability_status.lower()
        
        # o/w determine from in_stock & stock_quantity
        if not in_stock:
            return 'out_of_stock'
        
        # if in stock, check if quantity info for more granular status
        if stock_quantity is not None:
            if stock_quantity == 0:
                return 'out_of_stock'
            elif stock_quantity <= 100: 
                return 'limited_stock'
            else:
                return 'in_stock'
        
        # default to in_stock if in_stock is True but no quantity info
        return 'in_stock'
    
    # add random delay to avoid detection
    def random_delay(self, min_seconds=1, max_seconds=3):
        time.sleep(random.uniform(min_seconds, max_seconds))