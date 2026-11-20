import { h, copy, store } from "./ui.js";
import { INTRO, FAQ } from "./content.js";

// Guided paths: ordered page ids. Unknown ids are skipped so the home page never breaks if a page is renamed.
const PATHS = [
  { id: "beginner", label: "Manual tester starting automation", blurb: "Learn the building blocks in a sensible order: elements, waits, then a real app.",
    steps: [["inputs", "Fill text boxes and read validation messages"], ["choices", "Tick checkboxes, pick radios, flip switches"], ["dropdowns", "Select from native and custom dropdowns"], ["table-static", "Read and assert table data"], ["dynamic-loading", "Wait for content that appears later"], ["locators", "Practise CSS and XPath in the Locator Lab"], ["auth", "Automate login, register and OTP end to end"], ["api-console", "Send your first API request"]] },
  { id: "playwright", label: "Playwright engineer", blurb: "Locators, auto-waiting, assertions, network control and auth reuse.",
    steps: [["locators", "Solve getByRole, getByText and filter scenarios"], ["locator-cheatsheet", "Keep the Playwright locator and method sheet open"], ["playwright-actionability", "See what auto-wait checks before a click"], ["playwright-assertions", "Use web-first assertions and expect.poll"], ["playwright-fixtures", "Share setup with test and worker scoped fixtures"], ["playwright-network", "Mock, modify and wait for requests"], ["playwright-auth-storage", "Log in once and reuse storage state"], ["playwright-frames-shadow", "Reach into frames and shadow roots"], ["playwright-visual-a11y", "Add screenshot and accessibility checks"]] },
  { id: "selenium", label: "Selenium engineer", blurb: "Explicit waits, tricky elements and a framework you can show in interviews.",
    steps: [["inputs", "Warm up with forms and validation"], ["dropdowns", "Handle Select and custom widgets"], ["frames", "Switch between frames and windows"], ["shadow", "Reach shadow DOM with the right API"], ["dynamic-controls", "Replace sleeps with explicit waits"], ["flaky", "Survive stale elements and flaky responses"], ["frameworks", "Build a Selenium framework with page objects"], ["cicd-builder", "Generate a pipeline for it"]] },
  { id: "api", label: "API tester", blurb: "From a first GET to auth, validation, rate limits and contract checks.",
    steps: [["api-docs", "Read the OpenAPI reference"], ["api-console", "Send requests from the built-in console"], ["api-challenges", "Work through the API test checklist"], ["playwright-api-testing", "Automate the same checks in code"], ["frameworks", "Add API tests, schemas and Newman to a framework"], ["cicd-github-actions", "Run API tests on every pull request"]] },
  { id: "flaky", label: "Flaky test hunter", blurb: "Reproduce the classic causes of unstable tests, then fix each one properly.",
    steps: [["flaky-diagnosis", "Learn the root causes and the fixes"], ["flaky-lab", "Beat overlays, animations and detached elements"], ["flaky-network", "Handle races, retries and failing requests"], ["flaky-state-time", "Control time, ordering and shared state"], ["dynamic-autocomplete", "Fix a type-ahead race condition"], ["dynamic-progress", "Poll jobs instead of sleeping"], ["playwright-clock", "Control the clock instead of waiting"]] },
  { id: "sdet", label: "SDET and framework builder", blurb: "Design, build, run in CI and report on a framework employers can read.",
    steps: [["frameworks", "Follow the 22-step framework roadmap"], ["locators", "Agree on a locator strategy"], ["cicd-pipeline", "Plan stages, gates and flaky policy"], ["cicd-github-actions", "Shard and publish reports in CI"], ["cicd-docker-reports", "Containerise runs and read traces"], ["cicd-builder", "Generate pipelines for other CI tools"], ["playwright-visual-a11y", "Add non-functional checks"]] },
];

