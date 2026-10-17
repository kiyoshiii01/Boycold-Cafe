/* Customer menu page. Products come from the cafe team's menu (store.js). */
const user = Shell.requireUser();
Shell.mount("menu");

const { SIZES, MILKS, ICES } = Store.OPTS;
const { peso, esc } = Store.u;

/* ---------- STATE ---------- */
let MENU = Store.menu.all();
const isPhone = () => window.matchMedia("(max-width: 900px)").matches;
let selectedId = isPhone() ? null : (MENU.find((m) => m.available) || {}).id || null;
let filter = "all";
let query = "";
let qty = 1;
let choice = { size: 0, milk: 0, ice: 0 };
let cart = Store.cart.get();

const saveCart = () => Store.cart.save(cart);

const placeholder = (m) => m && m.img
  ? `<div class="ph"><img src="${Store.u.asset(m.img)}" alt="${esc(m.name)}" loading="lazy"></div>`
  : `<div class="ph">${I("cup")}<span>Boycold Cafe</span></div>`;

function unitPrice(item) {
  let p = item.price;
  if (item.opts.includes("size")) p += SIZES[choice.size].add;
  if (item.opts.includes("milk")) p += MILKS[choice.milk].add;
  return p;
}

/* ---------- MENU CARDS ---------- */
function renderCards() {
  const q = query.trim().toLowerCase();
  const list = MENU.filter((m) =>
    (filter === "all" || m.cat === filter) &&
    (!q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q))
  );

  $("count").textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;

  if (!list.length) { $("cards").innerHTML = '<p class="empty">No items match your search.</p>'; return; }

  $("cards").innerHTML = list.map((m) => {
    const isSel = m.id === selectedId;
    const action = !m.available
      ? '<span class="pill">Sold out</span>'
      : `<button type="button" class="btn-sm ${isSel ? "is-selected" : ""}">${isSel ? "Selected" : "Customize +"}</button>`;
    return `
      <article class="card ${isSel ? "is-selected" : ""} ${!m.available ? "is-soldout" : ""}" data-id="${m.id}">
        ${placeholder(m)}
        <h3 class="card__name">${esc(m.name)}</h3>
        <p class="card__desc">${esc(m.desc)}</p>
        <div class="card__foot">
          <span class="card__price">${peso(m.price)}</span>
          ${m.badge && m.available ? '<span class="card__fav only-mobile">Favorite</span>' : ""}
          ${action}
        </div>
      </article>`;
  }).join("");
}

/* ---------- DETAIL PANEL ---------- */
function renderDetail() {
  const box = $("detail");
  const item = MENU.find((m) => m.id === selectedId);

  if (!item) {
    box.innerHTML = `<div class="detail--empty">${placeholder()}<p>Pick something from the menu to customize it.</p></div>`;
    return;
  }

  const selectHTML = (id, label, options, current) => `
    <div class="opt">
      <label for="${id}">${label}</label>
      <select id="${id}" data-opt="${id}">
        ${options.map((o, i) => `<option value="${i}" ${i === current ? "selected" : ""}>${o}</option>`).join("")}
      </select>
    </div>`;

  const total = unitPrice(item) * qty;

  box.innerHTML = `
    <div class="detail__top">
      <span class="tag">${esc(item.badge || item.cat.toUpperCase())}</span>
      <button type="button" class="close" id="closeDetail" aria-label="Close">${I("x")}</button>
    </div>
    ${placeholder(item)}
    <h3 class="detail__name">${esc(item.name)}</h3>
    <p class="detail__desc">${esc(item.long || item.desc)} From ${peso(item.price)}.</p>

    ${item.opts.includes("size") ? selectHTML("size", "Size", SIZES.map((s) => s.label), choice.size) : ""}
    ${item.opts.includes("milk") ? selectHTML("milk", "Milk", MILKS.map((m) => m.label), choice.milk) : ""}
    ${item.opts.includes("ice") ? selectHTML("ice", "Ice preference", ICES, choice.ice) : ""}

    <div class="qty-row">
      <span>Quantity</span>
      <div class="qty">
        <button type="button" id="qtyMinus" aria-label="Decrease quantity">&minus;</button>
        <output id="qtyValue">${qty}</output>
        <button type="button" id="qtyPlus" aria-label="Increase quantity">+</button>
      </div>
    </div>

    <button type="button" class="btn-primary" id="addBtn">Add to cart &middot; ${peso(total)}</button>`;
}

