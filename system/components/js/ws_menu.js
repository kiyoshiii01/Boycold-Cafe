/* Workspace menu manager: prices, photos, availability. Changes appear on the customer menu. */
const staff = WS.require("menu");
WS.mount("menu", "Menu");

const { peso, esc, clock, dayWord } = Store.u;
const CATS = { coffee: "Coffee", food: "Food", pastries: "Pastries" };

let items = Store.menu.all();
let filter = "all", q = "";
let selectedId = null;       // number, or "new"
let draft = null;            // working copy shown in the panel

const thumb = (m) => `<span class="p-thumb">${m.img ? `<img src="${Store.u.asset(m.img)}" alt="">` : I("image")}</span>`;

function optsSummary(opts) {
  const parts = [];
  if (opts.includes("size")) parts.push("Regular · Large (+₱30)");
  if (opts.includes("milk")) parts.push("Dairy / Oat (+₱20)");
  if (opts.includes("ice")) parts.push("Ice preference");
  return parts.length ? parts.join(" · ") : "No drink options";
}

function renderList() {
  const needle = q.trim().toLowerCase();
  const list = items.filter((m) => (filter === "all" || m.cat === filter) && (!needle || m.name.toLowerCase().includes(needle)));
  const n = (c) => items.filter((m) => m.cat === c).length;
  const avail = items.filter((m) => m.available).length;

  $("menuList").innerHTML = `
    <div class="ws-chips" style="margin-bottom:16px">
      ${[["all", "All products", items.length], ["coffee", "Coffee", n("coffee")], ["food", "Food", n("food")], ["pastries", "Pastries", n("pastries")]]
        .map(([k, l, c]) => `<button type="button" class="ws-chip-btn ${filter === k ? "is-active" : ""}" data-filter="${k}">${l} · ${c}</button>`).join("")}
    </div>
    <section class="ws-card">
      <div class="ws-card__head"><h2>Your cafe menu</h2><span class="badge badge--ok">${avail} available · ${items.length - avail} sold out</span></div>
      <div class="table-wrap">
        <table class="ws-table">
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Availability</th><th>Action</th></tr></thead>
          <tbody>${list.length ? list.map((m) => `
            <tr data-id="${m.id}" class="${m.id === selectedId ? "is-selected" : ""}">
              <td><div class="p-cell">${thumb(m)}<span>${esc(m.name)}</span></div></td>
              <td>${CATS[m.cat] || esc(m.cat)}</td><td>${peso(m.price)}</td>
              <td><span class="badge ${m.available ? "badge--ok" : "badge--muted"}">${m.available ? "Available" : "Sold out"}</span></td>
              <td><button type="button" class="btn-outline btn-sm" data-edit="${m.id}">Edit</button></td>
            </tr>`).join("") : `<tr><td colspan="5" class="ws-empty">No products match.</td></tr>`}</tbody>
        </table>
      </div>
      <p class="ws-note">${items.length} product${items.length === 1 ? "" : "s"} · Prices in PHP</p>
    </section>
    <div class="info-card"><strong>Sold out doesn't mean forgotten.</strong><p>Temporarily unavailable products stay visible on the menu, but customers can't add them to their cart.</p></div>`;
}

function renderPanel() {
  const box = $("editPanel");
  if (!draft) { box.innerHTML = `<div class="ws-panel__empty">Select a product to edit its details, or add a new one.</div>`; return; }
  const isNew = selectedId === "new";
  const upd = draft.updatedAt ? `Last updated by ${esc(draft.updatedBy)} · ${dayWord(Store.u.ymd(new Date(draft.updatedAt))) || Store.u.dayShort(Store.u.ymd(new Date(draft.updatedAt)))}, ${clock(draft.updatedAt)}` : "Not saved yet";

  box.innerHTML = `
    <div class="ws-panel__head"><h2>${isNew ? "Add product" : "Edit product"}</h2><button type="button" class="x" id="closePanel" aria-label="Close">${I("x")}</button></div>
    <div class="photo" id="photoBox">${draft.img ? `<img src="${Store.u.asset(draft.img)}" alt="">` : I("image")}</div>
    <button type="button" class="photo-link" id="photoBtn">${draft.img ? "Replace photo" : "Upload photo"} ${I("external").replace("<svg", '<svg width="11" height="11"')}</button>
    <input type="file" id="photoFile" accept="image/*" hidden>

    <form id="editForm" novalidate>
      <div class="f" id="fName"><label for="pName">Product name</label><input id="pName" value="${esc(draft.name)}" placeholder="e.g. Iced Mocha"><p class="err"></p></div>
      <div class="grid-2">
        <div class="f"><label for="pCat">Category</label><div class="f__wrap"><select id="pCat">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${draft.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select>${I("chevron")}</div></div>
        <div class="f" id="fPrice"><label for="pPrice">Base price (PHP)</label><input id="pPrice" inputmode="decimal" value="${draft.price ? draft.price.toFixed(2) : ""}" placeholder="0.00"><p class="err"></p></div>
      </div>
      <div class="f"><label for="pDesc">Description</label><input id="pDesc" value="${esc(draft.desc)}" placeholder="One short line for the menu card"></div>
      <div class="toggle-row ${draft.available ? "" : "is-off"}" id="availRow"><span>Available to order</span><label class="switch"><input type="checkbox" id="pAvail" ${draft.available ? "checked" : ""}><span></span></label></div>
      <p class="hint">${draft.cat === "coffee" ? "Drink options: " + optsSummary(draft.opts.length ? draft.opts : ["size", "milk", "ice"]) : "Pastries and food have no drink options."}</p>
      <hr class="hr-sm">
      <button type="submit" class="btn-primary">${isNew ? "Add to menu" : "Save changes"}</button>
      <button type="button" class="btn-outline" id="cancelEdit">Cancel</button>
      ${isNew ? "" : `<button type="button" class="btn-outline btn-danger" id="removeBtn">Remove product</button>`}
    </form>
    <p class="panel-foot">${upd}</p>`;
}

