// Server-side rendering of the HTML shell for search engines and first paint.
// Reads page metadata straight from the browser modules, so titles, descriptions, sitemap and nav never drift out of sync.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

globalThis.customElements ??= { get: () => true, define() {} }; // page modules register web components at import time

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const load = (rel) => import(pathToFileURL(path.join(pub, rel)).href);
const { GROUPS, pages } = await load("js/registry.js");
for (const f of ["elements", "elements2", "tables", "dynamic", "apps", "api", "learn"]) await load(`js/pages/${f}.js`);
const { INTRO, FAQ, SITE_NAME, clip, HOME_TITLE, homeDescription, pageTitle, pageDescription } = await load("js/content.js");

const TEMPLATE = fs.readFileSync(path.join(pub, "index.html"), "utf8");
const listed = pages.filter((p) => !p.hidden);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const url = (p) => "/practice/" + p.id;

const HOME_DESC = homeDescription(listed.length);

function nav() {
  return GROUPS.map((g) => {
    const items = listed.filter((p) => p.group === g.id);
    return `<div class="grp"><button type="button" tabindex="-1"><span>${esc(g.title)}</span></button><ul>${items.map((p) => `<li><a href="${url(p)}"><span class="dot"></span>${esc(p.title)}</a></li>`).join("")}</ul></div>`;
  }).join("");
}

function head({ origin, title, description, canonicalPath, noindex, ld }) {
  const abs = origin + canonicalPath;
  const img = origin + "/og-image.png";
  const verify = [["google-site-verification", process.env.GOOGLE_SITE_VERIFICATION], ["msvalidate.01", process.env.BING_SITE_VERIFICATION]]
    .filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${esc(v)}">`).join("");
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(abs)}">`,
    `<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">`,
    `<meta name="theme-color" content="#e8481c">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(abs)}"><meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="TestYard – free QA automation practice website">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(img)}">`,
    verify,
    ...(ld || []).map(jsonLd),
  ].join("\n  ");
}

const fill = (h, n, m) => TEMPLATE.replace("<!--SEO_HEAD-->", h).replace("<!--SEO_NAV-->", n).replace("<!--SEO_MAIN-->", m);
const NOSCRIPT = `<p class="muted"><noscript>The interactive practice area needs JavaScript. The text below describes what each page covers.</noscript></p>`;

export function renderHome(origin) {
  const groups = GROUPS.map((g) => {
    const items = listed.filter((p) => p.group === g.id);
    return `<h3>${esc(g.title)}</h3><p>${esc(g.blurb)}</p><ul>${items.map((p) => `<li><a href="${url(p)}">${esc(p.title)}</a> – ${esc(p.blurb)}</li>`).join("")}</ul>`;
  }).join("");
  const faq = FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
  const main = `<div data-testid="prerender"><section class="hero"><div class="eyebrow">Free · open source · no sign-up</div><h1>Free QA practice website for <em>test automation</em></h1><p>${esc(INTRO)}</p></section>${NOSCRIPT}<h2>What you can practise</h2>${groups}<h2>Frequently asked questions</h2>${faq}</div>`;
  return fill(head({
    origin, title: HOME_TITLE, description: HOME_DESC, canonicalPath: "/",
    ld: [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: origin + "/", description: HOME_DESC, inLanguage: "en" },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  }), nav(), main);
}

export function renderPage(id, origin) {
  const p = pages.find((x) => x.id === id);
  if (!p) return null;
  const g = GROUPS.find((x) => x.id === p.group);
  const title = pageTitle(p);
  const description = pageDescription(p);
  const siblings = listed.filter((x) => x.group === p.group && x.id !== p.id);
  const main = `<article data-testid="prerender"><header class="page-head"><div class="eyebrow">${esc(g?.title || "")}</div><h1>${esc(p.title)}</h1><p>${esc(p.blurb)}</p></header>${NOSCRIPT}` +
    (p.tasks?.length ? `<h2>Practice tasks</h2><ul>${p.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "") +
    (siblings.length ? `<h2>More ${esc(g?.title || "")} practice</h2><ul>${siblings.map((x) => `<li><a href="${url(x)}">${esc(x.title)}</a></li>`).join("")}</ul>` : "") + `</article>`;
  return fill(head({
    origin, title, description, canonicalPath: url(p), noindex: !!p.hidden,
    ld: [
      { "@context": "https://schema.org", "@type": "WebPage", name: p.title, description, url: origin + url(p), isPartOf: { "@type": "WebSite", name: SITE_NAME, url: origin + "/" }, inLanguage: "en" },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: origin + "/" },
        { "@type": "ListItem", position: 2, name: g?.title || "Practice", item: origin + "/" },
        { "@type": "ListItem", position: 3, name: p.title, item: origin + url(p) },
      ] },
    ],
  }), nav(), main);
}

export function renderNotFound(origin) {
  const main = `<div data-testid="page-404"><h1>Page not found</h1><p>There is no page at this address.</p><p><a class="btn primary" href="/">Back to TestYard</a></p></div>`;
  return fill(head({ origin, title: "Page not found | TestYard", description: "This page does not exist.", canonicalPath: "/", noindex: true }), nav(), main);
}

export const sitemapXml = (origin) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [origin + "/", ...listed.map((p) => origin + url(p))].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") + `\n</urlset>\n`;

export const robotsTxt = (origin) =>
  `User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/openapi.json\n\nSitemap: ${origin}/sitemap.xml\n`;

export const pageExists = (id) => pages.some((p) => p.id === id);