const QUICK = () => {
  const o = typeof location !== "undefined" ? location.origin : "https://your-testyard-url";
  return {
    Playwright: ["tests/first.spec.ts", `import { test, expect } from "@playwright/test";

test("TestYard login works", async ({ page }) => {
  await page.goto("${o}/practice/auth");
  await page.getByLabel("Email").fill("practice@testyard.dev");
  await page.getByLabel("Password").fill("SecretPass1!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("profile-name")).toHaveText("Practice User");
});`, `npm init playwright@latest\nnpx playwright test`],
    Selenium: ["test_first.py", `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("${o}/practice/inputs")
WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='page-title']")))
print(driver.title)
driver.quit()`, `pip install selenium\npython test_first.py`],
    Cypress: ["cypress/e2e/first.cy.js", `describe("TestYard", () => {
  it("opens the inputs page", () => {
    cy.visit("${o}/practice/inputs");
    cy.get("[data-testid=page-title]").should("be.visible");
  });
});`, `npm i -D cypress\nnpx cypress open`],
    API: ["terminal", `curl -s ${o}/api/health

curl -s -X POST ${o}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"practice@testyard.dev","password":"SecretPass1!"}'`, `# or open ${o}/practice/api-console`],
  };
};

const TIPS = [
  ["Pick locators in this order", "Role, label, test id, then CSS, then XPath. The Locator Lab scores your choice and shows the stronger alternatives."],
  ["Every control has a test id", "Look for data-testid on all pages. Playwright can use it directly with getByTestId, and Selenium with a CSS attribute selector."],
  ["Run each task twice", "A test that passes once proves little. Re-run on the dynamic and flaky pages, then run in parallel to expose hidden coupling."],
  ["Isolate API data", "Send an X-Sandbox header so your records stay separate from other learners, and so parallel runs never collide."],
  ["Use the sidebar search", "Press / anywhere to jump to the search box, and mark pages as practiced to see your progress grow."],
  ["Read the failure, then fix it", "Turn on trace, screenshots and video for your runner. Debug a failure from the report before you add a wait."],
];

