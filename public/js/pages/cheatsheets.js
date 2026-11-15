import { page } from "../registry.js";
import { h, $$, copy, stage } from "../ui.js";

// Each row: [syntax, what it does, example]
const CSS = {
  "Basic selectors": [
    ["tag", "Elements by tag name", "button"],
    [".class", "Elements with a class (chain for AND)", ".btn.primary"],
    ["#id", "Element by id (escape odd characters)", "#signin  ·  #a\\.b  ·  #\\31 23"],
    ["*", "Any element", "form *"],
    ["a, b", "Union: matches a OR b", "h1, h2, h3"],
    ["[attr]", "Has the attribute", "[disabled]"],
    ["[attr=v]", "Attribute equals", "[data-testid=\"signin\"]"],
    ["[attr=v i]", "Case-insensitive value match", "[type=\"EMAIL\" i]"],
  ],
  "Attribute operators": [
    ["[a^=v]", "Starts with", "[id^=btn_]"],
    ["[a$=v]", "Ends with", "[href$=\".pdf\"]"],
    ["[a*=v]", "Contains substring", "[class*=\"col-\"]"],
    ["[a~=v]", "Whitespace-separated word list contains v", "[class~=\"sale\"]"],
    ["[a|=v]", "Equals v or starts with v-", "[lang|=\"en\"]"],
    ["[a=v][b=w]", "Several attributes (AND)", "input[type=checkbox][name=remember]"],
  ],
  "Combinators": [
    ["a b", "Descendant (any depth)", "form input"],
    ["a > b", "Direct child", "ul.items > li"],
    ["a + b", "Next sibling immediately after", "label + input"],
    ["a ~ b", "Any later sibling", "h2 ~ p"],
  ],
  "Structural pseudo-classes": [
    [":first-child / :last-child", "First or last child of its parent", "li:last-child"],
    [":nth-child(n)", "Nth child; supports 2n, 2n+1, odd, even, -n+3", "tr:nth-child(2n+1)"],
    [":nth-last-child(n)", "Counting from the end", "li:nth-last-child(2)"],
    [":nth-of-type(n)", "Nth of the same tag among siblings", "p:nth-of-type(2)"],
    [":only-child / :only-of-type", "Sole child / sole of its tag", "li:only-child"],
    [":empty", "No children and no text", "td:empty"],
    [":root", "The html element", ":root"],
    [":not(sel)", "Negation", "input:not([type=hidden])"],
    [":is(a, b) / :where(a, b)", "Match any in the list (:where has zero specificity)", ":is(h1,h2) + p"],
    [":has(sel)", "Parent selector: has a matching descendant", "li:has(> a.active)"],
  ],
  "State pseudo-classes": [
    [":checked", "Checked checkbox, radio, selected option", "input:checked"],
    [":disabled / :enabled", "Form control state", "button:enabled"],
    [":required / :optional", "Required attribute present or not", "input:required"],
    [":read-only / :read-write", "Editable or not", "input:read-only"],
    [":placeholder-shown", "Placeholder currently visible", "input:placeholder-shown"],
    [":focus / :focus-within", "Focused element / contains focus", "form:focus-within"],
    [":valid / :invalid", "Constraint validation result", "input:invalid"],
    [":target", "Element matching the URL fragment", ":target"],
    ["::before / ::after", "Pseudo-elements are NOT selectable by any locator API", "(read via getComputedStyle)"],
  ],
  "Playwright-only CSS extensions": [
    [":has-text(\"x\")", "Contains text (case-insensitive, substring)", "article:has-text(\"Playwright\")"],
    [":text(\"x\")", "Smallest element containing text", "button:text(\"Log in\")"],
    [":text-is(\"x\")", "Exact full-string text", "li:text-is(\"Banana\")"],
    [":text-matches(\"re\", \"i\")", "Regex on text", ":text-matches(\"^Order #\\\\d+\")"],
    [":visible", "Only visible elements", "button:visible"],
    [":nth-match(sel, n)", "Nth match across the whole result set (1-based)", ":nth-match(.card, 3)"],
    ["a >> b", "Chain engines: result of a becomes scope of b", "css=.row >> text=Edit"],
    ["Shadow piercing", "CSS pierces OPEN shadow roots; closed roots stay unreachable", "ty-card input"],
  ],
};

