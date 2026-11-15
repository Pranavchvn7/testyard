from .base_page import BasePage


class AuthPage(BasePage):
    PATH = "/practice/auth"

    def goto(self):
        self.open(self.PATH)
        return self

    def login(self, email, password):
        self.type("login-email", email)
        self.type("login-password", password)
        self.click("login-submit")
        return self

    @property
    def profile_name(self):
        return self.text("profile-name")

    @property
    def error(self):
        return self.text("msg-error")
