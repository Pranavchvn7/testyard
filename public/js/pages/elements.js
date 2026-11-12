import { page } from "../registry.js";
import { h, $, $$, toast, modal, stage, field, resultPre, pretty, api, sleep } from "../ui.js";

const COUNTRIES = ["Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China", "Colombia", "Denmark", "Egypt", "Finland", "France", "Germany", "Ghana", "Greece", "India", "Indonesia", "Ireland", "Italy", "Japan", "Kenya", "Mexico", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Peru", "Poland", "Portugal", "Singapore", "South Africa", "Spain", "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine", "United Kingdom", "United States", "Vietnam"];

// ---------------------------------------------------------------- inputs
page({
  id: "inputs", group: "elements", title: "Text inputs & forms",
  blurb: "A classic data-entry form with client-side validation, error messages and a submitted-data summary.",
  tasks: ["Submit the empty form and assert every error message.", "Fill valid data and assert the JSON result.", "Test boundaries: age 17, 18, 99, 100; invalid phone and email formats.", "Toggle password visibility and assert the input type changes.", "Reset the form and assert all fields are cleared."],
  render(root) {
    const f = h("form", { id: "entry-form", novalidate: true, "data-testid": "entry-form" });
    const inp = (name, type, extra = {}) => h("input", { name, id: name, type, ...extra });
    const pw = inp("password", "password", { autocomplete: "new-password", placeholder: "min 8 characters" });
    const showPw = h("button", { type: "button", class: "btn sm ghost", "data-testid": "toggle-password", onClick: () => { pw.type = pw.type === "password" ? "text" : "password"; showPw.textContent = pw.type === "password" ? "Show" : "Hide"; } }, "Show");
    const radios = ["Female", "Male", "Other"].map((g) => h("label", { class: "check" }, h("input", { type: "radio", name: "gender", value: g.toLowerCase(), "data-testid": "gender-" + g.toLowerCase() }), g));
    const hobbies = ["Reading", "Cycling", "Gaming", "Cooking"].map((x) => h("label", { class: "check" }, h("input", { type: "checkbox", name: "hobbies", value: x.toLowerCase(), "data-testid": "hobby-" + x.toLowerCase() }), x));
    const country = h("select", { name: "country", id: "country", "data-testid": "country" }, h("option", { value: "", text: "Select a country…" }), COUNTRIES.slice(0, 12).map((c) => h("option", { value: c, text: c })));
    const news = h("input", { type: "checkbox", name: "newsletter", id: "newsletter", "data-testid": "newsletter" });
    const result = resultPre();
    const banner = h("div", { "data-testid": "form-banner" });

    f.append(
      h("div", { class: "grid g2" },
        field("First name *", inp("firstName", "text", { autocomplete: "given-name" }), null, "err-firstName"),
        field("Last name", inp("lastName", "text", { autocomplete: "family-name" })),
        field("Email *", inp("email", "email", { autocomplete: "email", placeholder: "you@example.com" }), null, "err-email"),
        field("Phone *", inp("phone", "tel", { placeholder: "10 digits" }), "Digits only, exactly 10", "err-phone"),
        field("Password *", h("div", { class: "row", style: { flexWrap: "nowrap" } }, pw, showPw), null, "err-password"),
        field("Age *", inp("age", "number", { min: "18", max: "99" }), "Between 18 and 99", "err-age")),
      field("Address", h("textarea", { name: "address", id: "address", rows: "3" })),
      h("div", { class: "grid g3" },
        h("div", { class: "field" }, h("span", { class: "label", text: "Gender *" }), h("div", { role: "radiogroup", "aria-label": "Gender" }, radios), h("span", { class: "err", "data-testid": "err-gender" })),
        h("div", { class: "field" }, h("span", { class: "label", text: "Hobbies" }), hobbies),
        field("Country *", country, null, "err-country")),
      h("label", { class: "check" }, h("span", { class: "switch" }, news, h("i")), "Subscribe to the newsletter"),
      h("div", { class: "row", style: { marginTop: "18px" } },
        h("button", { class: "btn primary", type: "submit", "data-testid": "submit" }, "Submit"),
        h("button", { class: "btn", type: "reset", "data-testid": "reset" }, "Reset")));

    const rules = {
      firstName: (v) => (v.trim().length < 2 ? "First name must be at least 2 characters" : ""),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter a valid email address"),
      phone: (v) => (/^\d{10}$/.test(v) ? "" : "Phone must be exactly 10 digits"),
      password: (v) => (v.length < 8 ? "Password must be at least 8 characters" : ""),
      age: (v) => (v === "" || +v < 18 || +v > 99 ? "Age must be between 18 and 99" : ""),
    };
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = new FormData(f);
      let bad = 0;
      for (const [k, fn] of Object.entries(rules)) {
        const msg = fn(String(d.get(k) ?? ""));
        $("#err-" + k, f).textContent = msg;
        f.elements[k].setAttribute("aria-invalid", msg ? "true" : "false");
        if (msg) bad++;
      }
      const gErr = !d.get("gender") ? "Please choose a gender" : "";
      $('[data-testid="err-gender"]', f).textContent = gErr; if (gErr) bad++;
      const cErr = !d.get("country") ? "Please select a country" : "";
      $("#err-country", f).textContent = cErr; if (cErr) bad++;
      if (bad) { banner.replaceChildren(h("div", { class: "alert bad", role: "alert", "data-testid": "form-error" }, `Please fix ${bad} error${bad > 1 ? "s" : ""} and try again.`)); result.textContent = "—"; return; }
      const out = Object.fromEntries(d); out.hobbies = d.getAll("hobbies"); out.newsletter = news.checked; out.password = "•".repeat(String(out.password).length);
      banner.replaceChildren(h("div", { class: "alert ok", role: "status", "data-testid": "form-success" }, "Thanks! Your form was submitted successfully."));
      result.textContent = pretty(out);
    });
    f.addEventListener("reset", () => { banner.replaceChildren(); result.textContent = "—"; $$(".err", f).forEach((x) => (x.textContent = "")); $$("[aria-invalid]", f).forEach((x) => x.removeAttribute("aria-invalid")); });
    root.append(stage(f, h("div", { class: "result" }, banner, h("div", { class: "label", text: "Submitted data" }), result)));
  },
});