const XPATH = {
  "Paths & predicates": [
    ["//tag", "Anywhere in the document", "//button"],
    ["/html/body/div", "Absolute path (brittle, avoid)", "/html/body/div[2]"],
    [".//tag", "Anywhere below the current node", ".//td"],
    ["//*[@id='x']", "Attribute equals", "//input[@id='email']"],
    ["//*[@a and @b]", "AND / OR conditions", "//input[@type='text' or @type='email']"],
    ["//tag[n]", "Nth child of its parent with that tag (1-based)", "(//li)[3]  vs  //li[3]"],
    ["(//tag)[n]", "Nth in the WHOLE result set", "(//a[text()='Remove'])[2]"],
    ["a | b", "Union of two paths", "//h1 | //h2"],
    ["//*[not(@disabled)]", "Negation", "//button[not(@disabled)]"],
  ],
  "String functions": [
    ["text()", "Direct text node of the element", "//button[text()='Sign in']"],
    ["contains(a, b)", "Substring test", "//a[contains(@href,'docs')]"],
    ["starts-with(a, b)", "Prefix test (ends-with() needs XPath 2.0, use substring)", "//*[starts-with(@id,'btn_')]"],
    ["normalize-space(x)", "Trim and collapse whitespace", "//*[normalize-space()='Hello World']"],
    ["translate(s, from, to)", "Character mapping: the trick for case-insensitive matching", "//*[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'login')]"],
    ["concat(a, b, ...)", "Join strings (handy for quotes inside quotes)", "concat('It', \"'\", 's')"],
    ["substring(s, start, len)", "1-based substring", "//td[substring(.,1,2)='AB']"],
    ["substring-before / -after", "Text before or after a delimiter", "//p[substring-after(.,': ')='42']"],
    ["string-length(s)", "Length of a string", "//input[string-length(@value)>5]"],
    ["string(.)  vs  text()", "string(.) joins all descendant text; text() is only direct text nodes", "//p[contains(string(.),'a b')]"],
    ["ends-with emulation", "substring(@a, string-length(@a) - n + 1) = 'x'", "//a[substring(@href,string-length(@href)-3)='.pdf']"],
  ],
  "Number & position functions": [
    ["position()", "Position within the current node-set", "//tr[position()>1]"],
    ["last()", "Last position (use last()-1 for second last)", "//li[last()-1]"],
    ["count(nodes)", "Number of nodes", "//ul[count(li)=3]"],
    ["sum / floor / ceiling / round", "Numeric helpers", "//li[round(@data-price) > 2]"],
    ["number(x)", "Convert to number", "//li[number(@data-price) >= 3]"],
    ["Comparison", "Numeric comparisons coerce to numbers automatically", "//li[@data-price>2]"],
    ["mod / div", "Arithmetic operators", "//tr[position() mod 2 = 0]"],
  ],
  "Axes": [
    ["child::", "Direct children (default axis)", "//ul/child::li"],
    ["descendant:: / descendant-or-self::", "All nested nodes", "//div/descendant::a"],
    ["parent::  (..)", "Immediate parent", "//td[.='Banana']/parent::tr"],
    ["ancestor::", "All ancestors, nearest first", "//td[.='32']/ancestor::table"],
    ["ancestor-or-self::", "Ancestors including the node", "//span/ancestor-or-self::div[1]"],
    ["following-sibling::", "Later siblings", "//label[.='Username']/following-sibling::input[1]"],
    ["preceding-sibling::", "Earlier siblings (nearest is [1])", "//td[.='QA']/preceding-sibling::td[1]"],
    ["following::", "Everything after in document order (not descendants)", "//h2[.='Totals']/following::p[1]"],
    ["preceding::", "Everything before in document order (not ancestors)", "//h2[.='Totals']/preceding::p[1]"],
    ["self::", "The node itself", "//*[self::h1 or self::h2]"],
    ["attribute::", "Attribute axis (@ is short for it)", "//a/attribute::href"],
    ["Table cell by header", "Find the column index from the header, then pick the cell", "//tr[td[.='Clean Code']]/td[count(//th[.='Price']/preceding-sibling::th)+1]"],
  ],
  "Gotchas": [
    ["XPath 1.0 only", "Browsers implement 1.0: no lower-case(), ends-with(), regex, or matches()", "use translate() / substring()"],
    ["//  inside a chained locator", "Playwright makes a chained xpath relative to the parent, so //a becomes .//a", "page.locator('ul').locator('//li')"],
    ["Quotes in values", "Use concat() when a string holds both ' and \"", "concat('He said \"it', \"'\", 's\"')"],
    ["Shadow DOM", "XPath cannot see into shadow roots; use CSS or getBy*", "(none)"],
    ["Namespaces", "SVG nodes need name()='svg' or local-name()", "//*[local-name()='circle']"],
  ],
};

