/* Applies the saved theme before the page paints (load this in <head>). */
(function () {
  var t = "light";
  try { t = localStorage.getItem("bc_theme") || "light"; } catch (e) {}
  document.documentElement.setAttribute("data-theme", t);
})();

window.BCTheme = {
  get: function () { return document.documentElement.getAttribute("data-theme") || "light"; },
  set: function (t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("bc_theme", t); } catch (e) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  },
  toggle: function () { this.set(this.get() === "dark" ? "light" : "dark"); },
};
