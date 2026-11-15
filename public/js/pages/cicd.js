import { page } from "../registry.js";
import { h, copy, stage, store } from "../ui.js";

const code = (title, text) => h("div", { style: { marginBottom: "14px" } },
  h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "6px" } }, h("b", { class: "mono", text: title }), h("button", { class: "btn sm", type: "button", "data-testid": "copy-snippet", onClick: () => copy(text) }, "Copy")), h("pre", { text }));
const list = (items) => h("ul", { style: { paddingLeft: "20px", margin: "0 0 12px" } }, items.map((t) => h("li", { style: { marginBottom: "5px" } }, Array.isArray(t) ? [h("b", { text: t[0] + ": " }), t[1]] : t)));

// ================================================================= concepts
page({
  id: "cicd-pipeline", group: "learn", title: "CI/CD for test automation",
  blurb: "Stages, quality gates, sharding, caching, artifacts, flaky quarantine and the checklist for a trustworthy pipeline.",
  tasks: [
    "Draw your pipeline: build, unit, API, smoke, regression, deploy, post-deploy checks.",
    "Decide which tests block a pull request and which run nightly. Write the rule down.",
    "Add a smoke tag and run only that subset on every commit.",
    "Define your flaky policy: how many retries, who fixes, how long before deletion.",
    "List every secret the pipeline needs and where each one is stored.",
  ],
  render(root) {
    const STAGES = [
      ["Commit stage (under 5 min)", "Lint, type check, unit tests, static analysis. Fails fast, runs on every push."],
      ["Build & package", "Build once, version the artifact or image, and test exactly that artifact everywhere after."],
      ["Deploy to ephemeral test env", "Spin up the app per pull request (Docker Compose, preview environment) so tests never fight over shared data."],
      ["API & contract tests (1 to 10 min)", "Fast, stable, and they find most backend regressions before the UI is involved."],
      ["UI smoke (under 10 min)", "A handful of critical journeys: login, search, checkout. Blocks the merge."],
      ["UI regression (parallel, sharded)", "The full suite split across machines. Runs on merge to main or nightly if too long for each PR."],
      ["Quality gates", "Pass rate, no new flaky tests, coverage threshold, accessibility and visual diff budget, performance budget."],
      ["Publish & notify", "HTML/Allure/JUnit report, traces and videos for failures, a chat message with a link, a dashboard trend."],
    ];
    const open = (title, body) => h("details", { class: "tasks", style: { marginBottom: "10px" } }, h("summary", { text: title }), h("div", { style: { padding: "0 0 12px" } }, body));
    const CHECK = [
      "Pipeline is defined as code and reviewed like application code",
      "Every run starts from a clean checkout and a clean environment",
      "Dependencies and browsers are cached with a lockfile-based key",
      "Test data is created per run (unique ids, X-Sandbox style isolation)",
      "Secrets live in the CI secret store, never in the repo or logs",
      "Tests run in parallel and are independent (no order coupling)",
      "Failures publish a report, screenshot, video and trace as artifacts",
      "Retries are limited (0 locally, 1 or 2 in CI) and every retry is reported as flaky",
      "A quarantine tag exists and quarantined tests still run but do not block",
      "Smoke runs on every PR, regression on merge, full cross-browser nightly",
      "Branch protection requires the pipeline to be green before merge",
      "Build time and flake rate are tracked and reviewed weekly",
      "Reports are linkable from the pull request and from chat",
      "Scheduled runs catch environment drift and third-party changes",
    ];
    const saved = new Set(store.get("cicd.check", []));
    const prog = h("p", { class: "mono", "data-testid": "cicd-progress" });
    const draw = () => { prog.textContent = `${saved.size} of ${CHECK.length} in place`; };
    const boxes = CHECK.map((t, i) => {
      const cb = h("input", { type: "checkbox", id: "cicd-chk-" + i, "data-testid": "cicd-chk-" + i }); cb.checked = saved.has(i);
      cb.addEventListener("change", () => { cb.checked ? saved.add(i) : saved.delete(i); store.set("cicd.check", [...saved]); draw(); });
      return h("label", { class: "check", for: "cicd-chk-" + i }, cb, t);
    });
    draw();
    root.append(
      stage(h("h2", { text: "A pipeline, stage by stage" }), h("ol", { "data-testid": "cicd-stages", style: { paddingLeft: "20px" } }, STAGES.map(([t, d]) => h("li", { style: { marginBottom: "8px" } }, h("b", { text: t + ". " }), h("span", { class: "muted", text: d }))))),
      stage(h("h2", { text: "Decisions you must make" }),
        open("Which tests run when?", list([["Every commit", "unit + lint + API contract + 5 to 10 UI smoke tests."], ["Pull request", "smoke + the regression subset touched by the change (tags or path filters)."], ["Merge to main", "full regression on Chromium, sharded."], ["Nightly", "full regression on Chromium, Firefox and WebKit, plus visual and accessibility suites."], ["Post-deploy", "a tiny read-only smoke run against the real environment."]])),
        open("Retries and flaky tests", list([["Retries are a diagnostic, not a fix", "a test that passes on retry is reported as flaky and must be ticketed."], ["Quarantine", "tag @quarantine, run in a separate non-blocking job, and set an expiry date."], ["Metrics", "flake rate = tests that needed a retry / total. Aim for under 1%."], ["Root causes", "shared data, fixed sleeps, animations, unmocked third parties, order dependence, time and timezone."]])),
        open("Speed: parallelism and sharding", list([["Workers", "parallel inside one machine (Playwright workers, pytest-xdist, TestNG parallel)."], ["Shards", "split across machines: npx playwright test --shard=1/4. Merge blob reports afterwards."], ["Caching", "cache node_modules or the pip cache, and the browsers folder, keyed by the lockfile hash."], ["Containers", "use the official Playwright image so browser and system dependencies match locally and in CI."]])),
        open("Environments, data and secrets", list([["Ephemeral per PR", "start the app in the job (services, docker compose) or deploy a preview URL."], ["Test data", "create it through the API at the start of each test; never depend on rows someone else made."], ["Secrets", "store tokens in the CI secret store and expose as environment variables; mask them in logs."], ["Config", "BASE_URL and credentials come from environment variables, not constants."]])),
        open("Reports and notifications", list([["HTML report", "upload as an artifact or publish to GitHub Pages."], ["JUnit XML", "feeds the CI test summary and trend graphs."], ["Traces & videos", "keep them for failed tests only (retain-on-failure) to save space."], ["Chat", "post pass/fail with the run link, the failing test names and the flake count."]]))),
      stage(h("h2", { text: "Pipeline health checklist" }), prog, h("div", { class: "grid g2" }, boxes)),
      stage(h("h2", { text: "Where to go next" }), h("div", { class: "row" },
        h("a", { class: "btn", href: "/practice/cicd-github-actions", "data-testid": "to-gha" }, "GitHub Actions workflows"),
        h("a", { class: "btn", href: "/practice/cicd-other-providers", "data-testid": "to-other" }, "Jenkins, GitLab, Azure & more"),
        h("a", { class: "btn", href: "/practice/cicd-docker-reports", "data-testid": "to-docker" }, "Docker & reports"),
        h("a", { class: "btn primary", href: "/practice/cicd-builder", "data-testid": "to-builder" }, "Pipeline builder"))));
  },
});