// ---------------------------------------------------------------- choices
page({
  id: "choices", group: "elements", title: "Radios, checkboxes & switches",
  blurb: "Single and multi selection, indeterminate state, disabled options and enabling controls conditionally.",
  tasks: ["Select each radio and assert only one stays checked.", "Use “Select all” and assert the indeterminate state when partially selected.", "Assert disabled options cannot be clicked.", "Tick the terms checkbox and wait for the Continue button to become enabled."],
  render(root) {
    const out = h("p", { "data-testid": "radio-out", class: "mono", text: "Chosen size: none" });
    const sizes = ["Small", "Medium", "Large"].map((s, i) => h("label", { class: "check" + (i === 2 ? " disabled" : "") }, h("input", { type: "radio", name: "size", value: s.toLowerCase(), disabled: i === 2, "data-testid": "size-" + s.toLowerCase(), onChange: () => (out.textContent = "Chosen size: " + s.toLowerCase()) }), s + (i === 2 ? " (sold out)" : "")));

    const items = ["Pizza", "Pasta", "Salad", "Soup"];
    const all = h("input", { type: "checkbox", id: "all", "data-testid": "select-all" });
    const boxes = items.map((x) => h("input", { type: "checkbox", name: "food", value: x.toLowerCase(), "data-testid": "food-" + x.toLowerCase() }));
    const count = h("p", { "data-testid": "check-count", class: "mono", text: "0 of 4 selected" });
    const sync = () => {
      const n = boxes.filter((b) => b.checked).length;
      all.checked = n === boxes.length; all.indeterminate = n > 0 && n < boxes.length;
      count.textContent = `${n} of ${boxes.length} selected`;
    };
    all.addEventListener("change", () => { boxes.forEach((b) => (b.checked = all.checked)); sync(); });
    boxes.forEach((b) => b.addEventListener("change", sync));

    const terms = h("input", { type: "checkbox", id: "terms", "data-testid": "terms" });
    const cont = h("button", { class: "btn primary", disabled: true, "data-testid": "continue", type: "button", onClick: () => toast("Continued!", "ok") }, "Continue");
    terms.addEventListener("change", () => (cont.disabled = !terms.checked));
    const sw = h("input", { type: "checkbox", role: "switch", id: "sw", "data-testid": "switch" });
    const swOut = h("span", { "data-testid": "switch-state", class: "tag", text: "OFF" });
    sw.addEventListener("change", () => { swOut.textContent = sw.checked ? "ON" : "OFF"; swOut.className = "tag " + (sw.checked ? "ok" : ""); });

    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Radio buttons" }), h("div", { role: "radiogroup" }, sizes), out),
      stage(h("h2", { text: "Checkboxes" }), h("label", { class: "check" }, all, h("b", { text: "Select all" })), items.map((x, i) => h("label", { class: "check" }, boxes[i], x)), count),
      stage(h("h2", { text: "Conditional enable" }), h("label", { class: "check" }, terms, "I accept the terms and conditions"), h("div", { style: { marginTop: "12px" } }, cont)),
      stage(h("h2", { text: "Switch" }), h("label", { class: "check" }, h("span", { class: "switch" }, sw, h("i")), "Notifications"), swOut)));
  },
});

