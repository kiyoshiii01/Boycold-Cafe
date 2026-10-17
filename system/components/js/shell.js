/* shell.js: customer top bar, mobile drawer, bottom tabs, notifications, toast.
   Usage in a page:  const user = Shell.requireUser(); Shell.mount("menu"); */
const Shell = (() => {
  const { esc, initials } = Store.u;
  let user = null;
  let toastTimer;

  const LINKS = [
    { key: "menu", label: "Menu", href: "menu.html", icon: "cup" },
    { key: "orders", label: "My orders", href: "my_orders.html", icon: "clipboard" },
    { key: "account", label: "Account", href: "profile.html", icon: "user" },
  ];

  function toast(message) {
    let el = $("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function requireUser() {
    user = Store.session.user();
    if (!user) location.replace("index.html");
    return user;
  }

  function signOut() {
    Store.session.clear();
    location.href = "index.html";
  }

  /* notifications are built from the status changes of this customer's orders */
  const NOTE = {
    pending: (id) => [`Order ${id} received`, "We got your order."],
    preparing: (id) => [`${id} is being prepared`, "The team has started on it."],
    ready: (id) => [`${id} is ready for pickup`, "Show your order number at the counter."],
    picked_up: (id) => [`${id} picked up`, "Thanks for stopping by."],
  };
  function notifications() {
    const list = [];
    Store.orders.byUser(user.id).forEach((o) => {
      Object.entries(o.times || {}).forEach(([st, ts]) => { if (NOTE[st]) list.push({ ts, id: o.id, st }); });
    });
    return list.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }
  const seenKey = () => "bc_seen_" + user.id;
  const lastSeen = () => Number(localStorage.getItem(seenKey()) || 0);

  function renderBell() {
    const list = notifications();
    const unseen = list.some((n) => n.ts > lastSeen());
    const dot = $("bellDot"); if (dot) dot.hidden = !unseen;
    $("notifPop").innerHTML = `<div class="notif__head">Notifications</div>` + (list.length
      ? list.map((n) => { const [t, s] = NOTE[n.st](n.id); return `<a class="notif" href="order_status.html?id=${esc(n.id)}"><strong>${esc(t)}</strong><span>${esc(s)} · ${Store.u.clock(n.ts)}</span></a>`; }).join("")
      : `<p class="notif-empty">No new notifications</p>`);
  }

  function themeLabel() { return BCTheme.get() === "dark" ? "Light mode" : "Dark mode"; }
  function themeIcon() { return BCTheme.get() === "dark" ? "sun" : "moon"; }

  function mount(active) {
    if (!user) return;
    const first = user.name.split(" ")[0];
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <a href="menu.html" class="brand">
        <span class="brand__logo"><img src="components/images/boycold_logo.png" alt=""></span>
        <span class="brand__text"><span class="brand__name">Boycold Cafe</span><span class="brand__tag">COFFEE &amp; GOOD COMPANY</span></span>
      </a>
      <nav class="nav">
        <a href="menu.html" class="${active === "menu" ? "is-active" : ""}">Menu</a>
        <a href="my_orders.html" class="${active === "orders" ? "is-active" : ""}">My orders</a>
        <span class="pill">Pickup only</span>
      </nav>
      <div class="topbar__right">
        <div class="pop-wrap">
          <button type="button" class="icon-btn" id="bellBtn" aria-label="Notifications">${I("bell")}<span class="dot" id="bellDot" hidden></span></button>
          <div class="pop pop--notif" id="notifPop"></div>
        </div>
        <div class="user">
          <button type="button" class="user__btn" id="userBtn" aria-haspopup="true" aria-expanded="false">
            <span class="avatar">${esc(initials(user.name))}</span>
            <span class="user__name">${esc(user.name)}</span>${I("chevron")}
          </button>
          <div class="pop" id="userPop">
            <a class="pop__item" href="profile.html">${I("user")}Profile</a>
            <a class="pop__item" href="my_orders.html">${I("clipboard")}My orders</a>
            <button type="button" class="pop__item" data-act="theme">${I(themeIcon())}<span>${themeLabel()}</span></button>
            <div class="pop__sep"></div>
            <button type="button" class="pop__item" data-act="signout">${I("logout")}Sign out</button>
          </div>
        </div>
        <button type="button" class="icon-btn burger" id="burger" aria-label="Open menu" aria-expanded="false">${I("burger")}</button>
      </div>`;
    document.body.prepend(header);

    const drawer = document.createElement("div");
    drawer.className = "drawer"; drawer.id = "drawer";
    drawer.innerHTML = `
      <div class="drawer__who"><span class="avatar">${esc(initials(user.name))}</span><span>${esc(user.name)}<small>${esc(user.email)}</small></span></div>
      <a class="pop__item" href="menu.html">${I("cup")}Menu</a>
      <a class="pop__item" href="my_orders.html">${I("clipboard")}My orders</a>
      <a class="pop__item" href="profile.html">${I("user")}Profile</a>
      <button type="button" class="pop__item" data-act="theme">${I(themeIcon())}<span>${themeLabel()}</span></button>
      <button type="button" class="pop__item" data-act="signout">${I("logout")}Sign out</button>`;
    header.after(drawer);

    const tabs = document.createElement("nav");
    tabs.className = "tabbar"; tabs.setAttribute("aria-label", "Main");
    tabs.innerHTML = LINKS.map((l) => `<a href="${l.href}" class="${l.key === active ? "is-active" : ""}">${I(l.icon)}<span>${l.label}</span></a>`).join("");
    document.body.appendChild(tabs);
    document.body.classList.add("has-tabs");

    const closeAll = () => {
      $("userPop").classList.remove("open"); $("userBtn").setAttribute("aria-expanded", "false");
      $("notifPop").classList.remove("open"); drawer.classList.remove("open"); $("burger").setAttribute("aria-expanded", "false");
    };
    $("userBtn").addEventListener("click", (e) => { e.stopPropagation(); const o = !$("userPop").classList.contains("open"); closeAll(); $("userPop").classList.toggle("open", o); $("userBtn").setAttribute("aria-expanded", String(o)); });
    $("bellBtn").addEventListener("click", (e) => {
      e.stopPropagation(); const o = !$("notifPop").classList.contains("open"); closeAll(); $("notifPop").classList.toggle("open", o);
      if (o) { localStorage.setItem(seenKey(), String(Date.now())); $("bellDot").hidden = true; }
    });
    $("burger").addEventListener("click", (e) => { e.stopPropagation(); const o = !drawer.classList.contains("open"); closeAll(); drawer.classList.toggle("open", o); $("burger").setAttribute("aria-expanded", String(o)); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop, .drawer")) closeAll(); });
    document.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "signout") signOut();
      if (act.dataset.act === "theme") BCTheme.toggle();
    });
    document.addEventListener("themechange", () => {
      document.querySelectorAll('[data-act="theme"]').forEach((b) => { b.innerHTML = I(themeIcon()) + `<span>${themeLabel()}</span>`; });
    });
    renderBell();
    Store.watch(renderBell, 5000);
  }

  return { requireUser, mount, toast, signOut, user: () => user };
})();