// ================================================================= GitHub Actions
const GHA = {
  pr: `# .github/workflows/e2e.yml: pull request run, sharded, with a merged report
name: e2e
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: e2e-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/cache@v4
        id: pw-cache
        with:
          path: ~/.cache/ms-playwright
          key: pw-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
        if: steps.pw-cache.outputs.cache-hit != 'true'
      - run: npx playwright install-deps chromium
        if: steps.pw-cache.outputs.cache-hit == 'true'
      - run: npx playwright test --shard=\${{ matrix.shard }}/4 --reporter=blob
        env:
          BASE_URL: \${{ vars.BASE_URL }}
          TEST_PASSWORD: \${{ secrets.TEST_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: \${{ !cancelled() }}
        with:
          name: blob-report-\${{ matrix.shard }}
          path: blob-report
          retention-days: 3

  merge-reports:
    if: \${{ !cancelled() }}
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with: { name: html-report, path: playwright-report, retention-days: 14 }`,
  nightly: `# .github/workflows/nightly.yml: full cross-browser run every night
name: nightly
on:
  schedule:
    - cron: "30 21 * * *"   # 03:00 IST; GitHub cron is always UTC
  workflow_dispatch:
    inputs:
      grep:
        description: "Only run tests matching this tag"
        required: false
        default: ""

jobs:
  regression:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.49.0-noble
      options: --ipc=host
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright test --project=\${{ matrix.project }} --grep "\${{ inputs.grep }}"
        env:
          BASE_URL: \${{ vars.BASE_URL }}
          HOME: /root
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: report-\${{ matrix.project }}
          path: |
            playwright-report
            test-results
          retention-days: 7`,
  reusable: `# .github/workflows/reusable-e2e.yml: one definition, many callers
name: reusable-e2e
on:
  workflow_call:
    inputs:
      base-url: { type: string, required: true }
      project:  { type: string, default: chromium }
    secrets:
      test-password: { required: false }

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npx playwright install --with-deps \${{ inputs.project }}
      - run: npx playwright test --project=\${{ inputs.project }}
        env:
          BASE_URL: \${{ inputs.base-url }}
          TEST_PASSWORD: \${{ secrets.test-password }}

# caller, e.g. .github/workflows/staging.yml
# jobs:
#   staging:
#     uses: ./.github/workflows/reusable-e2e.yml
#     with: { base-url: "https://staging.example.com" }
#     secrets: inherit`,
  pages: `# publish the HTML report to GitHub Pages after the main branch run
  publish-report:
    needs: merge-reports
    if: github.ref == 'refs/heads/main' && !cancelled()
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with: { name: html-report, path: report }
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: report
          destination_dir: reports/\${{ github.run_number }}
          keep_files: true`,
  selenium: `# Selenium Grid as a service container, pytest on the runner
jobs:
  selenium:
    runs-on: ubuntu-latest
    services:
      selenium:
        image: selenium/standalone-chrome:latest
        ports: ["4444:4444"]
        options: --shm-size=2g
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }
      - run: pip install -r requirements.txt
      - run: |
          for i in $(seq 1 30); do curl -sf http://localhost:4444/status | grep -q '"ready": true' && break; sleep 2; done
      - run: pytest -n 4 --base-url "$BASE_URL" --remote-url http://localhost:4444 --junitxml=results.xml --html=report.html --self-contained-html
        env: { BASE_URL: "\${{ vars.BASE_URL }}" }
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: selenium-report, path: "results.xml\\nreport.html" }`,
  api: `# API tests with Newman (Postman CLI) and the TestYard OpenAPI/Postman files
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm i -g newman newman-reporter-htmlextra
      - run: |
          newman run collection.json \\
            --env-var baseUrl=\${{ vars.BASE_URL }} \\
            --env-var sandbox=ci-\${{ github.run_id }} \\
            -r cli,htmlextra,junit --reporter-htmlextra-export newman/report.html --reporter-junit-export newman/junit.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: newman, path: newman }`,
  notify: `# Slack message on failure (set the SLACK_WEBHOOK_URL secret)
  notify:
    needs: [test]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST -H 'Content-type: application/json' \\
            --data "{\\"text\\":\\"E2E failed on \${{ github.ref_name }}: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}\\"}" \\
            "\${{ secrets.SLACK_WEBHOOK_URL }}"`,
  badge: `<!-- README.md: status badge -->
[![e2e](https://github.com/OWNER/REPO/actions/workflows/e2e.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/e2e.yml)`,
};
page({
  id: "cicd-github-actions", group: "learn", title: "GitHub Actions workflows",
  blurb: "Copy-paste workflows: sharded PR runs, nightly cross-browser, reusable jobs, Selenium Grid, Newman and Pages reports.",
  tasks: [
    "Add the PR workflow to your repo and make it required in branch protection.",
    "Run it with 4 shards and confirm the merged HTML report contains every test.",
    "Add the nightly workflow and trigger it manually with workflow_dispatch.",
    "Publish the report to GitHub Pages and add the status badge to your README.",
    "Break a test on purpose and download the trace from the failed run.",
  ],
  render(root) {
    const sets = [["PR run (sharded)", GHA.pr], ["Nightly cross-browser", GHA.nightly], ["Reusable workflow", GHA.reusable], ["Publish report to Pages", GHA.pages], ["Selenium Grid service", GHA.selenium], ["API tests with Newman", GHA.api], ["Slack notification", GHA.notify], ["Status badge", GHA.badge]];
    root.append(
      stage(h("p", { class: "muted", html: "Ready-to-run copies live in the repository under <code>frameworks/playwright/.github-workflow-examples</code> and <code>frameworks/cicd/github-actions</code>. Replace <code>vars.BASE_URL</code> with your own TestYard URL (a repository variable) and run." })),
      ...sets.map(([t, c]) => stage(code(t, c))));
  },
});

