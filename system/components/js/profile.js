/* Profile: edit personal details, change password, pick light or dark theme. */
let user = Shell.requireUser();
Shell.mount("account");

const { esc, initials } = Store.u;

function setErr(id, msg) {
  const f = $(id); f.classList.toggle("invalid", Boolean(msg));
  f.querySelector(".err").textContent = msg || "";
  return !msg;
}

function render() {
  const count = Store.orders.byUser(user.id).length;
  const since = new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const theme = BCTheme.get();

  $("app").innerHTML = `
    <div class="pg-head"><h1>Your profile</h1><p>Keep your details up to date so pickup is quick and easy.</p></div>

    <div class="pf-who">
      <span class="avatar">${esc(initials(user.name))}</span>
      <div><strong>${esc(user.name)}</strong><span>${esc(user.email)} · Member since ${since} · ${count} order${count === 1 ? "" : "s"}</span></div>
    </div>

    <section class="pf-card">
      <h2>Personal details</h2>
      <p>We use these to prefill your pickup name and phone number at checkout.</p>
      <form id="infoForm" novalidate>
        <div class="f" id="fName"><label for="name">Full name</label><input id="name" type="text" value="${esc(user.name)}" autocomplete="name"><p class="err"></p></div>
        <div class="f" id="fEmail"><label for="email">Email address</label><input id="email" type="email" value="${esc(user.email)}" autocomplete="email"><p class="err"></p></div>
        <div class="f" id="fPhone"><label for="phone">Phone number</label><input id="phone" type="tel" value="${esc(user.phone)}" autocomplete="tel" placeholder="09XX XXX XXXX"><p class="err"></p></div>
        <div class="pf-actions"><button type="submit" class="btn-primary">Save changes</button></div>
      </form>
    </section>

    <section class="pf-card">
      <h2>Password</h2>
      <p>Use at least 8 characters, including a letter and a number.</p>
      <form id="pwForm" novalidate>
        <div class="f" id="fCur"><label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password"><p class="err"></p></div>
        <div class="grid-2">
          <div class="f" id="fNew"><label for="new">New password</label><input id="new" type="password" autocomplete="new-password"><p class="err"></p></div>
          <div class="f" id="fConf"><label for="conf">Confirm new password</label><input id="conf" type="password" autocomplete="new-password"><p class="err"></p></div>
        </div>
        <div class="pf-actions"><button type="submit" class="btn-outline btn-auto">Update password</button></div>
      </form>
    </section>

    <section class="pf-card">
      <h2>Appearance</h2>
      <p>Choose how Boycold Cafe looks on this device.</p>
      <div class="themes" id="themes">
        <label class="theme-opt"><input type="radio" name="theme" value="light" ${theme === "light" ? "checked" : ""}><span class="theme-opt__box"><span class="theme-prev theme-prev--light"><i></i><i></i></span><span class="theme-opt__name">Light</span></span></label>
        <label class="theme-opt"><input type="radio" name="theme" value="dark" ${theme === "dark" ? "checked" : ""}><span class="theme-opt__box"><span class="theme-prev theme-prev--dark"><i></i><i></i></span><span class="theme-opt__name">Dark</span></span></label>
      </div>
    </section>

    <section class="pf-card pf-out">
      <h2>Signed in as ${esc(user.email)}</h2>
      <button type="button" class="btn-outline btn-auto" id="signOut">${I("logout")}Sign out</button>
    </section>`;
}
render();

$("app").addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "infoForm") {
    const name = $("name").value.trim(), email = $("email").value.trim().toLowerCase(), phone = $("phone").value.trim();
    const ok = [
      setErr("fName", name.length < 2 ? "Please enter your full name." : ""),
      setErr("fEmail", !Store.u.validEmail(email) ? "Please enter a valid email address." : (Store.accounts.byEmail(email) || {}).id && Store.accounts.byEmail(email).id !== user.id ? "Another account already uses this email." : Store.staff.byEmail(email) ? "Another account already uses this email." : ""),
      setErr("fPhone", !Store.u.validPhone(phone) ? "Enter a valid PH number, e.g. 09XX XXX XXXX." : ""),
    ].every(Boolean);
    if (!ok) return;
    Store.accounts.update(user.id, { name, email, phone });
    Shell.toast("Profile saved");
    setTimeout(() => location.reload(), 650);
  }
  if (e.target.id === "pwForm") {
    const cur = $("cur").value, nw = $("new").value, conf = $("conf").value;
    const ok = [
      setErr("fCur", cur !== user.password ? "That isn't your current password." : ""),
      setErr("fNew", nw.length < 8 || !/[A-Za-z]/.test(nw) || !/\d/.test(nw) ? "Use 8+ characters with a letter and a number." : ""),
      setErr("fConf", conf !== nw ? "Passwords do not match." : ""),
    ].every(Boolean);
    if (!ok) return;
    user = Store.accounts.update(user.id, { password: nw });
    e.target.reset();
    Shell.toast("Password updated");
  }
});

$("app").addEventListener("change", (e) => {
  if (e.target.name === "theme") BCTheme.set(e.target.value);
});
$("app").addEventListener("click", (e) => { if (e.target.closest("#signOut")) Shell.signOut(); });
document.addEventListener("themechange", () => {
  const r = document.querySelector(`input[name="theme"][value="${BCTheme.get()}"]`);
  if (r) r.checked = true;
});
