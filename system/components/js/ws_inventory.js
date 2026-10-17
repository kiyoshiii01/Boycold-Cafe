/* Workspace inventory: stock levels, adjustments, low-stock alerts. */
const staff = WS.require("inventory");
WS.mount("inventory", "Inventory");

const { esc, clock, dayWord, ymd, dayShort } = Store.u;

let filter = "all", q = "", selectedId = null;
let type = "add";

const TYPES = {
  add:   { label: "Add received stock",        qty: "Quantity to add",   log: "Restock",        sign: 1 },
  use:   { label: "Usage count (deduct)",      qty: "Quantity used",     log: "Usage count",    sign: -1 },
  count: { label: "Physical count (set total)", qty: "Counted quantity", log: "Physical count", sign: 0 },
  waste: { label: "Wastage (deduct)",          qty: "Quantity wasted",   log: "Wastage",        sign: -1 },
};
const FAMILY = { kg: [["kg", 1], ["g", 0.001]], L: [["L", 1], ["ml", 0.001]] };
const round = (n) => Math.round(n * 100) / 100;
const q2 = (n) => String(round(n));
const dayText = (ts) => { const k = ymd(new Date(ts)); return dayWord(k) || dayShort(k); };

function render() {
  const all = Store.inventory.all();
  const low = all.filter(Store.inventory.isLow);
  const needle = q.trim().toLowerCase();
  const list = all.filter((i) => (filter === "all" || Store.inventory.isLow(i)) && (!needle || i.name.toLowerCase().includes(needle)));
  const adj = Store.inventory.adjustments();
  const lastTs = Math.max(0, ...all.map((i) => i.updated || 0));
  const lastBy = (adj[0] && adj[0].by) || staff.name;

  $("page").innerHTML = `
    <div class="ws-title">
      <div><h1>Inventory</h1><p>Simple stock checks for a smoothly running counter.</p></div>
      <button type="button" class="btn-outline btn-auto" id="addIng">${I("plus")}Add ingredient</button>
    </div>

    <div class="kpis kpis--3">
      <div class="kpi"><div class="kpi__label">Tracked ingredients</div><div class="kpi__value">${all.length}</div><div class="kpi__foot">Coffee, kitchen &amp; bakery essentials</div></div>
      <div class="kpi"><div class="kpi__label">Below minimum stock</div><div class="kpi__value">${low.length}</div><div class="kpi__foot">${low.length ? esc(low.map((i) => i.name).join(" · ")) : "Everything is stocked"}</div></div>
      <div class="kpi"><div class="kpi__label">Last stock update</div><div class="kpi__value">${lastTs ? clock(lastTs) : "–"}</div><div class="kpi__foot">${lastTs ? dayText(lastTs) : ""} · Updated by ${esc(lastBy)}</div></div>
    </div>

    <div class="ws-split">
      <div>
        <div class="ws-tools" style="margin-bottom:14px">
          <div class="ws-chips"><button type="button" class="ws-chip-btn ${filter === "all" ? "is-active" : ""}" data-filter="all">All stock</button><button type="button" class="ws-chip-btn ${filter === "low" ? "is-active" : ""}" data-filter="low">Low stock · ${low.length}</button></div>
          <div class="ws-search" style="width:260px;max-width:100%"><label for="iq">Find an ingredient</label><input id="iq" type="search" placeholder="Search stock..." value="${esc(q)}" autocomplete="off">${I("search").replace("<svg", '<svg class="ws-search__ico"')}</div>
        </div>
        <div class="table-wrap">
          <table class="ws-table">
            <thead><tr><th>Ingredient</th><th>On hand</th><th>Minimum</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>${list.length ? list.map((i) => `
              <tr data-id="${i.id}" class="${i.id === selectedId ? "is-selected" : ""}">
                <td>${esc(i.name)}</td><td>${q2(i.onHand)} ${esc(i.unit)}</td><td>${q2(i.min)} ${esc(i.unit)}</td>
                <td><span class="badge ${Store.inventory.isLow(i) ? "badge--low" : "badge--ok"}">${Store.inventory.isLow(i) ? "Low stock" : "In stock"}</span></td>
                <td>${clock(i.updated)}</td><td><button type="button" class="btn-outline btn-sm" data-edit="${i.id}">Edit</button></td>
              </tr>`).join("") : `<tr><td colspan="6" class="ws-empty">No ingredients match.</td></tr>`}</tbody>
          </table>
        </div>
        <p class="ws-note">Stock is updated by the team. Low-stock alerts compare on-hand quantities with the minimum level.</p>
      </div>

      <div class="ws-stack">
        <aside class="ws-panel" id="stockPanel" style="position:static;position:sticky"></aside>
        <section class="ws-card">
          <h2 style="margin-bottom:14px">Recent adjustments</h2>
          ${adj.length ? adj.slice(0, 4).map((a) => `<div style="margin-bottom:14px"><strong style="font-size:13.5px;font-weight:500">${esc(a.name)}</strong><div class="hint" style="margin-top:3px">${a.delta > 0 ? "+" : "−"}${q2(Math.abs(a.delta))} ${esc(a.unit)} · ${esc(a.type)}${a.reason ? " · " + esc(a.reason) : ""}</div><div class="hint">${clock(a.ts)} · ${esc(a.by)}</div></div>`).join("") : `<p class="hint">No adjustments yet.</p>`}
        </section>
      </div>
    </div>`;
  renderPanel();
}