// ================================================================= other providers
const OTHER = {
  jenkins: `// Jenkinsfile (declarative): Docker agent, parallel shards, JUnit and HTML report
pipeline {
  agent { docker { image 'mcr.microsoft.com/playwright:v1.49.0-noble'; args '--ipc=host' } }
  options { timestamps(); timeout(time: 30, unit: 'MINUTES') }
  environment { BASE_URL = credentials('testyard-base-url') }
  stages {
    stage('Install') { steps { sh 'npm ci' } }
    stage('E2E') {
      parallel {
        stage('Shard 1') { steps { sh 'npx playwright test --shard=1/3 --reporter=junit,html' } }
        stage('Shard 2') { steps { sh 'npx playwright test --shard=2/3 --reporter=junit,html' } }
        stage('Shard 3') { steps { sh 'npx playwright test --shard=3/3 --reporter=junit,html' } }
      }
    }
  }
  post {
    always {
      junit 'results/*.xml'
      publishHTML(target: [reportDir: 'playwright-report', reportFiles: 'index.html', reportName: 'Playwright report', keepAll: true])
      archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
    }
    failure { echo "E2E failed: \${env.BUILD_URL}" }
  }
}`,
  gitlab: `# .gitlab-ci.yml: Playwright image, parallel shards, JUnit report in the merge request
stages: [test]
e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.49.0-noble
  parallel: 4
  variables:
    BASE_URL: "https://your-testyard.example.com"
  cache:
    key: { files: [package-lock.json] }
    paths: [node_modules/]
  script:
    - npm ci
    - npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL --reporter=junit,html
  artifacts:
    when: always
    expire_in: 7 days
    paths: [playwright-report/, test-results/]
    reports:
      junit: results/junit.xml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`,
  azure: `# azure-pipelines.yml
trigger: [main]
pr: [main]
pool: { vmImage: ubuntu-latest }
strategy:
  matrix:
    chromium: { project: chromium }
    firefox:  { project: firefox }
steps:
  - task: NodeTool@0
    inputs: { versionSpec: "22.x" }
  - script: npm ci
    displayName: Install
  - script: npx playwright install --with-deps $(project)
    displayName: Browsers
  - script: npx playwright test --project=$(project) --reporter=junit
    displayName: Run tests
    env: { BASE_URL: $(BASE_URL), PLAYWRIGHT_JUNIT_OUTPUT_NAME: results.xml }
  - task: PublishTestResults@2
    condition: succeededOrFailed()
    inputs: { testResultsFormat: JUnit, testResultsFiles: results.xml }
  - task: PublishPipelineArtifact@1
    condition: succeededOrFailed()
    inputs: { targetPath: playwright-report, artifact: report-$(project) }`,
  circle: `# .circleci/config.yml
version: 2.1
jobs:
  e2e:
    docker:
      - image: mcr.microsoft.com/playwright:v1.49.0-noble
    parallelism: 4
    steps:
      - checkout
      - restore_cache: { keys: [deps-{{ checksum "package-lock.json" }}] }
      - run: npm ci
      - save_cache: { key: deps-{{ checksum "package-lock.json" }}, paths: [node_modules] }
      - run:
          name: Run this container's share of the tests
          command: |
            SPECS=$(circleci tests glob "tests/**/*.spec.ts" | circleci tests split --split-by=timings)
            npx playwright test $SPECS --reporter=junit
      - store_test_results: { path: results }
      - store_artifacts: { path: playwright-report }
workflows:
  main: { jobs: [e2e] }`,
  bitbucket: `# bitbucket-pipelines.yml
image: mcr.microsoft.com/playwright:v1.49.0-noble
pipelines:
  pull-requests:
    '**':
      - step:
          name: E2E
          caches: [node]
          script:
            - npm ci
            - npx playwright test --reporter=junit,html
          artifacts: [playwright-report/**, test-results/**]
  custom:
    nightly:
      - step:
          name: Nightly regression
          script: [npm ci, npx playwright test]`,
};
page({
  id: "cicd-other-providers", group: "learn", title: "Jenkins, GitLab & Azure",
  blurb: "Jenkinsfile, GitLab CI, Azure Pipelines, CircleCI and Bitbucket pipelines for browser tests.",
  tasks: [
    "Translate the GitHub Actions PR workflow to your company's CI tool using these examples.",
    "Find the equivalent of a matrix, a cache and an artifact in each provider.",
    "Wire the JUnit report into the CI test summary and confirm failures show names.",
    "Add a manual or scheduled trigger to run the full regression.",
  ],
  render(root) {
    root.append(stage(h("p", { class: "muted", html: "Runnable copies are under <code>frameworks/cicd</code> (Jenkinsfile, gitlab-ci.yml, azure-pipelines.yml, circleci-config.yml, bitbucket-pipelines.yml)." })),
      ...[["Jenkins", OTHER.jenkins], ["GitLab CI", OTHER.gitlab], ["Azure Pipelines", OTHER.azure], ["CircleCI", OTHER.circle], ["Bitbucket Pipelines", OTHER.bitbucket]].map(([t, c]) => stage(code(t, c))));
  },
});