// ---------------------------------------------------------------- dropdowns
page({
  id: "dropdowns", group: "elements", title: "Dropdowns & autocomplete",
  blurb: "Native select, multi-select, a keyboard-driven autocomplete and a custom listbox with a long scrolling list.",
  tasks: ["Select an option by value, label and index.", "Select several options in the multi-select and read back selectedOptions.", "Type “uni” in the autocomplete and pick a suggestion with the keyboard.", "Scroll the custom list to “Item 180” and select it."],
  render(root) {
    const sel = h("select", { id: "fruit", "data-testid": "fruit" }, h("option", { value: "", text: "Please select" }), ["Apple", "Banana", "Cherry", "Grape"].map((x) => h("option", { value: x.toLowerCase(), text: x })), h("option", { value: "x", disabled: true, text: "Disabled option" }));
    const selOut = h("p", { class: "mono", "data-testid": "fruit-out", text: "Selected: none" });
    sel.addEventListener("change", () => (selOut.textContent = "Selected: " + (sel.value || "none")));

    const multi = h("select", { id: "langs", multiple: true, size: "5", "data-testid": "langs" }, ["JavaScript", "Python", "Java", "C#", "Go", "Ruby"].map((x) => h("option", { value: x.toLowerCase(), text: x })));
    const mOut = h("p", { class: "mono", "data-testid": "langs-out", text: "Selected: none" });
    multi.addEventListener("change", () => (mOut.textContent = "Selected: " + ([...multi.selectedOptions].map((o) => o.value).join(", ") || "none")));

    // autocomplete
    const ac = h("input", { type: "text", id: "ac", role: "combobox", "aria-expanded": "false", "aria-autocomplete": "list", autocomplete: "off", placeholder: "Type a country…", "data-testid": "autocomplete" });
    const list = h("ul", { role: "listbox", class: "menu", style: { display: "none", listStyle: "none", margin: 0, width: "100%" }, "data-testid": "suggestions" });
    let idx = -1, shown = [];
    const render = () => {
      const q = ac.value.trim().toLowerCase();
      shown = q ? COUNTRIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8) : [];
      list.replaceChildren(...shown.map((c, i) => h("li", { role: "option", "aria-selected": String(i === idx), style: { padding: "7px 10px", borderRadius: "6px", cursor: "pointer", background: i === idx ? "var(--accent-soft)" : "" }, onMousedown: (e) => { e.preventDefault(); choose(c); } }, c)));
      list.style.display = shown.length ? "block" : "none"; ac.setAttribute("aria-expanded", String(!!shown.length));
    };
    const acOut = h("p", { class: "mono", "data-testid": "ac-out", text: "Chosen: none" });
    const choose = (c) => { ac.value = c; acOut.textContent = "Chosen: " + c; idx = -1; shown = []; list.style.display = "none"; };
    ac.addEventListener("input", () => { idx = -1; render(); });
    ac.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { idx = Math.min(shown.length - 1, idx + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && shown[idx]) { choose(shown[idx]); e.preventDefault(); }
      else if (e.key === "Escape") { shown = []; render(); }
    });
    ac.addEventListener("blur", () => setTimeout(() => { list.style.display = "none"; }, 100));

    // custom dropdown with long list
    const items = Array.from({ length: 200 }, (_, i) => "Item " + (i + 1));
    const trigger = h("button", { class: "btn", type: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "data-testid": "custom-trigger" }, "Choose an item ▾");
    const box = h("div", { class: "menu", role: "listbox", style: { display: "none", maxHeight: "200px", overflowY: "auto" }, "data-testid": "custom-list" }, items.map((it) => h("button", { type: "button", role: "option", onClick: () => { trigger.textContent = it + " ▾"; box.style.display = "none"; trigger.setAttribute("aria-expanded", "false"); cOut.textContent = "Picked: " + it; } }, it)));
    const cOut = h("p", { class: "mono", "data-testid": "custom-out", text: "Picked: none" });
    trigger.addEventListener("click", () => { const open = box.style.display === "none"; box.style.display = open ? "block" : "none"; trigger.setAttribute("aria-expanded", String(open)); });

    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Select" }), field("Favourite fruit", sel), selOut),
      stage(h("h2", { text: "Multi-select" }), field("Languages (Ctrl/Cmd-click)", multi), mOut),
      stage(h("h2", { text: "Autocomplete" }), h("div", { style: { position: "relative" } }, field("Country", ac), list), acOut),
      stage(h("h2", { text: "Custom scrolling listbox" }), h("div", { style: { position: "relative" } }, trigger, box), cOut)));
  },
});

