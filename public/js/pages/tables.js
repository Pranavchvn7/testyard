import { page } from "../registry.js";
import { h, $, stage, field, rand, shuffle, money } from "../ui.js";

// ---------------------------------------------------------------- static table
page({
  id: "table-static", group: "tables", title: "Static table",
  blurb: "A fixed table with a header, footer and totals — the baseline for row/column assertions.",
  tasks: ["Read the price of “Clean Code” by header name, not column index.", "Sum the Price column and compare with the footer total.", "Count rows whose subject is “JavaScript”.", "Assert the table caption and header cells."],
  render(root) {
    const rows = [["Learn Selenium", "Amit", "Selenium", 300], ["Learn Java", "Mukesh", "Java", 500], ["Learn JS", "Animesh", "JavaScript", 300], ["Master In Selenium", "Mukesh", "Selenium", 3000], ["Master In Java", "Amod", "JavaScript", 2000], ["Master In JS", "Amit", "JavaScript", 1000]];
    const total = rows.reduce((s, r) => s + r[3], 0);
    root.append(stage(h("div", { class: "tbl-wrap" }, h("table", { id: "books", "data-testid": "books-table" },
      h("caption", { class: "sr", text: "Books" }),
      h("thead", {}, h("tr", {}, ["BookName", "Author", "Subject", "Price"].map((c) => h("th", { scope: "col", text: c })))),
      h("tbody", {}, rows.map((r, i) => h("tr", { "data-row": i + 1 }, r.map((c, j) => h("td", { "data-col": ["name", "author", "subject", "price"][j], text: String(c) }))))),
      h("tfoot", {}, h("tr", {}, h("th", { colspan: 3, text: "Total" }), h("th", { "data-testid": "books-total", text: String(total) })))))));
  },
});

// ---------------------------------------------------------------- dynamic table
page({
  id: "table-dynamic", group: "tables", title: "Dynamic table",
  blurb: "Values and even the column order change on every load. Locate cells by header text and row label.",
  tasks: ["Find the CPU usage of Chrome and compare to the yellow label below the table.", "Reload and prove the column order changed — your locator must still work.", "Use the Refresh button and assert values changed."],
  render(root) {
    const out = h("p", { "data-testid": "chrome-cpu", class: "alert info" });
    const table = h("div", { class: "tbl-wrap" });
    const draw = () => {
      const cols = shuffle(["CPU", "Memory", "Network", "Disk"]);
      const procs = ["Chrome", "Firefox", "Node", "Docker", "IDE"];
      const data = procs.map((p) => ({ p, CPU: rand(1, 95) + "%", Memory: rand(120, 4000) + " MB", Network: rand(1, 900) + " Mbps", Disk: rand(1, 300) + " MB/s" }));
      table.replaceChildren(h("table", { id: "sys", "data-testid": "sys-table" }, h("thead", {}, h("tr", {}, h("th", { text: "Name" }), cols.map((c) => h("th", { text: c })))), h("tbody", {}, data.map((d) => h("tr", {}, h("td", { text: d.p }), cols.map((c) => h("td", { text: d[c] })))))));
      out.textContent = "Chrome CPU: " + data[0].CPU;
    };
    draw();
    root.append(stage(table, h("div", { class: "row", style: { marginTop: "14px" } }, h("button", { class: "btn primary", type: "button", "data-testid": "refresh", onClick: draw }, "Refresh"), out)));
  },
});

// ---------------------------------------------------------------- data grid
const FIRST = ["Asha", "Liam", "Mei", "Omar", "Sofia", "Ken", "Priya", "Lucas", "Hana", "Diego", "Zoe", "Ravi", "Nora", "Ivan", "Lena", "Tariq"];
const LAST = ["Verma", "Carter", "Tanaka", "Haddad", "Rossi", "Adeyemi", "Nair", "Meyer", "Kim", "Silva", "Martin", "Patel", "Novak", "Petrov", "Fischer", "Khan"];
const DEPT = ["QA", "Engineering", "Design", "Support", "Sales"];
const STATUS = ["Active", "Pending", "Suspended"];
function seeded(n) { let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `${FIRST[Math.floor(r() * 16)]} ${LAST[Math.floor(r() * 16)]}`, dept: DEPT[Math.floor(r() * 5)], status: STATUS[Math.floor(r() * 3)], score: Math.floor(r() * 100) })); }

