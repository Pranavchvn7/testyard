# TestYard — a free playground for practising QA automation

TestYard is an open-source practice site for Selenium, Playwright, Cypress and API testers. It has **42 practice pages**, a **real sandboxed REST API**, four demo applications and copy-paste framework starters. Nothing to sign up for, nothing precious: break it.

| Area | What you get |
|---|---|
| **Web elements** (17) | Forms & validation, radios/checkboxes, dropdowns & autocomplete, date pickers, sliders, upload/download, JS dialogs & modals, hover, mouse & keyboard, drag & drop, iframes & windows, **shadow DOM**, tabs, toasts, infinite scroll, links & broken images, SVG |
| **Tables & grids** (3) | Static, dynamic (column order shuffles on every load), 120-row grid with sort / filter / paginate / select / delete |
| **Dynamic & timing** (5) | Async controls, hidden vs. late-rendered elements, flaky API and stale elements, slow images, unstable UI (typos, shifting layout) |
| **Locators & DOM** (4) | Dynamic ids, challenging DOM, 2 500-cell table and 40-level tree, locator playground |
| **Demo apps** (5) | Login/register/forgot/OTP, Notes (CRUD), E-commerce shop (cart → order), 4-step flight booking, BMI / password / tip calculators |
| **API lab** (3) | Live OpenAPI reference, Postman-style request console, API test challenge checklist |
| **Learning & tools** (5) | Framework roadmap + starters, cheatsheet (Playwright / Selenium / Cypress), XPath & CSS tester, HTTP/browser diagnostics, cookies/storage/console/errors |

Every interactive element has a stable `data-testid` (and sensible ids, names and ARIA), and each page lists **practice tasks**.

## Run it locally

Requires Node.js 18+ and nothing else: there are **no dependencies and no build step**.

```bash
git clone https://github.com/<you>/testyard.git
cd testyard
npm start            # http://localhost:3000
```

```bash
npm test             # API + security + SEO tests (node:test, no browser needed)
npm run test:e2e     # browser tests; needs: npm i -D playwright && npx playwright install chromium
```

## The API

* Base URL: `<your-host>/api` · OpenAPI document: `/api/openapi.json` (import into Postman, Insomnia or Bruno)
* **Sandboxes:** send `X-Sandbox: <any-id>` and you get your own isolated data (users, accounts, notes, orders). The browser UI generates one automatically. Data lives in memory for 2 hours; the shared default sandbox is wiped every 30 minutes, so always send your own id.
* Demo account: `practice@testyard.dev` / `SecretPass1!`
* Features to test against: CRUD, pagination, bearer auth, OTP with lockout, account deletion, validation errors, `204`/`400`/`401`/`404`/`405`/`409`/`413`/`429`, `Retry-After`, redirects, delays, flaky responses, file upload/download, Basic auth.
* Limits: 600 requests/minute per IP, 60 sign-up/login calls/minute per IP, 10 failed logins per account per minute, 100 KB JSON bodies, 1 MB per uploaded file.

## Deploy for free

TestYard is one small Node process that serves the UI, the API **and the server-rendered pages search engines read**. Pick any host that runs Node or Docker.

### Option A: Render (easiest, free web service)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint** (it reads `render.yaml`), pick the repo, and deploy.
3. If you use a custom domain, set the `SITE_URL` environment variable to it (for example `https://testyard.example.com`). Without it Render's own URL is used.
4. Free instances sleep after inactivity, so the first request can take ~30 s. Practice data resets on restart.

### Option B: Any Docker host (Fly.io, Railway, Google Cloud Run, a VPS…)
```bash
docker build -t testyard .
docker run -p 3000:3000 -e TRUST_PROXY_HOPS=1 -e SITE_URL=https://your-domain.example testyard
```
Set `TRUST_PROXY_HOPS` to the number of reverse proxies in front of the container (`0` if none). It decides which `X-Forwarded-For` entry is trusted, and the rate limits depend on it.

### Not recommended
* **Static-only hosting** (GitHub Pages, plain Netlify): the clean `/practice/...` URLs, per-page SEO tags, sitemap and security headers are produced by the Node server.
* **Serverless platforms** (Vercel, Netlify Functions) for the API: its sandboxes live in memory, which serverless instances do not keep.

### Configuration

Everything is optional; see [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `SITE_URL` | Public origin, used for canonical URLs, `sitemap.xml`, `robots.txt` and social previews |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the app (`1` on Render/Fly/Railway) |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API (default `*`) |
| `API_ORIGIN` | Only if the UI and API are on different hosts (extends the CSP `connect-src`) |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | Webmaster-tool verification tokens |

## Security

TestYard ships hardened: strict Content-Security-Policy with no inline scripts, `X-Frame-Options`, HSTS, scrypt password hashing, per-IP and per-account rate limits, request-size caps, generic error responses with correlation ids, and no runtime dependencies. Some behaviours are deliberately weak because they are the thing being practised; they are listed in [SECURITY.md](SECURITY.md), together with how to report a vulnerability. **Never enter real personal data.**

## Getting found on Google

The site is built to be crawlable: every practice page has a real URL (`/practice/<page>`), its own title, description, canonical link, Open Graph tags and structured data, all in the initial HTML, plus `sitemap.xml` and `robots.txt`. After deploying:

1. Set `SITE_URL` to your final address.
2. Verify the site in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) (use the `*_SITE_VERIFICATION` variables), then submit `/sitemap.xml`.
3. Use a short, memorable domain and 301-redirect any other hostname to it.
4. Fill in your GitHub repository's *About* box and add topics such as `qa`, `test-automation`, `selenium`, `playwright`, `cypress`, `api-testing`, `practice-website`, then link the live site there.
5. Earn links: submit to lists such as awesome-test-automation, and share walkthroughs on Dev.to, Reddit (r/QualityAssurance, r/softwaretesting), LinkedIn and YouTube. Rankings for competitive searches depend mostly on links and useful content and take weeks to months.

## Project layout

```
server.js            hardened static + SEO + API server (no dependencies)
seo.js               renders titles, meta, JSON-LD, nav, sitemap and robots from the page registry
api/core.js          the REST API (routes, validation, sandboxes, rate limits, OpenAPI)
public/              the single-page app (clean-URL routing, vanilla JS modules)
  js/pages/*.js      one module per group of practice pages
tests/               API, security/SEO and Playwright smoke tests
frameworks/playwright  runnable Playwright starter that targets TestYard
```

## Adding a practice page

```js
// public/js/pages/my-page.js  (import it in public/js/app.js and add its file name to the list in seo.js)
import { page } from "../registry.js";
import { h, stage } from "../ui.js";

page({
  id: "my-page", group: "elements", title: "My page", blurb: "What it teaches.",
  tasks: ["First thing to automate"],
  render(root) { root.append(stage(h("button", { "data-testid": "go" }, "Go"))); },
});
```

## Contributing

Issues and pull requests are welcome — new element types, harder edge cases and extra API endpoints are especially useful. Keep pages dependency-free and give every control a `data-testid`.

## License

MIT — see [LICENSE](LICENSE). Use it in workshops, courses and interviews. TestYard is an independent project and is not affiliated with any other practice site.