const PW_LOC = {
  "Built-in locators (page.* and locator.*)": [
    ["getByRole(role, opts)", "ARIA role + accessible name. Options: name, exact, checked, disabled, expanded, includeHidden, level, pressed, selected", "page.getByRole('button', { name: 'Sign in' })"],
    ["getByText(text, opts)", "Visible text. String is a case-insensitive substring; exact:true is case-sensitive full match; regex allowed", "page.getByText('Hello', { exact: true })"],
    ["getByLabel(text, opts)", "Form control by its label, aria-label or aria-labelledby", "page.getByLabel('Password')"],
    ["getByPlaceholder(text, opts)", "Input by placeholder", "page.getByPlaceholder('you@example.com')"],
    ["getByAltText(text, opts)", "Images (and area/input[type=image]) by alt", "page.getByAltText('TestYard logo')"],
    ["getByTitle(text, opts)", "Elements by title attribute", "page.getByTitle('Close dialog')"],
    ["getByTestId(id)", "data-testid exact match (change the attribute via selectors.setTestIdAttribute)", "page.getByTestId('login-submit')"],
    ["locator(selector, opts)", "CSS, XPath or an engine string. Options: has, hasNot, hasText, hasNotText", "page.locator('li', { hasText: 'Banana' })"],
    ["frameLocator(selector)", "Enter an iframe; chain further locators inside", "page.frameLocator('iframe[name=outer]').getByRole('button')"],
  ],
  "Narrowing & combining": [
    [".filter({ hasText })", "Keep matches whose text contains/matches", "rows.filter({ hasText: 'Pending' })"],
    [".filter({ hasNotText })", "Drop matches containing text", "rows.filter({ hasNotText: 'Active' })"],
    [".filter({ has: locator })", "Keep matches that contain a descendant matching the locator", "rows.filter({ has: page.getByRole('button', { name: 'Edit' }) })"],
    [".filter({ hasNot: locator })", "Keep matches that do NOT contain it", "rows.filter({ hasNot: page.locator('.badge') })"],
    [".filter({ visible: true })", "Only visible matches", "buttons.filter({ visible: true })"],
    [".first() / .last() / .nth(i)", "Pick by position (0-based nth); last resort for duplicates", "page.getByRole('link').nth(2)"],
    [".and(locator)", "Intersection: must match both", "page.getByRole('button').and(page.getByTitle('Subscribe'))"],
    [".or(locator)", "Union: either (handy for variant UIs and dialogs that may appear)", "newEmail.or(dialog)"],
    [".locator('..')", "Parent element via XPath ..", "cell.locator('..')"],
    [".locator('xpath=...')", "Explicit XPath engine", "row.locator('xpath=./td[2]')"],
    [".describe('name')", "Label a locator for reports and trace", "page.getByTestId('x').describe('Cart badge')"],
    [".contentFrame() / .frameLocator()", "Move from an iframe element into its frame", "page.locator('iframe').contentFrame()"],
  ],
  "Selector-string engines (page.locator('engine=...'))": [
    ["css=...", "CSS (default when no prefix)", "css=button.primary"],
    ["xpath=... or //...", "XPath (a leading // or .. is detected automatically)", "xpath=//tr[td[.='Asha']]"],
    ["text=Log in", "Case-insensitive substring; text=\"Log in\" is exact; text=/re/i is a regex", "text=\"Log in\""],
    ["role=button[name=\"Save\"]", "Role engine with attribute-like options", "role=checkbox[checked=true]"],
    ["id=foo  ·  data-testid=foo", "Shortcuts for exact attribute matches", "data-testid=signin"],
    ["internal:label=\"x\"i", "What codegen emits for getByLabel", "internal:role=button[name=\"OK\"i]"],
    ["a >> b", "Chain: select b inside each a", "css=.card >> text=Add to cart"],
    [">> nth=1", "Pick the second result of the left side", ".line >> nth=1"],
  ],
  "Strictness & matching rules": [
    ["Strict mode", "Actions and assertions on a locator that resolves to more than one element throw: narrow it, or use first()/nth()/all()", "locator.click()  ->  strict mode violation"],
    ["Locators are lazy", "A locator is a recipe, re-resolved on every action, so it never goes stale like Selenium elements", "const btn = page.getByRole('button'); await btn.click();"],
    ["Auto-waiting", "Actions wait for visible, stable, enabled and receiving events; assertions retry until timeout", "await expect(btn).toBeEnabled()"],
    ["Whitespace", "Text matching normalises whitespace and ignores case unless exact:true", "getByText('hello   world')"],
    ["Hidden elements", "getByRole skips hidden/aria-hidden elements unless includeHidden:true", "getByRole('button', { includeHidden: true })"],
    ["Open shadow roots", "Pierced automatically by CSS, text, role and test id; not by XPath", "page.locator('ty-card').getByRole('button')"],
    ["Priority", "Prefer: role > label > placeholder > text > alt > title > test id > CSS > XPath", "Playwright docs, 'Best practices'"],
  ],
};

