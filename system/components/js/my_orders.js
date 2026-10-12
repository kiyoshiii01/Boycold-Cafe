/* My orders: every order this customer placed. Tap one to open its status page. */
const user = Shell.requireUser();
Shell.mount("orders");

const { peso, esc, dayShort, dayWord } = Store.u;
let filter = "all";

const isActive = (o) => o.status !== "picked_up";

function mine() {
  // active first (soonest pickup), then past orders (newest first)
  return Store.orders.byUser(user.id).sort((a, b) => b.placedAt - a.placedAt);
}

function cardHTML(o) {
  const word = dayWord(o.pickupDay);
  const summary = o.items.map((c) => `${c.qty} × ${esc(c.name)}`).join(", ");
  return `
    <article class="oh-card" data-id="${esc(o.id)}" tabindex="0" role="link" aria-label="Open order ${esc(o.id)}">
      <div>
        <div class="oh-card__top"><span class="oh-card__id">#${esc(o.id)}</span><span class="badge badge--${o.status}">${Store.STATUS[o.status].label}</span></div>
        <div class="oh-card__when">${word ? word + ", " : ""}${dayShort(o.pickupDay)} · Pickup ${esc(o.pickupTime)}</div>
        <div class="oh-card__items">${summary}</div>
      </div>
      <div class="oh-card__side">
        <span class="oh-card__total">${peso(o.total)}</span>
        <span class="oh-card__act">
          ${isActive(o) ? "" : '<button type="button" class="btn-sm" data-again>Order again</button>'}
          <span class="oh-card__view">${isActive(o) ? "Track order" : "Details"}${I("arrow")}</span>
        </span>
      </div>
    </article>`;
}

function render() {
  const all = mine();
  const list = all.filter((o) => filter === "all" || (filter === "active" ? isActive(o) : !isActive(o)));
  const active = list.filter(isActive).sort((a, b) => (a.pickupDay + String(a.pickupMin).padStart(4, "0")).localeCompare(b.pickupDay + String(b.pickupMin).padStart(4, "0")));
  const past = list.filter((o) => !isActive(o));

  $("app").innerHTML = `
    <div class="pg-head">
      <div><h1>My orders</h1><p>Follow your current pickup and look back at past favorites.</p></div>
      <span class="pill pill--accent">${all.length} order${all.length === 1 ? "" : "s"}</span>
    </div>
    <div class="oh-chips">
      ${[["all", "All"], ["active", "Active"], ["past", "Past"]].map(([k, l]) => `<button type="button" class="chip ${filter === k ? "is-active" : ""}" data-filter="${k}">${l}</button>`).join("")}
    </div>
    ${list.length ? `
      ${active.length ? `<section class="oh-group"><h2 class="oh-group__title">Active</h2>${active.map(cardHTML).join("")}</section>` : ""}
      ${past.length ? `<section class="oh-group"><h2 class="oh-group__title">Past orders</h2>${past.map(cardHTML).join("")}</section>` : ""}`
      : `<div class="oh-empty"><h2>${all.length ? "Nothing here yet." : "No orders yet."}</h2><p>${all.length ? "Try another filter." : "Your pickup orders will show up here, ready to track."}</p><a href="menu.html" class="btn-primary btn-auto">Browse the menu</a></div>`}`;
}

function orderAgain(o) {
  const cart = Store.cart.get();
  let skipped = 0;
  o.items.forEach((c) => {
    const m = Store.menu.get(c.id);
    if (!m || !m.available) { skipped++; return; }
    const hit = cart.find((x) => x.key === c.key);
    if (hit) hit.qty = Math.min(20, hit.qty + c.qty);
    else cart.push({ key: c.key, id: c.id, name: c.name, qty: c.qty, unit: c.unit, sub: c.sub });
  });
  Store.cart.save(cart);
  Shell.toast(skipped ? `Added to your cart. ${skipped} item${skipped > 1 ? "s are" : " is"} unavailable right now.` : "Added to your cart");
  setTimeout(() => { location.href = "checkout.html"; }, 700);
}

$("app").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) { filter = chip.dataset.filter; render(); return; }
  const card = e.target.closest(".oh-card");
  if (!card) return;
  if (e.target.closest("[data-again]")) { orderAgain(Store.orders.get(card.dataset.id)); return; }
  location.href = `order_status.html?id=${encodeURIComponent(card.dataset.id)}`;
});
$("app").addEventListener("keydown", (e) => {
  const card = e.target.closest(".oh-card");
  if (card && e.key === "Enter" && e.target === card) location.href = `order_status.html?id=${encodeURIComponent(card.dataset.id)}`;
});

let sig = "";
function refresh() {
  const next = JSON.stringify(mine());
  if (next === sig) return;
  sig = next; render();
}
refresh();
Store.watch(refresh, 4000);
