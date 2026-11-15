// TestYard locator engine.
// Evaluates, against a live DOM: CSS selectors, XPath 1.0 (axes and functions), Playwright selector strings
// (text=, role=, id=, data-testid=, >> chains, :has-text() and friends) and Playwright locator API chains
// such as page.getByRole("button", { name: "Save" }).filter({ hasText: "x" }).nth(1).
// Nothing here touches the DOM at load time, so the module is safe to import on the server.

const SKIP_TEXT = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "TEMPLATE", "META", "LINK", "TITLE", "BASE"]);
export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const lc = (s) => String(s).toLowerCase();
export class EngineError extends Error {}

// ------------------------------------------------------------------ tree helpers
/** All descendant elements of a scope in document order; open shadow roots are pierced. */
export function descendants(scope) {
  const out = [];
  const visit = (n) => {
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) {
      out.push(c);
      if (c.shadowRoot) visit(c.shadowRoot);
      visit(c);
    }
  };
  if (scope.nodeType === 1 && scope.shadowRoot) visit(scope.shadowRoot);
  visit(scope);
  return out;
}
const parentEl = (e) => e.parentElement || (e.parentNode && e.parentNode.host) || null;
const winOf = (el) => (el.ownerDocument || el).defaultView;
const uniq = (arr) => [...new Set(arr)];

// ------------------------------------------------------------------ text
function textOf(el, cache) {
  if (cache?.has(el)) return cache.get(el);
  let s = "";
  if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) s = el.value;
  else {
    const add = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.nodeValue;
        else if (c.nodeType === 1 && !SKIP_TEXT.has(c.tagName)) {
          if (c.tagName === "SLOT" && c.assignedNodes?.({ flatten: true }).length) {
            for (const a of c.assignedNodes({ flatten: true })) s += a.nodeType === 3 ? a.nodeValue : a.nodeType === 1 ? textOf(a, cache) : "";
          } else s += textOf(c, cache);
        }
      }
    };
    add(el.shadowRoot || el);
  }
  cache?.set(el, s);
  return s;
}
const makeMatcher = (v, exact) => {
  if (v instanceof RegExp) return (t) => { v.lastIndex = 0; return v.test(t); };
  const want = norm(v);
  return exact ? (t) => norm(t) === want : (t) => lc(norm(t)).includes(lc(want));
};
/** Smallest element whose text matches: the element matches and none of its child elements do. */
function textSelf(el, m, cache) {
  if (SKIP_TEXT.has(el.tagName) || !m(textOf(el, cache))) return false;
  const kids = el.shadowRoot ? el.shadowRoot.children : el.children;
  for (const c of kids) if (!SKIP_TEXT.has(c.tagName) && m(textOf(c, cache))) return false;
  return true;
}