const PW_METHODS = {
  "Actions": [
    ["click(opts) / dblclick() / tap()", "Options: button, clickCount, delay, modifiers, position, force, trial, timeout, noWaitAfter", "await loc.click({ modifiers: ['Shift'] })"],
    ["fill(value) / clear()", "Replace the whole value of input, textarea or contenteditable (fires input events)", "await loc.fill('hello')"],
    ["pressSequentially(text, { delay })", "Type key by key (replaces the old type())", "await loc.pressSequentially('abc', { delay: 80 })"],
    ["press(key)", "Single key or chord: Enter, Control+A, Shift+Tab", "await loc.press('Control+A')"],
    ["check() / uncheck() / setChecked(b)", "Checkbox and radio, verifies the final state", "await loc.check()"],
    ["selectOption(values)", "Select by value, label or index; arrays for multiple", "await loc.selectOption({ label: 'Canada' })"],
    ["hover() / focus() / blur()", "Pointer and focus actions", "await loc.hover()"],
    ["dragTo(target)", "Drag and drop between two locators", "await src.dragTo(dst)"],
    ["setInputFiles(files)", "Upload; pass [] to clear; buffers supported", "await loc.setInputFiles('a.png')"],
    ["scrollIntoViewIfNeeded()", "Scroll an element into view", "await loc.scrollIntoViewIfNeeded()"],
    ["dispatchEvent(type)", "Fire a DOM event directly, bypassing actionability", "await loc.dispatchEvent('click')"],
    ["selectText() / highlight()", "Select the element text; highlight it in headed mode", "await loc.highlight()"],
  ],
  "Reading values": [
    ["textContent() / innerText()", "Raw text vs rendered text", "await loc.innerText()"],
    ["allTextContents() / allInnerTexts()", "Arrays for multi-match locators", "await rows.allInnerTexts()"],
    ["inputValue()", "Current value of a form control", "await loc.inputValue()"],
    ["getAttribute(name)", "Attribute or null", "await loc.getAttribute('href')"],
    ["innerHTML()", "Markup inside", "await loc.innerHTML()"],
    ["count()", "How many elements match right now (no waiting)", "await rows.count()"],
    ["all()", "Array of one locator per match (resolves once, no auto-wait)", "for (const r of await rows.all()) { }"],
    ["boundingBox()", "Position and size or null", "await loc.boundingBox()"],
    ["isVisible() / isEnabled() / isChecked() / isEditable()", "Instant state checks, do not wait; prefer expect()", "await loc.isVisible()"],
    ["ariaSnapshot()", "YAML view of the accessibility tree", "await loc.ariaSnapshot()"],
    ["evaluate(fn) / evaluateAll(fn)", "Run code in the page with the element(s)", "await rows.evaluateAll(els => els.length)"],
    ["screenshot(opts)", "Element screenshot (mask, animations: 'disabled')", "await loc.screenshot({ path: 'a.png' })"],
  ],
  "Waiting": [
    ["locator.waitFor({ state })", "state: attached | detached | visible | hidden", "await loc.waitFor({ state: 'hidden' })"],
    ["page.waitForURL(url)", "Wait until navigation settles on a URL", "await page.waitForURL('**/dashboard')"],
    ["page.waitForResponse(match)", "Wait for a network response", "const r = await page.waitForResponse('**/api/users*')"],
    ["page.waitForRequest(match)", "Wait for an outgoing request", "await page.waitForRequest('**/api/orders')"],
    ["page.waitForEvent(name)", "popup, download, dialog, filechooser, console, pageerror...", "const p = page.waitForEvent('popup')"],
    ["page.waitForLoadState(state)", "load | domcontentloaded | networkidle (discouraged)", "await page.waitForLoadState('domcontentloaded')"],
    ["page.waitForFunction(fn)", "Poll a JavaScript predicate in the page", "await page.waitForFunction(() => window.ready)"],
    ["expect.poll(fn)", "Retry any async value until the assertion passes", "await expect.poll(() => api.count()).toBe(3)"],
    ["expect(fn).toPass()", "Retry a block of assertions", "await expect(async () => { }).toPass()"],
    ["Never: waitForTimeout", "Fixed sleeps are the top cause of slow and flaky tests", "page.waitForTimeout(5000)"],
  ],
  "Web-first assertions (auto-retrying)": [
    ["toBeVisible / toBeHidden / toBeAttached", "Presence and visibility", "await expect(loc).toBeVisible()"],
    ["toBeEnabled / toBeDisabled / toBeEditable", "Interaction state", "await expect(loc).toBeDisabled()"],
    ["toBeChecked({ checked })", "Checkbox, radio, switch", "await expect(loc).toBeChecked()"],
    ["toHaveText / toContainText", "Full or partial text, arrays for lists, regex allowed", "await expect(rows).toHaveText(['a', 'b'])"],
    ["toHaveValue / toHaveValues", "Input and multi-select values", "await expect(loc).toHaveValue('x')"],
    ["toHaveAttribute / toHaveClass / toHaveId", "DOM attributes (class accepts regex or array)", "await expect(loc).toHaveClass(/active/)"],
    ["toHaveCSS(prop, value)", "Computed style", "await expect(loc).toHaveCSS('color', 'rgb(0, 0, 0)')"],
    ["toHaveCount(n)", "Number of matches", "await expect(rows).toHaveCount(3)"],
    ["toBeFocused / toBeInViewport / toBeEmpty", "Focus, viewport and emptiness", "await expect(loc).toBeFocused()"],
    ["toHaveURL / toHaveTitle", "Page level", "await expect(page).toHaveURL(/shop/)"],
    ["toHaveScreenshot / toMatchAriaSnapshot", "Visual and accessibility-tree snapshots", "await expect(loc).toMatchAriaSnapshot('- button \"Save\"')"],
    ["toBeOK()", "APIResponse status 200-299", "await expect(response).toBeOK()"],
    ["expect.soft(...)", "Record the failure and keep running", "await expect.soft(loc).toHaveText('x')"],
    [".not", "Negate any matcher; it retries until the negation holds", "await expect(loc).not.toBeVisible()"],
  ],
  "Page, context & network": [
    ["page.goto / reload / goBack", "Navigation helpers", "await page.goto('/practice/shop')"],
    ["page.route(url, handler)", "Intercept: fulfill, abort, continue, fetch+modify", "await page.route('**/api/products*', r => r.fulfill({ json: {} }))"],
    ["page.on('dialog' | 'console' | 'pageerror' | 'request' | 'response')", "Event listeners", "page.on('dialog', d => d.accept())"],
    ["context.storageState()", "Save cookies and localStorage for reuse across tests", "await context.storageState({ path: 'auth.json' })"],
    ["context.addCookies / cookies", "Cookie control", "await context.addCookies([{ name, value, url }])"],
    ["context.grantPermissions / setGeolocation", "Permissions and device location", "await context.setGeolocation({ latitude: 48.85, longitude: 2.35 })"],
    ["page.addInitScript / exposeFunction", "Inject code before the page scripts / call Node from the page", "await page.addInitScript(() => { window.__flag = true })"],
    ["page.clock.install / fastForward / setFixedTime", "Control Date, timers and performance.now", "await page.clock.install(); await page.clock.fastForward('01:00')"],
    ["page.pause() / PWDEBUG=1", "Open the Inspector", "await page.pause()"],
    ["request (APIRequestContext)", "HTTP calls with shared cookies: get, post, put, patch, delete, fetch", "await request.post('/api/users', { data })"],
    ["browser.newContext(opts)", "Isolated profile: viewport, locale, timezoneId, colorScheme, userAgent, offline", "await browser.newContext({ locale: 'fr-FR' })"],
  ],
  "Test runner": [
    ["test / test.describe / test.step", "Structure and reporting", "await test.step('log in', async () => { })"],
    ["test.beforeEach / afterEach / beforeAll / afterAll", "Hooks", "test.beforeEach(async ({ page }) => { })"],
    ["test.use({ ... })", "Override options per file or describe", "test.use({ viewport: { width: 390, height: 844 } })"],
    ["test.skip / fixme / fail / slow", "Annotations and conditional skips", "test.fixme(browserName === 'webkit', 'bug 123')"],
    ["test.describe.configure({ mode })", "parallel | serial | default, retries, timeout", "test.describe.configure({ mode: 'serial' })"],
    ["Tags & --grep", "Tag with { tag: '@smoke' } and filter with --grep", "npx playwright test --grep @smoke"],
    ["Fixtures: test.extend", "Reusable setup/teardown with dependency injection", "const test = base.extend({ cart: async ({ page }, use) => { await use(new Cart(page)) } })"],
    ["CLI", "--project, --headed, --ui, --debug, --trace on, --shard 1/4, --last-failed, --update-snapshots", "npx playwright test --shard=1/4"],
    ["Tools", "codegen, show-trace, show-report, UI mode, VS Code extension", "npx playwright codegen http://localhost:3000"],
    ["Config", "retries, workers, projects, webServer, reporter, use.trace, expect.timeout", "defineConfig({ retries: 2, workers: 4 })"],
  ],
};