function renderPanel() {
  const box = $("stockPanel");
  const i = selectedId ? Store.inventory.all().find((x) => x.id === selectedId) : null;
  if (!i) { box.innerHTML = `<div class="ws-panel__empty">Select an ingredient to record a stock update.</div>`; return; }
  const fam = FAMILY[i.unit] || [[i.unit, 1]];
  const lowNow = Store.inventory.isLow(i);

  box.innerHTML = `
    <div class="ws-panel__head"><h2>Update stock</h2><button type="button" class="x" id="closePanel" aria-label="Close">${I("x")}</button></div>
    <span class="badge ${lowNow ? "badge--low" : "badge--ok"}" style="margin:10px 0 12px">${esc(i.name)} · ${lowNow ? "Low stock" : "In stock"}</span>
    <p class="hint">Current balance: ${q2(i.onHand)} ${esc(i.unit)}. Record a physical stock count or add received stock.</p>
    <form id="stockForm" novalidate style="margin-top:14px">
      <div class="f"><label for="aType">Adjustment type</label><div class="f__wrap"><select id="aType">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${type === k ? "selected" : ""}>${t.label}</option>`).join("")}</select>${I("chevron")}</div></div>
      <div class="grid-2">
        <div class="f" id="fQty"><label for="aQty" id="qtyLabel">${TYPES[type].qty}</label><input id="aQty" inputmode="decimal" placeholder="0"><p class="err"></p></div>
        <div class="f"><label for="aUnit">Unit</label><div class="f__wrap"><select id="aUnit" ${fam.length < 2 ? "disabled" : ""}>${fam.map(([u]) => `<option>${esc(u)}</option>`).join("")}</select>${I("chevron")}</div></div>
      </div>
      <div class="f"><label for="aWhy">Reason / note</label><input id="aWhy" placeholder="Morning restock"></div>
      <p class="hint" id="preview" style="color:var(--ok);font-size:12.5px;margin-bottom:6px"></p>
      <button type="submit" class="btn-primary">Save stock update</button>
      <button type="button" class="btn-outline" id="editIng">Edit name &amp; minimum</button>
    </form>`;
  updatePreview();
}

function parsed() {
  const i = Store.inventory.all().find((x) => x.id === selectedId);
  const fam = FAMILY[i.unit] || [[i.unit, 1]];
  const factor = (fam.find(([u]) => u === $("aUnit").value) || [0, 1])[1];
  const raw = parseFloat(String($("aQty").value).replace(/,/g, ""));
  return { i, qty: isNaN(raw) ? NaN : raw * factor };
}
function newBalance() {
  const { i, qty } = parsed();
  if (isNaN(qty)) return { i, value: null };
  const s = TYPES[type].sign;
  return { i, value: round(s === 0 ? qty : i.onHand + s * qty) };
}
function updatePreview() {
  const { i, value } = newBalance();
  const el = $("preview");
  if (value === null) { el.textContent = ""; return; }
  el.style.color = value < 0 ? "var(--danger)" : "var(--ok)";
  el.textContent = value < 0 ? "That is more than what's on hand." : `New balance after saving: ${q2(value)} ${i.unit}`;
}

function saveStock() {
  const { i, value } = newBalance();
  const bad = value === null || parsed().qty < 0 || value < 0;
  $("fQty").classList.toggle("invalid", bad);
  $("fQty").querySelector(".err").textContent = bad ? (value !== null && value < 0 ? "That is more than what's on hand." : "Enter a quantity of 0 or more.") : "";
  if (bad) return;

  const list = Store.inventory.all();
  const cur = list.find((x) => x.id === i.id);
  const delta = round(value - cur.onHand);
  cur.onHand = value; cur.updated = Date.now();
  Store.inventory.save(list);
  Store.inventory.logAdjustment({ ts: Date.now(), name: cur.name, delta, unit: cur.unit, type: TYPES[type].log, reason: $("aWhy").value.trim(), by: staff.name });
  WS.toast(`${cur.name} updated to ${q2(value)} ${cur.unit}`);
  render();
  WS.panel.close($("stockPanel"));
}

function ingredientModal(existing) {
  const m = WS.modal(`
    <h2>${existing ? "Edit ingredient" : "Add ingredient"}</h2>
    <p class="modal__sub">${existing ? "Rename it or change the level that triggers a low-stock alert." : "Track a new ingredient and set the level that triggers a low-stock alert."}</p>
    <form id="ingForm" novalidate>
      <div class="f" id="gName"><label for="gN">Name</label><input id="gN" value="${esc(existing ? existing.name : "")}" placeholder="e.g. Vanilla syrup"><p class="err"></p></div>
      <div class="grid-2">
        <div class="f"><label for="gU">Unit</label><div class="f__wrap"><select id="gU" ${existing ? "disabled" : ""}>${["kg", "L", "slices", "pcs"].map((u) => `<option ${existing && existing.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select>${I("chevron")}</div></div>
        <div class="f" id="gOn"><label for="gO">On hand</label><input id="gO" inputmode="decimal" value="${existing ? existing.onHand : ""}" ${existing ? "disabled" : ""} placeholder="0"><p class="err"></p></div>
      </div>
      <div class="f" id="gMin"><label for="gM">Minimum level</label><input id="gM" inputmode="decimal" value="${existing ? existing.min : ""}" placeholder="0"><p class="err"></p></div>
      <div class="modal__actions"><button type="button" class="btn-outline" data-close>Cancel</button><button type="submit" class="btn-primary">${existing ? "Save" : "Add ingredient"}</button></div>
    </form>`);
  m.el.querySelector("[data-close]").addEventListener("click", m.close);
  m.el.querySelector("#ingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = m.el.querySelector("#gN").value.trim();
    const on = parseFloat(m.el.querySelector("#gO").value), min = parseFloat(m.el.querySelector("#gM").value);
    const set = (id, msg) => { const f = m.el.querySelector(id); f.classList.toggle("invalid", !!msg); f.querySelector(".err").textContent = msg; return !msg; };
    const ok = [set("#gName", name ? "" : "Please enter a name."), set("#gOn", existing || (on >= 0) ? "" : "Enter the quantity on hand."), set("#gMin", min >= 0 ? "" : "Enter a minimum level.")].every(Boolean);
    if (!ok) return;
    const list = Store.inventory.all();
    if (existing) { const cur = list.find((x) => x.id === existing.id); cur.name = name; cur.min = min; cur.updated = Date.now(); }
    else { const id = Store.uid("i"); list.push({ id, name, unit: m.el.querySelector("#gU").value, onHand: on, min, updated: Date.now() }); selectedId = id; }
    Store.inventory.save(list);
    m.close(); WS.toast(existing ? "Ingredient updated" : `${name} added to inventory`); render();
  });
}

