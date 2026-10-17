/* Customer sign in (front-end demo: accounts live in localStorage via store.js) */
const form = $("loginForm");
const emailInput = $("email");
const passwordInput = $("password");
const emailError = $("emailError");
const passwordError = $("passwordError");
const toggleBtn = $("togglePassword");
const signInBtn = $("signInBtn");

let toastTimer;
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

toggleBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  toggleBtn.classList.toggle("is-visible", isHidden);
  toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  passwordInput.focus();
});

function setError(input, errorEl, message) {
  errorEl.textContent = message;
  input.closest(".field").classList.toggle("invalid", Boolean(message));
}

function validateEmail() {
  const value = emailInput.value.trim();
  if (!value) { setError(emailInput, emailError, "Please enter your email address."); return false; }
  if (!Store.u.validEmail(value)) { setError(emailInput, emailError, "Please enter a valid email address."); return false; }
  setError(emailInput, emailError, ""); return true;
}
function validatePassword() {
  const value = passwordInput.value;
  if (!value) { setError(passwordInput, passwordError, "Please enter your password."); return false; }
  if (value.length < 6) { setError(passwordInput, passwordError, "Password must be at least 6 characters."); return false; }
  setError(passwordInput, passwordError, ""); return true;
}

emailInput.addEventListener("blur", validateEmail);
passwordInput.addEventListener("blur", validatePassword);
emailInput.addEventListener("input", () => emailError.textContent && validateEmail());
passwordInput.addEventListener("input", () => passwordError.textContent && validatePassword());


form.addEventListener("submit", (e) => {
  e.preventDefault();
  const emailOk = validateEmail();
  const passOk = validatePassword();
  if (!emailOk || !passOk) { (emailOk ? passwordInput : emailInput).focus(); return; }

  // one sign in for everyone: the account decides where you land
  const email = emailInput.value;
  const customer = Store.accounts.byEmail(email);
  const member = Store.staff.byEmail(email);
  const account = customer || member;

  if (!account) { setError(emailInput, emailError, "We couldn't find an account with that email. Create one below?"); emailInput.focus(); return; }
  if (account.password !== passwordInput.value) { setError(passwordInput, passwordError, "That password doesn't match. Please try again."); passwordInput.focus(); return; }
  if (!customer && !member.active) { setError(emailInput, emailError, "This team account is disabled. Please ask your manager."); emailInput.focus(); return; }

  signInBtn.disabled = true;
  signInBtn.querySelector("span").textContent = "Signing in...";
  Store.session.clear();
  Store.staffSession.clear();

  const first = account.name.split(" ")[0];
  if (customer) {
    Store.session.set(customer.id, $("remember").checked);
    showToast(`Welcome back, ${first}! Opening the menu...`);
    setTimeout(() => { window.location.href = "menu.html"; }, 600);
  } else {
    Store.staffSession.set(member.id, $("remember").checked);
    showToast(`Welcome, ${first}! Opening the workspace...`);
    setTimeout(() => { window.location.href = "workspace/overview.html"; }, 600);
  }
});

document.querySelectorAll("[data-soon]").forEach((el) => {
  el.addEventListener("click", (e) => { e.preventDefault(); showToast(el.dataset.soon); });
});