const SELENIUM = {
  "Locator strategies (By.*)": [
    ["By.id / By.name / By.className / By.tagName", "Basic strategies", "driver.find_element(By.ID, 'signin')"],
    ["By.CSS_SELECTOR", "Any CSS selector (no shadow piercing)", "driver.find_element(By.CSS_SELECTOR, \"[data-testid='signin']\")"],
    ["By.XPATH", "XPath 1.0", "driver.find_element(By.XPATH, \"//button[text()='Sign in']\")"],
    ["By.LINK_TEXT / PARTIAL_LINK_TEXT", "Anchor text only", "driver.find_element(By.PARTIAL_LINK_TEXT, 'Docs')"],
    ["Relative locators", "above, below, to_left_of, to_right_of, near (Selenium 4)", "locate_with(By.TAG_NAME, 'input').below({By.ID: 'user'})"],
    ["find_elements", "Returns a list and never throws when empty", "len(driver.find_elements(By.CSS_SELECTOR, 'li'))"],
  ],
  "Waits": [
    ["Implicit wait", "Global polling for find_element. Do not mix with explicit waits", "driver.implicitly_wait(0)"],
    ["WebDriverWait + expected_conditions", "visibility_of_element_located, element_to_be_clickable, presence_of_element_located, text_to_be_present_in_element, staleness_of, invisibility_of_element_located, frame_to_be_available_and_switch_to_it, alert_is_present, url_contains, number_of_windows_to_be", "WebDriverWait(driver, 10).until(EC.element_to_be_clickable(locator))"],
    ["FluentWait (Java)", "Polling interval and ignored exceptions", "new FluentWait<>(driver).withTimeout(Duration.ofSeconds(10)).ignoring(NoSuchElementException.class)"],
    ["StaleElementReferenceException", "The element was replaced: re-find it, or wait with staleness_of", "WebDriverWait(driver, 5).until(EC.staleness_of(old))"],
  ],
  "Browser features": [
    ["Shadow DOM", "element.shadow_root.find_element(...): open roots only, CSS selectors only", "host.shadow_root.find_element(By.CSS_SELECTOR, 'input')"],
    ["iFrames", "switch_to.frame(name | index | element), switch_to.default_content(), switch_to.parent_frame()", "driver.switch_to.frame('outer-frame')"],
    ["Windows and tabs", "window_handles, switch_to.window, switch_to.new_window('tab')", "driver.switch_to.window(driver.window_handles[-1])"],
    ["Alerts", "switch_to.alert: accept, dismiss, text, send_keys", "driver.switch_to.alert.accept()"],
    ["Actions API", "move_to_element, click_and_hold, drag_and_drop, key_down, scroll_to_element, double_click, context_click", "ActionChains(driver).move_to_element(el).perform()"],
    ["JavaScript", "execute_script and execute_async_script", "driver.execute_script('arguments[0].click()', el)"],
    ["Cookies and screenshots", "add_cookie, get_cookies, delete_all_cookies, save_screenshot, element.screenshot", "driver.save_screenshot('a.png')"],
    ["CDP and BiDi", "Chromium DevTools: network, console, geolocation (Selenium 4)", "driver.execute_cdp_cmd('Network.enable', {})"],
    ["Select helper", "Select(el).select_by_visible_text / value / index", "Select(el).select_by_visible_text('Canada')"],
  ],
};