$("page").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter]");
  if (chip) { filter = chip.dataset.filter; render(); return; }
  if (e.target.closest("#addIng")) { ingredientModal(null); return; }
  if (e.target.closest("#editIng")) { ingredientModal(Store.inventory.all().find((x) => x.id === selectedId)); return; }
  if (e.target.closest("#closePanel")) { selectedId = null; WS.panel.close($("stockPanel")); render(); return; }
  const row = e.target.closest("tr[data-id]");
  if (row) { selectedId = row.dataset.id; type = "add"; render(); WS.panel.open($("stockPanel")); }
});
$("page").addEventListener("input", (e) => {
  if (e.target.id === "iq") { q = e.target.value; const p = e.target.selectionStart; render(); const f = $("iq"); f.focus(); f.setSelectionRange(p, p); }
  if (e.target.id === "aQty") updatePreview();
});
$("page").addEventListener("change", (e) => {
  if (e.target.id === "aType") { type = e.target.value; $("qtyLabel").textContent = TYPES[type].qty; updatePreview(); }
  if (e.target.id === "aUnit") updatePreview();
});
$("page").addEventListener("submit", (e) => { e.preventDefault(); if (e.target.id === "stockForm") saveStock(); });
document.addEventListener("sheetclose", () => WS.panel.close($("stockPanel")));

render();
