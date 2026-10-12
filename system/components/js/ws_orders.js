/* Workspace orders: list, filters and the status panel. Changes reach the customer's status page. */
const staff = WS.require("orders");
WS.mount("orders", "Orders");

const { peso, esc, clock, todayKey, addDays, dayShort, dayFull, dayWord } = Store.u;
const PER_PAGE = 7;
const RANK = { ready: 0, preparing: 1, pending: 2 };

let filter = "all", q = "", range = "today", page = 1;
let selectedId = new URLSearchParams(location.search).get("open");

const inRange = (o) => {
  const t = todayKey();
  if (range === "today") return o.pickupDay === t;
  if (range === "yesterday") return o.pickupDay === addDays(t, -1);
  if (range === "week") return o.pickupDay >= addDays(t, -6) && o.pickupDay <= t;
  return true;
};

function sorted(list) {
  const key = (o) => o.pickupDay + String(o.pickupMin).padStart(4, "0");
  const act = list.filter((o) => o.status !== "picked_up").sort((a, b) => key(a).localeCompare(key(b)) || RANK[a.status] - RANK[b.status] || b.id.localeCompare(a.id));
  const done = list.filter((o) => o.status === "picked_up").sort((a, b) => b.id.localeCompare(a.id));
  return act.concat(done);
}

