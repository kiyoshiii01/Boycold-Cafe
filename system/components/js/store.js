/* store.js: front-end only data layer (localStorage).
   Everything the customer app and the workspace share lives here, so a customer's order
   shows up in the workspace and a status change in the workspace shows up for the customer.
   When a real backend is ready, replace the functions in this file with API calls. */
const Store = (() => {
  const K = {
    accounts: "bc_accounts", staff: "bc_staff", orders: "bc_orders", menu: "bc_menu",
    inv: "bc_inventory", adj: "bc_adjustments", act: "bc_activity", counter: "bc_counter",
    seed: "bc_seed_day", ver: "bc_seed_ver", session: "bc_session", staffSession: "bc_staff_session", cart: "boycoldCart",
  };

  const read = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
  const uid = (p) => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  /* ---------- formatting helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => ymd(new Date());
  const parseKey = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return ymd(d); };
  const tsAt = (key, min) => { const d = parseKey(key); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d.getTime(); };
  const fmtMin = (mins) => {
    const h24 = Math.floor(mins / 60), m = mins % 60, h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${pad(m)} ${h24 >= 12 ? "PM" : "AM"}`;
  };
  const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
  const dayShort = (key) => parseKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const dayFull = (key) => parseKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const dayWord = (key) => {
    const t = todayKey();
    return key === t ? "Today" : key === addDays(t, -1) ? "Yesterday" : key === addDays(t, 1) ? "Tomorrow" : "";
  };
  const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const asset = (src) => (!src || /^(data:|https?:|\/)/.test(src) ? src : (location.pathname.includes("/workspace/") ? "../" : "") + src);
  const initials = (name) => String(name || "G").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "G";
  const digitsOnly = (s) => String(s || "").replace(/[\s-]/g, "");
  const validPhone = (s) => /^(09\d{9}|\+639\d{9})$/.test(digitsOnly(s));
  const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

  const STATUS = {
    pending: { label: "Pending" },
    preparing: { label: "Preparing" },
    ready: { label: "Ready" },
    picked_up: { label: "Picked up" },
  };
  const STATUS_ORDER = ["pending", "preparing", "ready", "picked_up"];

  /* drink options (used by the customer menu and by the workspace menu manager) */
  const OPTS = {
    SIZES: [
      { label: "Regular · 16 oz", short: "Regular", add: 0 },
      { label: "Large · 22 oz (+₱30)", short: "Large", add: 30 },
    ],
    MILKS: [
      { label: "Whole milk", short: "Whole milk", add: 0 },
      { label: "Oat milk · +₱20", short: "Oat milk", add: 20 },
      { label: "Almond milk · +₱20", short: "Almond milk", add: 20 },
    ],
    ICES: ["Regular ice", "Less ice", "No ice"],
  };

  /* ---------- accounts (customers) ---------- */
  const accounts = {
    all: () => read(K.accounts, []),
    save: (l) => write(K.accounts, l),
    byId: (id) => accounts.all().find((a) => a.id === id) || null,
    byEmail: (e) => accounts.all().find((a) => a.email === String(e || "").trim().toLowerCase()) || null,
    create({ name, email, phone, password }) {
      const acc = { id: uid("u_"), name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, createdAt: Date.now() };
      const l = accounts.all(); l.push(acc); accounts.save(l); return acc;
    },
    update(id, patch) {
      const l = accounts.all(); const a = l.find((x) => x.id === id);
      if (!a) return null;
      Object.assign(a, patch); accounts.save(l); return a;
    },
  };

  const makeSession = (key, lookup) => ({
    user() {
      let id = null;
      try { id = sessionStorage.getItem(key) || localStorage.getItem(key); } catch (e) { /* ignore */ }
      return id ? lookup(id) : null;
    },
    set(id, remember = true) {
      this.clear();
      try { (remember ? localStorage : sessionStorage).setItem(key, id); } catch (e) { /* ignore */ }
    },
    clear() { try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (e) { /* ignore */ } },
  });

  /* ---------- staff (workspace accounts) ---------- */
  const staff = {
    all: () => read(K.staff, []),
    save: (l) => write(K.staff, l),
    byId: (id) => staff.all().find((s) => s.id === id) || null,
    byEmail: (e) => staff.all().find((s) => s.email === String(e || "").trim().toLowerCase()) || null,
  };

  const session = makeSession(K.session, (id) => accounts.byId(id));
  const staffSession = makeSession(K.staffSession, (id) => { const s = staff.byId(id); return s && s.active ? s : null; });

  /* ---------- activity log (workspace) ---------- */
  const activity = {
    all: () => read(K.act, []).sort((a, b) => b.ts - a.ts),
    add(title, sub) {
      const l = read(K.act, []); l.push({ ts: Date.now(), title, sub: sub || "" });
      write(K.act, l.slice(-40));
    },
  };

  /* ---------- menu ---------- */
  const menu = {
    all: () => read(K.menu, []),
    save: (l) => write(K.menu, l),
    get: (id) => menu.all().find((m) => m.id === id) || null,
    nextId: () => menu.all().reduce((n, m) => Math.max(n, m.id), 0) + 1,
  };

  /* ---------- inventory ---------- */
  const inventory = {
    all: () => read(K.inv, []),
    save: (l) => write(K.inv, l),
    adjustments: () => read(K.adj, []).sort((a, b) => b.ts - a.ts),
    logAdjustment: (entry) => { const l = read(K.adj, []); l.push(entry); write(K.adj, l.slice(-60)); },
    isLow: (i) => i.onHand < i.min,
  };

  /* ---------- orders ---------- */
  const orders = {
    all: () => read(K.orders, []),
    save: (l) => write(K.orders, l),
    get: (id) => orders.all().find((o) => o.id === id) || null,
    byUser: (userId) => orders.all().filter((o) => o.userId === userId),
    nextId() {
      const max = orders.all().reduce((n, o) => Math.max(n, parseInt(String(o.id).replace(/\D/g, ""), 10) || 0), 0);
      const n = Math.max(read(K.counter, 1051), max + 1);
      write(K.counter, n + 1);
      return "BC-" + n;
    },
    create({ user, items, pickupDay, pickupTime, pickupMin, name, phone, note }) {
      const now = Date.now();
      const order = {
        id: orders.nextId(), userId: user.id, email: user.email, name, phone, note: note || "",
        items, total: items.reduce((n, c) => n + c.qty * c.unit, 0),
        pickupDay, pickupTime, pickupMin, status: "pending", paid: false,
        placedAt: now, times: { pending: now },
      };
      const l = orders.all(); l.push(order); orders.save(l);
      activity.add(`New order ${order.id} received`, `${name} · ${items.map((c) => c.name).slice(0, 2).join(", ")}`);
      return order;
    },
    setStatus(id, status) {
      const l = orders.all(); const o = l.find((x) => x.id === id);
      if (!o) return null;
      const now = Date.now();
      o.status = status; o.times = o.times || {};
      // moving straight to picked up also fills any step that was skipped
      STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(status) + 1).forEach((s) => { if (!o.times[s]) o.times[s] = now; });
      if (status === "picked_up") o.paid = true;
      orders.save(l);
      if (status === "picked_up") activity.add(`${o.id} collected & paid`, `${o.name} · ${peso(o.total)} recorded in sales`);
      else activity.add(`${o.id} moved to ${STATUS[status].label}`, `${o.name} · Pickup at ${o.pickupTime}`);
      return o;
    },
  };

  /* ---------- demo seed (same numbers as the workspace mockups) ---------- */
  const SEED_VERSION = "3";
  const MENU_IMG = {
    1: "components/images/IceSpanish.png", 2: "components/images/Iced_americano.png", 3: "components/images/cappuccino.png",
    4: "components/images/butter_croissant.png", 5: "components/images/chicken_pesto.png", 6: "components/images/fudge_brownie.png",
  };
  const LAT = (u, sub) => ({ key: "1-" + u, id: 1, name: "Iced Spanish Latte", unit: u, sub });
  const P = {
    L0: () => LAT(140, "Regular · Whole milk · Regular ice"),
    L1: () => LAT(160, "Regular · Oat milk (+₱20 each) · Less ice"),
    L2: () => LAT(170, "Large · Whole milk · Regular ice"),
    L3: () => LAT(190, "Large · Oat milk (+₱20 each) · Regular ice"),
    A: () => ({ key: "2-0-0-0", id: 2, name: "Iced Americano", unit: 110, sub: "Regular · Regular ice" }),
    C: () => ({ key: "3-0-0-0", id: 3, name: "Cappuccino", unit: 130, sub: "Regular · Whole milk" }),
    Cr: () => ({ key: "4-0-0-0", id: 4, name: "Butter Croissant", unit: 95, sub: "Ready for pickup" }),
    S: () => ({ key: "5-0-0-0", id: 5, name: "Chicken Pesto Sandwich", unit: 185, sub: "Ready for pickup" }),
  };
  const line = (code, qty = 1) => ({ ...P[code](), qty });

  function seedOrders(today) {
    const out = [];
    // [id, name, phone, [items], pickupMin, status, {minute of each step}, extra]
    const rows = [
      ["BC-1030", "Maya Cruz", "0917 555 0130", [["L1"]], 435, "picked_up", { pending: 410, preparing: 417, ready: 430, picked_up: 435 }],
      ["BC-1031", "Rico Dela Peña", "0917 555 0131", [["C"]], 450, "picked_up", { pending: 430, preparing: 437, ready: 450, picked_up: 455 }],
      ["BC-1032", "Tina Lopez", "0917 555 0132", [["Cr"]], 465, "picked_up", { pending: 445, preparing: 452, ready: 465, picked_up: 470 }],
      ["BC-1033", "Paolo Santos", "0917 555 0133", [["A", 2]], 480, "picked_up", { pending: 460, preparing: 467, ready: 480, picked_up: 485 }],
      ["BC-1034", "Jenna Uy", "0917 555 0134", [["C"], ["L2"]], 510, "picked_up", { pending: 490, preparing: 497, ready: 515, picked_up: 520 }],
      ["BC-1035", "Carlo Mendoza", "0917 555 0135", [["L1"]], 540, "picked_up", { pending: 525, preparing: 532, ready: 548, picked_up: 552 }],
      ["BC-1036", "James Lim", "0917 555 0136", [["L1", 2]], 570, "picked_up", { pending: 550, preparing: 556, ready: 568, picked_up: 572 }],
      ["BC-1037", "Chloe Reyes", "0917 555 0137", [["Cr"], ["L1"]], 585, "picked_up", { pending: 565, preparing: 571, ready: 582, picked_up: 585 }],
      ["BC-1038", "Lucas Ong", "0917 555 0138", [["A"], ["Cr"]], 600, "picked_up", { pending: 580, preparing: 586, ready: 597, picked_up: 600 }],
      ["BC-1039", "Sofia Cruz", "0917 555 0139", [["L0"], ["L3"]], 600, "picked_up", { pending: 581, preparing: 587, ready: 598, picked_up: 601 }],
      ["BC-1040", "Ethan Tan", "0917 555 0140", [["L1", 2], ["Cr"]], 600, "picked_up", { pending: 582, preparing: 588, ready: 599, picked_up: 602 }],
      ["BC-1041", "Isla Ramos", "0917 555 0141", [["L0"], ["C"]], 600, "picked_up", { pending: 583, preparing: 589, ready: 600, picked_up: 604 }],
      ["BC-1045", "Leo Tan", "0917 555 0145", [["L0"]], 615, "preparing", { pending: 594, preparing: 601 }],
      ["BC-1046", "Ava Dela Cruz", "0917 555 0146", [["L0"], ["C"]], 615, "preparing", { pending: 592, preparing: 600 }],
      ["BC-1047", "Liam Reyes", "0917 555 0147", [["A"], ["Cr"]], 615, "ready", { pending: 590, preparing: 597, ready: 610 }],
      ["BC-1048", "Maya Santos", "0917 000 0123", [["L1", 2], ["Cr"]], 630, "preparing", { pending: 604, preparing: 608 }, { userId: "u_maya", email: "customer@example.com", note: "Please pack the croissant separately." }],
      ["BC-1049", "Ella Garcia", "0917 555 0149", [["A"], ["C"]], 630, "pending", { pending: 606 }],
      ["BC-1050", "Noah Lim", "0917 555 0150", [["S"]], 645, "pending", { pending: 612 }],
    ];
    rows.forEach(([id, name, phone, items, pickupMin, status, steps, extra]) => {
      const its = items.map(([c, q]) => line(c, q || 1));
      const times = {}; Object.keys(steps).forEach((s) => { times[s] = tsAt(today, steps[s]); });
      out.push({
        id, userId: "demo", email: "", name, phone, note: "", items: its, total: its.reduce((n, c) => n + c.qty * c.unit, 0),
        pickupDay: today, pickupTime: fmtMin(pickupMin), pickupMin, status, paid: status === "picked_up",
        placedAt: times.pending, times, demo: true, ...(extra || {}),
      });
    });

    [["BC-1012", -3, [["A"], ["L0"]], 540], ["BC-1003", -6, [["Cr", 2]], 495]].forEach(([id, off, items, pmin]) => {
      const day = addDays(today, off);
      const its = items.map(([c, q]) => line(c, q || 1));
      out.push({
        id, userId: "u_maya", email: "maya.santos@example.com", name: "Maya Santos", phone: "0917 000 0123", note: "",
        items: its, total: its.reduce((n, c) => n + c.qty * c.unit, 0), pickupDay: day, pickupTime: fmtMin(pmin), pickupMin: pmin,
        status: "picked_up", paid: true, placedAt: tsAt(day, pmin - 25),
        times: { pending: tsAt(day, pmin - 25), preparing: tsAt(day, pmin - 18), ready: tsAt(day, pmin - 3), picked_up: tsAt(day, pmin + 2) }, demo: true,
      });
    });
    return out;
  }

  function seed() {
    const today = todayKey();

    if (read(K.ver, "") !== SEED_VERSION) {
      const DEMO_CUSTOMERS = ["u_maya"], DEMO_STAFF = ["s_alex", "s_mika", "s_jon", "s_john"];
      accounts.save(accounts.all().filter((a) => !DEMO_CUSTOMERS.includes(a.id)).concat([
        { id: "u_maya", name: "Maya Santos", email: "customer@example.com", phone: "0917 000 0123", password: "customer123", createdAt: tsAt(addDays(today, -30), 600) },
      ]));
      staff.save(staff.all().filter((x) => !DEMO_STAFF.includes(x.id)).concat([
        { id: "s_alex", name: "Alex Cruz", email: "admin@example.com", password: "admin123", role: "manager", active: true, createdAt: tsAt(addDays(today, -60), 540), lastActive: Date.now() },
        { id: "s_mika", name: "Mika Dizon", email: "staff1@example.com", password: "staff123", role: "staff", active: true, createdAt: tsAt(addDays(today, -20), 540), lastActive: tsAt(addDays(today, -1), 1000) },
        { id: "s_jon", name: "John Jake Bautista", email: "staff2@example.com", password: "staff2123", role: "staff", active: false, createdAt: tsAt(addDays(today, -45), 540), lastActive: tsAt(addDays(today, -12), 900) },
      ]));
      write(K.seed, ""); 
      write(K.ver, SEED_VERSION);
    }
    if (!menu.all().length) {
      const t = tsAt(today, 585);
      const base = { available: true, img: "", updatedBy: "Alex Cruz", updatedAt: t };
      menu.save([
        { ...base, id: 1, name: "Iced Spanish Latte", cat: "coffee", price: 140, badge: "HOUSE FAVORITE", desc: "Espresso, creamy milk & a little sweetness.", long: "Double espresso, milk and a touch of condensed milk.", opts: ["size", "milk", "ice"] },
        { ...base, id: 2, name: "Iced Americano", cat: "coffee", price: 110, desc: "Bold espresso over ice. Clean and refreshing.", long: "Double espresso poured over ice and cold water.", opts: ["size", "ice"] },
        { ...base, id: 3, name: "Cappuccino", cat: "coffee", price: 130, desc: "Rich espresso with a cloud of silky foam.", long: "Espresso with steamed milk and a thick layer of foam.", opts: ["size", "milk"] },
        { ...base, id: 4, name: "Butter Croissant", cat: "pastries", price: 95, desc: "Golden, flaky layers. Baked for slow mornings.", long: "Flaky, buttery croissant baked fresh every morning.", opts: [] },
        { ...base, id: 5, name: "Chicken Pesto Sandwich", cat: "food", price: 185, desc: "Toasted sourdough, chicken & basil pesto.", long: "Toasted sourdough with grilled chicken and basil pesto.", opts: [] },
        { ...base, id: 6, name: "Fudge Brownie", cat: "pastries", price: 85, available: false, desc: "Deep cocoa, soft center & crisp edges.", long: "Rich chocolate brownie with a soft, fudgy center.", opts: [], img: "", updatedBy: "Alex Cruz", updatedAt: tsAt(today, 605) },
      ]);
    }
    // give the 6 starter products their photos (never overwrites a photo uploaded from the workspace)
    const withPhotos = menu.all().map((m) => (!m.img && MENU_IMG[m.id] ? { ...m, img: MENU_IMG[m.id] } : m));
    if (JSON.stringify(withPhotos) !== JSON.stringify(menu.all())) menu.save(withPhotos);

    if (!inventory.all().length) {
      const mk = (id, name, unit, onHand, min, m) => ({ id, name, unit, onHand, min, updated: tsAt(today, m) });
      inventory.save([
        mk("i1", "Coffee beans", "kg", 1.2, 2, 600), mk("i2", "Oat milk", "L", 1.5, 3, 595), mk("i3", "Butter", "kg", 0.4, 1, 590),
        mk("i4", "Fresh milk", "L", 8, 4, 570), mk("i5", "Condensed milk", "L", 3.2, 1, 570), mk("i6", "Sourdough bread", "slices", 18, 10, 560),
        mk("i7", "Chicken", "kg", 2.5, 1, 555), mk("i8", "Basil pesto", "kg", 0.8, 0.5, 555),
      ]);
      write(K.adj, [
        { ts: tsAt(today, 600), name: "Coffee beans", delta: -0.3, unit: "kg", type: "Usage count", by: "Alex Cruz" },
        { ts: tsAt(today, 595), name: "Oat milk", delta: -0.5, unit: "L", type: "Usage count", by: "Alex Cruz" },
        { ts: tsAt(today, 570), name: "Fresh milk", delta: 4, unit: "L", type: "Restock", by: "Alex Cruz" },
      ]);
    }

    // demo orders and demo activity are rebuilt each new day so "today" always has data
    if (read(K.seed, "") !== today) {
      orders.save(orders.all().filter((o) => !o.demo).concat(seedOrders(today)));
      write(K.act, read(K.act, []).filter((a) => !a.demo).concat([
        { ts: tsAt(today, 612), title: "New order BC-1050 received", sub: "Noah Lim · Chicken Pesto Sandwich", demo: true },
        { ts: tsAt(today, 608), title: "BC-1048 moved to Preparing", sub: "Maya Santos · Pickup at 10:30 AM", demo: true },
        { ts: tsAt(today, 605), title: "Brownies marked sold out", sub: "Updated by Alex Cruz", demo: true },
      ]));
      write(K.seed, today);
    }
  }
  seed();

  return {
    K, read, write, uid, accounts, staff, session, staffSession, menu, inventory, orders, activity, OPTS, STATUS, STATUS_ORDER,
    u: { pad, ymd, todayKey, parseKey, addDays, tsAt, fmtMin, clock, dayShort, dayFull, dayWord, peso, esc, asset, initials, digitsOnly, validPhone, validEmail },
    cart: {
      get: () => read(K.cart, []),
      save: (c) => write(K.cart, c),
      clear: () => write(K.cart, []),
    },
    /* run fn when data changes in another tab, or every few seconds as a fallback */
    watch(fn, ms = 4000) {
      window.addEventListener("storage", fn);
      setInterval(fn, ms);
    },
  };
})();