export function home({ pages, groups, done }) {
  const visible = pages.filter((p) => !p.hidden);
  const byId = new Map(visible.map((p) => [p.id, p]));
  const doneCount = visible.filter((p) => done.has(p.id)).length;
  const link = (id, txt, cls = "") => h("a", { class: cls, href: "/practice/" + id }, txt);

  // ---------- hero + quick start
  const q = QUICK(); const tabs = Object.keys(q); let active = tabs[0];
  const codeTitle = h("span", { class: "mono", "data-testid": "qs-file" });
  const codeEl = h("pre", { "data-testid": "qs-code" });
  const runEl = h("pre", { class: "hm-run", "data-testid": "qs-run" });
  const tabBtns = tabs.map((t) => h("button", { type: "button", role: "tab", "data-testid": "qs-tab-" + t.toLowerCase(), onClick: () => { active = t; drawQs(); } }, t));
  const drawQs = () => {
    tabBtns.forEach((b, i) => b.setAttribute("aria-selected", String(tabs[i] === active)));
    const [file, code, run] = q[active]; codeTitle.textContent = file; codeEl.textContent = code; runEl.textContent = run;
  };
  const hero = h("section", { class: "hero hm-hero", "data-testid": "home-hero" },
    h("div", { class: "hm-hero-text" },
      h("div", { class: "eyebrow", text: "Free · open source · no sign-up" }),
      h("h1", {}, "Free QA practice website for ", h("em", { text: "test automation" })),
      h("p", { text: INTRO }),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", "data-testid": "start-how", onClick: () => document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" }) }, "How to use TestYard"),
        h("a", { class: "btn", href: "/practice/locators", "data-testid": "start-locators" }, "Open the Locator Lab"),
        h("a", { class: "btn", href: "/practice/api-docs", "data-testid": "start-api" }, "Explore the API")),
      h("div", { class: "stat" },
        h("div", {}, h("b", { text: String(visible.length), "data-testid": "stat-pages" }), h("span", { text: "practice pages" })),
        h("div", {}, h("b", { text: String(doneCount), "data-testid": "stat-done" }), h("span", { text: "practiced by you" })),
        h("div", {}, h("b", { text: String(groups.length) }), h("span", { text: "categories" })))),
    h("div", { class: "hm-qs", "aria-label": "Quick start" },
      h("div", { class: "hm-qs-head" }, h("b", { text: "Your first test in 60 seconds" }), h("div", { class: "hm-tabs", role: "tablist", "aria-label": "Tool" }, tabBtns)),
      h("div", { class: "hm-qs-file" }, codeTitle, h("button", { class: "btn sm", type: "button", "data-testid": "qs-copy", onClick: () => copy(codeEl.textContent) }, "Copy")),
      codeEl, runEl));
  drawQs();

  // ---------- find a page
  const find = h("input", { type: "search", id: "home-find", placeholder: "What do you want to practise? e.g. iframe, xpath, retry, upload", "aria-label": "Find a practice page", "data-testid": "home-search", autocomplete: "off" });
  const results = h("div", { class: "hm-results", "data-testid": "home-results", "aria-live": "polite" });
  const CHIPS = ["locators", "waits", "forms", "iframe", "shadow", "table", "drag", "upload", "api", "network", "flaky", "ci"];
  const drawResults = () => {
    const needle = find.value.trim().toLowerCase();
    if (!needle) { results.replaceChildren(h("p", { class: "muted", text: `Type a topic or pick a chip. ${visible.length} pages are searchable.` })); return; }
    const words = needle.split(/\s+/);
    const hits = visible.map((p) => { const gt = groups.find((g) => g.id === p.group)?.title || ""; const hay = (p.title + " " + p.blurb + " " + gt + " " + (p.tasks || []).join(" ")).toLowerCase(); return { p, gt, score: words.every((w) => hay.includes(w)) ? words.reduce((a, w) => a + (p.title.toLowerCase().includes(w) ? 3 : 1), 0) : 0 }; }).filter((x) => x.score).sort((a, b) => b.score - a.score).slice(0, 8);
    results.replaceChildren(...(hits.length ? hits.map(({ p, gt }) => h("a", { class: "hm-hit", href: "/practice/" + p.id, "data-testid": "home-hit" }, h("span", { class: "eyebrow", text: gt }), h("b", { text: p.title }), h("span", { class: "muted", text: p.blurb }))) : [h("p", { class: "muted", text: "No page matches that. Try a shorter word." })]));
  };
  find.addEventListener("input", drawResults);
  const finder = h("section", { class: "hm-sec", "data-testid": "home-finder" },
    h("h2", { text: "Find something to practise" }), find,
    h("div", { class: "hm-chips" }, CHIPS.map((c) => h("button", { class: "tag hm-chip", type: "button", "data-testid": "chip-" + c, onClick: () => { find.value = c; drawResults(); find.focus(); } }, c))), results);
  drawResults();

  // ---------- how it works
  const STEPS = [
    ["1", "Pick a page", "Use the sidebar or search above. Pages are grouped from simple elements to full applications."],
    ["2", "Read the practice tasks", "Every page opens with a task list. Each one is a small, checkable automation goal."],
    ["3", "Automate it", "Use the stable test ids, roles and labels. Try the same task in more than one tool or locator style."],
    ["4", "Check yourself", "Compare with the reference solutions where they exist, then mark the page as practiced."],
  ];
  const how = h("section", { class: "hm-sec", id: "how", "data-testid": "home-how" },
    h("h2", { text: "How to use TestYard effectively" }),
    h("div", { class: "hm-steps" }, STEPS.map(([n, t, d]) => h("div", { class: "hm-step" }, h("span", { class: "hm-num", "aria-hidden": "true", text: n }), h("h3", { text: t }), h("p", { class: "muted", text: d })))));

  // ---------- learning paths
  let pathId = store.get("homePath", PATHS[0].id); if (!PATHS.some((p) => p.id === pathId)) pathId = PATHS[0].id;
  const pathTabs = h("div", { class: "hm-path-tabs", role: "tablist", "aria-label": "Learning path" });
  const pathBody = h("div", { class: "hm-path", "data-testid": "path-body" });
  const drawPath = () => {
    const path = PATHS.find((p) => p.id === pathId);
    pathTabs.replaceChildren(...PATHS.map((p) => h("button", { type: "button", role: "tab", "aria-selected": String(p.id === pathId), "data-testid": "path-tab-" + p.id, onClick: () => { pathId = p.id; store.set("homePath", pathId); drawPath(); } }, p.label)));
    const steps = path.steps.filter(([id]) => byId.has(id));
    const n = steps.filter(([id]) => done.has(id)).length;
    const next = steps.find(([id]) => !done.has(id));
    pathBody.replaceChildren(
      h("p", { class: "muted", text: path.blurb }),
      h("div", { class: "row", style: { marginBottom: "10px" } }, h("div", { class: "bar", style: { flex: "1", minWidth: "160px" }, role: "progressbar", "aria-label": "Path progress", "aria-valuenow": String(n), "aria-valuemax": String(steps.length) }, h("i", { style: { width: (steps.length ? (n / steps.length) * 100 : 0) + "%" } })), h("span", { class: "mono", "data-testid": "path-progress", text: `${n} / ${steps.length}` }),
        next ? h("a", { class: "btn primary sm", href: "/practice/" + next[0], "data-testid": "path-next" }, n ? "Continue" : "Start this path") : h("span", { class: "tag ok", text: "Path complete" })),
      h("ol", { class: "hm-steplist" }, steps.map(([id, txt], i) => h("li", { class: done.has(id) ? "on" : "" }, h("a", { href: "/practice/" + id, "data-testid": "path-step-" + id }, h("span", { class: "hm-tick", "aria-hidden": "true", text: done.has(id) ? "✓" : String(i + 1) }), h("span", {}, h("b", { text: byId.get(id).title }), h("span", { class: "muted", text: " · " + txt })))))));
  };
  const paths = h("section", { class: "hm-sec", "data-testid": "home-paths" }, h("h2", { text: "Pick a learning path" }), h("p", { class: "muted", text: "Each path is an ordered set of pages. Progress comes from the pages you mark as practiced." }), pathTabs, pathBody);
  drawPath();

  // ---------- featured
  const FEATURED = [
    ["locators", "Locator Lab", "95+ scenarios", "One textbox for CSS, XPath, axes and every Playwright built-in locator, with live match checking."],
    ["flaky-lab", "Flaky test lab", "Reproduce, then fix", "Overlays, animations, races and detached elements that make real suites unstable."],
    ["cicd-builder", "Pipeline builder", "CI/CD in minutes", "Generate GitHub Actions, GitLab CI or Jenkins files for Playwright, Selenium, Cypress and Newman."],
    ["frameworks", "Framework roadmap", "22 steps", "Starters for Playwright, Selenium, Cypress, API and BDD, plus a maturity checklist."],
  ].filter(([id]) => byId.has(id));
  const featured = h("section", { class: "hm-sec", "data-testid": "home-featured" }, h("h2", { text: "Start with the standouts" }),
    h("div", { class: "hm-feat" }, FEATURED.map(([id, t, tag, d]) => h("a", { class: "hm-feat-card", href: "/practice/" + id, "data-testid": "feat-" + id }, h("span", { class: "tag info", text: tag }), h("h3", { text: t }), h("p", { class: "muted", text: d }), h("span", { class: "hm-go", "aria-hidden": "true", text: "Open →" })))));

  // ---------- categories
  const cats = h("section", { class: "hm-sec", "data-testid": "home-categories" }, h("h2", { text: "Everything you can practise" }),
    h("div", { class: "cards" }, groups.map((g) => {
      const list = visible.filter((p) => p.group === g.id);
      if (!list.length) return null;
      const n = list.filter((p) => done.has(p.id)).length;
      return h("a", { class: "card", href: "/practice/" + list[0].id, "data-testid": "card-" + g.id },
        h("h3", { text: g.title }), h("p", { text: g.blurb }),
        h("div", { class: "bar", role: "progressbar", "aria-valuenow": String(n), "aria-valuemax": String(list.length) }, h("i", { style: { width: (list.length ? (n / list.length) * 100 : 0) + "%" } })),
        h("small", { class: "muted", text: `${n} / ${list.length} practiced` }));
    })));

  // ---------- tips
  const tips = h("section", { class: "hm-sec", "data-testid": "home-tips" }, h("h2", { text: "Practice habits that pay off" }),
    h("div", { class: "hm-tips" }, TIPS.map(([t, d]) => h("div", { class: "hm-tip" }, h("h3", { text: t }), h("p", { class: "muted", text: d })))));

  // ---------- faq
  const faq = h("section", { class: "hm-sec", "data-testid": "home-faq" }, h("h2", { text: "Frequently asked questions" }),
    FAQ.map(([qn, a]) => h("details", { class: "hm-faq" }, h("summary", { text: qn }), h("p", { class: "muted", text: a }))));

  return h("div", { "data-testid": "page-home" }, hero, finder, how, paths, featured, cats, tips, faq, h("p", { class: "muted", style: { marginTop: "30px" } }, "Source code and issues: ", h("a", { href: "https://github.com/Pranavchvn7/testyard", target: "_blank", rel: "noopener", text: "github.com/Pranavchvn7/testyard" })));
}
