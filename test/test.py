"""
Walmart CAPTCHA Solver - Image Recognition Approach
Uses computer vision to detect and click the "PRESS & HOLD" button
"""

import time
import random
import cv2
import numpy as np
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
import pyautogui
from PIL import Image, ImageEnhance
import io
import pytesseract

class WalmartCAPTCHASolver:
    def __init__(self, headless=False):
        self.driver = None
        self.headless = headless
        self.setup_driver()
    
    def setup_driver(self):
        # init Chrome driver w/ stealth settings
        options = Options()
        
        if not self.headless:
            options.add_argument("--start-maximized")
        else:
            options.add_argument("--headless")
        
        # anti-detection settings
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # realistic user agent
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ]
        options.add_argument(f"--user-agent={random.choice(user_agents)}")
        
        self.driver = webdriver.Chrome(options=options)
        
        # execute script to hide automation indicators
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    # take screenshot & return as OpenCV image
    def take_screenshot(self):
        try:
            screenshot = self.driver.get_screenshot_as_png()
            img = Image.open(io.BytesIO(screenshot))
            # PIL -> OpenCV format
            opencv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            return opencv_img
        except Exception as e:
            print(f"Error taking screenshot: {e}")
            return None
    
    # find button by text recognition
    def find_button_by_text_recognition(self, img):
        # use OCR to find 'PRESS & HOLD' text & button area
        try:
            # convert to grayscale for better OCR
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # enhance contrast for better text recognition
            enhanced = cv2.convertScaleAbs(gray, alpha=1.5, beta=30)
            
            # use pytesseract to find text
            data = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
            
            # "PRESS" & "HOLD" text
            press_boxes = []
            hold_boxes = []
            
            for i, text in enumerate(data['text']):
                text_upper = text.upper().strip()
                confidence = int(data['conf'][i])
                
                # only consider confident detections
                if confidence > 30:  
                    if 'PRESS' in text_upper:
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        press_boxes.append((x, y, w, h))
                        print(f"Found 'PRESS' text at: ({x}, {y}, {w}, {h})")
                    elif 'HOLD' in text_upper:
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        hold_boxes.append((x, y, w, h))
                        print(f"Found 'HOLD' text at: ({x}, {y}, {w}, {h})")
            
            # found both PRESS & HOLD -> estimate button center
            if press_boxes and hold_boxes:
                # find closest PRESS & HOLD texts (should be on the same button)
                min_distance = float('inf')
                best_press = None
                best_hold = None
                
                for press_box in press_boxes:
                    for hold_box in hold_boxes:
                        # calc distance b/w centers
                        press_center = (press_box[0] + press_box[2]//2, press_box[1] + press_box[3]//2)
                        hold_center = (hold_box[0] + hold_box[2]//2, hold_box[1] + hold_box[3]//2)
                        
                        distance = np.sqrt((press_center[0] - hold_center[0])**2 + 
                                         (press_center[1] - hold_center[1])**2)
                        
                        if distance < min_distance:
                            min_distance = distance
                            best_press = press_box
                            best_hold = hold_box
                
                # reasonable distance
                if best_press and best_hold and min_distance < 200:  
                    # calc button center area
                    left = min(best_press[0], best_hold[0])
                    right = max(best_press[0] + best_press[2], best_hold[0] + best_hold[2])
                    top = min(best_press[1], best_hold[1])
                    bottom = max(best_press[1] + best_press[3], best_hold[1] + best_hold[3])
                    
                    # expand area to cover full button
                    padding = 20
                    button_center = (
                        (left + right) // 2,
                        (top + bottom) // 2
                    )
                    
                    print(f"Estimated button center: {button_center}")
                    return button_center
            
        except Exception as e:
            print(f"OCR method failed: {e}")
        
        return None
    
    # find button by detecting rounded rectangle shapes
    def find_button_by_shape_detection(self, img):
        try:
            # convert to grayscale for better shape detection
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # use adaptive threshold to find edges
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                         cv2.THRESH_BINARY, 11, 2)
            
            # find contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # look for button-shaped contours
            for contour in contours:
                area = cv2.contourArea(contour)
                
                # button should be reasonably sized
                if 2000 < area < 50000:
                    # get bounding rectangle
                    x, y, w, h = cv2.boundingRect(contour)
                    
                    # check aspect ratio (buttons are usually wider than tall)
                    aspect_ratio = w / h
                    if 1.5 < aspect_ratio < 6:
                        # check if contour is roughly rectangular
                        hull = cv2.convexHull(contour)
                        hull_area = cv2.contourArea(hull)
                        
                        # relatively solid shape
                        if area / hull_area > 0.7:  
                            center_x = x + w // 2
                            center_y = y + h // 2
                            
                            print(f"Found potential button shape at: ({center_x}, {center_y})")
                            print(f"Button area: {area}, aspect ratio: {aspect_ratio:.2f}")
                            
                            return (center_x, center_y)
            
        except Exception as e:
            print(f"Shape detection failed: {e}")
        
        return None
    
    # find button by looking for common button patterns
    def find_button_by_template_matching(self, img):
        try:
            # convert to grayscale for better template matching
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # look for dark text on light background (typical button style)
            # apply different thresholds to catch various button styles
            thresholds = [127, 100, 150, 80, 180]
            
            for threshold_val in thresholds:
                _, thresh = cv2.threshold(gray, threshold_val, 255, cv2.THRESH_BINARY)
                
                # find contours
                contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                for contour in contours:
                    area = cv2.contourArea(contour)
                    
                    # look for button-sized areas
                    if 1500 < area < 30000:
                        x, y, w, h = cv2.boundingRect(contour)
                        aspect_ratio = w / h
                        
                        # button-like dimensions
                        if 1.8 < aspect_ratio < 5 and h > 30 and w > 100:
                            center_x = x + w // 2
                            center_y = y + h // 2
                            
                            # check if this area might contain text
                            roi = gray[y:y+h, x:x+w]
                            
                            # simple check for text-like patterns
                            edges = cv2.Canny(roi, 50, 150)
                            edge_density = np.sum(edges > 0) / (w * h)
                            
                            # reasonable amount of edges for text
                            if 0.05 < edge_density < 0.4:  
                                print(f"Found potential button by template matching at: ({center_x}, {center_y})")
                                return (center_x, center_y)
            
        except Exception as e:
            print(f"Template matching failed: {e}")
        
        return None
    
    # click and hold at specific screen coordinates (uses mouse)
    def click_and_hold_at_coordinates(self, x, y):
        try:
            # get browser window position and size
            window_rect = self.driver.get_window_rect()
            window_x = window_rect['x']
            window_y = window_rect['y']
            
            # calc actual screen coordinates
            # account for browser chrome/toolbar (approximately 80-120px)
            chrome_height = 90
            actual_x = window_x + x
            actual_y = window_y + y + chrome_height
            
            print(f"Clicking at screen coordinates: ({actual_x}, {actual_y})")
            
            # move mouse to position with some randomness
            offset_x = random.randint(-3, 3)
            offset_y = random.randint(-3, 3)
            
            final_x = actual_x + offset_x
            final_y = actual_y + offset_y
            
            # smooth mouse movement
            pyautogui.moveTo(final_x, final_y, duration=random.uniform(0.3, 0.8))
            
            # small delay before clicking
            time.sleep(random.uniform(0.2, 0.5))
            
            # click & hold
            pyautogui.mouseDown(button='left')
            
            # hold for realistic duration
            hold_duration = random.uniform(3.8, 5.2)
            print(f"Holding for {hold_duration:.2f} seconds...")
            time.sleep(hold_duration)
            
            # release
            pyautogui.mouseUp(button='left')
            
            print("Press and hold completed!")
            return True
            
        except Exception as e:
            print(f"Error during click and hold: {e}")
            return False
    
    # main method to solve the CAPTCHA using image recognition
    def solve_captcha(self, url="https://www.walmart.com/blocked"):
        try:
            print(f"Navigating to {url}...")
            self.driver.get(url)
            
            # wait for page to load
            time.sleep(random.uniform(3, 5))
            
            print("Taking screenshot for analysis...")
            img = self.take_screenshot()
            
            if img is None:
                print("Failed to take screenshot")
                return False
            
            # save screenshot for debugging
            cv2.imwrite("captcha_screenshot.png", img)
            print("Screenshot saved as 'captcha_screenshot.png'")
            
            # try multiple methods to find button
            button_coords = None
            
            print("\n--- Method 1: OCR Text Recognition ---")
            button_coords = self.find_button_by_text_recognition(img)
            
            if not button_coords:
                print("\n--- Method 2: Shape Detection ---")
                button_coords = self.find_button_by_shape_detection(img)
            
            if not button_coords:
                print("\n--- Method 3: Template Matching ---")
                button_coords = self.find_button_by_template_matching(img)
            
            if button_coords:
                print(f"\n✅ Button found at coordinates: {button_coords}")
                
                # perform click & hold
                success = self.click_and_hold_at_coordinates(button_coords[0], button_coords[1])
                
                if success:
                    # wait & check if redirected
                    time.sleep(3)
                    current_url = self.driver.current_url
                    
                    if "blocked" not in current_url:
                        print("🎉 CAPTCHA solved! Successfully redirected!")
                        return True
                    else:
                        print("Still on blocked page - CAPTCHA may need another attempt")
                        return False
                
            else:
                print("❌ Could not locate button using any image recognition method")
                print("You may need to manually inspect the screenshot and adjust the detection algorithms")
                return False
                
        except Exception as e:
            print(f"Error solving CAPTCHA: {e}")
            return False

    # close the browser
    def close(self):
        if self.driver:
            self.driver.quit()

# main function to run the CAPTCHA solver
def main():
    print("🤖 Starting Walmart CAPTCHA Solver (Image Recognition Mode)")
    print("=" * 60)
    
    # disable pyautogui failsafe for smoother operation
    pyautogui.FAILSAFE = False
    
    # init solver
    solver = WalmartCAPTCHASolver(headless=False)
    
    try:
        # solve CAPTCHA
        success = solver.solve_captcha()
        
        if success:
            print("\n✅ SUCCESS: CAPTCHA solved!")
            input("\nPress Enter to close browser...")
        else:
            print("\n❌ FAILED: Could not solve CAPTCHA")
            print("Check the saved screenshot 'captcha_screenshot.png' for debugging")
            input("\nPress Enter to close browser...")
            
    except KeyboardInterrupt:
        print("\n⚠️ Script interrupted by user")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        # clean up
        solver.close()
        print("Browser closed.")

if __name__ == "__main__":
    main()