// ---------------------------------------------------------------- datepickers
const pad = (n) => String(n).padStart(2, "0");
function calendar(input, onPick, { min } = {}) {
  let view = new Date(); view.setDate(1);
  const pop = h("div", { class: "cal", style: { display: "none" }, role: "dialog", "aria-label": "Choose date", "data-testid": "calendar" });
  const draw = () => {
    const y = view.getFullYear(), m = view.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const yearSel = h("select", { "aria-label": "Year", "data-testid": "cal-year", style: { width: "auto" }, onChange: (e) => { view.setFullYear(+e.target.value); draw(); } }, Array.from({ length: 21 }, (_, i) => 2016 + i).map((yy) => h("option", { value: yy, selected: yy === y, text: yy })));
    pop.replaceChildren(
      h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "8px" } },
        h("button", { class: "btn sm", type: "button", "aria-label": "Previous month", "data-testid": "cal-prev", onClick: () => { view.setMonth(m - 1); draw(); } }, "‹"),
        h("b", { "data-testid": "cal-title", text: view.toLocaleString("en", { month: "long" }) }), yearSel,
        h("button", { class: "btn sm", type: "button", "aria-label": "Next month", "data-testid": "cal-next", onClick: () => { view.setMonth(m + 1); draw(); } }, "›")),
      h("div", { class: "cal-grid" }, ["S", "M", "T", "W", "T", "F", "S"].map((d) => h("span", { text: d })), Array.from({ length: first }, () => h("span")),
        Array.from({ length: days }, (_, i) => {
          const d = new Date(y, m, i + 1), disabled = min && d < min;
          return h("button", { type: "button", disabled, "data-date": `${y}-${pad(m + 1)}-${pad(i + 1)}`, class: input.dataset.iso === `${y}-${pad(m + 1)}-${pad(i + 1)}` ? "sel" : "", onClick: () => { input.value = `${pad(i + 1)}/${pad(m + 1)}/${y}`; input.dataset.iso = `${y}-${pad(m + 1)}-${pad(i + 1)}`; pop.style.display = "none"; onPick?.(d); input.dispatchEvent(new Event("change", { bubbles: true })); } }, String(i + 1));
        })));
  };
  input.readOnly = true;
  input.addEventListener("click", () => { draw(); pop.style.display = "block"; });
  document.addEventListener("click", (e) => { if (!pop.contains(e.target) && e.target !== input) pop.style.display = "none"; });
  return pop;
}
page({
  id: "datepickers", group: "elements", title: "Date pickers",
  blurb: "Native date, month and time inputs plus a custom calendar widget and a validated date range.",
  tasks: ["Fill the native date input with a fixed date and read back its value.", "Open the custom calendar, change month and year, pick the 15th.", "Pick a range where end < start and assert the validation message.", "Assert past days are disabled in the “future only” picker."],
  render(root) {
    const nat = h("input", { type: "date", id: "native-date", "data-testid": "native-date" });
    const natOut = h("p", { class: "mono", "data-testid": "native-out", text: "Value: —" });
    nat.addEventListener("change", () => (natOut.textContent = "Value: " + (nat.value || "—")));
    const month = h("input", { type: "month", "data-testid": "native-month" }), time = h("input", { type: "time", "data-testid": "native-time" });

    const custom = h("input", { type: "text", id: "custom-date", placeholder: "DD/MM/YYYY", "data-testid": "custom-date" });
    const cal = calendar(custom);
    const fut = h("input", { type: "text", id: "future-date", placeholder: "Future dates only", "data-testid": "future-date" });
    const calF = calendar(fut, null, { min: new Date(new Date().setHours(0, 0, 0, 0)) });

    const start = h("input", { type: "text", id: "range-start", placeholder: "Start", "data-testid": "range-start" }), end = h("input", { type: "text", id: "range-end", placeholder: "End", "data-testid": "range-end" });
    const rOut = h("p", { "data-testid": "range-out", class: "mono", role: "status", text: "Pick a start and end date" });
    const calS = calendar(start), calE = calendar(end);
    const check = () => {
      if (!start.dataset.iso || !end.dataset.iso) return;
      rOut.className = "mono alert " + (end.dataset.iso < start.dataset.iso ? "bad" : "ok");
      rOut.textContent = end.dataset.iso < start.dataset.iso ? "End date must be on or after the start date" : `Range OK: ${start.dataset.iso} → ${end.dataset.iso}`;
    };
    start.addEventListener("change", check); end.addEventListener("change", check);

    const rel = (el, pop) => h("div", { style: { position: "relative" } }, el, pop);
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Native inputs" }), field("Date", nat), natOut, field("Month", month), field("Time", time)),
      stage(h("h2", { text: "Custom calendar" }), field("Date of birth", custom), cal, field("Booking (future only)", fut), calF),
      stage(h("h2", { text: "Date range" }), h("div", { class: "grid g2" }, h("div", { style: { position: "relative" } }, field("From", start), calS), h("div", { style: { position: "relative" } }, field("To", end), calE)), rOut)));
  },
});

