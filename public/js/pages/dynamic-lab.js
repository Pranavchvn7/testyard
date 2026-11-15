import { page } from "../registry.js";
import { h, stage, sleep, rand, api } from "../ui.js";

const BASE = () => (typeof window !== "undefined" ? window.TESTYARD_API_BASE || "" : "").replace(/\/$/, "");
const note = (t) => h("p", { class: "hint", text: t });
const skeleton = (n = 3) => h("div", { "data-testid": "skeleton", "aria-busy": "true", "aria-label": "Loading content" }, Array.from({ length: n }, () => h("div", { class: "dl-skel" })));
const feedItem = (it) => h("article", { class: "dl-item", "data-testid": "feed-item", "data-id": it.id }, h("h4", { text: it.title }), h("p", { class: "muted", text: it.body }));

// ---------------------------------------------------------------- lazy list + infinite scroll
page({
  id: "dynamic-lazy", group: "dynamic", title: "Lazy loading & scroll",
  blurb: "Load-more buttons, infinite scroll with IntersectionObserver, skeleton screens and lazy images.",
  tasks: [
    "Click Load more until the button disappears and assert 30 items in total.",
    "Scroll inside the infinite box and wait until the item count reaches 24.",
    "Assert the skeleton shows first, then is replaced by the real content.",
    "Scroll the lazy image into view and wait for its naturalWidth to be greater than zero.",
    "Mock /api/feed with page.route to return a single item and assert the UI.",
  ],
  render(root) {
    // 1. Load more button
    let pg = 0;
    const list = h("div", { "data-testid": "more-list" }), count = h("p", { class: "mono", "data-testid": "more-count", text: "Loaded 0 items" });
    const more = h("button", { class: "btn primary", type: "button", "data-testid": "load-more" }, "Load more");
    let total = 0, alive = true;
    more.addEventListener("click", async () => {
      more.disabled = true; more.textContent = "Loading…";
      const sk = skeleton(2); list.append(sk);
      const r = await api("GET", `/api/feed?page=${++pg}&size=6&delay=700`, undefined, { auth: false });
      sk.remove();
      if (!alive) return;
      if (r.ok) { r.data.data.items.forEach((i) => list.append(feedItem(i))); total += r.data.data.items.length; count.textContent = `Loaded ${total} items`; more.disabled = false; more.textContent = "Load more"; if (!r.data.data.hasMore || pg >= 5) { more.hidden = true; count.textContent += " (all loaded)"; } }
      else { more.disabled = false; more.textContent = "Retry"; }
    });
    // 2. Infinite scroll
    const box = h("div", { class: "scroll-box", "data-testid": "infinite-box", tabindex: "0", "aria-label": "Infinite list" });
    const sentinel = h("div", { "data-testid": "sentinel", class: "muted", text: "Scroll for more…" });
    const icount = h("p", { class: "mono", "data-testid": "infinite-count", text: "Items: 0" });
    let ip = 0, busy = false, n = 0, done = false;
    const loadMoreInf = async () => {
      if (busy || done) return; busy = true; sentinel.textContent = "Loading…";
      const r = await api("GET", `/api/feed?page=${++ip}&size=8&delay=400`, undefined, { auth: false });
      if (!alive) return;
      busy = false;
      if (!r.ok) { sentinel.textContent = "Failed, scroll to retry"; ip--; return; }
      r.data.data.items.forEach((i) => box.insertBefore(feedItem(i), sentinel)); n += r.data.data.items.length; icount.textContent = "Items: " + n;
      if (ip >= 5) { done = true; sentinel.textContent = "End of list"; } else sentinel.textContent = "Scroll for more…";
    };
    box.append(sentinel);
    let io = null;
    if (typeof IntersectionObserver !== "undefined") { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) loadMoreInf(); }, { root: box, rootMargin: "40px" }); io.observe(sentinel); }
    // 3. Lazy image
    const ph = h("div", { class: "dl-lazy-ph", "data-testid": "lazy-placeholder", text: "Image not requested yet" });
    const imgState = h("p", { class: "mono", "data-testid": "lazy-state", text: "Idle" });
    const imgHost = h("div", { "data-testid": "lazy-host" }, ph);
    const spacer = h("div", { class: "muted", style: { height: "120px" }, text: "↓ scroll the page down to the image ↓" });
    let io2 = null;
    const showImg = () => {
      imgState.textContent = "Loading…";
      const img = h("img", { alt: "Lazy loaded", width: 320, height: 140, "data-testid": "lazy-img", src: `${BASE()}/api/slow-image?ms=1500&label=lazy+image&t=${Date.now()}` });
      img.addEventListener("load", () => { imgState.textContent = "Loaded"; ph.replaceWith(img); });
      img.addEventListener("error", () => { imgState.textContent = "Failed"; });
      img.style.display = "none"; imgHost.append(img);
      img.addEventListener("load", () => { img.style.display = ""; });
    };
    if (typeof IntersectionObserver !== "undefined") { io2 = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io2.disconnect(); showImg(); } }); io2.observe(ph); }
    root.append(
      stage(h("h2", { text: "1 · Load more" }), list, h("div", { class: "row" }, more, count)),
      stage(h("h2", { text: "2 · Infinite scroll" }), box, icount, note("A sentinel at the bottom triggers the next page when it enters view.")),
      stage(h("h2", { text: "3 · Lazy image" }), spacer, imgHost, imgState));
    return () => { alive = false; io?.disconnect(); io2?.disconnect(); };
  },
});