const SECTIONS = {
  "CSS": CSS,
  "XPath": XPATH,
  "Playwright locators": PW_LOC,
  "Playwright methods": PW_METHODS,
  "Selenium": SELENIUM,
};
const rowsToMarkdown = (name, groups) => `# ${name}\n\n` + Object.entries(groups).map(([g, rows]) => `## ${g}\n\n| Syntax | Meaning | Example |\n|---|---|---|\n` + rows.map((r) => `| \`${r[0].replace(/\|/g, "\\|")}\` | ${r[1].replace(/\|/g, "\\|")} | \`${r[2].replace(/\|/g, "\\|")}\` |`).join("\n")).join("\n\n");

page({
  id: "locator-cheatsheet", group: "dom", title: "Locator cheat sheet",
  blurb: "CSS, XPath functions and axes, Playwright built-in locators, every key method and Selenium, searchable.",
  tasks: [
    "Find three XPath functions that have no CSS equivalent and use each one in the Locator Lab.",
    "List every Playwright method that waits automatically and every one that does not.",
    "Pick five Selenium waits and write the Playwright equivalent next to them.",
    "Use the search box to find everything that mentions “shadow” and compare how each tool handles it.",
  ],
  render(root) {
    const names = Object.keys(SECTIONS);
    let active = names[0];
    const q = h("input", { type: "search", placeholder: "Filter this sheet (e.g. sibling, filter, wait)…", "aria-label": "Filter cheat sheet", "data-testid": "cs-filter" });
    const count = h("span", { class: "muted", "data-testid": "cs-count" });
    const body = h("div", { "data-testid": "cs-body" });
    const tabs = names.map((n) => h("button", { role: "tab", type: "button", "data-testid": "cs-tab-" + n.toLowerCase().replace(/\W+/g, "-"), onClick: () => { active = n; draw(); } }, n));
    const row = (r) => h("tr", {},
      h("td", {}, h("code", { text: r[0] })),
      h("td", { style: { whiteSpace: "normal", minWidth: "220px" }, text: r[1] }),
      h("td", { style: { whiteSpace: "normal" } }, h("code", { text: r[2] }), " ", h("button", { class: "btn sm ghost", type: "button", "aria-label": "Copy example", "data-testid": "cs-copy", onClick: () => copy(r[2]) }, "Copy")));
    function draw() {
      tabs.forEach((b, i) => b.setAttribute("aria-selected", String(names[i] === active)));
      const needle = q.value.trim().toLowerCase();
      let shown = 0;
      const groups = Object.entries(SECTIONS[active]).map(([g, rows]) => {
        const list = rows.filter((r) => !needle || (g + " " + r.join(" ")).toLowerCase().includes(needle));
        shown += list.length;
        if (!list.length) return null;
        return stage(h("h2", { text: g }), h("div", { class: "tbl-wrap" }, h("table", { "data-testid": "cs-table" }, h("thead", {}, h("tr", {}, ["Syntax", "What it does", "Example"].map((c) => h("th", { text: c })))), h("tbody", {}, list.map(row)))));
      });
      count.textContent = shown + (shown === 1 ? " entry" : " entries");
      body.replaceChildren(...(shown ? groups.filter(Boolean) : [h("p", { class: "muted", text: "Nothing matches that filter in this tab." })]));
    }
    q.addEventListener("input", draw);
    root.append(
      h("div", { class: "row", style: { marginBottom: "14px" } }, q, count, h("button", { class: "btn sm", type: "button", "data-testid": "cs-copy-md", onClick: () => copy(rowsToMarkdown(active, SECTIONS[active])) }, "Copy tab as Markdown"), h("a", { class: "btn sm primary", href: "/practice/locators", "data-testid": "cs-open-lab" }, "Practise in the Locator Lab")),
      h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabs)), body);
    draw();
  },
});