// ---------------------------------------------------------------- sliders
page({
  id: "sliders", group: "elements", title: "Sliders & ranges",
  blurb: "Single range input, a two-handle price range and keyboard control with arrow keys.",
  tasks: ["Set the volume slider to exactly 70 using the keyboard.", "Drag the min price above the max and assert it is clamped.", "Assert the live label updates while dragging."],
  render(root) {
    const vol = h("input", { type: "range", min: "0", max: "100", value: "30", id: "volume", "data-testid": "volume" });
    const vOut = h("output", { "data-testid": "volume-out", for: "volume", class: "tag acc", text: "30" });
    vol.addEventListener("input", () => (vOut.textContent = vol.value));
    const lo = h("input", { type: "range", min: "0", max: "1000", value: "200", step: "10", "aria-label": "Minimum price", "data-testid": "price-min" });
    const hi = h("input", { type: "range", min: "0", max: "1000", value: "800", step: "10", "aria-label": "Maximum price", "data-testid": "price-max" });
    const pOut = h("p", { class: "mono", "data-testid": "price-out", text: "$200 – $800" });
    const upd = (who) => {
      if (+lo.value > +hi.value) (who === lo ? hi : lo).value = who.value;
      pOut.textContent = `$${lo.value} – $${hi.value}`;
    };
    lo.addEventListener("input", () => upd(lo)); hi.addEventListener("input", () => upd(hi));
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Volume" }), h("div", { class: "row", style: { flexWrap: "nowrap" } }, vol, vOut)),
      stage(h("h2", { text: "Price range" }), h("div", { class: "stack" }, lo, hi, pOut))));
  },
});