// ---------------------------------------------------------------- progress + polling
page({
  id: "dynamic-progress", group: "dynamic", title: "Progress bars & polling",
  blurb: "Background jobs with real polling, progress bars, retry with back-off and a live counter.",
  tasks: [
    "Start the job and wait for the progress bar to reach aria-valuenow=100.",
    "Wait for the status text “Job finished” without any fixed sleeps.",
    "Intercept GET /api/jobs/* and force the response to done to skip the wait.",
    "Press Retry with back-off and assert the attempt number reaches 3.",
    "Pause and resume the polling counter and assert it stops changing.",
  ],
  render(root) {
    // 1. Job + polling
    const dur = h("select", { "data-testid": "job-duration", "aria-label": "Job duration" }, [2000, 4000, 8000].map((v) => h("option", { value: v, text: v / 1000 + " s" })));
    dur.value = "4000";
    const bar = h("div", { class: "bar", role: "progressbar", "aria-label": "Job progress", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0", "data-testid": "job-bar" }, h("i", { style: { width: "0%" } }));
    const status = h("p", { role: "status", class: "mono", "data-testid": "job-status", text: "No job running" });
    const start = h("button", { class: "btn primary", type: "button", "data-testid": "job-start" }, "Start job");
    let timer = 0, alive = true;
    const setP = (p) => { bar.setAttribute("aria-valuenow", String(p)); bar.firstChild.style.width = p + "%"; };
    start.addEventListener("click", async () => {
      clearTimeout(timer); start.disabled = true; setP(0); status.textContent = "Starting…";
      const r = await api("POST", "/api/jobs", { durationMs: +dur.value }, { auth: false });
      if (!r.ok) { status.textContent = "Could not start: " + r.status; start.disabled = false; return; }
      const id = r.data.data.id;
      const poll = async () => {
        if (!alive) return;
        const s = await api("GET", "/api/jobs/" + id, undefined, { auth: false });
        if (!alive) return;
        if (!s.ok) { status.textContent = "Polling failed: " + s.status; start.disabled = false; return; }
        setP(s.data.data.progress); status.textContent = s.data.data.status === "done" ? "Job finished" : `Job running… ${s.data.data.progress}%`;
        if (s.data.data.status === "done") { start.disabled = false; return; }
        timer = setTimeout(poll, 500);
      };
      poll();
    });
    // 2. Retry with back-off
    const attempts = h("p", { class: "mono", "data-testid": "retry-attempts", text: "Attempts: 0" }), rstat = h("p", { role: "status", "data-testid": "retry-status", text: "Press the button" });
    const rbtn = h("button", { class: "btn", type: "button", "data-testid": "retry-btn" }, "Fetch with retry and back-off");
    let rt = 0;
    rbtn.addEventListener("click", async () => {
      rbtn.disabled = true; let n = 0, wait = 400;
      while (alive && n < 5) {
        n++; attempts.textContent = "Attempts: " + n; rstat.textContent = `Attempt ${n}…`;
        const r = await api("GET", "/api/flaky?failRate=0.7", undefined, { auth: false });
        if (r.ok) { rstat.textContent = `Succeeded on attempt ${n}`; rbtn.disabled = false; return; }
        rstat.textContent = `Attempt ${n} failed, retrying in ${wait} ms`;
        await sleep(wait); wait *= 2;
      }
      if (alive) { rstat.textContent = "Gave up after 5 attempts"; rbtn.disabled = false; }
    });
    // 3. Live counter
    let c = 0, running = true;
    const cnt = h("p", { class: "mono", style: { fontSize: "1.6rem" }, "data-testid": "live-counter", text: "0" });
    const tog = h("button", { class: "btn", type: "button", "data-testid": "live-toggle" }, "Pause");
    const iv = setInterval(() => { if (running) cnt.textContent = String(++c); }, 700);
    tog.addEventListener("click", () => { running = !running; tog.textContent = running ? "Pause" : "Resume"; });
    root.append(
      stage(h("h2", { text: "1 · Job with polling" }), h("div", { class: "row" }, dur, start), h("div", { style: { margin: "12px 0" } }, bar), status, note("POST /api/jobs creates a job and the page polls GET /api/jobs/:id every 500 ms.")),
      h("div", { class: "grid g2", style: { marginTop: "18px" } },
        stage(h("h2", { text: "2 · Retry with back-off" }), rbtn, attempts, rstat),
        stage(h("h2", { text: "3 · Live counter" }), cnt, tog, note("Good for expect.poll() and clock control."))));
    return () => { alive = false; clearTimeout(timer); clearTimeout(rt); clearInterval(iv); };
  },
});

// ---------------------------------------------------------------- autocomplete race
page({
  id: "dynamic-autocomplete", group: "dynamic", title: "Type-ahead & races",
  blurb: "A search box where slow, older responses can overwrite newer ones. Debounce, cancel, and wait correctly.",
  tasks: [
    "Type “playwright” with pressSequentially and wait for exactly one suggestion list.",
    "Switch to the Naive mode and reproduce the stale-results race with a fast typist.",
    "Switch to the Safe mode and prove the final list always matches the final query.",
    "Wait for the /api/search response for the last query using waitForResponse.",
    "Assert the loading hint appears and disappears around each request.",
  ],
  render(root) {
    const mode = h("select", { "data-testid": "ac-mode", "aria-label": "Mode" }, h("option", { value: "safe", text: "Safe (debounced, ignores stale)" }), h("option", { value: "naive", text: "Naive (race condition)" }));
    const input = h("input", { type: "text", role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": "ac-list", placeholder: "Search a tool, e.g. play", "data-testid": "ac-input", "aria-label": "Search tools", autocomplete: "off" });
    const list = h("ul", { id: "ac-list", role: "listbox", "data-testid": "ac-list", style: { listStyle: "none", padding: "0", margin: "8px 0 0" } });
    const state = h("p", { class: "mono", "data-testid": "ac-state", role: "status", text: "Idle" });
    const shownFor = h("p", { class: "mono", "data-testid": "ac-shown-for", text: "Results for: —" });
    const picked = h("p", { "data-testid": "ac-picked", text: "Nothing selected" });
    let seq = 0, t = 0, alive = true;
    const render = (q, items) => {
      list.replaceChildren(...items.map((w) => h("li", { role: "option", tabindex: "0", class: "dl-opt", "data-testid": "ac-option", onClick: () => { input.value = w; picked.textContent = "Selected: " + w; list.replaceChildren(); input.setAttribute("aria-expanded", "false"); } }, w)));
      input.setAttribute("aria-expanded", String(items.length > 0)); shownFor.textContent = "Results for: " + q;
    };
    const search = async (q) => {
      const my = ++seq; state.textContent = "Searching…";
      const r = await api("GET", "/api/search?q=" + encodeURIComponent(q), undefined, { auth: false });
      if (!alive) return;
      if (mode.value === "safe" && my !== seq) return; // stale response ignored
      state.textContent = "Idle"; if (r.ok) render(q, r.data.data.results);
    };
    input.addEventListener("input", () => {
      clearTimeout(t); const q = input.value.trim();
      if (!q) { list.replaceChildren(); state.textContent = "Idle"; shownFor.textContent = "Results for: —"; return; }
      if (mode.value === "safe") t = setTimeout(() => search(q), 300); else search(q);
    });
    root.append(stage(h("div", { class: "row" }, h("label", { class: "label", for: "ac-mode", text: "Mode" }), mode), h("div", { style: { margin: "12px 0" } }, input, list), state, shownFor, picked,
      note("Latency shrinks as the query grows, so in Naive mode the answer for “p” can arrive after the answer for “play”.")));
    return () => { alive = false; clearTimeout(t); };
  },
});

// ---------------------------------------------------------------- tabs & accordion lazy
page({
  id: "dynamic-tabs-accordion", group: "dynamic", title: "Lazy tabs & accordions",
  blurb: "Tabs and accordion panels that fetch their content on first open and then cache it.",
  tasks: [
    "Open the second tab and wait for its content, then return and assert it is cached (no skeleton).",
    "Expand every accordion section and assert aria-expanded and the loaded text for each.",
    "Count requests to /api/feed with page.on('request') and prove tabs fetch only once.",
    "Use getByRole('tab') and getByRole('tabpanel') with names.",
  ],
  render(root) {
    let alive = true;
    const calls = h("p", { class: "mono", "data-testid": "lazy-calls", text: "Content requests: 0" });
    let n = 0;
    const fetchPanel = async (kind, i) => { calls.textContent = "Content requests: " + ++n; const r = await api("GET", `/api/feed?page=${i}&size=2&delay=${kind === "tab" ? 900 : 600}`, undefined, { auth: false }); return r.ok ? r.data.data.items : []; };
    const names = ["Overview", "Details", "Reviews"];
    const loaded = new Set();
    const panels = names.map((nm, i) => h("div", { role: "tabpanel", id: "tp-" + i, "aria-labelledby": "tb-" + i, hidden: i !== 0, "data-testid": "tabpanel-" + nm.toLowerCase() }));
    const btns = names.map((nm, i) => h("button", { role: "tab", id: "tb-" + i, type: "button", "aria-selected": String(i === 0), "aria-controls": "tp-" + i, "data-testid": "tab-" + nm.toLowerCase() }, nm));
    const open = async (i) => {
      btns.forEach((b, j) => b.setAttribute("aria-selected", String(i === j))); panels.forEach((p, j) => (p.hidden = i !== j));
      if (loaded.has(i)) return; loaded.add(i);
      const p = panels[i]; p.replaceChildren(skeleton(2));
      const items = await fetchPanel("tab", i + 1);
      if (alive) p.replaceChildren(...items.map(feedItem));
    };
    btns.forEach((b, i) => b.addEventListener("click", () => open(i)));
    open(0);
    const sections = ["Shipping", "Returns", "Warranty"].map((nm, i) => {
      const body = h("div", { "data-testid": "acc-body-" + nm.toLowerCase(), hidden: true });
      const btn = h("button", { type: "button", "aria-expanded": "false", "aria-controls": "acc-" + i, "data-testid": "acc-btn-" + nm.toLowerCase() }, h("span", { text: nm }), h("span", { "aria-hidden": "true", text: "+" }));
      let got = false;
      btn.addEventListener("click", async () => {
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!isOpen)); body.hidden = isOpen; btn.lastChild.textContent = isOpen ? "+" : "–";
        if (!isOpen && !got) { got = true; body.replaceChildren(skeleton(1)); const items = await fetchPanel("acc", 4 + i); if (alive) body.replaceChildren(...items.map(feedItem)); }
      });
      body.id = "acc-" + i;
      return h("div", { class: "acc-item" }, btn, body);
    });
    root.append(stage(h("h2", { text: "Lazy tabs" }), h("div", { class: "tabs" }, h("div", { role: "tablist", "aria-label": "Product info" }, btns), panels)), stage(h("h2", { text: "Lazy accordion" }), sections), stage(calls));
    return () => { alive = false; };
  },
});

// ---------------------------------------------------------------- state changes
page({
  id: "dynamic-states", group: "dynamic", title: "Changing states",
  blurb: "Text, attributes, overlays and shadow content that change after a delay: wait for each kind of change.",
  tasks: [
    "Wait for the status text to change from Loading… to Loaded.",
    "Wait for data-state to become ready, then click the button.",
    "Click the button under the overlay only after the overlay is gone.",
    "Wait for the element that appears inside the shadow root.",
    "Wait for the content swap and assert the old node is detached.",
    "Wait until the random-delay element appears (1 to 6 seconds).",
  ],
  render(root) {
    let alive = true; const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
    const run = h("button", { class: "btn primary", type: "button", "data-testid": "states-run" }, "Start all changes");
    // text change
    const txt = h("p", { class: "mono", "data-testid": "state-text", role: "status", text: "Idle" });
    // attribute change
    const attr = h("button", { class: "btn", type: "button", "data-testid": "state-attr", "data-state": "idle", disabled: true }, "Wait for me");
    const attrOut = h("p", { class: "mono", "data-testid": "state-attr-out", text: "data-state=idle" });
    attr.addEventListener("click", () => { attrOut.textContent = "Clicked while " + attr.dataset.state; });
    // overlay
    const under = h("button", { class: "btn", type: "button", "data-testid": "under-overlay" }, "I am under an overlay");
    const underOut = h("p", { class: "mono", "data-testid": "under-out", text: "Not clicked" });
    under.addEventListener("click", () => { underOut.textContent = "Clicked"; });
    const overlay = h("div", { class: "dl-overlay", "data-testid": "overlay", hidden: true, role: "alert" }, h("span", { class: "spinner" }), " Working…");
    const overWrap = h("div", { class: "dl-overlay-wrap" }, under, overlay);
    // swap
    const swap = h("div", { "data-testid": "swap-host" }, h("p", { id: "old-node", "data-testid": "swap-old", text: "Old content" }));
    // shadow
    let shadowHost = null, shadowOut = h("p", { class: "mono", "data-testid": "shadow-state", text: "Shadow host is empty" });
    shadowHost = h("div", { "data-testid": "shadow-host" });
    // random delay
    const rnd = h("div", { "data-testid": "random-host", class: "mono", text: "Waiting for a random element…" });
    run.addEventListener("click", () => {
      run.disabled = true;
      txt.textContent = "Loading…"; later(() => { txt.textContent = "Loaded"; }, 1800);
      attr.dataset.state = "loading"; attrOut.textContent = "data-state=loading"; later(() => { attr.dataset.state = "ready"; attr.disabled = false; attrOut.textContent = "data-state=ready"; }, 2200);
      overlay.hidden = false; later(() => { overlay.hidden = true; }, 2500);
      later(() => swap.replaceChildren(h("p", { id: "new-node", "data-testid": "swap-new", text: "New content" })), 2000);
      later(() => { if (shadowHost.attachShadow) { const sr = shadowHost.shadowRoot || shadowHost.attachShadow({ mode: "open" }); sr.innerHTML = '<button id="late-shadow-btn">Shadow button</button><span class="tag">appeared</span>'; shadowOut.textContent = "Shadow content added"; } }, 2800);
      const d = rand(1000, 6000); later(() => { rnd.replaceChildren(h("button", { class: "btn", type: "button", "data-testid": "random-el", text: "Random element" })); rnd.className = ""; }, d);
      later(() => { run.disabled = false; }, 6200);
    });
    root.append(
      stage(h("div", { class: "row" }, run, h("span", { class: "muted", text: "Starts every change below at different times." }))),
      h("div", { class: "grid g2", style: { marginTop: "18px" } },
        stage(h("h2", { text: "Text changes" }), txt),
        stage(h("h2", { text: "Attribute changes" }), attr, attrOut),
        stage(h("h2", { text: "Overlay blocks clicks" }), overWrap, underOut),
        stage(h("h2", { text: "Content swap" }), swap),
        stage(h("h2", { text: "Appears in shadow DOM" }), shadowHost, shadowOut),
        stage(h("h2", { text: "Random delay" }), rnd)));
    return () => { alive = false; timers.forEach(clearTimeout); };
  },
});

// ---------------------------------------------------------------- network
page({
  id: "dynamic-network", group: "dynamic", title: "Network waits",
  blurb: "Parallel requests, network idle, delayed redirects and responses you must wait for explicitly.",
  tasks: [
    "Click Fire 5 requests and wait for all five responses with Promise.all and waitForResponse.",
    "Assert the summary says 5 of 5 completed, then compare total time to the slowest request.",
    "Click Delayed redirect and assert the URL change after about 3 seconds with waitForURL.",
    "Abort one request with page.route and assert the failed row in the table.",
    "Wait for the page to be idle after the burst, then explain why networkidle is discouraged.",
  ],
  render(root) {
    let alive = true;
    const rows = h("tbody", { "data-testid": "net-rows" });
    const summary = h("p", { class: "mono", role: "status", "data-testid": "net-summary", text: "No requests yet" });
    const fire = h("button", { class: "btn primary", type: "button", "data-testid": "net-fire" }, "Fire 5 requests");
    fire.addEventListener("click", async () => {
      fire.disabled = true; rows.replaceChildren(); summary.textContent = "Running…";
      const t0 = performance.now(); let okN = 0;
      const jobs = [300, 900, 1500, 2100, 2700].map(async (ms, i) => {
        const tr = h("tr", { "data-testid": "net-row" }, h("td", { text: "#" + (i + 1) }), h("td", { text: "/api/delay/" + ms }), h("td", { "data-testid": "net-row-status", text: "pending" }));
        rows.append(tr);
        const r = await api("GET", "/api/delay/" + ms, undefined, { auth: false });
        if (!alive) return;
        tr.lastChild.textContent = r.ok ? "200 in " + r.ms + " ms" : "failed (" + r.status + ")"; if (r.ok) okN++;
      });
      await Promise.all(jobs);
      if (alive) { summary.textContent = `${okN} of 5 completed in ${Math.round(performance.now() - t0)} ms`; fire.disabled = false; }
    });
    const redirOut = h("p", { class: "mono", "data-testid": "redirect-out", role: "status", text: "Not started" });
    let rt = 0;
    const redir = h("button", { class: "btn", type: "button", "data-testid": "delayed-redirect" }, "Delayed redirect (3 s)");
    redir.addEventListener("click", () => {
      let s = 3; redirOut.textContent = `Redirecting in ${s}…`;
      const tick = () => { if (!alive) return; s--; if (s <= 0) { history.pushState({}, "", "/practice/dynamic-network?redirected=1"); redirOut.textContent = "Redirected: " + location.search; } else { redirOut.textContent = `Redirecting in ${s}…`; rt = setTimeout(tick, 1000); } };
      rt = setTimeout(tick, 1000);
    });
    root.append(
      stage(h("h2", { text: "Parallel requests" }), h("div", { class: "row" }, fire), h("div", { class: "tbl-wrap", style: { margin: "12px 0" } }, h("table", { "data-testid": "net-table" }, h("thead", {}, h("tr", {}, ["Request", "URL", "Status"].map((c) => h("th", { text: c })))), rows)), summary),
      stage(h("h2", { text: "Delayed redirect" }), h("div", { class: "row" }, redir), redirOut, note("Uses the History API so the URL changes without a reload.")));
    return () => { alive = false; clearTimeout(rt); };
  },
});
