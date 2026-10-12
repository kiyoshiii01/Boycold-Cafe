/* Order status: one order, updates live when the cafe team changes its status. */
const user = Shell.requireUser();
Shell.mount("orders");

const { peso, esc, clock, dayFull, dayShort, dayWord } = Store.u;
const STEPS = ["pending", "preparing", "ready"];

const params = new URLSearchParams(location.search);

function findOrder() {
  const mine = Store.orders.byUser(user.id);
  const id = params.get("id");
  if (id) return mine.find((o) => o.id === id) || null;
  return mine.sort((a, b) => b.placedAt - a.placedAt)[0] || null; // no id given: show the latest order
}

const COPY = {
  pending:   { badge: "Pending",   title: "We got your order.",                         note: "We'll send an update as soon as the team starts on it." },
  preparing: { badge: "Preparing", title: "The team has started preparing your order.", note: "We'll send another update when it's ready." },
  ready:     { badge: "Ready",     title: "Your order is ready for pickup!",            note: "Show your order number at the counter and pay there." },
  picked_up: { badge: "Picked up", title: "Picked up. Thank you!",                      note: "Paid at the cafe. See you next coffee break." },
};

function heroFor(order, first) {
  if (order.status === "ready") return [`Your order is ready for pickup.`, `Come on by, ${first}. Show order #${order.id} to our team and pay at the counter.`, "Ready for pickup"];
  if (order.status === "picked_up") return [`Enjoy your coffee break.`, `Thanks for stopping by, ${first}. We hope it made your day a little brighter.`, "Order completed"];
  return [`Your coffee break is on its way.`, `Thanks, ${first}. Your pickup order is confirmed — we're making it with care.`, "Order confirmed"];
}

function pickupLabel(o) {
  const word = dayWord(o.pickupDay);
  return `${word ? word + ", " : ""}${dayShort(o.pickupDay)} · ${o.pickupTime}`;
}

function stepHTML(key, label, icon, order) {
  const cur = Store.STATUS_ORDER.indexOf(order.status);
  const idx = Store.STATUS_ORDER.indexOf(key);
  const state = idx < cur ? "is-done" : idx === cur ? "is-current" : "";
  const t = clock((order.times || {})[key]);

  let time;
  if (idx < cur) time = key === "pending" ? `Received at ${t}` : key === "ready" ? `Ready at ${t}` : `Done at ${t}`;
  else if (idx === cur) time = key === "ready" ? `Ready since ${t}` : key === "pending" ? `Received at ${t}` : `${t} · In progress`;
  else time = key === "ready" ? "We'll notify you" : "Up next";

  return `
    <div class="track__step ${state}">
      <div class="track__dot">${idx < cur ? I("check") : I(icon)}</div>
      <div><div class="track__name">${label}</div><div class="track__time">${time}</div></div>
    </div>`;
}

function render(order) {
  const copy = COPY[order.status];
  const first = esc(order.name.split(" ")[0]);
  const [h1, sub, pillText] = heroFor(order, first);
  const paid = order.status === "picked_up" || order.paid;
  const bannerTime = clock((order.times || {})[order.status]);
  const placedDay = Store.u.ymd(new Date(order.placedAt));
  const placedWord = dayWord(placedDay) ? dayWord(placedDay).toLowerCase() + ", " : "";

  $("orderPage").innerHTML = `
    <section class="or-hero">
      <a href="my_orders.html" class="back-link only-mobile">${I("back")}My orders</a>
      <span class="pill pill--ok only-mobile">${pillText}</span>
      <div class="or-hero__check only-desktop">${I("check")}</div>
      <h1>${h1}</h1>
      <p>${sub}</p>
    </section>

    <div class="or-layout">
      <section class="or-card or-status">
        <div class="or-head">
          <div>
            <div class="or-head__label">Order placed · ${dayFull(placedDay)}</div>
            <h2>Order #${esc(order.id)}</h2>
            <div class="or-head__sub only-mobile">Placed ${placedWord}${dayFull(placedDay)} · ${clock(order.placedAt)}</div>
          </div>
          <span class="badge badge--${order.status}">${copy.badge}</span>
        </div>

        <hr class="or-divider only-desktop">

        <div class="track">
          ${stepHTML("pending", "Pending", "check", order)}
          ${stepHTML("preparing", "Preparing", "chef", order)}
          ${stepHTML("ready", "Ready for pickup", "bag", order)}
        </div>

        <div class="update" role="status" aria-live="polite">
          ${I("bell")}
          <div><strong>${copy.title}</strong><span>${bannerTime} · ${copy.note}</span></div>
        </div>
      </section>

      <section class="or-card or-pickup">
        <h3><span class="only-desktop">A little reminder for pickup</span><span class="only-mobile">Your pickup</span></h3>
        <div class="remind">
          ${I("bag")}
          <div>
            <strong>${esc(pickupLabel(order))}</strong>
            <p>Collect at Boycold Cafe. Show order #${esc(order.id)} to our team and pay at the counter.</p>
          </div>
        </div>
        <p class="or-fine">${order.status === "picked_up" ? "This order has been collected." : `Your order will stay marked “${copy.badge}” until the team updates it.`}</p>
      </section>

      <aside class="or-card or-glance">
        <h3><span class="only-desktop">Your order, at a glance</span><span class="only-mobile">Your order</span></h3>
        ${order.items.map((c) => `
          <div class="g-item"><span>${c.qty} × ${esc(c.name)}</span><span>${peso(c.qty * c.unit)}</span></div>
          ${c.sub && c.sub !== "Ready for pickup" ? `<div class="g-sub">${esc(c.sub)}</div>` : ""}`).join("")}
        <hr class="or-divider">
        <div class="g-total"><span>${paid ? "Total paid" : "Amount due at pickup"}</span><strong>${peso(order.total)}</strong></div>
        <span class="badge badge--${paid ? "ok" : "unpaid"}">${paid ? "Paid at cafe" : "Unpaid · Pay at cafe"}</span>
        <hr class="or-divider only-desktop">
        <div class="g-contact only-desktop">${esc(order.name)}<br>${esc(order.phone)}${order.email ? `<br>${esc(order.email)}` : ""}</div>
        ${order.note ? `<p class="g-note">Note: ${esc(order.note)}</p>` : ""}
      </aside>

      <div class="or-actions">
        <a href="menu.html" class="btn-primary btn-auto">Back to menu</a>
        <a href="my_orders.html" class="btn-outline">View order history</a>
      </div>
    </div>
    <p class="or-foot only-mobile">Pickup only · Made with care at Boycold Cafe</p>`;
}

function renderEmpty() {
  $("orderPage").innerHTML = `
    <section class="or-empty">
      <h1>We couldn't find that order.</h1>
      <p>It may belong to another account, or it hasn't been placed yet.</p>
      <a href="my_orders.html" class="btn-primary btn-auto">Go to my orders</a>
    </section>`;
}

let sig = "";
function refresh() {
  const order = findOrder();
  if (!order) { if (sig !== "none") { sig = "none"; renderEmpty(); } return; }
  const next = JSON.stringify(order);
  if (next === sig) return;
  sig = next;
  render(order);
}
refresh();
Store.watch(refresh, 3000);