// ================================================================= docker + reports
const DOCKER = {
  file: `# Dockerfile.tests: tests and browsers in one image (matches CI exactly)
FROM mcr.microsoft.com/playwright:v1.49.0-noble
WORKDIR /work
COPY package*.json ./
RUN npm ci
COPY . .
ENV CI=1
CMD ["npx", "playwright", "test"]`,
  compose: `# docker-compose.yml: app under test + test runner (+ Selenium Grid for Selenium suites)
services:
  app:
    build: .
    environment: { PORT: "3000" }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 3s
      retries: 20
  tests:
    build: { context: ., dockerfile: Dockerfile.tests }
    depends_on: { app: { condition: service_healthy } }
    environment: { BASE_URL: "http://app:3000" }
    volumes: ["./playwright-report:/work/playwright-report", "./test-results:/work/test-results"]
  selenium:
    image: selenium/standalone-chrome:latest
    shm_size: 2g
    ports: ["4444:4444", "7900:7900"]   # 7900 = live noVNC view
    profiles: ["selenium"]`,
  reporters: `// playwright.config.ts: reporters for every audience
reporter: [
  ["list"],                                         // developers, local terminal
  ["html", { open: "never" }],                      // humans: screenshots, traces
  ["junit", { outputFile: "results/junit.xml" }],   // CI test summary and trends
  ["json", { outputFile: "results/results.json" }], // custom dashboards
  ["blob"],                                         // merge sharded runs
  ["github"],                                       // inline annotations on pull requests
],
use: {
  trace: "retain-on-failure",   // keep traces only for failures
  video: "retain-on-failure",
  screenshot: "only-on-failure",
},`,
  allure: `# Allure with pytest (Selenium) or Playwright
pip install allure-pytest        # or: npm i -D allure-playwright
pytest --alluredir=allure-results
allure generate allure-results --clean -o allure-report
allure open allure-report        # history trend needs the previous allure-report/history folder`,
  trace: `# Debug a CI failure locally
npx playwright show-trace test-results/login-chromium/trace.zip
npx playwright show-report playwright-report
# or drag the trace.zip onto https://trace.playwright.dev (runs entirely in your browser)`,
  metrics: `// flake and duration metrics from results.json (Node)
import fs from "node:fs";
const r = JSON.parse(fs.readFileSync("results/results.json", "utf8"));
const specs = r.suites.flatMap(function walk(s) { return [...s.specs, ...(s.suites || []).flatMap(walk)]; });
const flaky = specs.filter((s) => s.tests.some((t) => t.results.length > 1 && t.results.at(-1).status === "passed"));
process.stdout.write(\`tests=\${specs.length} flaky=\${flaky.length} rate=\${((flaky.length / specs.length) * 100).toFixed(1)}%\\n\`);
for (const f of flaky) process.stdout.write("  flaky: " + f.title + "\\n");`,
};
page({
  id: "cicd-docker-reports", group: "learn", title: "Docker & reports",
  blurb: "Run tests in containers, wire up HTML, JUnit and Allure reports, read traces and track flake rate.",
  tasks: [
    "Build the test image and run the whole suite with docker compose up --abort-on-container-exit.",
    "Run the Selenium suite against the Grid and watch it live on port 7900.",
    "Open a failed run's trace and find the failing action and the network call.",
    "Run the metrics script and list your flaky tests.",
    "Generate an Allure report and compare it with the Playwright HTML report.",
  ],
  render(root) {
    root.append(stage(h("p", { class: "muted", html: "Ready files: <code>frameworks/cicd/Dockerfile.tests</code> and <code>frameworks/cicd/docker-compose.yml</code>." })),
      ...[["Test image", DOCKER.file], ["Docker Compose", DOCKER.compose], ["Reporters", DOCKER.reporters], ["Allure", DOCKER.allure], ["Open traces", DOCKER.trace], ["Flake metrics", DOCKER.metrics]].map(([t, c]) => stage(code(t, c))));
  },
});

