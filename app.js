// ====== CONFIG ======
const API_BASE = "https://YOUR-API-DOMAIN.example.com"; // <-- поменяем в понедельник
const RATING_ENDPOINT = "/api/rating"; // ожидаемый endpoint

// ====== STATE ======
let state = {
  scope: "all", // all | operators | aup
  query: "",
  data: { all: [], operators: [], aup: [] },
};

// ====== DOM ======
const $status = document.getElementById("status");
const $tbody = document.querySelector("#ratingTable tbody");
const $search = document.getElementById("search");
const $refresh = document.getElementById("refresh");
const $top3 = document.getElementById("top3");
const $burger = document.getElementById("burger");
const $mobilemenu = document.getElementById("mobilemenu");

// ====== HELPERS ======
const fmt = (n) => {
  if (n === null || n === undefined || n === "") return "";
  const x = Number(String(n).replace(",", "."));
  if (Number.isNaN(x)) return String(n);
  const isInt = Math.abs(x - Math.round(x)) < 1e-9;
  return isInt ? String(Math.round(x)) : String(x).replace(".", ",");
};

const normalizeName = (s) => String(s || "").trim().toLowerCase();

const compareByBalanceDesc = (a, b) => {
  const aa = Number(String(a.balance ?? 0).replace(",", "."));
  const bb = Number(String(b.balance ?? 0).replace(",", "."));
  return bb - aa;
};

const renderStatus = (text) => {
  $status.textContent = text;
};

const renderRows = () => {
  const list = (state.data[state.scope] || []).filter((row) => {
    if (!state.query) return true;
    return normalizeName(row.name).includes(normalizeName(state.query));
  });

  $tbody.innerHTML = "";

  if (!list.length) {
    $tbody.innerHTML = `<tr><td colspan="5" style="color:#6b6f78;">Нет данных</td></tr>`;
    $top3.hidden = true;
    return;
  }

  // TOP 3 (optional)
  const top = [...list].sort(compareByBalanceDesc).slice(0, 3);
  $top3.hidden = false;
  $top3.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0 0;">
      ${top
        .map(
          (t, i) => `
        <div style="background:rgba(255,255,255,.82);border:1px solid rgba(17,19,23,.06);border-radius:18px;padding:14px 14px 12px;box-shadow:0 10px 26px rgba(17,19,23,.08);backdrop-filter:blur(8px)">
          <div style="font-weight:900;color:#b12338;">#${i + 1}</div>
          <div style="font-weight:900;margin-top:4px">${t.name}</div>
          <div style="color:#5f636b;font-size:13px;margin-top:6px">Остаток: <b style="color:#131417">${fmt(t.balance)}</b></div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  list.sort(compareByBalanceDesc).forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${row.name}</td>
      <td class="num">${fmt(row.earned)}</td>
      <td class="num">${fmt(row.spent)}</td>
      <td class="num"><b>${fmt(row.balance)}</b></td>
    `;
    $tbody.appendChild(tr);
  });
};

const parseApiResponse = (json) => {
  // Ожидаем:
  // { all: [{name, earned, spent, balance}], operators: [...], aup: [...] }
  // или просто массив для all
  if (Array.isArray(json)) {
    return { all: json, operators: [], aup: [] };
  }
  return {
    all: Array.isArray(json.all) ? json.all : [],
    operators: Array.isArray(json.operators) ? json.operators : [],
    aup: Array.isArray(json.aup) ? json.aup : [],
  };
};

const loadData = async () => {
  renderStatus("Загрузка данных…");
  try {
    const res = await fetch(`${API_BASE}${RATING_ENDPOINT}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    state.data = parseApiResponse(json);

    renderStatus("Данные загружены.");
    renderRows();
  } catch (e) {
    console.error(e);
    renderStatus("Данные не загружены");
    $tbody.innerHTML = `<tr><td colspan="5" style="color:#6b6f78;">Нет данных</td></tr>`;
    $top3.hidden = true;
  }
};

// ====== EVENTS ======
// Tabs
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.scope = btn.dataset.scope;
    renderRows();
  });
});

// Search
$search.addEventListener("input", (e) => {
  state.query = e.target.value || "";
  renderRows();
});

// Refresh
$refresh.addEventListener("click", () => loadData());

// Burger (mobile)
$burger.addEventListener("click", () => {
  const isOpen = $mobilemenu.style.display === "block";
  $mobilemenu.style.display = isOpen ? "none" : "block";
});

// Close mobile on click
$mobilemenu.querySelectorAll("a").forEach((a) => {
  a.addEventListener("click", () => ($mobilemenu.style.display = "none"));
});

// Init
loadData();


// ====== REVEAL ON SCROLL (subtle, modern) ======
(() => {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    items.forEach(el => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });

  items.forEach(el => io.observe(el));
})();
