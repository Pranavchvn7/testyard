export class AuthPage {
  constructor(page) { this.page = page; }
  async goto() { await this.page.goto("/practice/auth"); }
  async login(email, password) {
    await this.page.getByTestId("login-email").fill(email);
    await this.page.getByTestId("login-password").fill(password);
    await this.page.getByTestId("login-submit").click();
  }
  get profileName() { return this.page.getByTestId("profile-name"); }
  get error() { return this.page.getByTestId("msg-error"); }
}
