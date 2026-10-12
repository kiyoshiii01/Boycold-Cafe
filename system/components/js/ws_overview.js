/* Workspace overview: today at a glance. */
const staff = WS.require("overview");
WS.mount("overview", "Overview");

const { peso, esc, clock, todayKey, ymd } = Store.u;
const RANK = { ready: 0, preparing: 1, pending: 2 };
const COLORS = { picked_up: "#3f6e55", ready: "#9bc2a9", preparing: "#51647f", pending: "#c09a3a" };

function render() {
  const today = todayKey();
  const all = Store.orders.all();
  const todays = all.filter((o) => o.pickupDay === today);
  const active = all.filter((o) => o.status !== "picked_up");
  const collected = all.filter((o) => o.status === "picked_up" && ymd(new Date(o.times.picked_up)) === today);
  const sales = collected.reduce((n, o) => n + o.total, 0);
  const low = Store.inventory.all().filter(Store.inventory.isLow);
  const count = (s) => active.filter((o) => o.status === s).length;

  const next = active.slice().sort((a, b) =>
    (a.pickupDay + String(a.pickupMin).padStart(4, "0")).localeCompare(b.pickupDay + String(b.pickupMin).padStart(4, "0")) ||
    RANK[a.status] - RANK[b.status] || b.id.localeCompare(a.id));
  const shown = next.slice(0, 4);

  const mix = ["picked_up", "preparing", "pending", "ready"].map((s) => ({ s, n: todays.filter((o) => o.status === s).length })).filter((x) => x.n);
  const mixLabel = { picked_up: "Picked up", preparing: "Preparing", pending: "Pending", ready: "Ready" };
  const inProgress = todays.filter((o) => o.status !== "picked_up").length;
  const feed = Store.activity.all().slice(0, 5);
  const longDate = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  $("page").innerHTML = `
    <div class="ws-title">
      <div><h1>A good day starts here.</h1><p>Your cafe at a glance · ${longDate} · Demo data</p></div>
      <a href="orders.html" class="btn-primary btn-auto">${I("arrow")}View all orders</a>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="kpi__label">Paid sales today</div><div class="kpi__value">${peso(sales)}</div><div class="kpi__foot">Collected orders only</div></div>
      <div class="kpi"><div class="kpi__label">Completed orders</div><div class="kpi__value">${collected.length}</div><div class="kpi__foot">Paid &amp; picked up today</div></div>
      <div class="kpi"><div class="kpi__label">Active orders</div><div class="kpi__value">${active.length}</div><div class="kpi__foot">${count("pending")} pending · ${count("preparing")} preparing · ${count("ready")} ready</div></div>
      <div class="kpi"><div class="kpi__label">Low-stock ingredients</div><div class="kpi__value">${low.length}</div><div class="kpi__foot">Check before the next rush</div></div>
    </div>

    <div class="ws-split">
      <div class="ws-stack">
        <section class="ws-card ov-list">
          <div class="ws-card__head"><h2>Next pickups</h2><span class="badge badge--preparing">${active.length} active</span></div>
          <div class="table-wrap">
            <table class="ws-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Pickup</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>${shown.length ? shown.map((o) => `
                <tr data-id="${esc(o.id)}"><td>${esc(o.id)}</td><td>${esc(o.name)}</td><td>${esc(o.pickupTime)}</td>
                <td><span class="badge badge--${o.status}">${Store.STATUS[o.status].label}</span></td><td>${peso(o.total)}</td></tr>`).join("")
                : `<tr><td colspan="5" class="ws-empty">No active orders right now. Enjoy the quiet.</td></tr>`}</tbody>
            </table>
          </div>
          <p class="ws-note">Showing next ${shown.length} of ${active.length} active orders · All amounts are unpaid</p>
        </section>

        <section class="ws-card">
          <div class="ws-card__head"><h2>Recent activity</h2><span class="hint">Updated at ${clock(Date.now())}</span></div>
          <ul class="feed">${feed.map((a) => `<li><time>${clock(a.ts)}</time><div><strong>${esc(a.title)}</strong><small>${esc(a.sub)}</small></div></li>`).join("")}</ul>
        </section>
      </div>

      <div class="ws-stack">
        <section class="ws-card">
          <div class="ws-card__head"><h2>${I("alert")}Running low</h2></div>
          ${low.length ? low.slice(0, 3).map((i) => `<div class="ov-low"><strong>${esc(i.name)}</strong><small>${i.onHand} ${esc(i.unit)} left · minimum ${i.min} ${esc(i.unit)}</small></div>`).join("") : `<p class="hint">Everything is above its minimum level.</p>`}
          <a href="inventory.html" class="btn-outline" style="width:100%;margin-top:6px">Update inventory</a>
        </section>

        <section class="ws-card">
          <h2>Today's order mix</h2>
          <div class="mix-bar">${mix.length ? mix.map((m) => `<i style="flex:${m.n};background:${COLORS[m.s]}" title="${mixLabel[m.s]} · ${m.n}"></i>`).join("") : `<i style="flex:1;background:var(--tint)"></i>`}</div>
          <div class="mix-legend">${mix.map((m) => `<span style="--c:${COLORS[m.s]}">${mixLabel[m.s]} ${m.n}</span>`).join("")}</div>
          <p style="margin-top:14px;font-size:13px;line-height:1.6">${todays.length} orders today<br>${todays.length - inProgress} completed · ${inProgress} still in progress</p>
          <hr class="hr-sm">
          <p class="hint">Sales are recorded only after payment and collection at the cafe.</p>
        </section>
      </div>
    </div>`;
}

$("page").addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-id]");
  if (row) location.href = `orders.html?open=${encodeURIComponent(row.dataset.id)}`;
});

let sig = "";
function refresh() {
  const next = JSON.stringify([Store.orders.all(), Store.inventory.all(), Store.activity.all().slice(0, 5)]);
  if (next === sig) return;
  sig = next; render();
}
refresh();
Store.watch(refresh, 4000);
