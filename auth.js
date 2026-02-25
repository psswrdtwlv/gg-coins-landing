// auth.js
(function () {
  const AUTH_KEY = "ggcoins_auth_v1";

  function isAuthed() {
    try { return localStorage.getItem(AUTH_KEY) === "1"; } catch { return false; }
  }

  const path = (location.pathname || "").toLowerCase();
  const isLogin = path.endsWith("/login.html") || path.endsWith("login.html");

  if (!isLogin && !isAuthed()) {
    const next = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
    location.replace(`./login.html?next=${next}`);
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      try { localStorage.removeItem(AUTH_KEY); } catch {}
      location.href = "./login.html";
    });
  });
})();
