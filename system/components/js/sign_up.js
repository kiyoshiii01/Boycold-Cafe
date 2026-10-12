const form = document.getElementById("signupForm");
const toast = document.getElementById("toast");
const createBtn = document.getElementById("createBtn");

const fields = {
  fullName: { input: document.getElementById("fullName"), error: document.getElementById("fullNameError") },
  email: { input: document.getElementById("email"), error: document.getElementById("emailError") },
  phone: { input: document.getElementById("phone"), error: document.getElementById("phoneError") },
  password: { input: document.getElementById("password"), error: document.getElementById("passwordError") },
  confirm: { input: document.getElementById("confirmPassword"), error: document.getElementById("confirmError") },
};
const terms = document.getElementById("terms");
const termsError = document.getElementById("termsError");

let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setError(field, message) {
  field.error.textContent = message;
  field.input.closest(".field").classList.toggle("invalid", Boolean(message));
  return !message;
}

/* Validators: each returns true when valid */
const validators = {
  fullName() {
    const v = fields.fullName.input.value.trim();
    if (!v) return setError(fields.fullName, "Please enter your full name.");
    if (v.length < 2) return setError(fields.fullName, "Name is too short.");
    return setError(fields.fullName, "");
  },
  email() {
    const v = fields.email.input.value.trim();
    if (!v) return setError(fields.email, "Please enter your email address.");
    if (!Store.u.validEmail(v)) return setError(fields.email, "Please enter a valid email address.");
    return setError(fields.email, "");
  },
  phone() {
    const digits = fields.phone.input.value.replace(/[\s-]/g, "");
    if (!digits) return setError(fields.phone, "Please enter your phone number.");
    if (!/^(09\d{9}|\+639\d{9})$/.test(digits)) return setError(fields.phone, "Enter a valid PH number, e.g. 09XX XXX XXXX.");
    return setError(fields.phone, "");
  },
  password() {
    const v = fields.password.input.value;
    if (!v) return setError(fields.password, "Please create a password.");
    if (v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      return setError(fields.password, "Use 8+ characters with a letter and a number.");
    }
    return setError(fields.password, "");
  },
  confirm() {
    const v = fields.confirm.input.value;
    if (!v) return setError(fields.confirm, "Please confirm your password.");
    if (v !== fields.password.input.value) return setError(fields.confirm, "Passwords do not match.");
    return setError(fields.confirm, "");
  },
  terms() {
    const ok = terms.checked;
    termsError.textContent = ok ? "" : "Please agree to the Terms and Privacy Policy.";
    return ok;
  },
};

/* Validate on blur, re-validate while typing once an error is showing */
Object.entries(fields).forEach(([name, f]) => {
  f.input.addEventListener("blur", validators[name]);
  f.input.addEventListener("input", () => {
    if (f.error.textContent) validators[name]();
    if (name === "password" && fields.confirm.input.value) validators.confirm();
  });
});
terms.addEventListener("change", validators.terms);

/* Show / hide password (both fields) */
document.querySelectorAll(".toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.classList.toggle("is-visible", hidden);
    btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    input.focus();
  });
});

/* Submit (frontend demo only, no backend yet) */
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const results = Object.keys(validators).map((name) => validators[name]());
  const firstBad = results.findIndex((ok) => !ok);
  if (firstBad !== -1) {
    const order = [fields.fullName, fields.email, fields.phone, fields.password, fields.confirm, { input: terms }];
    order[firstBad].input.focus();
    return;
  }

  if (Store.accounts.byEmail(fields.email.input.value) || Store.staff.byEmail(fields.email.input.value)) {
    setError(fields.email, "An account with this email already exists. Try signing in instead.");
    fields.email.input.focus();
    return;
  }

  createBtn.disabled = true;
  createBtn.querySelector("span").textContent = "Creating account...";

  const account = Store.accounts.create({
    name: fields.fullName.input.value,
    email: fields.email.input.value,
    phone: fields.phone.input.value,
    password: fields.password.input.value,
  });
  Store.session.set(account.id, true);

  showToast("Account created! Opening the menu...");
  setTimeout(() => { window.location.href = "menu.html"; }, 900);
});

/* Links to pages that don't exist yet */
document.querySelectorAll("[data-soon]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    showToast(el.dataset.soon);
  });
});