function render() {
  const base = Store.orders.all().filter(inRange);
  const count = (s) => base.filter((o) => o.status === s).length;
  const needle = q.trim().toLowerCase();
  const list = sorted(base.filter((o) => (filter === "all" || o.status === filter) && (!needle || o.id.toLowerCase().includes(needle) || o.name.toLowerCase().includes(needle))));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(page, pages);
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeAll = Store.orders.all().filter((o) => o.status !== "picked_up").length;

  const newest = Store.orders.all().filter((o) => o.status === "pending").sort((a, b) => b.placedAt - a.placedAt)[0];
  const t = todayKey();

  const chips = [["all", "All", base.length], ["pending", "Pending", count("pending")], ["preparing", "Preparing", count("preparing")], ["ready", "Ready", count("ready")], ["picked_up", "Picked up", count("picked_up")]];

  $("page").innerHTML = `
    <div class="ws-title">
      <div><h1>Orders</h1><p>Keep every pickup moving, from the first ping to the handoff.</p></div>
      <span class="badge badge--preparing">${activeAll} active order${activeAll === 1 ? "" : "s"}</span>
    </div>

    ${newest ? `<div class="ws-alert">${I("bell")}<span>New order #${esc(newest.id)} · ${esc(newest.name)} · Pickup ${esc(newest.pickupTime)} · ${peso(newest.total)} due at cafe</span><button type="button" class="btn-outline" data-review="${esc(newest.id)}">Review</button></div>` : ""}

    <div class="ws-chips" style="margin-bottom:16px">
      ${chips.map(([k, l, n]) => `<button type="button" class="ws-chip-btn ${filter === k ? "is-active" : ""}" data-filter="${k}">${l} · ${n}</button>`).join("")}
    </div>

    <div class="ws-split">
      <div>
        <div class="ws-tools" style="margin-bottom:14px">
          <div class="ws-tools__row">
            <div class="ws-search"><label for="oq">Find an order</label><input id="oq" type="search" placeholder="Search ID or customer..." value="${esc(q)}" autocomplete="off">${I("search").replace("<svg", '<svg class="ws-search__ico"')}</div>
            <div class="ws-field"><label for="orange">Pickup date</label>
              <select id="orange">${[["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["all", "All dates"]].map(([v, l]) => `<option value="${v}" ${range === v ? "selected" : ""}>${l}</option>`).join("")}</select>${I("calendar")}</div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="ws-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Pickup</th><th>Status</th><th>Total</th><th>Payment</th></tr></thead>
            <tbody>${rows.length ? rows.map((o) => `
              <tr data-id="${esc(o.id)}" class="${o.id === selectedId ? "is-selected" : ""}">
                <td>${esc(o.id)}</td><td>${esc(o.name)}</td>
                <td>${o.pickupDay === t ? "" : dayShort(o.pickupDay) + " · "}${esc(o.pickupTime)}</td>
                <td><span class="badge badge--${o.status}">${Store.STATUS[o.status].label}</span></td>
                <td>${peso(o.total)}</td><td>${o.paid ? "Paid at cafe" : "Unpaid"}</td>
              </tr>`).join("") : `<tr><td colspan="6" class="ws-empty">No orders match these filters.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="ws-tfoot">
          <span>Showing ${rows.length} of ${list.length} orders · Demo</span>
          <span class="ws-pager"><button type="button" data-page="-1" ${page <= 1 ? "disabled" : ""}>← Previous</button><button type="button" data-page="1" ${page >= pages ? "disabled" : ""}>Next →</button></span>
        </div>
        <p class="ws-note">Unpaid orders are not included in sales. Record payment when the customer collects.</p>
      </div>

      <aside class="ws-panel" id="detail"></aside>
    </div>`;
  renderDetail();
}

function renderDetail() {
  const box = $("detail");
  const o = selectedId ? Store.orders.get(selectedId) : null;
  if (!o) { box.innerHTML = `<div class="ws-panel__empty">Select an order to see its items and update its status.</div>`; return; }

  const word = dayWord(o.pickupDay);
  const times = [["pending", "Received"], ["preparing", "Preparing"], ["ready", "Ready"], ["picked_up", "Picked up"]].filter(([s]) => o.times && o.times[s]).map(([s, l]) => `${l} ${clock(o.times[s])}`).join(" · ");

  const primary = { pending: ["Start preparing", "chef", "preparing"], preparing: ["Mark ready for pickup", "check", "ready"], ready: ["Mark paid & picked up", "check", "picked_up"] }[o.status];
  const secondary = o.status === "picked_up" || o.status === "ready" ? null : ["Mark paid & picked up", "picked_up"];

  box.innerHTML = `
    <div class="ws-panel__head"><h2>#${esc(o.id)}</h2><span class="badge badge--${o.status}">${Store.STATUS[o.status].label}</span><button type="button" class="x" id="closeDetail" aria-label="Close">${I("x")}</button></div>
    <p style="font-weight:600;font-size:13.5px;margin-top:14px">${esc(o.name)} · ${esc(o.phone)}</p>
    <p class="d-meta">Pickup ${word ? word.toLowerCase() + " · " : ""}${dayFull(o.pickupDay)} · ${esc(o.pickupTime)}</p>
    <hr>
    ${o.items.map((c) => `<div class="d-line"><span>${c.qty} × ${esc(c.name)}</span><span>${peso(c.qty * c.unit)}</span></div>${c.sub && c.sub !== "Ready for pickup" ? `<div class="d-sub">${esc(c.sub)}</div>` : `<div class="d-sub" style="margin:0 0 10px"></div>`}`).join("")}
    ${o.note ? `<p class="d-meta">Note: ${esc(o.note)}</p>` : ""}
    <hr>
    <div class="d-total"><span>${o.paid ? "Paid at cafe" : "Due at pickup"}</span><strong>${peso(o.total)}</strong></div>
    <span class="badge badge--${o.paid ? "ok" : "unpaid"}">${o.paid ? "Paid · Collected" : "Unpaid · Not yet collected"}</span>
    ${primary ? `
      <p class="d-label">Update order status</p>
      <button type="button" class="btn-primary" data-set="${primary[2]}">${I(primary[1])}${primary[0]}</button>
      ${secondary ? `<button type="button" class="btn-outline" data-set="${secondary[1]}">${secondary[0]}</button>` : ""}
      <p class="d-help">Use “paid &amp; picked up” only after receiving payment and handing over the order. This records ${peso(o.total)} in sales.</p>`
      : `<p class="d-help">This order is complete. ${peso(o.total)} is recorded in sales.</p>`}
    <p class="d-times">${times}</p>`;
}

function select(id) {
  selectedId = id;
  document.querySelectorAll("tr[data-id]").forEach((r) => r.classList.toggle("is-selected", r.dataset.id === id));
  renderDetail();
  WS.panel.open($("detail"));
}

$("page").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter]");
  if (chip) { filter = chip.dataset.filter; page = 1; render(); return; }
  const pg = e.target.closest("[data-page]");
  if (pg) { page += Number(pg.dataset.page); render(); return; }
  const rev = e.target.closest("[data-review]");
  if (rev) { range = "all"; filter = "all"; q = ""; page = 1; render(); select(rev.dataset.review); return; }
  const set = e.target.closest("[data-set]");
  if (set && selectedId) {
    const o = Store.orders.setStatus(selectedId, set.dataset.set);
    WS.toast(`${o.id} marked ${Store.STATUS[o.status].label.toLowerCase()}`);
    render();
    return;
  }
  if (e.target.closest("#closeDetail")) { WS.panel.close($("detail")); if (window.innerWidth > 1100) { selectedId = null; render(); } return; }
  const row = e.target.closest("tr[data-id]");
  if (row) select(row.dataset.id);
});
$("page").addEventListener("input", (e) => {
  if (e.target.id !== "oq") return;
  q = e.target.value; page = 1;
  const pos = e.target.selectionStart; render();
  const f = $("oq"); f.focus(); f.setSelectionRange(pos, pos);
});
$("page").addEventListener("change", (e) => { if (e.target.id === "orange") { range = e.target.value; page = 1; render(); } });
document.addEventListener("sheetclose", () => WS.panel.close($("detail")));

/* new orders from customers and changes from other staff show up on their own */
let sig = "";
function refresh() {
  const next = JSON.stringify(Store.orders.all());
  if (next === sig) return;
  const first = sig === ""; sig = next;
  if (first) { render(); return; }
  const active = document.activeElement;
  if (active && active.id === "oq") return; // don't interrupt typing
  const open = $("detail").classList.contains("is-open");
  render(); if (open) WS.panel.open($("detail"));
}
refresh();
Store.watch(refresh, 4000);
if (selectedId && window.innerWidth <= 1100) WS.panel.open($("detail"));