// ---------------------------------------------------------------- files
page({
  id: "files", group: "elements", title: "File upload & download",
  blurb: "Single and multiple upload with type/size validation, a drop zone, real server upload and genuine file downloads.",
  tasks: ["Upload a .png with setInputFiles and assert it appears in the list.", "Upload a file over 1 MB and assert the error.", "Upload a .exe and assert it is rejected.", "Click each download link and assert the downloaded file name and contents.", "Send the files to the server and assert the 201 response."],
  render(root) {
    const files = [];
    const list = h("ul", { "data-testid": "file-list", style: { paddingLeft: "18px" } });
    const msg = h("div", { "data-testid": "upload-msg" });
    const srv = resultPre("upload-result");
    const input = h("input", { type: "file", id: "file-input", multiple: true, accept: ".png,.jpg,.jpeg,.pdf,.txt,.csv", "data-testid": "file-input" });
    const drop = h("div", { class: "dropzone", "data-testid": "dropzone" }, "Drop files here or use the picker above");
    const OK = /\.(png|jpe?g|pdf|txt|csv)$/i;
    const add = (fl) => {
      const errs = [];
      for (const f of fl) {
        if (!OK.test(f.name)) errs.push(`${f.name}: type not allowed`);
        else if (f.size > 1024 * 1024) errs.push(`${f.name}: larger than 1 MB`);
        else files.push(f);
      }
      msg.replaceChildren(...errs.map((e) => h("div", { class: "alert bad", role: "alert", "data-testid": "upload-error", text: e })), ...(files.length && !errs.length ? [h("div", { class: "alert ok", "data-testid": "upload-ok", text: "Files ready to upload" })] : []));
      list.replaceChildren(...files.map((f, i) => h("li", { "data-testid": "file-item" }, `${f.name} (${(f.size / 1024).toFixed(1)} KB) `, h("button", { class: "btn sm", type: "button", "data-testid": "file-remove", onClick: () => { files.splice(i, 1); add([]); } }, "remove"))));
    };
    input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); add([...e.dataTransfer.files]); });
    const send = h("button", { class: "btn primary", type: "button", "data-testid": "upload-send", onClick: async () => {
      if (!files.length) { toast("Add a file first", "warn"); return; }
      const fd = new FormData(); files.forEach((f) => fd.append("files", f, f.name));
      const r = await api("POST", "/api/upload", fd);
      srv.textContent = `HTTP ${r.status}\n` + pretty(r.data);
    } }, "Upload to server");
    const blobDl = h("button", { class: "btn", type: "button", "data-testid": "download-blob", onClick: () => {
      const a = h("a", { href: URL.createObjectURL(new Blob(["generated in the browser at " + new Date().toISOString()], { type: "text/plain" })), download: "generated.txt" });
      document.body.append(a); a.click(); a.remove();
    } }, "Generate & download (blob)");
    const BASE = (window.TESTYARD_API_BASE || "").replace(/\/$/, "");
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Upload" }), field("Choose files (png, jpg, pdf, txt, csv · max 1 MB)", input), drop, msg, list, h("div", { class: "row", style: { marginTop: "12px" } }, send), h("div", { class: "result" }, srv)),
      stage(h("h2", { text: "Download" }), h("div", { class: "stack" },
        ["sample.csv", "sample.json", "sample.txt"].map((n) => h("div", {}, h("a", { class: "btn", href: `${BASE}/api/files/${n}`, download: n, "data-testid": "download-" + n.replace(".", "-") }, "⬇ " + n))), blobDl,
        h("p", { class: "hint", text: "The first three are served by the API with Content-Disposition: attachment." })))));
  },
});

