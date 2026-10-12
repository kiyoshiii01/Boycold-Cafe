/* Checkout: review the cart, choose pickup, place the order. */
const user = Shell.requireUser();
Shell.mount("menu");

const { peso, esc } = Store.u;
const ARROW_ICON = I("arrow");

const saveCart = () => Store.cart.save(cart);

/* ---------- STATE ---------- */
let cart = Store.cart.get();
let selectedTime = "";
let placed = false;

/* ---------- PICKUP DATES AND TIMES (dummy hours: 8:00 AM to 8:00 PM) ---------- */
const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 20 * 60;
const STEP = 15;
const LEAD = 15; // minutes of lead time needed for today's orders

const fmtTime = Store.u.fmtMin;

function slotsFor(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + LEAD : 0;
  const out = [];
  for (let t = OPEN_MIN; t <= CLOSE_MIN; t += STEP) {
    if (t >= earliest) out.push(fmtTime(t));
  }
  return out;
}

function buildDates() {
  const list = [];
  const base = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    if (i === 0 && !slotsFor(d).length) continue; // cafe is closed for today
    const pretty = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const prefix = i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : "";
    list.push({ date: d, label: prefix + pretty });
  }
  return list;
}

const dates = buildDates();

function renderDates() {
  $("pickupDate").innerHTML = dates.map((d, i) => `<option value="${i}">${d.label}</option>`).join("");
}

function renderTimes() {
  const d = dates[Number($("pickupDate").value)];
  const slots = slotsFor(d.date);
  $("pickupTime").innerHTML = slots.map((s) => `<option value="${s}">${s}</option>`).join("");
  selectedTime = slots[0] || "";
  $("pickupTime").value = selectedTime;
  renderSlots(slots);
}

function renderSlots(slots) {
  $("slots").innerHTML = slots.slice(0, 4).map((s) =>
    `<button type="button" class="slot ${s === selectedTime ? "is-active" : ""}" data-time="${s}">${s}</button>`
  ).join("");
}

/* ---------- ORDER ---------- */
function totals() {
  const count = cart.reduce((n, c) => n + c.qty, 0);
  const total = cart.reduce((n, c) => n + c.qty * c.unit, 0);
  return { count, total };
}

function thumbFor(c) {
  const m = Store.menu.get(c.id);
  return m && m.img ? `<div class="ph"><img src="${Store.u.asset(m.img)}" alt=""></div>` : `<div class="ph">${I("cup")}<span>Boycold Cafe</span></div>`;
}

function itemSub(c) {
  if (!c.sub || c.sub === "Ready for pickup") return `Freshly made · ${peso(c.unit)} each`;
  return c.sub;
}

function renderOrder() {
  const { count } = totals();

  const body = cart.length
    ? cart.map((c) => `
        <div class="item" data-key="${esc(c.key)}">
          <div class="thumb">${thumbFor(c)}</div>
          <div class="item__info">
            <div class="item__name">${esc(c.name)}</div>
            <div class="item__sub">${itemSub(c)}</div>
            <div class="item__links">
              <a href="menu.html">Edit customization</a><i>&middot;</i><button type="button" data-action="remove">Remove</button>
            </div>
          </div>
          <div class="qty">
            <button type="button" data-action="minus" aria-label="Decrease quantity">&minus;</button>
            <output>${c.qty}</output>
            <button type="button" data-action="plus" aria-label="Increase quantity">+</button>
          </div>
          <div class="item__price">${peso(c.qty * c.unit)}</div>
        </div>`).join("")
    : `<div class="co-empty">Your cart is empty.<br><a href="menu.html">Browse the menu</a></div>`;

  $("orderCard").innerHTML = `
    <div class="co-card__head">
      <h2 class="co-card__title">Your order</h2>
      <span class="co-card__count">${count} item${count === 1 ? "" : "s"}</span>
    </div>
    ${body}`;
}