page({
  id: "table-grid", group: "tables", title: "Data grid: sort, filter, paginate",
  blurb: "120 rows with search, column sorting, page-size control, row selection and delete — all client-side.",
  tasks: ["Search “QA” and assert every visible row’s dept.", "Sort Score descending and assert the first value is the maximum.", "Set page size 25, go to the last page and count rows.", "Select three rows, delete them, assert the total.", "Select-all selects only the current page."],
  render(root) {
    let data = seeded(120), q = "", dept = "", sortKey = "id", dir = 1, size = 10, pg = 1;
    const selected = new Set();
    const body = h("tbody", { "data-testid": "grid-body" }), pager = h("div", { class: "pager", "data-testid": "pager" });
    const info = h("p", { class: "mono", "data-testid": "grid-info" });
    const all = h("input", { type: "checkbox", "aria-label": "Select all on page", "data-testid": "grid-select-all" });
    const cols = [["id", "ID"], ["name", "Name"], ["dept", "Department"], ["status", "Status"], ["score", "Score"]];
    const view = () => {
      let rows = data.filter((r) => (!dept || r.dept === dept) && (!q || Object.values(r).join(" ").toLowerCase().includes(q.toLowerCase())));
      rows.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * dir);
      return rows;
    };
    const draw = () => {
      const rows = view(), pages = Math.max(1, Math.ceil(rows.length / size));
      pg = Math.min(pg, pages);
      const slice = rows.slice((pg - 1) * size, pg * size);
      body.replaceChildren(...slice.map((r) => h("tr", { "data-id": r.id, "data-testid": "grid-row" },
        h("td", {}, h("input", { type: "checkbox", checked: selected.has(r.id), "aria-label": "Select row " + r.id, onChange: (e) => { e.target.checked ? selected.add(r.id) : selected.delete(r.id); draw(); } })),
        h("td", { text: r.id }), h("td", { text: r.name }), h("td", { text: r.dept }), h("td", {}, h("span", { class: "tag " + { Active: "ok", Pending: "warn", Suspended: "bad" }[r.status], text: r.status })), h("td", { text: r.score }),
        h("td", {}, h("button", { class: "btn sm danger", type: "button", "data-testid": "row-delete", onClick: () => { data = data.filter((d) => d.id !== r.id); selected.delete(r.id); draw(); } }, "Delete")))));
      all.checked = slice.length > 0 && slice.every((r) => selected.has(r.id));
      info.textContent = `Showing ${slice.length ? (pg - 1) * size + 1 : 0}–${(pg - 1) * size + slice.length} of ${rows.length} · ${selected.size} selected`;
      const btn = (label, p, dis, cur) => h("button", { class: "btn sm", type: "button", disabled: dis, "aria-current": cur ? "true" : null, "data-testid": "page-" + label.toLowerCase(), onClick: () => { pg = p; draw(); } }, label);
      const nums = []; for (let i = Math.max(1, pg - 2); i <= Math.min(pages, pg + 2); i++) nums.push(btn(String(i), i, false, i === pg));
      pager.replaceChildren(btn("First", 1, pg === 1), btn("Prev", pg - 1, pg === 1), ...nums, btn("Next", pg + 1, pg === pages), btn("Last", pages, pg === pages));
    };
    all.addEventListener("change", () => { const rows = view().slice((pg - 1) * size, pg * size); rows.forEach((r) => (all.checked ? selected.add(r.id) : selected.delete(r.id))); draw(); });
    const th = cols.map(([k, l]) => h("th", { class: "sortable", scope: "col", "aria-sort": "none", "data-testid": "sort-" + k, onClick: (e) => { dir = sortKey === k ? -dir : 1; sortKey = k; $("thead", root).querySelectorAll("th").forEach((x) => x.setAttribute("aria-sort", "none")); e.currentTarget.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending"); draw(); } }, l));
    root.append(stage(
      h("div", { class: "row", style: { marginBottom: "12px" } },
        h("input", { type: "search", placeholder: "Search…", style: { maxWidth: "240px" }, "aria-label": "Search", "data-testid": "grid-search", onInput: (e) => { q = e.target.value; pg = 1; draw(); } }),
        h("select", { style: { width: "auto" }, "aria-label": "Department", "data-testid": "grid-dept", onChange: (e) => { dept = e.target.value; pg = 1; draw(); } }, h("option", { value: "", text: "All departments" }), DEPT.map((d) => h("option", { value: d, text: d }))),
        h("select", { style: { width: "auto" }, "aria-label": "Page size", "data-testid": "grid-size", onChange: (e) => { size = +e.target.value; pg = 1; draw(); } }, [10, 25, 50].map((n) => h("option", { value: n, text: n + " / page" }))),
        h("button", { class: "btn danger", type: "button", "data-testid": "delete-selected", onClick: () => { data = data.filter((d) => !selected.has(d.id)); selected.clear(); draw(); } }, "Delete selected")),
      h("div", { class: "tbl-wrap" }, h("table", { id: "grid", "data-testid": "grid" }, h("thead", {}, h("tr", {}, h("th", {}, all), th, h("th", { text: "Actions" }))), body)), info, pager));
    draw();
  },
});