// ---------------------------------------------------------------- dialogs
page({
  id: "dialogs", group: "elements", title: "Alerts, modals & popups",
  blurb: "Native JavaScript dialogs, an accessible custom modal, cookie banner, entry ad, exit intent and new windows.",
  tasks: ["Register page.on('dialog') and accept/dismiss alert, confirm and prompt.", "Type into the prompt and assert the echoed text.", "Open the modal, press Escape and assert it closes.", "Enable the entry ad, wait for it, and close it.", "Click “Open popup window” and switch to the new page."],
  render(root) {
    const out = h("p", { class: "mono", "data-testid": "dialog-out", role: "status", text: "Result: —" });
    const set = (t) => (out.textContent = "Result: " + t);
    const btn = (label, id, fn) => h("button", { class: "btn", type: "button", "data-testid": id, onClick: fn }, label);

    const banner = h("div", { class: "alert info", style: { display: "none" }, "data-testid": "cookie-banner", role: "dialog", "aria-label": "Cookie consent" },
      "We use cookies to improve your experience. ", h("button", { class: "btn sm primary", type: "button", "data-testid": "cookie-accept", onClick: () => (banner.style.display = "none") }, "Accept"), " ", h("button", { class: "btn sm", type: "button", "data-testid": "cookie-reject", onClick: () => (banner.style.display = "none") }, "Reject"));

    let exitOn = false;
    const onLeave = (e) => { if (exitOn && e.clientY <= 0) { exitOn = false; modal({ title: "Wait — before you go!", body: "Here is a 10% discount code: TESTYARD10", actions: [{ label: "No thanks" }] }); } };
    document.addEventListener("mouseleave", onLeave);

    root.append(
      stage(h("h2", { text: "JavaScript dialogs" }), h("div", { class: "row" },
        btn("Alert", "js-alert", () => { alert("Hello from an alert"); set("alert closed"); }),
        btn("Confirm", "js-confirm", () => set(confirm("Do you confirm?") ? "OK" : "Cancel")),
        btn("Prompt", "js-prompt", () => { const v = prompt("What is your name?", "Guest"); set(v === null ? "prompt cancelled" : "Hello, " + v); })), out),
      stage(h("h2", { text: "Custom modal" }), h("div", { class: "row" },
        btn("Open modal", "open-modal", () => modal({ title: "Subscribe", body: "Press Escape, click outside, or use a button to close this dialog.", actions: [{ label: "Cancel" }, { label: "Subscribe", primary: true, onClick: () => toast("Subscribed!", "ok") }] })),
        btn("Show cookie banner", "show-cookie", () => (banner.style.display = "block")),
        btn("Entry ad in 2 s", "entry-ad", async () => { await sleep(2000); modal({ title: "Limited offer", body: "Sign up today and get 20% off.", actions: [{ label: "Close" }] }); }),
        btn("Arm exit intent", "exit-intent", () => { exitOn = true; toast("Move the mouse out of the top of the window", "info"); })), h("div", { style: { marginTop: "14px" } }, banner)),
      stage(h("h2", { text: "New tab & popup window" }), h("div", { class: "row" },
        h("a", { class: "btn", href: "/practice/window-child", target: "_blank", rel: "noopener", "data-testid": "new-tab" }, "Open new tab"),
        btn("Open popup window", "popup", () => window.open("/practice/window-child", "ty-popup", "width=480,height=320")))));
    return () => document.removeEventListener("mouseleave", onLeave);
  },
});