function renderSummary() {
  const { count, total } = totals();
  $("summary").innerHTML = `
    <h2>The little details</h2>
    <div class="sum-row"><span>Subtotal &middot; ${count} item${count === 1 ? "" : "s"}</span><span>${peso(total)}</span></div>
    <div class="sum-row sum-row--muted"><span>Pickup fee</span><span class="free">Free</span></div>
    <div class="sum-total"><span>Total due</span><strong>${peso(total)}</strong></div>
    <div class="pay-box">
      <strong>Pay at Boycold Cafe</strong>
      <p>No online payment needed. Settle your total with our team when you collect your order.</p>
    </div>
    <button type="button" class="btn-primary btn-primary--lg" id="confirmBtn" ${cart.length ? "" : "disabled"}>
      ${ARROW_ICON}<span>Confirm pickup order</span>
    </button>
    <p class="fine">By confirming, you agree to collect and pay for your order at your selected pickup time.</p>`;
}

function renderAll() {
  renderOrder();
  renderSummary();
}

/* ---------- VALIDATION ---------- */
function setError(fieldId, errId, message) {
  $(errId).textContent = message;
  $(fieldId).classList.toggle("invalid", Boolean(message));
  return !message;
}

function validateName() {
  const v = $("pickupName").value.trim();
  if (!v) return setError("nameField", "nameError", "Please enter a pickup name.");
  if (v.length < 2) return setError("nameField", "nameError", "Name is too short.");
  return setError("nameField", "nameError", "");
}

function validatePhone() {
  const digits = Store.u.digitsOnly($("phone").value);
  if (!digits) return setError("phoneField", "phoneError", "Please enter your phone number.");
  if (!Store.u.validPhone(digits)) return setError("phoneField", "phoneError", "Enter a valid PH number, e.g. 09XX XXX XXXX.");
  return setError("phoneField", "phoneError", "");
}

function validateTime() {
  if (!selectedTime) return setError("timeField", "timeError", "Please choose a pickup time.");
  return setError("timeField", "timeError", "");
}

$("pickupName").addEventListener("blur", validateName);
$("phone").addEventListener("blur", validatePhone);
$("pickupName").addEventListener("input", () => $("nameError").textContent && validateName());
$("phone").addEventListener("input", () => $("phoneError").textContent && validatePhone());

/* ---------- EVENTS ---------- */
$("pickupDate").addEventListener("change", renderTimes);

$("pickupTime").addEventListener("change", (e) => {
  selectedTime = e.target.value;
  renderSlots(slotsFor(dates[Number($("pickupDate").value)].date));
  validateTime();
});

$("slots").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  selectedTime = slot.dataset.time;
  $("pickupTime").value = selectedTime;
  renderSlots(slotsFor(dates[Number($("pickupDate").value)].date));
  validateTime();
});

$("orderCard").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const row = btn.closest(".item");
  const item = cart.find((c) => c.key === row.dataset.key);
  if (!item) return;

  const action = btn.dataset.action;
  if (action === "plus") item.qty = Math.min(20, item.qty + 1);
  if (action === "minus") item.qty = Math.max(1, item.qty - 1);
  if (action === "remove") cart = cart.filter((c) => c.key !== item.key);

  saveCart();
  renderAll();
});

$("summary").addEventListener("click", (e) => {
  if (!e.target.closest("#confirmBtn")) return;
  if (placed || !cart.length) return;

  const okTime = validateTime();
  const okName = validateName();
  const okPhone = validatePhone();
  if (!okTime || !okName || !okPhone) {
    (!okName ? $("pickupName") : !okPhone ? $("phone") : $("pickupTime")).focus();
    return;
  }

  const d = dates[Number($("pickupDate").value)];
  const tm = selectedTime.match(/(\d+):(\d+) (AM|PM)/);
  const pickupMin = ((Number(tm[1]) % 12) + (tm[3] === "PM" ? 12 : 0)) * 60 + Number(tm[2]);

  const order = Store.orders.create({
    user,
    items: cart.map((c) => ({ key: c.key, id: c.id, name: c.name, qty: c.qty, unit: c.unit, sub: c.sub })),
    pickupDay: Store.u.ymd(d.date),
    pickupTime: selectedTime,
    pickupMin,
    name: $("pickupName").value.trim(),
    phone: $("phone").value.trim(),
    note: $("note").value.trim(),
  });

  placed = true;
  cart = [];
  Store.cart.clear();
  $("confirmBtn").disabled = true;
  window.location.href = `order_status.html?id=${encodeURIComponent(order.id)}&new=1`;
});

/* ---------- INIT ---------- */
$("pickupName").value = user.name;
$("phone").value = user.phone || "";
renderDates();
renderTimes();
renderAll();