function openProduct(id) {
  selectedId = id;
  if (id === "new") draft = { id: null, name: "", cat: "coffee", price: 0, desc: "", long: "", opts: [], available: true, img: "", badge: "" };
  else draft = { ...Store.menu.get(id), opts: [...Store.menu.get(id).opts] };
  renderList(); renderPanel(); WS.panel.open($("editPanel"));
}
function closePanel() {
  selectedId = null; draft = null; WS.panel.close($("editPanel")); renderList(); renderPanel();
}

/* shrink uploaded photos so they fit in browser storage */
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 640, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function save() {
  const name = $("pName").value.trim();
  const price = parseFloat(String($("pPrice").value).replace(/,/g, ""));
  const e1 = !name ? "Please enter a product name." : "";
  const e2 = !(price > 0) ? "Enter a price greater than 0." : "";
  $("fName").classList.toggle("invalid", !!e1); $("fName").querySelector(".err").textContent = e1;
  $("fPrice").classList.toggle("invalid", !!e2); $("fPrice").querySelector(".err").textContent = e2;
  if (e1 || e2) return;

  const cat = $("pCat").value;
  const available = $("pAvail").checked;
  const list = Store.menu.all();
  const meta = { name, cat, price, desc: $("pDesc").value.trim(), available, img: draft.img, updatedBy: staff.name, updatedAt: Date.now() };
  meta.opts = cat === "coffee" ? (draft.opts.length ? draft.opts : ["size", "milk", "ice"]) : [];

  if (selectedId === "new") {
    list.push({ id: Store.menu.nextId(), long: meta.desc, badge: "", ...meta });
    Store.activity.add(`New product added: ${name}`, `Updated by ${staff.name}`);
    WS.toast(`${name} added to the menu`);
  } else {
    const cur = list.find((m) => m.id === selectedId);
    const wasAvail = cur.available;
    Object.assign(cur, meta);
    if (wasAvail !== available) Store.activity.add(`${name} marked ${available ? "available again" : "sold out"}`, `Updated by ${staff.name}`);
    WS.toast("Changes saved. The customer menu is updated");
  }
  Store.menu.save(list);
  items = Store.menu.all();
  closePanel();
}

$("page").innerHTML = `
  <div class="ws-title">
    <div><h1>Menu &amp; prices</h1><p>A thoughtful menu, kept fresh. Changes appear on the customer menu.</p></div>
    <button type="button" class="btn-primary btn-auto" id="addBtn">${I("plus")}Add product</button>
  </div>
  <div class="ws-tools" style="justify-content:flex-end">
    <div class="ws-search" style="width:260px;max-width:100%"><label for="mq">Search products</label><input id="mq" type="search" placeholder="Product name..." autocomplete="off">${I("search").replace("<svg", '<svg class="ws-search__ico"')}</div>
  </div>
  <div class="ws-split"><div id="menuList"></div><aside class="ws-panel" id="editPanel"></aside></div>`;

$("addBtn").addEventListener("click", () => openProduct("new"));
$("mq").addEventListener("input", (e) => { q = e.target.value; renderList(); });

$("page").addEventListener("click", async (e) => {
  const chip = e.target.closest("[data-filter]");
  if (chip) { filter = chip.dataset.filter; renderList(); return; }
  const edit = e.target.closest("[data-edit]");
  if (edit) { openProduct(Number(edit.dataset.edit)); return; }
  if (e.target.closest("#closePanel, #cancelEdit")) { closePanel(); return; }
  if (e.target.closest("#photoBtn, #photoBox")) { $("photoFile").click(); return; }
  if (e.target.closest("#removeBtn")) {
    if (!confirm(`Remove ${draft.name} from the menu?`)) return;
    Store.menu.save(Store.menu.all().filter((m) => m.id !== selectedId));
    Store.activity.add(`${draft.name} removed from the menu`, `Updated by ${staff.name}`);
    items = Store.menu.all(); WS.toast("Product removed"); closePanel(); return;
  }
  const row = e.target.closest("tr[data-id]");
  if (row) openProduct(Number(row.dataset.id));
});
$("page").addEventListener("change", async (e) => {
  if (e.target.id === "photoFile" && e.target.files[0]) {
    try { draft.img = await readPhoto(e.target.files[0]); keepFields(); renderPanel(); }
    catch (err) { WS.toast("Sorry, that photo couldn't be read"); }
  }
  if (e.target.id === "pAvail") $("availRow").classList.toggle("is-off", !e.target.checked);
  if (e.target.id === "pCat") { keepFields(); renderPanel(); }
});
/* keep what was typed when the panel re-renders (photo or category change) */
function keepFields() {
  draft.name = $("pName").value; draft.price = parseFloat($("pPrice").value) || 0;
  draft.desc = $("pDesc").value; draft.cat = $("pCat").value; draft.available = $("pAvail").checked;
}
$("page").addEventListener("submit", (e) => { e.preventDefault(); if (e.target.id === "editForm") save(); });
document.addEventListener("sheetclose", closePanel);

renderList(); renderPanel();
Store.watch(() => {
  const sig = JSON.stringify(Store.menu.all());
  if (sig === JSON.stringify(items) || draft) return;
  items = Store.menu.all(); renderList();
}, 5000);