/* ---------- CART ---------- */
function renderCart() {
  const count = cart.reduce((n, c) => n + c.qty, 0);
  const total = cart.reduce((n, c) => n + c.qty * c.unit, 0);

  const items = cart.map((c) => `
    <div class="cart__item">
      <div class="cart__line"><span>${c.qty} &times; ${esc(c.name)}</span><span>${peso(c.qty * c.unit)}</span></div>
      <div class="cart__sub"><span>${esc(c.sub)}</span><button type="button" class="cart__remove" data-key="${esc(c.key)}">Remove</button></div>
    </div>`).join("");

  $("cart").innerHTML = `
    <div class="cart__head">
      <h3 class="cart__title">Your cart</h3>
      <span class="pill pill--accent">${count} item${count === 1 ? "" : "s"}</span>
    </div>
    ${cart.length ? items + '<div class="cart__divider"></div>' : '<p class="cart__empty">Your cart is empty. Add something warm.</p>'}
    <button type="button" class="btn-primary" id="reviewBtn" ${cart.length ? "" : "disabled"}>Review order &middot; ${peso(total)}</button>`;

  const bar = $("cartbar");
  bar.hidden = !cart.length;
  bar.innerHTML = cart.length ? `
    <div class="cartbar__row"><span>${count} item${count === 1 ? "" : "s"} in your cart</span><strong>${peso(total)}</strong></div>
    <a href="checkout.html" class="btn-primary">${I("bag")}<span>View cart &amp; choose pickup</span></a>` : "";
}

function addToCart() {
  const item = MENU.find((m) => m.id === selectedId);
  if (!item || !item.available) return;

  const parts = [];
  if (item.opts.includes("size")) parts.push(SIZES[choice.size].short);
  if (item.opts.includes("milk")) {
    const m = MILKS[choice.milk];
    parts.push(m.add ? `${m.short} (+₱${m.add} each)` : m.short);
  }
  if (item.opts.includes("ice")) parts.push(ICES[choice.ice]);

  const unit = unitPrice(item);
  const sub = parts.length ? parts.join(" · ") : item.cat === "coffee" ? "" : "Ready for pickup";
  const key = [item.id, choice.size, choice.milk, choice.ice].join("-");

  const existing = cart.find((c) => c.key === key);
  if (existing) existing.qty += qty;
  else cart.push({ key, id: item.id, name: item.name, qty, unit, sub });

  saveCart();
  renderCart();
  Shell.toast(`Added ${qty} × ${item.name} to your cart`);
  qty = 1;
  if (isPhone()) { selectedId = null; document.body.classList.remove("sheet-open"); renderCards(); }
  renderDetail();
}

function selectItem(id) {
  selectedId = id;
  qty = 1;
  choice = { size: 0, milk: 0, ice: 0 };
  renderCards();
  renderDetail();
  if (isPhone()) document.body.classList.add("sheet-open");
}

function closeDetail() {
  selectedId = null;
  document.body.classList.remove("sheet-open");
  renderCards();
  renderDetail();
}

/* ---------- EVENTS ---------- */
$("chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filter = chip.dataset.filter;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
  renderCards();
});

$("search").addEventListener("input", (e) => { query = e.target.value; renderCards(); });

$("cards").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const item = MENU.find((m) => m.id === Number(card.dataset.id));
  if (!item) return;
  if (!item.available) { Shell.toast(`${item.name} is sold out for today`); return; }
  selectItem(item.id);
});

$("detail").addEventListener("click", (e) => {
  if (e.target.closest("#closeDetail")) { closeDetail(); return; }
  if (e.target.closest("#qtyMinus")) { qty = Math.max(1, qty - 1); renderDetail(); return; }
  if (e.target.closest("#qtyPlus")) { qty = Math.min(20, qty + 1); renderDetail(); return; }
  if (e.target.closest("#addBtn")) addToCart();
});

$("detail").addEventListener("change", (e) => {
  const key = e.target.dataset.opt;
  if (!key) return;
  choice[key] = Number(e.target.value);
  renderDetail();
});

$("sheetBackdrop").addEventListener("click", closeDetail);

$("cart").addEventListener("click", (e) => {
  const remove = e.target.closest(".cart__remove");
  if (remove) { cart = cart.filter((c) => c.key !== remove.dataset.key); saveCart(); renderCart(); return; }
  if (e.target.closest("#reviewBtn")) window.location.href = "checkout.html";
});

/* pick up changes the cafe team makes to the menu (price, sold out, new items) */
let menuSig = JSON.stringify(MENU);
Store.watch(() => {
  const next = Store.menu.all();
  const sig = JSON.stringify(next);
  if (sig === menuSig) return;
  menuSig = sig; MENU = next;
  const sel = MENU.find((m) => m.id === selectedId);
  if (!sel || !sel.available) selectedId = null;
  renderCards(); renderDetail();
}, 5000);

/* ---------- INIT ---------- */
renderCards();
renderDetail();
renderCart();
