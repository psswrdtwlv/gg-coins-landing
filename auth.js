// auth.js
// Простая “шторка” (НЕ security-grade). Нужна только для внутреннего портала на GitHub Pages.

const AUTH_KEY = "ggcoins_auth_v1";

(function guard() {
  const isLogin = /\/login\.html$/i.test(location.pathname) || /\/login$/i.test(location.pathname);
  const authed = localStorage.getItem(AUTH_KEY) === "1";

  if (!authed && !isLogin) {
    const next = encodeURIComponent(location.pathname.replace(/^\//, "") + location.hash);
    location.replace(`./login.html?next=${next}`);
  }
})();

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_KEY);
    location.href = "./login.html";
  });
});
