from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class BasePage:
    """Explicit waits and test-id helpers shared by every page object."""

    def __init__(self, driver, base_url, timeout=10):
        self.driver, self.base_url = driver, base_url
        self.wait = WebDriverWait(driver, timeout)

    @staticmethod
    def tid(test_id):
        return (By.CSS_SELECTOR, f'[data-testid="{test_id}"]')

    def open(self, path):
        self.driver.get(self.base_url + path)

    def click(self, test_id):
        self.wait.until(EC.element_to_be_clickable(self.tid(test_id))).click()

    def type(self, test_id, text):
        el = self.wait.until(EC.visibility_of_element_located(self.tid(test_id)))
        el.clear()
        el.send_keys(text)

    def text(self, test_id):
        return self.wait.until(EC.visibility_of_element_located(self.tid(test_id))).text
