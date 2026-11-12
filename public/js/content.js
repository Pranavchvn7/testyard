// Copy shared by the browser app and the server-side renderer (so crawlers and users read the same text).
export const SITE_NAME = "TestYard";

export const INTRO =
  "TestYard is a free QA practice website where testers practise test automation on realistic web elements, tricky timing problems, demo applications and a sandboxed REST API. " +
  "Use it with Selenium, Playwright, Cypress, WebdriverIO, Puppeteer, Postman, REST Assured or any other tool. It is open source, needs no sign-up and every control has a stable test id.";

export const FAQ = [
  ["What is a QA practice website?", "A QA practice website is a safe site built for testers to practise on. Its pages and APIs are stable and public, so you can automate or manually test them without touching a real product."],
  ["Is TestYard free?", "Yes. TestYard is open source under the MIT licence. There is no sign-up, no paywall and no advertising."],
  ["Which automation tools can I use?", "Any of them. Selenium in every language, Playwright, Cypress, WebdriverIO, TestCafe and Puppeteer for UI tests, and Postman, Insomnia, Bruno, REST Assured or Python requests for API tests."],
  ["Can I practise API testing?", "Yes. The API lab has a real REST API with an OpenAPI document. It covers CRUD, pagination, bearer-token authentication, one-time passwords, validation errors, rate limiting, redirects, delays, flaky responses and file upload and download. Each visitor gets an isolated data sandbox."],
  ["What can I practise on the web pages?", "Forms and validation, dropdowns, date pickers, drag and drop, iframes, shadow DOM, dynamic waits, data tables, locators and XPath, and complete demo apps such as login, a notes app, an online shop and a flight booking wizard."],
  ["Where should a beginner start?", "Start with Text inputs and forms, then Dropdowns, Static table and Dynamic loading. Move on to the Login app and finish with the API request console."],
  ["Can I host TestYard myself?", "Yes. Clone the repository and run npm start, or use the included Dockerfile. It has no dependencies and no build step."],
];

// Short phrase per group, used in <title> tags.
export const GROUP_SUFFIX = {
  elements: "Selenium & Playwright",
  tables: "Table Testing",
  dynamic: "Waits & Flaky Tests",
  dom: "Locators & XPath",
  apps: "E2E Test Practice",
  api: "API Testing",
  learn: "Automation Framework",
  tools: "QA Tools",
};

export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
export const HOME_TITLE = `Free QA Practice Website for Test Automation | ${SITE_NAME}`;
export const homeDescription = (count) => clip(`${SITE_NAME} is a free QA practice website with ${count} pages to practise Selenium, Playwright and Cypress automation, plus a sandboxed REST API for API testing. No sign-up.`, 160);
export const pageTitle = (p) => clip(`${p.title} Practice – ${GROUP_SUFFIX[p.group] || "QA"} | ${SITE_NAME}`, 70);
export const pageDescription = (p) => clip(`${p.blurb} Free practice page with ready-made test tasks for Selenium, Playwright and Cypress.`, 160);
