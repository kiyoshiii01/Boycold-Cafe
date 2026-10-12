/* Workspace sales reports (managers only): only paid & collected orders count. */
const staff = WS.require("sales");
WS.mount("sales", "Sales reports");

const { peso, esc, clock, todayKey, addDays, ymd, parseKey, dayShort, dayFull } = Store.u;

let period = "today";
let from = todayKey(), to = todayKey();
let showAll = false;

function setPeriod(p) {
  const t = todayKey();
  period = p;
  if (p === "today") { from = to = t; }
  if (p === "yesterday") { from = to = addDays(t, -1); }
  if (p === "week") { from = addDays(t, -6); to = t; }
  if (p === "month") { from = t.slice(0, 8) + "01"; to = t; }
}

const collectedKey = (o) => ymd(new Date(o.times.picked_up));
function sales() {
  return Store.orders.all()
    .filter((o) => o.status === "picked_up" && o.times && o.times.picked_up && collectedKey(o) >= from && collectedKey(o) <= to)
    .sort((a, b) => b.times.picked_up - a.times.picked_up);
}

function buckets(list) {
  const single = from === to;
  const map = new Map();
  if (single) {
    const hrs = list.map((o) => new Date(o.times.picked_up).getHours());
    if (!hrs.length) return [];
    for (let h = Math.min(...hrs); h <= Math.max(...hrs); h++) map.set(h, { label: `${(h % 12) || 12} ${h >= 12 ? "PM" : "AM"}`, v: 0 });
    list.forEach((o) => { map.get(new Date(o.times.picked_up).getHours()).v += o.total; });
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) map.set(d, { label: dayShort(d), v: 0 });
    list.forEach((o) => { const b = map.get(collectedKey(o)); if (b) b.v += o.total; });
  }
  return [...map.values()];
}