// ------------------------------------------------------------------ visibility
export function isVisible(el) {
  if (el.tagName === "OPTION" || el.tagName === "OPTGROUP") return parentEl(el) ? isVisible(parentEl(el)) : false;
  const st = winOf(el).getComputedStyle(el);
  if (st.visibility !== "visible") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function ariaHidden(el) {
  const win = winOf(el);
  const own = win.getComputedStyle(el);
  if (own.visibility === "hidden" || own.visibility === "collapse") return true;
  for (let e = el; e; e = parentEl(e)) {
    if (e.getAttribute("aria-hidden") === "true" || win.getComputedStyle(e).display === "none") return true;
  }
  return false;
}

// ------------------------------------------------------------------ roles
const inside = (el, tags) => { for (let e = parentEl(el); e; e = parentEl(e)) if (tags.includes(e.tagName)) return true; return false; };
const INPUT_ROLE = { button: "button", image: "button", reset: "button", submit: "button", checkbox: "checkbox", radio: "radio", range: "slider", number: "spinbutton", search: "searchbox" };
const TAG_ROLE = {
  A: (e) => (e.hasAttribute("href") ? "link" : null), AREA: (e) => (e.hasAttribute("href") ? "link" : null),
  ARTICLE: "article", ASIDE: "complementary", BLOCKQUOTE: "blockquote", BUTTON: "button", CAPTION: "caption", CODE: "code",
  DATALIST: "listbox", DD: "definition", DEL: "deletion", DETAILS: "group", DFN: "term", DIALOG: "dialog", DT: "term", EM: "emphasis",
  FIELDSET: "group", FIGURE: "figure", H1: "heading", H2: "heading", H3: "heading", H4: "heading", H5: "heading", H6: "heading",
  HR: "separator", INS: "insertion", LI: "listitem", MAIN: "main", MARK: "mark", MENU: "list", METER: "meter", NAV: "navigation",
  OL: "list", UL: "list", OPTGROUP: "group", OPTION: "option", OUTPUT: "status", P: "paragraph", PROGRESS: "progressbar",
  STRONG: "strong", SUB: "subscript", SUP: "superscript", TABLE: "table", TBODY: "rowgroup", THEAD: "rowgroup", TFOOT: "rowgroup",
  TEXTAREA: "textbox", TIME: "time", TR: "row", SEARCH: "search",
  FOOTER: (e) => (inside(e, ["ARTICLE", "ASIDE", "MAIN", "NAV", "SECTION"]) ? null : "contentinfo"),
  HEADER: (e) => (inside(e, ["ARTICLE", "ASIDE", "MAIN", "NAV", "SECTION"]) ? null : "banner"),
  IMG: (e) => (e.getAttribute("alt") === "" && !e.hasAttribute("title") ? "presentation" : "img"),
  FORM: (e) => (e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") || e.hasAttribute("title") ? "form" : null),
  SECTION: (e) => (e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") ? "region" : null),
  TD: (e) => (inside(e, ["TABLE"]) ? "cell" : null),
  TH: (e) => (e.getAttribute("scope") === "row" ? "rowheader" : "columnheader"),
  SELECT: (e) => (e.multiple || e.size > 1 ? "listbox" : "combobox"),
  INPUT: (e) => {
    const t = lc(e.getAttribute("type") || "text");
    if (t === "hidden") return null;
    if (INPUT_ROLE[t]) return INPUT_ROLE[t];
    if (e.hasAttribute("list")) return "combobox";
    return "textbox";
  },
};
export function roleOf(el) {
  const explicit = (el.getAttribute("role") || "").trim().split(/\s+/)[0];
  if (explicit) return lc(explicit);
  const r = TAG_ROLE[el.tagName];
  return typeof r === "function" ? r(el) : r || null;
}
const NAME_FROM_CONTENT = new Set(["button", "cell", "checkbox", "columnheader", "gridcell", "heading", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "row", "rowheader", "switch", "tab", "tooltip", "treeitem"]);
const BLOCKISH = (el) => { const d = winOf(el).getComputedStyle(el).display; return d !== "inline" && d !== "contents"; };

/** Simplified accessible-name computation (accname 1.2): labelledby, aria-label, native label, alt/value, content, title. */
export function accName(el, st = { seen: new Set(), labelledby: false, rec: false, target: null }) {
  if (st.seen.has(el)) return "";
  st.seen.add(el);
  const root = el.getRootNode();
  if (!st.labelledby) {
    const ids = el.getAttribute("aria-labelledby");
    if (ids) {
      const t = norm(ids.split(/\s+/).map((id) => root.getElementById?.(id) || el.ownerDocument.getElementById(id)).filter(Boolean)
        .map((n) => accName(n, { seen: st.seen, labelledby: true, rec: false, target: el })).join(" "));
      if (t) return t;
    }
  }
  const al = norm(el.getAttribute("aria-label"));
  if (al) return al;
  const tag = el.tagName, role = roleOf(el);
  const title = () => norm(el.getAttribute("title"));
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "METER" || tag === "PROGRESS" || tag === "OUTPUT") {
    if (!st.rec || st.labelledby) {
      const t = norm([...(el.labels || [])].map((l) => fromContent(l, { seen: new Set(), labelledby: false, rec: true, target: el })).join(" "));
      if (t) return t;
    }
    const type = lc(el.getAttribute("type") || "text");
    if (tag === "INPUT" && /^(button|submit|reset)$/.test(type)) return norm(el.value) || (type === "submit" ? "Submit" : type === "reset" ? "Reset" : "") || title();
    if (tag === "INPUT" && type === "image") return norm(el.getAttribute("alt")) || title() || "Submit";
    return title() || norm(el.getAttribute("placeholder"));
  }
  if (tag === "IMG" || tag === "AREA") return norm(el.getAttribute("alt")) || title();
  if (tag === "FIELDSET") { const lg = [...el.children].find((c) => c.tagName === "LEGEND"); if (lg) return fromContent(lg, { seen: st.seen, labelledby: false, rec: true, target: null }); }
  if (tag === "TABLE") { const cap = [...el.children].find((c) => c.tagName === "CAPTION"); if (cap) return fromContent(cap, { seen: st.seen, labelledby: false, rec: true, target: null }); }
  if (tag === "FIGURE") { const cap = [...el.children].find((c) => c.tagName === "FIGCAPTION"); if (cap) return fromContent(cap, { seen: st.seen, labelledby: false, rec: true, target: null }); }
  if (tag === "svg" || tag === "SVG") { const t = [...el.children].find((c) => c.tagName.toLowerCase() === "title"); if (t) return norm(t.textContent); }
  if ((role && NAME_FROM_CONTENT.has(role)) || st.rec) { const t = fromContent(el, { ...st, rec: true }); if (t) return t; }
  return title();
}
function fromContent(el, st) {
  let out = "";
  for (const c of el.childNodes) {
    if (c.nodeType === 3) out += c.nodeValue;
    else if (c.nodeType === 1 && c !== st.target && !SKIP_TEXT.has(c.tagName)) {
      if (!st.labelledby && ariaHidden(c)) continue;
      const r = roleOf(c);
      let t;
      if (c.tagName === "INPUT" && (r === "textbox" || r === "searchbox" || r === "spinbutton" || r === "slider")) t = c.value;
      else if (c.tagName === "SELECT") t = [...c.selectedOptions].map((o) => o.textContent).join(" ");
      else t = accName(c, { seen: st.seen, labelledby: st.labelledby, rec: true, target: st.target });
      out += BLOCKISH(c) ? ` ${t} ` : t;
    }
  }
  return norm(out);
}
const isDisabled = (el) => {
  if ("disabled" in el && el.disabled === true) return true;
  for (let e = el; e; e = parentEl(e)) if (e.getAttribute("aria-disabled") === "true") return true;
  const fs = el.closest?.("fieldset[disabled]");
  if (fs) { const lg = [...fs.children].find((c) => c.tagName === "LEGEND"); return !(lg && lg.contains(el)); }
  return false;
};
const checkedState = (el) => {
  const a = el.getAttribute("aria-checked");
  if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) return el.indeterminate ? "mixed" : el.checked;
  if (a === "true") return true; if (a === "false") return false; if (a === "mixed") return "mixed";
  const r = roleOf(el);
  return ["checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio"].includes(r) ? false : null;
};
const boolAttr = (el, n) => { const a = el.getAttribute(n); return a === "true" ? true : a === "false" ? false : a === "mixed" ? "mixed" : null; };
function roleMatch(el, role, o) {
  if (roleOf(el) !== role) return false;
  if (!o.includeHidden && ariaHidden(el)) return false;
  if (o.checked !== undefined && checkedState(el) !== o.checked) return false;
  if (o.disabled !== undefined && isDisabled(el) !== o.disabled) return false;
  if (o.expanded !== undefined && boolAttr(el, "aria-expanded") !== o.expanded) return false;
  if (o.pressed !== undefined && boolAttr(el, "aria-pressed") !== o.pressed) return false;
  if (o.selected !== undefined) { const s = el.tagName === "OPTION" ? el.selected : boolAttr(el, "aria-selected"); if (s !== o.selected) return false; }
  if (o.level !== undefined) { const lv = el.getAttribute("aria-level") ? Number(el.getAttribute("aria-level")) : /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : null; if (lv !== o.level) return false; }
  if (o.name !== undefined && !makeMatcher(o.name, o.exact)(accName(el))) return false;
  return true;
}

// ------------------------------------------------------------------ attribute / label getters
function labelTexts(el) {
  const out = [];
  if (el.labels) for (const l of el.labels) out.push(norm(fromContent(l, { seen: new Set(), labelledby: false, rec: true, target: el })));
  const ids = el.getAttribute("aria-labelledby");
  if (ids) for (const id of ids.split(/\s+/)) { const n = el.getRootNode().getElementById?.(id) || el.ownerDocument.getElementById(id); if (n) out.push(norm(textOf(n))); }
  const al = el.getAttribute("aria-label");
  if (al) out.push(norm(al));
  return out;
}

// ------------------------------------------------------------------ CSS (with Playwright extensions) and XPath
function splitArgs(body) { // split on top-level commas, respecting quotes and parentheses
  const parts = []; let depth = 0, q = "", cur = "";
  for (const ch of body) {
    if (q) { cur += ch; if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; } else if (ch === "(") { depth++; cur += ch; } else if (ch === ")") { depth--; cur += ch; } else if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim());
}
const unquote = (s) => { s = s.trim(); const m = /^(["'])([\s\S]*)\1$/.exec(s); return m ? m[2].replace(/\\(["'\\])/g, "$1") : s; };
const PW_PSEUDO = /:(has-text|text-is|text-matches|text|visible|nth-match)(?=\(|[^\w-]|$)/;
function readParen(str, from) { // from points at "("; returns index after matching ")"
  let depth = 0, q = "";
  for (let i = from; i < str.length; i++) {
    const ch = str[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") q = ch; else if (ch === "(") depth++; else if (ch === ")") { depth--; if (depth === 0) return i + 1; }
  }
  throw new EngineError("Unbalanced parentheses in selector");
}

/** Split one complex selector into [{comb, compound}] at top-level combinators (so we can walk across shadow boundaries). */
function tokenizeComplex(sel) {
  const toks = []; let cur = "", depth = 0, q = "", comb = " ";
  const push = () => { if (cur) { toks.push({ comb, compound: cur }); cur = ""; } };
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (q) { cur += ch; if (ch === "\\") cur += sel[++i] ?? ""; else if (ch === q) q = ""; continue; }
    if (ch === "\\") { cur += ch + (sel[++i] ?? ""); continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "[" || ch === "(") depth++; else if (ch === "]" || ch === ")") depth--;
    if (depth === 0 && (/\s/.test(ch) || ch === ">" || ch === "+" || ch === "~")) {
      push();
      let j = i, c = " ";
      while (j < sel.length && (/\s/.test(sel[j]) || ">+~".includes(sel[j]))) { if (">+~".includes(sel[j])) c = sel[j]; j++; }
      comb = c; i = j - 1; continue;
    }
    cur += ch;
  }
  push();
  return toks;
}
function composedMatch(el, toks, idx) {
  const t = toks[idx];
  if (!el.matches(t.compound)) return false;
  if (idx === 0) return true;
  if (t.comb === ">") { const p = parentEl(el); return !!p && composedMatch(p, toks, idx - 1); }
  if (t.comb === "+") { const s = el.previousElementSibling; return !!s && composedMatch(s, toks, idx - 1); }
  if (t.comb === "~") { for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (composedMatch(s, toks, idx - 1)) return true; return false; }
  for (let a = parentEl(el); a; a = parentEl(a)) if (composedMatch(a, toks, idx - 1)) return true;
  return false;
}
function queryCSS(sel, scope, ctx) {
  const nm0 = /^:nth-match\(/.exec(sel);
  if (nm0) {
    const close = readParen(sel, nm0[0].length - 1);
    const [inner, idx] = splitArgs(sel.slice(nm0[0].length, close - 1));
    const list = queryCSS(inner, scope, ctx);
    const i = Number(idx) - 1;
    return list[i] ? [list[i]] : [];
  }
  const lead = /^\s*([>+~])\s*([\s\S]+)$/.exec(sel);
  if (lead && scope.nodeType === 1) { // relative selector such as "+ p": anchor it to the scope element
    scope.setAttribute("data-ty-scope", "");
    try { return queryCSS(`[data-ty-scope] ${lead[1]} ${lead[2]}`, scope.parentNode || scope, ctx).filter((e) => e !== scope); }
    finally { scope.removeAttribute("data-ty-scope"); }
  }
  const all = descendants(scope);
  const marks = [];
  let css = sel, n = 0, m;
  const mark = new Set();
  while ((m = PW_PSEUDO.exec(css))) {
    const name = m[1], start = m.index;
    let end = start + m[0].length, arg = "";
    if (css[end] === "(") { const close = readParen(css, end); arg = css.slice(end + 1, close - 1); end = close; }
    if (name === "nth-match") throw new EngineError(":nth-match() must wrap the whole selector, e.g. :nth-match(li.item, 2)");
    const attr = "data-ty-p" + n++;
    let test;
    if (name === "visible") test = (e) => isVisible(e);
    else if (name === "has-text") { const mm = makeMatcher(unquote(arg), false); test = (e) => mm(textOf(e, ctx.text)); }
    else if (name === "text") { const mm = makeMatcher(unquote(arg), false); test = (e) => textSelf(e, mm, ctx.text); }
    else if (name === "text-is") { const mm = makeMatcher(unquote(arg), true); test = (e) => textSelf(e, mm, ctx.text); }
    else { const [re, fl] = splitArgs(arg); let rx; try { rx = new RegExp(unquote(re), unquote(fl || "")); } catch (e) { throw new EngineError("Invalid regular expression in :text-matches()"); } test = (e) => textSelf(e, (t) => rx.test(t), ctx.text); }
    for (const e of all) if (test(e)) { e.setAttribute(attr, ""); marks.push(e); mark.add(attr); }
    css = css.slice(0, start) + `[${attr}]` + css.slice(end);
  }
  try {
    if (all.some((e) => e.shadowRoot)) { const sels = splitArgs(css).map(tokenizeComplex); return all.filter((e) => sels.some((t) => t.length && composedMatch(e, t, t.length - 1))); }
    return all.filter((e) => e.matches(css));
  } catch (e) {
    if (e instanceof EngineError) throw e;
    throw new EngineError(`Invalid CSS selector: ${e.message.replace(/^Failed to execute 'matches' on 'Element': /, "")}`);
  } finally {
    for (const e of marks) for (const a of mark) e.removeAttribute(a);
  }
}
function queryXPath(xp, scope, ctx) {
  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  let expr = xp.trim();
  if (expr.startsWith("/") && scope.nodeType !== 9) expr = "." + expr; // chained xpath is relative, like Playwright
  let res;
  try { res = doc.evaluate(expr, scope, null, 0 /* ANY_TYPE */, null); }
  catch (e) { throw new EngineError("Invalid XPath: " + e.message.replace(/^Failed to execute 'evaluate' on 'Document': /, "")); }
  if (res.resultType === 4) res = doc.evaluate(expr, scope, null, 5 /* ORDERED_NODE_ITERATOR_TYPE */, null);
  if (res.resultType === 1 || res.resultType === 2 || res.resultType === 3) {
    ctx.scalar = res.resultType === 1 ? res.numberValue : res.resultType === 2 ? res.stringValue : res.booleanValue;
    return [];
  }
  const out = [];
  for (let n = res.iterateNext(); n; n = res.iterateNext()) {
    if (n.nodeType === 1) out.push(n);
    else if (n.nodeType === 3) ctx.textNodes = (ctx.textNodes || 0) + 1;
    else if (n.nodeType === 2) ctx.attrNodes = (ctx.attrNodes || 0) + 1;
  }
  return out;
}

// ------------------------------------------------------------------ selector strings (>> chains, engines)
function splitChain(sel) {
  const parts = []; let q = "", depth = 0, cur = "";
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (q) { cur += ch; if (ch === "\\") cur += sel[++i] ?? ""; else if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "[" || ch === "(") depth++; else if (ch === "]" || ch === ")") depth--;
    if (depth === 0 && ch === ">" && sel[i + 1] === ">") { parts.push(cur.trim()); cur = ""; i++; continue; }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}
function parseQuotedFlag(body) { // "text"i | "text"s | text
  const m = /^(["'])([\s\S]*)\1([is]?)$/.exec(body.trim());
  return m ? { value: m[2].replace(/\\(["'\\])/g, "$1"), flag: m[3] } : { value: body.trim(), flag: "" };
}
function parseRoleBody(body) {
  const m = /^([a-z0-9_-]+)((?:\[[^\]]*\])*)\s*$/i.exec(body.trim());
  if (!m) throw new EngineError("Invalid role selector. Example: role=button[name=\"Save\"][disabled=false]");
  const o = {};
  for (const a of m[2].matchAll(/\[\s*([a-z-]+)\s*(?:=\s*((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\]]*?))\s*)?\]/gi)) {
    const key = a[1].toLowerCase().replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const raw = a[2] === undefined ? "true" : a[2];
    const q = parseQuotedFlag(raw);
    if (key === "name") { o.name = q.value; o.exact = q.flag === "s" || !/^["']/.test(raw.trim()); }
    else if (key === "level") o.level = Number(q.value);
    else o[key] = q.value === "true" ? true : q.value === "false" ? false : q.value === "mixed" ? "mixed" : q.value;
  }
  return { role: lc(m[1]), opts: o };
}
function attrExact(scope, attr, value) { return descendants(scope).filter((e) => e.getAttribute(attr) === value); }
const withSelf = (scope, list) => (scope.nodeType === 1 ? [scope, ...list] : list);
function queryPart(part, scope, ctx) {
  let m;
  if (/^(["'])[\s\S]*\1$/.test(part)) part = "text=" + part;
  else if (/^(\/|\.\.|\(\s*\/)/.test(part) || /^\.\//.test(part)) part = "xpath=" + part;
  else if (!/^[\w:-]+\s*=/.test(part)) part = "css=" + part;
  m = /^([\w:-]+)\s*=([\s\S]*)$/.exec(part);
  const name = m[1], body = m[2];
  const els = () => descendants(scope);
  switch (name) {
    case "css": return queryCSS(body.trim(), scope, ctx);
    case "xpath": return queryXPath(body, scope, ctx);
    case "id": return attrExact(scope, "id", unquote(body));
    case "data-testid": case "data-test-id": case "data-test": return attrExact(scope, name, unquote(body));
    case "text": {
      const b = body.trim();
      const rx = /^\/([\s\S]+)\/([a-z]*)$/.exec(b);
      let mm;
      if (rx) { try { const re = new RegExp(rx[1], rx[2]); mm = (t) => re.test(t); } catch { throw new EngineError("Invalid regular expression in text="); } }
      else if (/^(["'])[\s\S]*\1$/.test(b)) mm = makeMatcher(unquote(b), true);
      else mm = makeMatcher(b, false);
      return withSelf(scope, els()).filter((e) => textSelf(e, mm, ctx.text));
    }
    case "role": { const { role, opts } = parseRoleBody(body); return els().filter((e) => roleMatch(e, role, opts)); }
    case "visible": return els().filter((e) => isVisible(e) === (body.trim() !== "false"));
    case "internal:role": { const { role, opts } = parseRoleBody(body); return els().filter((e) => roleMatch(e, role, opts)); }
    case "internal:text": { const q = parseQuotedFlag(body); const mm = makeMatcher(q.value, q.flag === "s"); return els().filter((e) => textSelf(e, mm, ctx.text)); }
    case "internal:label": { const q = parseQuotedFlag(body); const mm = makeMatcher(q.value, q.flag === "s"); return els().filter((e) => labelTexts(e).some(mm)); }
    case "internal:testid": { const am = /^\[\s*([\w-]+)\s*=\s*(["'])([\s\S]*)\2[is]?\s*\]$/.exec(body.trim()); if (!am) throw new EngineError("Invalid internal:testid selector"); return attrExact(scope, am[1], am[3]); }
    case "internal:attr": {
      const am = /^\[\s*([\w-]+)\s*=\s*(["'])([\s\S]*?)\2([is]?)\s*\]$/.exec(body.trim());
      if (!am) throw new EngineError("Invalid internal:attr selector");
      const mm = makeMatcher(am[3], am[4] === "s");
      return els().filter((e) => e.hasAttribute(am[1]) && mm(e.getAttribute(am[1])));
    }
    default: throw new EngineError(`Unknown selector engine "${name}=". Supported: css, xpath, text, role, id, data-testid, nth, visible`);
  }
}
/** Resolve a Playwright selector string (possibly "a >> b >> nth=0") from the given scopes. */
function queryString(sel, scopes, ctx) {
  const parts = splitChain(sel);
  let cur = scopes;
  for (const part of parts) {
    if (!part) throw new EngineError("Empty selector part (stray >>?)");
    const nth = /^nth\s*=\s*(-?\d+)$/.exec(part);
    if (nth) { const i = Number(nth[1]); const el = cur[i < 0 ? cur.length + i : i]; cur = el ? [el] : []; continue; }
    const vis = /^visible\s*=\s*(true|false)$/.exec(part);
    if (vis) { cur = cur.filter((e) => e.nodeType === 1 && isVisible(e) === (vis[1] === "true")); continue; }
    cur = uniq(cur.flatMap((s) => queryPart(part, s, ctx)));
  }
  return cur;
}

// ------------------------------------------------------------------ locator API parser
function lexError(msg, src, i) { return new EngineError(`${msg} (at character ${i + 1}: …${src.slice(Math.max(0, i - 12), i + 12)}…)`); }
class Parser {
  constructor(src) { this.s = src; this.i = 0; }
  ws() { while (/\s/.test(this.s[this.i] || "")) this.i++; }
  peek() { this.ws(); return this.s[this.i]; }
  eat(ch) { this.ws(); if (this.s[this.i] === ch) { this.i++; return true; } return false; }
  need(ch) { if (!this.eat(ch)) throw lexError(`Expected "${ch}"`, this.s, this.i); }
  ident() { this.ws(); const m = /^[A-Za-z_$][\w$]*/.exec(this.s.slice(this.i)); if (!m) return null; this.i += m[0].length; return m[0]; }
  string() {
    const q = this.s[this.i++]; let out = "";
    while (this.i < this.s.length && this.s[this.i] !== q) {
      let ch = this.s[this.i++];
      if (q === "`" && ch === "$" && this.s[this.i] === "{") throw lexError("Template-literal ${…} is not supported here; use a plain string", this.s, this.i);
      if (ch === "\\") {
        const n = this.s[this.i++];
        if (n === "n") ch = "\n"; else if (n === "t") ch = "\t"; else if (n === "r") ch = "\r";
        else if (n === "u") { ch = String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16)); this.i += 4; }
        else if (n === "x") { ch = String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 2), 16)); this.i += 2; }
        else ch = n;
      }
      out += ch;
    }
    if (this.s[this.i] !== q) throw lexError("Unterminated string", this.s, this.i);
    this.i++;
    return out;
  }
  regex() {
    this.i++; let body = "", cls = false;
    while (this.i < this.s.length) {
      const ch = this.s[this.i];
      if (ch === "\\") { body += ch + (this.s[this.i + 1] ?? ""); this.i += 2; continue; }
      if (ch === "[") cls = true; else if (ch === "]") cls = false;
      else if (ch === "/" && !cls) break;
      body += ch; this.i++;
    }
    if (this.s[this.i] !== "/") throw lexError("Unterminated regular expression", this.s, this.i);
    this.i++;
    const fl = /^[a-z]*/.exec(this.s.slice(this.i))[0]; this.i += fl.length;
    try { return new RegExp(body, fl); } catch (e) { throw lexError("Invalid regular expression: " + e.message, this.s, this.i); }
  }
  value() {
    const c = this.peek();
    if (c === '"' || c === "'" || c === "`") return this.string();
    if (c === "/") return this.regex();
    if (c === "{") return this.object();
    if (c === "[") { this.i++; const a = []; while (this.peek() !== "]") { a.push(this.value()); if (!this.eat(",")) break; } this.need("]"); return a; }
    if (/[-\d]/.test(c || "")) { const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i)); if (!m) throw lexError("Bad number", this.s, this.i); this.i += m[0].length; return Number(m[0]); }
    const save = this.i, id = this.ident();
    if (id === "true") return true; if (id === "false") return false; if (id === "null") return null; if (id === "undefined") return undefined;
    if (id) { this.i = save; return { chain: this.chain() }; }
    throw lexError("Unexpected token", this.s, this.i);
  }
  object() {
    this.need("{"); const o = {};
    while (this.peek() !== "}") {
      const q = this.peek();
      const key = q === '"' || q === "'" ? this.string() : this.ident();
      if (!key) throw lexError("Expected an option name", this.s, this.i);
      this.need(":");
      o[key] = this.value();
      if (!this.eat(",")) break;
    }
    this.need("}");
    return o;
  }
  args() { this.need("("); const a = []; while (this.peek() !== ")") { a.push(this.value()); if (!this.eat(",")) break; } this.need(")"); return a; }
  /** ident(.ident | .ident(args))* ; calls become steps, bare property segments before the first call (page, this, frame) are ignored. */
  chain() {
    const steps = [];
    this.ident();
    if (this.peek() === "(") steps.push({ name: "", args: this.args() }); // a bare call such as locator("…")
    while (this.peek() === ".") {
      this.i++;
      const name = this.ident();
      if (!name) throw lexError("Expected a method name after the dot", this.s, this.i);
      if (this.peek() === "(") steps.push({ name, args: this.args() });
      else if (steps.length) throw lexError(`"${name}" needs parentheses: .${name}()`, this.s, this.i);
    }
    return steps;
  }
}
const TERMINALS = new Set(["click", "dblclick", "fill", "check", "uncheck", "setChecked", "hover", "press", "type", "pressSequentially", "selectOption", "setInputFiles", "focus", "blur", "tap", "dragTo", "scrollIntoViewIfNeeded", "screenshot", "clear", "selectText", "dispatchEvent", "highlight",
  "textContent", "innerText", "innerHTML", "inputValue", "getAttribute", "isVisible", "isHidden", "isChecked", "isEnabled", "isDisabled", "isEditable", "boundingBox", "evaluate", "evaluateAll", "evaluateHandle", "waitFor", "ariaSnapshot", "count", "all", "allTextContents", "allInnerTexts", "elementHandle", "elementHandles"]);
const ACTIONS = new Set(["click", "dblclick", "fill", "check", "uncheck", "setChecked", "hover", "press", "type", "pressSequentially", "selectOption", "setInputFiles", "focus", "blur", "tap", "dragTo", "scrollIntoViewIfNeeded", "screenshot", "clear", "selectText", "dispatchEvent", "highlight", "textContent", "innerText", "innerHTML", "inputValue", "getAttribute", "isVisible", "isHidden", "isChecked", "isEnabled", "isDisabled", "isEditable", "boundingBox", "evaluate", "waitFor", "ariaSnapshot", "elementHandle"]);

// ------------------------------------------------------------------ chain evaluation
const rankOf = (nodes, base) => { const all = descendants(base); const r = new Map(all.map((e, i) => [e, i])); return (e) => (r.has(e) ? r.get(e) : 1e9); };
function applyFilter(nodes, o, base, ctx) {
  let out = nodes;
  if (!o) return out;
  if (o.hasText !== undefined) { const m = makeMatcher(o.hasText, false); out = out.filter((e) => m(textOf(e, ctx.text))); }
  if (o.hasNotText !== undefined) { const m = makeMatcher(o.hasNotText, false); out = out.filter((e) => !m(textOf(e, ctx.text))); }
  if (o.has !== undefined) { if (!o.has?.chain) throw new EngineError("`has` must be a locator, e.g. { has: page.getByRole('button') }"); out = out.filter((e) => runSteps(o.has.chain, [e], ctx).nodes.length > 0); }
  if (o.hasNot !== undefined) { if (!o.hasNot?.chain) throw new EngineError("`hasNot` must be a locator"); out = out.filter((e) => runSteps(o.hasNot.chain, [e], ctx).nodes.length === 0); }
  if (o.visible !== undefined) out = out.filter((e) => isVisible(e) === !!o.visible);
  return out;
}
const needStr = (v, what) => { if (typeof v !== "string" && !(v instanceof RegExp)) throw new EngineError(`${what} needs a string or a /regex/`); return v; };
function byAttr(nodes, attr, v, o) { const m = makeMatcher(needStr(v, attr), !!o?.exact); return nodes.filter((e) => e.hasAttribute(attr) && m(e.getAttribute(attr))); }
function runSteps(steps, scopes, ctx) {
  let cur = scopes, terminal = null;
  const flat = () => uniq(cur.flatMap((s) => descendants(s)));
  for (let k = 0; k < steps.length; k++) {
    const { name, args } = steps[k];
    const a0 = args[0], o = args[1] && typeof args[1] === "object" && !(args[1] instanceof RegExp) ? args[1] : undefined;
    if (terminal) throw new EngineError(`Nothing can follow .${terminal.name}() in a locator chain`);
    switch (name) {
      case "": case "locator": {
        if (a0 && a0.chain) throw new EngineError("locator() takes a selector string. To combine locators use .and(), .or() or .filter({ has })");
        if (typeof a0 !== "string") throw new EngineError('locator() needs a selector string, e.g. locator("#id")');
        cur = applyFilter(queryString(a0, cur, ctx), o, scopes, ctx); break;
      }
      case "getByRole": {
        if (typeof a0 !== "string") throw new EngineError('getByRole() needs a role, e.g. getByRole("button", { name: "Save" })');
        const opts = o || {}; const role = lc(a0);
        cur = flat().filter((e) => roleMatch(e, role, opts)); break;
      }
      case "getByText": { const m = makeMatcher(needStr(a0, "getByText()"), !!o?.exact); cur = uniq(cur.flatMap((s) => withSelf(s, descendants(s)))).filter((e) => textSelf(e, m, ctx.text)); break; }
      case "getByLabel": { const m = makeMatcher(needStr(a0, "getByLabel()"), !!o?.exact); cur = flat().filter((e) => labelTexts(e).some(m)); break; }
      case "getByPlaceholder": cur = byAttr(flat(), "placeholder", a0, o); break;
      case "getByAltText": cur = byAttr(flat(), "alt", a0, o); break;
      case "getByTitle": cur = byAttr(flat(), "title", a0, o); break;
      case "getByTestId": { const v = needStr(a0, "getByTestId()"); cur = flat().filter((e) => { const t = e.getAttribute("data-testid"); return t !== null && (v instanceof RegExp ? v.test(t) : t === v); }); break; }
      case "first": cur = cur.slice(0, 1); break;
      case "last": cur = cur.slice(-1); break;
      case "nth": { if (typeof a0 !== "number") throw new EngineError("nth() needs a number"); const el = cur[a0 < 0 ? cur.length + a0 : a0]; cur = el ? [el] : []; break; }
      case "filter": cur = applyFilter(cur, a0, scopes, ctx); break;
      case "and": { if (!a0?.chain) throw new EngineError("and() needs a locator"); const other = new Set(runSteps(a0.chain, scopes, ctx).nodes); cur = cur.filter((e) => other.has(e)); break; }
      case "or": {
        if (!a0?.chain) throw new EngineError("or() needs a locator");
        const rank = rankOf(null, scopes[0].nodeType === 9 ? scopes[0] : scopes[0].getRootNode());
        cur = uniq([...cur, ...runSteps(a0.chain, scopes, ctx).nodes]).sort((x, y) => rank(x) - rank(y)); break;
      }
      case "frameLocator": {
        if (typeof a0 !== "string") throw new EngineError('frameLocator() needs a selector, e.g. frameLocator("iframe[name=x]")');
        const frames = queryString(a0, cur, ctx).filter((e) => /^I?FRAME$/.test(e.tagName));
        if (!frames.length) { ctx.notes.push(`frameLocator("${a0}") matched no <iframe>`); cur = []; }
        else cur = frames.map((f) => f.contentDocument).filter(Boolean);
        ctx.inFrame = true; break;
      }
      case "contentFrame": ctx.notes.push("contentFrame() is shown as frameLocator()"); cur = cur.filter((e) => /^I?FRAME$/.test(e.tagName)).map((f) => f.contentDocument).filter(Boolean); break;
      case "owner": ctx.notes.push("owner() returns the <iframe> element"); break;
      case "describe": break;
      default:
        if (TERMINALS.has(name)) { terminal = { name, args }; break; }
        throw new EngineError(`Unknown locator method .${name}(). Try getByRole, getByText, getByLabel, getByPlaceholder, getByAltText, getByTitle, getByTestId, locator, filter, first, last, nth, and, or, frameLocator`);
    }
  }
  cur = cur.filter((n) => n && n.nodeType === 1);
  return { nodes: cur, terminal };
}

// ------------------------------------------------------------------ expect() assertions
function runAssertion(src, root, ctx) {
  const p = new Parser(src);
  p.ident(); // expect
  if (p.eat(".")) p.ident(); // expect.soft / expect.poll
  p.need("(");
  const chain = p.chain();
  p.need(")");
  let negated = false;
  p.need(".");
  let name = p.ident();
  if (name === "not") { negated = true; p.need("."); name = p.ident(); }
  const args = p.peek() === "(" ? p.args() : [];
  const { nodes, terminal } = runSteps(chain, [root], ctx);
  if (terminal) throw new EngineError("expect() takes a locator, not the result of ." + terminal.name + "()");
  const exp = args[0];
  const one = () => (nodes.length === 1 ? nodes[0] : null);
  let ok, detail = "";
  const strictNeeded = name !== "toHaveCount";
  if (strictNeeded && nodes.length > 1) return { nodes, assertion: { ok: false, message: `Error: strict mode violation: locator resolved to ${nodes.length} elements. Narrow it down (first(), nth(), filter(), a more specific locator).` } };
  const el = one();
  const str = (v) => (v instanceof RegExp ? v.toString() : JSON.stringify(v));
  switch (name) {
    case "toHaveCount": ok = nodes.length === exp; detail = `received ${nodes.length}`; break;
    case "toBeAttached": ok = !!el; break;
    case "toBeVisible": ok = !!el && isVisible(el); break;
    case "toBeHidden": ok = !el || !isVisible(el); break;
    case "toBeEnabled": ok = !!el && !isDisabled(el); break;
    case "toBeDisabled": ok = !!el && isDisabled(el); break;
    case "toBeChecked": ok = !!el && checkedState(el) === (args[0]?.checked ?? true); break;
    case "toBeEditable": ok = !!el && !isDisabled(el) && !el.readOnly; break;
    case "toBeEmpty": ok = !!el && !norm(textOf(el)) && !el.value; break;
    case "toHaveText": ok = !!el && makeMatcher(exp, true)(textOf(el)) ; if (typeof exp === "string" && el) ok = norm(textOf(el)) === norm(exp); detail = el ? `received ${JSON.stringify(norm(textOf(el)))}` : ""; break;
    case "toContainText": ok = !!el && makeMatcher(exp, false)(textOf(el)); detail = el ? `received ${JSON.stringify(norm(textOf(el)))}` : ""; break;
    case "toHaveValue": ok = !!el && (exp instanceof RegExp ? exp.test(el.value) : el.value === exp); detail = el ? `received ${JSON.stringify(el.value)}` : ""; break;
    case "toHaveAttribute": { const v = el?.getAttribute(exp); ok = args.length < 2 ? v !== null && v !== undefined : v !== null && (args[1] instanceof RegExp ? args[1].test(v) : v === args[1]); detail = el ? `received ${JSON.stringify(v)}` : ""; break; }
    case "toHaveClass": { const c = el?.getAttribute("class") || ""; ok = !!el && (exp instanceof RegExp ? exp.test(c) : norm(c) === norm(exp)); detail = `received ${JSON.stringify(c)}`; break; }
    case "toHaveId": ok = !!el && el.id === exp; break;
    default: throw new EngineError(`Assertion .${name}() is not simulated here. Supported: toHaveCount, toBeVisible, toBeHidden, toBeEnabled, toBeDisabled, toBeChecked, toBeAttached, toBeEditable, toBeEmpty, toHaveText, toContainText, toHaveValue, toHaveAttribute, toHaveClass, toHaveId`);
  }
  const pass = negated ? !ok : ok;
  const shown = `expect(locator)${negated ? ".not" : ""}.${name}(${args.map(str).join(", ")})`;
  return { nodes, assertion: { ok: pass, message: pass ? `✔ ${shown} would pass` : `✘ ${shown} would fail${detail ? " (" + detail + ")" : ""}${!el && nodes.length === 0 && name !== "toHaveCount" && name !== "toBeHidden" && name !== "toBeAttached" ? ": locator resolved to 0 elements" : ""}` } };
}

// ------------------------------------------------------------------ public API
const XP_FUNCS = ["contains", "starts-with", "normalize-space", "translate", "substring-before", "substring-after", "substring", "string-length", "concat", "count", "last", "position", "not", "name", "local-name", "sum", "floor", "ceiling", "round", "boolean", "number", "string", "lang"];
export function detectKind(input) {
  const s = input.trim().replace(/^await\s+/, "");
  if (/^expect(\.\w+)?\s*\(/.test(s)) return "assertion";
  if (/^(page|this|frame|locator|loc|[a-z]\w*)\s*\.\s*(getBy\w+|locator|frameLocator|filter|first|last|nth)\s*\(/.test(s) || /^(getBy\w+|locator|frameLocator)\s*\(/.test(s)) return "pw-api";
  if (/^(xpath\s*=)?\s*(\/|\(\s*\/|\.\/|\.\.|\.\s*$)/.test(s) || /^xpath\s*=/.test(s)) return "xpath";
  if (/^(["'])[\s\S]*\1$/.test(s) || /^(css|text|role|id|data-testid|data-test-id|data-test|nth|visible|internal:[\w-]+)\s*=/.test(s) || s.includes(" >> ")) return "pw-selector";
  return "css";
}
export function describeKind(input) {
  const kind = detectKind(input);
  const s = input.trim();
  const chips = [];
  let label;
  if (kind === "css") {
    label = "CSS selector";
    const ext = [...s.matchAll(/:(has-text|text-is|text-matches|text|visible|nth-match)\b/g)].map((m) => m[1]);
    if (ext.length) label = "CSS + Playwright pseudo-classes";
    for (const m of s.matchAll(/(?<!:):([a-z-]+)/g)) chips.push(":" + m[1]);
    for (const m of s.matchAll(/\[([\w-]+)\s*([~|^$*]?=)/g)) if (m[2] !== "=") chips.push(`[attr${m[2]}]`);
    if (/[>+~]/.test(s.replace(/\[[^\]]*\]/g, ""))) chips.push("combinator");
  } else if (kind === "xpath") {
    const axes = [...new Set([...s.matchAll(/([a-z-]+)::/g)].map((m) => m[1]))];
    label = axes.length ? "XPath with axes" : "XPath";
    axes.forEach((a) => chips.push(a + "::"));
    for (const f of XP_FUNCS) if (new RegExp(`(^|[^\\w-])${f}\\(`).test(s)) chips.push(f + "()");
    if (/\btext\(\)/.test(s)) chips.push("text()");
    if (/\|/.test(s)) chips.push("union |");
  } else if (kind === "pw-selector") {
    label = "Playwright selector";
    for (const m of s.matchAll(/(?:^|>>\s*)\s*(css|text|role|id|data-testid|data-test-id|data-test|nth|visible|xpath|internal:[\w-]+)\s*=/g)) chips.push(m[1] + "=");
    if (s.includes(">>")) chips.push(">> chain");
    for (const m of s.matchAll(/:(has-text|text-is|text-matches|text|visible|nth-match)\b/g)) chips.push(":" + m[1]);
  } else if (kind === "pw-api" || kind === "assertion") {
    label = kind === "assertion" ? "Playwright assertion" : "Playwright locator API";
    for (const m of s.matchAll(/\.?\b(getBy\w+|locator|filter|first|last|nth|and|or|frameLocator)\s*\(/g)) chips.push(m[1] + "()");
  }
  return { kind, label, chips: [...new Set(chips)] };
}
export function describeNode(el, max = 140) {
  const attrs = [...el.attributes].filter((a) => !/^data-ty-/.test(a.name)).slice(0, 5).map((a) => ` ${a.name}${a.value === "" ? "" : `="${a.value.length > 28 ? a.value.slice(0, 27) + "…" : a.value}"`}`).join("");
  const t = norm(textOf(el)).slice(0, 36);
  const s = `<${el.tagName.toLowerCase()}${attrs}>${t}${norm(textOf(el)).length > 36 ? "…" : ""}`;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Evaluate any locator expression against a document (or element). Never throws: errors are returned in .error.
 * @returns {{kind,label,chips,nodes:Element[],error:string|null,notes:string[],terminal:object|null,assertion:object|null,strict:{count:number,violates:boolean},scalar:any,textNodes:number}}
 */
export function evaluate(input, root) {
  const ctx = { text: new Map(), notes: [], scalar: undefined, textNodes: 0, attrNodes: 0 };
  const info = describeKind(input);
  const out = { ...info, nodes: [], error: null, notes: ctx.notes, terminal: null, assertion: null, strict: { count: 0, violates: false }, scalar: undefined, textNodes: 0 };
  const src = input.trim();
  if (!src) { out.error = "Type a locator above."; return out; }
  try {
    let nodes = [];
    if (info.kind === "assertion") { const r = runAssertion(src, root, ctx); nodes = r.nodes; out.assertion = r.assertion; }
    else if (info.kind === "pw-api") {
      const p = new Parser(src.replace(/^await\s+/, "").replace(/;\s*$/, ""));
      const steps = p.chain();
      p.ws();
      if (p.i < p.s.length) throw lexError("Unexpected text after the locator", p.s, p.i);
      if (!steps.length) throw new EngineError("No locator method found. Start with page.getByRole(…), page.locator(…) …");
      const r = runSteps(steps, [root], ctx);
      nodes = r.nodes; out.terminal = r.terminal;
    } else nodes = queryString(src, [root], ctx);
    out.nodes = nodes;
    out.scalar = ctx.scalar;
    out.textNodes = ctx.textNodes;
    if (ctx.scalar !== undefined) ctx.notes.push(`This XPath returned ${typeof ctx.scalar} ${JSON.stringify(ctx.scalar)}, not nodes. A locator needs an expression that returns elements; wrap it in a predicate, e.g. //ul[count(li)=3].`);
    if (ctx.textNodes) ctx.notes.push(`${ctx.textNodes} text node(s) matched. Locators return elements only, so select the parent element instead (e.g. //li[text()="x"]).`);
    if (ctx.attrNodes) ctx.notes.push("Attribute nodes (@attr) are not elements. Move the attribute into a predicate: //a[@href].");
    out.strict = { count: nodes.length, violates: nodes.length > 1 };
    if (out.terminal && ACTIONS.has(out.terminal.name) && nodes.length > 1) ctx.notes.push(`.${out.terminal.name}() would throw "strict mode violation: locator resolved to ${nodes.length} elements". Narrow it down or use .first()/.nth()/.filter().`);
    if (out.terminal && ACTIONS.has(out.terminal.name) && nodes.length === 0) ctx.notes.push(`.${out.terminal.name}() would wait until its timeout and then fail: the locator resolves to 0 elements.`);
    if (out.terminal && out.terminal.name === "count") ctx.notes.push(`count() would return ${nodes.length}.`);
    if (out.terminal && out.terminal.name === "isVisible" && nodes.length === 1) ctx.notes.push(`isVisible() would return ${isVisible(nodes[0])}.`);
    if (out.terminal && out.terminal.name === "allTextContents") ctx.notes.push("allTextContents() would return " + JSON.stringify(nodes.map((n) => n.textContent)));
    if (out.terminal && out.terminal.name === "textContent" && nodes.length === 1) ctx.notes.push("textContent() would return " + JSON.stringify(nodes[0].textContent));
    if (out.terminal && out.terminal.name === "inputValue" && nodes.length === 1) ctx.notes.push("inputValue() would return " + JSON.stringify(nodes[0].value ?? ""));
    if (out.terminal && out.terminal.name === "getAttribute" && nodes.length === 1) ctx.notes.push(`getAttribute(${JSON.stringify(out.terminal.args[0])}) would return ` + JSON.stringify(nodes[0].getAttribute(out.terminal.args[0])));
  } catch (e) {
    out.error = e instanceof EngineError ? e.message : "Locator error: " + e.message;
  }
  return out;
}

// ------------------------------------------------------------------ locator suggestions (like codegen's "pick locator")
const q1 = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const cssIdent = (s) => s.replace(/([^\w-])/g, "\\$1").replace(/^(\d)/, "\\3$1 ");
const looksGenerated = (id) => /\d{4,}|^[a-z]+_[a-z0-9]{5,}$|[0-9a-f]{8,}/i.test(id);
export function suggest(el, root) {
  const out = [];
  const add = (type, expr, note) => { const r = evaluate(expr, root); out.push({ type, expr, count: r.nodes.length, unique: r.nodes.length === 1 && r.nodes[0] === el, note }); };
  const role = roleOf(el), name = accName(el), text = norm(textOf(el));
  const tid = el.getAttribute("data-testid");
  if (tid) add("Playwright", `page.getByTestId(${q1(tid)})`);
  if (role && name && role !== "presentation") add("Playwright", `page.getByRole(${q1(role)}, { name: ${q1(name.slice(0, 60))} })`);
  const lbl = labelTexts(el).find(Boolean);
  if (lbl) add("Playwright", `page.getByLabel(${q1(lbl.slice(0, 60))})`);
  if (el.getAttribute("placeholder")) add("Playwright", `page.getByPlaceholder(${q1(el.getAttribute("placeholder"))})`);
  if (el.getAttribute("alt")) add("Playwright", `page.getByAltText(${q1(el.getAttribute("alt"))})`);
  if (el.getAttribute("title")) add("Playwright", `page.getByTitle(${q1(el.getAttribute("title"))})`);
  if (text && text.length <= 60 && el.children.length === 0) add("Playwright", `page.getByText(${q1(text)})`);
  if (el.id) add("CSS", `#${cssIdent(el.id)}`, looksGenerated(el.id) ? "id looks auto-generated: brittle" : "");
  if (tid) add("CSS", `[data-testid="${tid}"]`);
  if (el.getAttribute("name")) add("CSS", `${el.tagName.toLowerCase()}[name="${el.getAttribute("name")}"]`);
  const cls = [...el.classList].filter((c) => !looksGenerated(c)).slice(0, 2);
  if (cls.length) add("CSS", `${el.tagName.toLowerCase()}.${cls.map(cssIdent).join(".")}`);
  if (el.id) add("XPath", `//${el.tagName.toLowerCase()}[@id=${q1(el.id)}]`);
  if (text && text.length <= 60 && el.children.length === 0) add("XPath", `//${el.tagName.toLowerCase()}[normalize-space()=${q1(text)}]`);
  // structural fallback
  const path = []; let e = el;
  while (e && e.nodeType === 1 && e !== root && e.tagName !== "BODY" && e.tagName !== "HTML") {
    const sibs = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [e];
    path.unshift(`${e.tagName.toLowerCase()}${sibs.length > 1 ? `:nth-of-type(${sibs.indexOf(e) + 1})` : ""}`);
    e = e.parentElement;
  }
  if (path.length) add("CSS (structural)", path.join(" > "), "position-based: breaks when the layout changes");
  const seen = new Set();
  return out.filter((r) => (seen.has(r.expr) ? false : seen.add(r.expr)));
}
