/* Workspace user management (managers only): accounts for the cafe team, not for customers. */
const staff = WS.require("users");
WS.mount("users", "Manage users");

const { esc, initials, clock, ymd, dayWord, dayShort } = Store.u;
const ROLES = { manager: "Manager", staff: "Staff" };

let selectedId = null;   // staff id or "new"
let draft = null;

const lastSeen = (ts) => {
  if (!ts) return "Never";
  if (Date.now() - ts < 5 * 60 * 1000) return "Just now";
  const k = ymd(new Date(ts));
  return `${dayWord(k) || dayShort(k)}, ${clock(ts)}`;
};

function render() {
  const list = Store.staff.all();
  const active = list.filter((s) => s.active).length;

  $("page").innerHTML = `
    <div class="ws-title">
      <div><h1>Manage users</h1><p>Create and manage sign-in accounts for your cafe team. These are workspace accounts only. Customers sign up on their own.</p></div>
      <button type="button" class="btn-primary btn-auto" id="addUser">${I("plus")}Add staff account</button>
    </div>

    <div class="ws-split">
      <div>
        <section class="ws-card">
          <div class="ws-card__head"><h2>Cafe team</h2><span class="badge badge--ok">${active} active · ${list.length - active} disabled</span></div>
          <div class="table-wrap">
            <table class="ws-table">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last active</th><th>Action</th></tr></thead>
              <tbody>${list.map((s) => `
                <tr data-id="${s.id}" class="${s.id === selectedId ? "is-selected" : ""}">
                  <td><div class="p-cell"><span class="avatar avatar-lg">${esc(initials(s.name))}</span><div><div>${esc(s.name)}${s.id === staff.id ? ' <span class="pill" style="margin-left:4px">You</span>' : ""}</div><div class="p-sub">${esc(s.email)}</div></div></div></td>
                  <td>${ROLES[s.role]}</td>
                  <td><span class="badge ${s.active ? "badge--ok" : "badge--muted"}">${s.active ? "Active" : "Disabled"}</span></td>
                  <td>${s.id === staff.id ? "Just now" : lastSeen(s.lastActive)}</td>
                  <td><button type="button" class="btn-outline btn-sm" data-edit="${s.id}">Edit</button></td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
          <p class="ws-note">${list.length} workspace account${list.length === 1 ? "" : "s"}</p>
        </section>
        <div class="info-card"><strong>Who can do what</strong>
          <p><b>Managers</b> can open every page, including Sales reports and Manage users.<br><b>Staff</b> can handle orders, the menu and inventory.</p></div>
      </div>
      <aside class="ws-panel" id="userPanel"></aside>
    </div>`;
  renderPanel();
}

function renderPanel() {
  const box = $("userPanel");
  if (!draft) { box.innerHTML = `<div class="ws-panel__empty">Select a team member to edit, or add a new staff account.</div>`; return; }
  const isNew = selectedId === "new", isMe = draft.id === staff.id;

  box.innerHTML = `
    <div class="ws-panel__head"><h2>${isNew ? "Add staff account" : "Edit account"}</h2><button type="button" class="x" id="closePanel" aria-label="Close">${I("x")}</button></div>
    <form id="userForm" novalidate style="margin-top:16px">
      <div class="f" id="uName"><label for="n">Full name</label><input id="n" value="${esc(draft.name)}" placeholder="e.g. Rina Gomez" autocomplete="off"><p class="err"></p></div>
      <div class="f" id="uEmail"><label for="e">Work email</label><input id="e" type="email" value="${esc(draft.email)}" placeholder="name@example.com" autocomplete="off"><p class="err"></p></div>
      <div class="f"><label for="r">Role</label><div class="f__wrap"><select id="r" ${isMe ? "disabled" : ""}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${draft.role === k ? "selected" : ""}>${l}</option>`).join("")}</select>${I("chevron")}</div></div>
      <div class="f" id="uPass"><label for="p">${isNew ? "Temporary password" : "Reset password (optional)"}</label><input id="p" type="text" value="" placeholder="${isNew ? "At least 8 characters" : "Leave blank to keep the current one"}" autocomplete="off"><p class="err"></p>
        <p class="hint" style="margin-top:6px">Share it with them privately. They sign in on the normal sign in page and are taken to the workspace.</p></div>
      <div class="toggle-row ${draft.active ? "" : "is-off"}" id="activeRow"><span>Account active</span><label class="switch"><input type="checkbox" id="a" ${draft.active ? "checked" : ""} ${isMe ? "disabled" : ""}><span></span></label></div>
      ${isMe ? `<p class="hint">You can't change your own role or disable your own account.</p>` : ""}
      <hr class="hr-sm">
      <button type="submit" class="btn-primary">${isNew ? "Create account" : "Save changes"}</button>
      <button type="button" class="btn-outline" id="cancelUser">Cancel</button>
      ${isNew || isMe ? "" : `<button type="button" class="btn-outline btn-danger" id="removeUser">Remove account</button>`}
    </form>`;
}

function open(id) {
  selectedId = id;
  draft = id === "new" ? { id: null, name: "", email: "", role: "staff", active: true } : { ...Store.staff.byId(id) };
  render(); WS.panel.open($("userPanel"));
}
function close() { selectedId = null; draft = null; WS.panel.close($("userPanel")); render(); }

function save() {
  const name = $("n").value.trim(), email = $("e").value.trim().toLowerCase(), pass = $("p").value;
  const isNew = selectedId === "new";
  const clash = Store.staff.byEmail(email);
  const set = (id, msg) => { const f = $(id); f.classList.toggle("invalid", !!msg); f.querySelector(".err").textContent = msg; return !msg; };
  const ok = [
    set("uName", name.length < 2 ? "Please enter the full name." : ""),
    set("uEmail", !Store.u.validEmail(email) ? "Please enter a valid email address." : clash && clash.id !== draft.id ? "Another team account already uses this email." : Store.accounts.byEmail(email) ? "This email already has a customer account." : ""),
    set("uPass", isNew && (pass.length < 8 || !/[A-Za-z]/.test(pass) || !/\d/.test(pass)) ? "Use 8+ characters with a letter and a number." : !isNew && pass && pass.length < 8 ? "Use at least 8 characters." : ""),
  ].every(Boolean);
  if (!ok) return;

  const list = Store.staff.all();
  const role = $("r").disabled ? draft.role : $("r").value;
  const active = $("a").disabled ? true : $("a").checked;
  if (isNew) {
    list.push({ id: Store.uid("s_"), name, email, password: pass, role, active, createdAt: Date.now(), lastActive: 0 });
    Store.activity.add(`Staff account created: ${name}`, `Added by ${staff.name}`);
    WS.toast(`${name}'s account is ready`);
  } else {
    const cur = list.find((s) => s.id === draft.id);
    // keep at least one active manager
    const managers = list.filter((s) => s.role === "manager" && s.active && s.id !== cur.id).length;
    if (cur.role === "manager" && (role !== "manager" || !active) && managers === 0) { WS.toast("There must be at least one active manager"); return; }
    Object.assign(cur, { name, email, role, active }); if (pass) cur.password = pass;
    WS.toast("Account updated");
  }
  Store.staff.save(list);
  close();
}

$("page").addEventListener("click", (e) => {
  if (e.target.closest("#addUser")) { open("new"); return; }
  const edit = e.target.closest("[data-edit]");
  if (edit) { open(edit.dataset.edit); return; }
  if (e.target.closest("#closePanel, #cancelUser")) { close(); return; }
  if (e.target.closest("#removeUser")) {
    if (!confirm(`Remove ${draft.name}'s account? They will no longer be able to sign in.`)) return;
    const list = Store.staff.all();
    const rest = list.filter((s) => s.id !== draft.id);
    if (!rest.some((s) => s.role === "manager" && s.active)) { WS.toast("There must be at least one active manager"); return; }
    Store.staff.save(rest); WS.toast("Account removed"); close(); return;
  }
  const row = e.target.closest("tr[data-id]");
  if (row) open(row.dataset.id);
});
$("page").addEventListener("change", (e) => { if (e.target.id === "a") $("activeRow").classList.toggle("is-off", !e.target.checked); });
$("page").addEventListener("submit", (e) => { e.preventDefault(); if (e.target.id === "userForm") save(); });
document.addEventListener("sheetclose", close);

render();
