/* ws_shell.js: workspace sidebar, top bar, notifications, toast, modal and sheet helpers.
   Usage in a page:  const staff = WS.require("orders"); WS.mount("orders", "Orders"); */
const WS = (() => {
  const { esc, initials } = Store.u;
  let staff = null;
  let toastTimer;

  const NAV = [
    { key: "overview", label: "Overview", href: "overview.html", icon: "grid" },
    { key: "orders", label: "Orders", href: "orders.html", icon: "clipboard" },
    { key: "menu", label: "Menu", href: "menu.html", icon: "cup" },
    { key: "inventory", label: "Inventory", href: "inventory.html", icon: "box" },
    { key: "sales", label: "Sales reports", href: "sales_reports.html", icon: "chart", manager: true },
    { key: "users", label: "Manage users", href: "users.html", icon: "users", manager: true },
  ];

  function toast(message) {
    let el = $("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* make sure someone is signed in (and allowed to see this page) */
  function require(key) {
    staff = Store.staffSession.user();
    if (!staff) { location.replace("../index.html"); return null; }
    const item = NAV.find((n) => n.key === key);
    if (item && item.manager && staff.role !== "manager") { location.replace("overview.html"); return null; }
    const all = Store.staff.all(); const me = all.find((s) => s.id === staff.id);
    if (me) { me.lastActive = Date.now(); Store.staff.save(all); }
    return staff;
  }

  function signOut() { Store.staffSession.clear(); location.href = "../index.html"; }

  /* modal: WS.modal(html) -> { el, close } */
  function modal(html) {
    const back = document.createElement("div");
    back.className = "modal-backdrop open";
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => back.remove();
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    document.addEventListener("keydown", function esc_(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc_); } });
    document.body.appendChild(back);
    return { el: back.firstElementChild, close };
  }

  /* side panels turn into bottom sheets on small screens */
  let sheetBack = null;
  function ensureBackdrop() {
    if (sheetBack) return sheetBack;
    sheetBack = document.createElement("div");
    sheetBack.className = "ws-sheet-backdrop";
    sheetBack.addEventListener("click", () => document.dispatchEvent(new CustomEvent("sheetclose")));
    document.body.appendChild(sheetBack);
    return sheetBack;
  }
  const panel = {
    open(el) { el.classList.add("is-open"); ensureBackdrop().classList.add("open"); },
    close(el) { el.classList.remove("is-open"); ensureBackdrop().classList.remove("open"); },
  };

  /* notifications: new orders waiting + low stock */
  function notes() {
    const out = [];
    Store.orders.all().filter((o) => o.status === "pending").sort((a, b) => b.placedAt - a.placedAt).slice(0, 4)
      .forEach((o) => out.push({ href: `orders.html?open=${encodeURIComponent(o.id)}`, t: `New order ${o.id}`, s: `${o.name} · Pickup ${o.pickupTime} · ${Store.u.peso(o.total)}` }));
    const low = Store.inventory.all().filter(Store.inventory.isLow);
    if (low.length) out.push({ href: "inventory.html", t: `${low.length} ingredient${low.length > 1 ? "s" : ""} running low`, s: low.map((i) => i.name).join(", ") });
    return out;
  }
  function renderBell() {
    const list = notes();
    $("wsBellDot").hidden = !list.length;
    $("wsNotifPop").innerHTML = `<div class="notif__head">Notifications</div>` + (list.length
      ? list.map((n) => `<a class="notif" href="${n.href}"><strong>${esc(n.t)}</strong><span>${esc(n.s)}</span></a>`).join("")
      : `<p class="notif-empty">You're all caught up</p>`);
  }

  function clockText() {
    const d = new Date();
    return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getFullYear()} · ${Store.u.clock(d)}`;
  }
  const themeIcon = () => (BCTheme.get() === "dark" ? "sun" : "moon");

  function mount(key, crumb) {
    if (!staff) return;
    document.body.classList.add("ws");

    $("wsSide").className = "ws-side";
    $("wsSide").innerHTML = `
      <div class="ws-brand"><span class="ws-brand__logo"><img src="../components/images/boycold_logo.png" alt=""></span>Boycold Cafe</div>
      <div class="ws-label">Cafe workspace</div>
      <nav class="ws-nav" aria-label="Workspace">
        ${NAV.filter((n) => !n.manager || staff.role === "manager").map((n) => `<a href="${n.href}" class="${n.key === key ? "is-active" : ""}">${I(n.icon)}${n.label}</a>`).join("")}
      </nav>
      <div class="ws-side__foot">
        <button type="button" class="ws-help" id="wsHelp">Help &amp; workspace guide ${I("external")}</button>
        <div class="ws-me">
          <span class="avatar">${esc(initials(staff.name))}</span>
          <div><strong>${esc(staff.name)}</strong><small>${staff.role === "manager" ? "Cafe manager" : "Cafe staff"}</small></div>
          <button type="button" id="wsOut" aria-label="Sign out" title="Sign out">${I("logout")}</button>
        </div>
      </div>`;

    $("wsTop").className = "ws-top";
    $("wsTop").innerHTML = `
      <div style="display:flex;align-items:center">
        <button type="button" class="icon-btn ws-burger" id="wsBurger" aria-label="Open navigation">${I("burger")}</button>
        <div class="ws-crumb">Workspace / <b>${esc(crumb)}</b></div>
      </div>
      <div class="ws-top__right">
        <span class="ws-clock" id="wsClock">${clockText()}</span>
        <button type="button" class="icon-btn" id="wsTheme" aria-label="Toggle dark mode">${I(themeIcon())}</button>
        <div class="pop-wrap">
          <button type="button" class="icon-btn" id="wsBell" aria-label="Notifications">${I("bell")}<span class="dot" id="wsBellDot" hidden></span></button>
          <div class="pop pop--notif" id="wsNotifPop"></div>
        </div>
      </div>`;

    const back = document.createElement("div");
    back.className = "ws-backdrop"; back.id = "wsBackdrop";
    document.body.appendChild(back);

    const side = $("wsSide");
    const closeNav = () => { side.classList.remove("open"); back.classList.remove("open"); };
    $("wsBurger").addEventListener("click", () => { side.classList.add("open"); back.classList.add("open"); });
    back.addEventListener("click", closeNav);
    $("wsOut").addEventListener("click", signOut);
    $("wsTheme").addEventListener("click", () => BCTheme.toggle());
    document.addEventListener("themechange", () => { $("wsTheme").innerHTML = I(themeIcon()); });
    $("wsBell").addEventListener("click", (e) => { e.stopPropagation(); $("wsNotifPop").classList.toggle("open"); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop-wrap")) $("wsNotifPop").classList.remove("open"); });

    $("wsHelp").addEventListener("click", () => {
      const m = modal(`
        <h2>Workspace guide</h2>
        <p class="modal__sub">A quick tour for the cafe team.</p>
        <p class="hint" style="line-height:1.7;font-size:13px">
          <b>Orders:</b> new pickup orders appear as Pending. Move them to Preparing, then Ready. Use “Paid &amp; picked up” only after you have received payment.<br><br>
          <b>Menu:</b> change prices, photos and availability. Changes show on the customer menu right away.<br><br>
          <b>Inventory:</b> record stock you received or used. Items below their minimum are flagged as low stock.<br><br>
          <b>Sales reports &amp; Manage users:</b> only managers can open these.
        </p>
        <div class="modal__actions"><button type="button" class="btn-primary" data-close>Got it</button></div>`);
      m.el.querySelector("[data-close]").addEventListener("click", m.close);
    });

    setInterval(() => { $("wsClock").textContent = clockText(); }, 30000);
    renderBell();
    Store.watch(renderBell, 5000);
  }

  return { require, mount, toast, modal, panel, signOut, staff: () => staff, NAV };
})();