function render() {
  const list = sales();
  const total = list.reduce((n, o) => n + o.total, 0);
  const avg = list.length ? total / list.length : 0;
  const bk = buckets(list);
  const max = Math.max(1, ...bk.map((b) => b.v));
  const top = Math.max(0, ...bk.map((b) => b.v));
  const step = Math.max(100, Math.ceil(max / 3 / 100) * 100);
  const axis = step * 3;

  const items = {};
  list.forEach((o) => o.items.forEach((c) => { const r = items[c.name] || (items[c.name] = { n: 0, rev: 0 }); r.n += c.qty; r.rev += c.qty * c.unit; }));
  const best = Object.entries(items).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  const itemCount = Object.values(items).reduce((n, r) => n + r.n, 0);

  const rows = showAll ? list : list.slice(0, 6);
  const shown = rows.reduce((n, o) => n + o.total, 0);
  const single = from === to;
  const rangeText = single ? dayFull(from) : `${dayFull(from)} – ${dayFull(to)}`;

  $("page").innerHTML = `
    <div class="ws-title">
      <div><h1>Sales reports</h1><p>A clear record of paid, collected orders. No pending order amounts are counted.</p></div>
      <button type="button" class="btn-outline btn-auto" id="exportBtn">${I("download")}Export records</button>
    </div>

    <div class="filters">
      <div class="ws-field"><label for="sp">Reporting period</label><select id="sp">${[["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["month", "This month"], ["custom", "Custom range"]].map(([v, l]) => `<option value="${v}" ${period === v ? "selected" : ""}>${l}</option>`).join("")}</select>${I("chevron")}</div>
      <div class="ws-field"><label for="sf">From</label><input id="sf" type="date" value="${from}" max="${todayKey()}"></div>
      <div class="ws-field"><label for="st">To</label><input id="st" type="date" value="${to}" max="${todayKey()}"></div>
      <button type="button" class="btn-primary btn-auto" id="apply">Apply filters</button>
      <span class="badge badge--low" style="margin-bottom:10px">Demo · As of ${clock(Date.now())}</span>
    </div>

    <div class="kpis kpis--3">
      <div class="kpi"><div class="kpi__label">${single && from === todayKey() ? "Revenue today" : "Revenue"}</div><div class="kpi__value">${peso(total)}</div><div class="kpi__foot">Payment recorded at the cafe</div></div>
      <div class="kpi"><div class="kpi__label">Paid &amp; completed orders</div><div class="kpi__value">${list.length}</div><div class="kpi__foot">All collected · No unpaid orders</div></div>
      <div class="kpi"><div class="kpi__label">Average order value</div><div class="kpi__value">${peso(avg)}</div><div class="kpi__foot">${peso(total)} ÷ ${list.length} completed orders</div></div>
    </div>

    <div class="ws-split" style="margin-bottom:20px">
      <section class="ws-card">
        <div class="ws-card__head"><h2>Recorded sales by ${single ? "hour" : "day"}</h2><span class="badge badge--muted">Total ${peso(total)}</span></div>
        <p class="hint">${rangeText} · PHP · Paid &amp; collected only</p>
        ${bk.length ? `
        <div class="chart">
          <div class="chart__y"><span>0</span><span>${step.toLocaleString("en-PH")}</span><span>${(step * 2).toLocaleString("en-PH")}</span><span>${axis.toLocaleString("en-PH")}</span></div>
          <div class="chart__plot">${bk.map((b) => `<div class="bar ${b.v === top && top > 0 ? "is-top" : ""}"><b>${b.v ? peso(b.v) : ""}</b><i style="height:${(b.v / axis) * 100}%"></i></div>`).join("")}</div>
          <div class="chart__x">${bk.map((b) => `<span>${b.label}</span>`).join("")}</div>
        </div>` : `<p class="ws-empty">No collected orders in this period.</p>`}
      </section>

      <section class="ws-card">
        <h2 style="margin-bottom:8px">Best-selling items</h2>
        ${best.length ? `<ul class="best">${best.map(([n, r]) => `<li><div>${esc(n)}<small>${r.n} sold</small></div><strong style="font-weight:500">${peso(r.rev)}</strong></li>`).join("")}</ul>` : `<p class="hint">Nothing sold in this period.</p>`}
        <p class="hint" style="margin-top:12px">Item revenue includes milk add-ons. Total ${itemCount} items · ${peso(total)}.</p>
      </section>
    </div>

    <section class="ws-card">
      <div class="ws-card__head"><h2>Sales records</h2><span class="badge badge--ok">${list.length} completed order${list.length === 1 ? "" : "s"}</span></div>
      <div class="table-wrap">
        <table class="ws-table">
          <thead><tr><th>Order</th><th>Collected</th><th>Customer</th><th>Payment</th><th>Status</th><th>Paid total</th></tr></thead>
          <tbody>${rows.length ? rows.map((o) => `<tr><td>${esc(o.id)}</td><td>${single ? "" : dayShort(collectedKey(o)) + " · "}${clock(o.times.picked_up)}</td><td>${esc(o.name)}</td><td>Paid at cafe</td><td><span class="badge badge--picked_up">Picked up</span></td><td>${peso(o.total)}</td></tr>`).join("") : `<tr><td colspan="6" class="ws-empty">No sales records for this period.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="ws-tfoot">
        <span>${showAll ? `Showing all ${list.length}` : `Showing latest ${rows.length} of ${list.length}`} · Shown: ${peso(shown)}${!showAll && list.length > rows.length ? ` · Earlier ${list.length - rows.length} orders: ${peso(total - shown)}` : ""}${list.length > 6 ? ` · <button type="button" class="btn-link" id="toggleAll">${showAll ? "Show latest 6" : "Show all"}</button>` : ""}</span>
        <strong style="font-size:15px;color:var(--text)">${single ? "Day total" : "Total"}: ${peso(total)}</strong>
      </div>
    </section>`;
}

function exportCsv() {
  const list = sales();
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Order", "Collected", "Customer", "Payment", "Items", "Paid total (PHP)"].join(",")]
    .concat(list.map((o) => [o.id, `${collectedKey(o)} ${clock(o.times.picked_up)}`, o.name, "Paid at cafe", o.items.map((c) => `${c.qty} x ${c.name}`).join("; "), o.total].map(cell).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `boycold-sales-${from}${from === to ? "" : "_to_" + to}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  WS.toast(`Exported ${list.length} record${list.length === 1 ? "" : "s"}`);
}

$("page").addEventListener("change", (e) => {
  if (e.target.id === "sp") { if (e.target.value !== "custom") { setPeriod(e.target.value); showAll = false; render(); } else period = "custom"; }
  if (e.target.id === "sf" || e.target.id === "st") { period = "custom"; $("sp").value = "custom"; }
});
$("page").addEventListener("click", (e) => {
  if (e.target.closest("#apply")) {
    const f = $("sf").value, t = $("st").value;
    if (!f || !t) { WS.toast("Please choose both dates"); return; }
    if (f > t) { WS.toast("The start date must be before the end date"); return; }
    period = $("sp").value; from = f; to = t; showAll = false; render(); return;
  }
  if (e.target.closest("#exportBtn")) { exportCsv(); return; }
  if (e.target.closest("#toggleAll")) { showAll = !showAll; render(); }
});

setPeriod("today");
render();
