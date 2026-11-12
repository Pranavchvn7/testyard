export const GROUPS = [
  { id: "elements", title: "Web elements", blurb: "Inputs, dropdowns, dialogs, drag & drop, frames, shadow DOM and more." },
  { id: "tables", title: "Tables & grids", blurb: "Static, dynamic and paginated data grids with sorting and filtering." },
  { id: "dynamic", title: "Dynamic & timing", blurb: "Waits, flaky behaviour, slow resources and elements that move." },
  { id: "dom", title: "Locators & DOM", blurb: "Tricky selectors, changing IDs and very large DOM trees." },
  { id: "apps", title: "Demo applications", blurb: "Login, notes, shop and booking apps for end-to-end flows." },
  { id: "api", title: "API lab", blurb: "A real sandboxed REST API, live docs and a request console." },
  { id: "learn", title: "Frameworks & learning", blurb: "Build a full automation framework step by step." },
  { id: "tools", title: "Tools & diagnostics", blurb: "Selector tester, status codes, headers, console and errors." },
];

export const pages = [];
/** page({ id, group, title, blurb, tasks: [..], render(root) -> optional cleanup fn, hidden }) */
export const page = (def) => { pages.push(def); return def; };
