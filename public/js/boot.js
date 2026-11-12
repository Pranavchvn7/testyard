// Runs before first paint (kept as an external file so the Content-Security-Policy can forbid inline scripts).
try {
  var t = localStorage.getItem("ty.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) { /* storage blocked: fall back to the system theme */ }
// Old links of the form /#/inputs now live at /practice/inputs.
if (location.hash.indexOf("#/") === 0) {
  var id = location.hash.slice(2).split("?")[0].replace(/[^a-z0-9-]/gi, "");
  history.replaceState({}, "", id ? "/practice/" + id : "/");
}