// ================================================================= pipeline builder
const FRAMEWORKS = {
  playwright: { label: "Playwright (Node)", setup: ["npm ci"], browsers: (b) => `npx playwright install --with-deps ${b.join(" ")}`, run: (o) => `npx playwright test${o.projects.map((p) => " --project=" + p).join("")}${o.shard ? " --shard=SHARD" : ""}`, artifacts: ["playwright-report", "test-results"], image: "mcr.microsoft.com/playwright:v1.49.0-noble", lang: "node" },
  cypress: { label: "Cypress", setup: ["npm ci"], browsers: () => "npx cypress install", run: (o) => `npx cypress run --browser ${o.browsers.includes("firefox") ? "firefox" : "chrome"}`, artifacts: ["cypress/screenshots", "cypress/videos"], image: "cypress/browsers:node-22.11.0-chrome-130.0.6723.69-1-ff-132.0.1-edge-130.0.2849.52-1", lang: "node" },
  "selenium-python": { label: "Selenium (Python, pytest)", setup: ["pip install -r requirements.txt"], browsers: () => "", run: (o) => `pytest -n 4 --base-url "$BASE_URL" --junitxml=results/junit.xml --html=report.html --self-contained-html`, artifacts: ["results", "report.html"], image: "python:3.12", lang: "python" },
  "selenium-java": { label: "Selenium (Java, Maven, TestNG)", setup: [], browsers: () => "", run: () => `mvn -B test -DbaseUrl="$BASE_URL" -Dheadless=true`, artifacts: ["target/surefire-reports"], image: "maven:3.9-eclipse-temurin-21", lang: "java" },
  newman: { label: "API tests (Newman)", setup: ["npm i -g newman newman-reporter-htmlextra"], browsers: () => "", run: () => `newman run collection.json --env-var baseUrl="$BASE_URL" -r cli,htmlextra,junit --reporter-htmlextra-export newman/report.html --reporter-junit-export newman/junit.xml`, artifacts: ["newman"], image: "postman/newman:alpine", lang: "node" },
};
const q = (s) => (/[:#{}\[\],&*!|>'"%@`]/.test(s) ? JSON.stringify(s) : s);
function genGithub(o, f) {
  const nodeLike = f.lang === "node", shards = o.shard ? Array.from({ length: o.shards }, (_, i) => i + 1) : null;
  const on = [];
  if (o.triggers.includes("pr")) on.push("  pull_request:");
  if (o.triggers.includes("push")) on.push("  push:\n    branches: [main]");
  if (o.triggers.includes("nightly")) on.push('  schedule:\n    - cron: "30 21 * * *"');
  if (o.triggers.includes("manual")) on.push("  workflow_dispatch:");
  const steps = ["      - uses: actions/checkout@v4"];
  if (nodeLike) steps.push("      - uses: actions/setup-node@v4\n        with: { node-version: 22, cache: npm }");
  if (f.lang === "python") steps.push('      - uses: actions/setup-python@v5\n        with: { python-version: "3.12", cache: pip }');
  if (f.lang === "java") steps.push("      - uses: actions/setup-java@v4\n        with: { distribution: temurin, java-version: 21, cache: maven }");
  f.setup.forEach((s) => steps.push("      - run: " + s));
  const br = f.browsers(o.browsers); if (br) steps.push("      - run: " + br);
  let run = f.run(o);
  if (shards) run = run.replace("SHARD", "${{ matrix.shard }}/" + o.shards);
  steps.push(`      - run: ${q(run)}\n        env:\n          BASE_URL: \${{ vars.BASE_URL }}`);
  steps.push(`      - uses: actions/upload-artifact@v4\n        if: \${{ !cancelled() }}\n        with:\n          name: report${shards ? "-\${{ matrix.shard }}" : ""}\n          path: |\n${f.artifacts.map((a) => "            " + a).join("\n")}\n          retention-days: 7`);
  const matrix = shards ? `    strategy:\n      fail-fast: false\n      matrix:\n        shard: [${shards.join(", ")}]\n` : "";
  return `name: e2e\non:\n${on.join("\n") || "  workflow_dispatch:"}\n\nconcurrency:\n  group: e2e-\${{ github.ref }}\n  cancel-in-progress: true\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30\n${matrix}    steps:\n${steps.join("\n")}\n`;
}
function genGitlab(o, f) {
  const rules = [];
  if (o.triggers.includes("pr")) rules.push("    - if: $CI_PIPELINE_SOURCE == \"merge_request_event\"");
  if (o.triggers.includes("push")) rules.push("    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH");
  if (o.triggers.includes("nightly")) rules.push('    - if: $CI_PIPELINE_SOURCE == "schedule"');
  if (o.triggers.includes("manual")) rules.push("    - when: manual");
  let run = f.run(o); if (o.shard) run = run.replace("SHARD", "$CI_NODE_INDEX/$CI_NODE_TOTAL");
  const script = [...f.setup, f.browsers(o.browsers), run].filter(Boolean).map((s) => "    - " + q(s)).join("\n");
  return `stages: [test]\n\ne2e:\n  stage: test\n  image: ${f.image}\n${o.shard ? `  parallel: ${o.shards}\n` : ""}  variables:\n    BASE_URL: "https://your-testyard.example.com"\n  script:\n${script}\n  artifacts:\n    when: always\n    expire_in: 7 days\n    paths:\n${f.artifacts.map((a) => "      - " + a).join("\n")}\n${rules.length ? "  rules:\n" + rules.join("\n") + "\n" : ""}`;
}
function genJenkins(o, f) {
  const trig = [o.triggers.includes("nightly") ? "    cron('H 21 * * *')" : "", o.triggers.includes("push") || o.triggers.includes("pr") ? "    pollSCM('H/5 * * * *')" : ""].filter(Boolean);
  const stagesRun = o.shard ? Array.from({ length: o.shards }, (_, i) => `        stage('Shard ${i + 1}') { steps { sh '${f.run(o).replace("SHARD", `${i + 1}/${o.shards}`)}' } }`).join("\n") : `        stage('Tests') { steps { sh '${f.run(o)}' } }`;
  const pre = [...f.setup, f.browsers(o.browsers)].filter(Boolean).map((s) => `sh '${s}'`).join("; ");
  return `pipeline {\n  agent { docker { image '${f.image}' } }\n  options { timestamps(); timeout(time: 30, unit: 'MINUTES') }\n${trig.length ? "  triggers {\n" + trig.join("\n") + "\n  }\n" : ""}  environment { BASE_URL = credentials('testyard-base-url') }\n  stages {\n    stage('Install') { steps { ${pre || "echo 'nothing to install'"} } }\n    stage('Test') {\n      parallel {\n${stagesRun}\n      }\n    }\n  }\n  post {\n    always {\n      archiveArtifacts artifacts: '${f.artifacts.map((a) => (a.includes(".") ? a : a + "/**")).join(",")}', allowEmptyArchive: true\n    }\n  }\n}\n`;
}
const PROVIDERS = { "GitHub Actions": genGithub, "GitLab CI": genGitlab, Jenkins: genJenkins };
page({
  id: "cicd-builder", group: "learn", title: "Pipeline builder",
  blurb: "Pick a CI provider, framework, browsers, sharding and triggers and get a ready-to-edit pipeline file.",
  tasks: [
    "Generate a GitHub Actions file for Playwright with 3 shards and run it in your repo.",
    "Switch the provider to GitLab CI and compare how parallelism is expressed.",
    "Generate the Jenkins version and explain how the parallel stages map to shards.",
    "Change the framework to Selenium (Python) and note what is no longer needed.",
    "Remove the pull request trigger and add nightly: which jobs would run when?",
  ],
  render(root) {
    const sel = (id, label, opts) => h("div", { class: "field" }, h("label", { for: id, text: label }), h("select", { id, "data-testid": id }, opts.map(([v, t]) => h("option", { value: v, text: t }))));
    const prov = sel("pb-provider", "CI provider", Object.keys(PROVIDERS).map((k) => [k, k]));
    const fw = sel("pb-framework", "Test framework", Object.entries(FRAMEWORKS).map(([k, v]) => [k, v.label]));
    const checks = (name, items) => h("fieldset", { style: { border: "1px solid var(--line)", borderRadius: "9px", padding: "8px 12px", marginBottom: "14px" }, "data-testid": "pb-" + name }, h("legend", { text: name === "triggers" ? "Triggers" : "Browsers" }), items.map(([v, t, on]) => h("label", { class: "check" }, h("input", { type: "checkbox", value: v, name, checked: on || null, "data-testid": `pb-${name}-${v}` }), t)));
    const provSel = prov.querySelector("select"), fwSel = fw.querySelector("select");
    const trig = checks("triggers", [["pr", "Pull request", true], ["push", "Push to main", true], ["nightly", "Nightly schedule", false], ["manual", "Manual run", false]]);
    const brw = checks("browsers", [["chromium", "Chromium", true], ["firefox", "Firefox", false], ["webkit", "WebKit", false]]);
    const shard = h("input", { type: "checkbox", id: "pb-shard", "data-testid": "pb-shard" });
    const shards = h("input", { type: "number", min: "2", max: "8", value: "3", id: "pb-shards", "data-testid": "pb-shards", "aria-label": "Number of shards", style: { width: "90px" } });
    const out = h("pre", { "data-testid": "pb-output", style: { maxHeight: "560px" } });
    const label = h("b", { class: "mono", "data-testid": "pb-filename" });
    const names = { "GitHub Actions": ".github/workflows/e2e.yml", "GitLab CI": ".gitlab-ci.yml", Jenkins: "Jenkinsfile" };
    const vals = (root2) => [...root2.querySelectorAll("input:checked")].map((i) => i.value);
    const draw = () => {
      const f = FRAMEWORKS[fwSel.value];
      const bs = vals(brw), opts = { triggers: vals(trig), browsers: bs.length ? bs : ["chromium"], shard: shard.checked, shards: Math.min(8, Math.max(2, +shards.value || 3)) };
      opts.projects = fwSel.value === "playwright" ? opts.browsers : [];
      label.textContent = names[provSel.value];
      out.textContent = PROVIDERS[provSel.value](opts, f);
    };
    [provSel, fwSel, trig, brw, shard, shards].forEach((e) => e.addEventListener("input", draw));
    const copyBtn = h("button", { class: "btn primary", type: "button", "data-testid": "pb-copy", onClick: () => copy(out.textContent) }, "Copy pipeline");
    root.append(h("div", { class: "grid g2", style: { alignItems: "start" } },
      stage(h("h2", { text: "Options" }), prov, fw, trig, brw, h("label", { class: "check", for: "pb-shard" }, shard, "Shard across machines"), h("div", { class: "field", style: { marginTop: "8px" } }, h("label", { for: "pb-shards", text: "Number of shards" }), shards)),
      stage(h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "8px" } }, label, copyBtn), out, h("p", { class: "hint", text: "A starting point: add secrets, caching and notifications from the other CI/CD pages." }))));
    draw();
  },
});
