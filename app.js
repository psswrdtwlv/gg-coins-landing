// ====== CONFIG ======
const API_BASE = "https://YOUR-API-DOMAIN.example.com"; // поменяем в понедельник
const RATING_ENDPOINT = "/api/rating";
const USE_MOCK = false;

// ====== STATE ======
let state = {
  scope: "all",
  query: "",
  data: { all: [], operators: [], aup: [] },
  loadedAt: null,
  loading: false,
};

// ====== DOM ======
const $status = document.getElementById("status");
const $tbody = document.querySelector("#ratingTable tbody");
const $search = document.getElementById("search");
const $refresh = document.getElementById("refresh");
const $top3 = document.getElementById("top3");

const $tabs = Array.from(document.querySelectorAll(".tab"));
const $burger = document.getElementById("burger");
const $mobilemenu = document.getElementById("mobilemenu");

// ====== UI ======
function setStatus(text, isError = false) {
  $status.textContent = text;
  $status.style.color = isError ? "#b11226" : "";
}

function setLoading(isLoading) {
  state.loading = isLoading;
  if (!$refresh) return;
  $refresh.classList.toggle("is-loading", isLoading);
  $refresh.disabled = isLoading;
  $refresh.setAttribute("aria-busy", isLoading ? "true" : "false");
}

function normalizeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function safeText(v) {
  return (v ?? "").toString().trim();
}

function formatNumber(n) {
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  const v = isInt ? Math.round(n).toString() : n.toFixed(1);
  return v.replace(".", ",");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTop3(rows) {
  if (!rows || rows.length < 1) {
    $top3.hidden = true;
    $top3.innerHTML = "";
    return;
  }
  const top = rows.slice(0, 3);
  $top3.hidden = false;
  $top3.innerHTML = top.map((r, idx) => {
    const place = idx + 1;
    return `
      <div class="winner">
        <div class="winner__place">TOP ${place}</div>
        <div class="winner__name">${escapeHtml(r.name)}</div>
        <div class="winner__coins">Остаток: <b>${formatNumber(r.balance)}</b> GC</div>
      </div>
    `;
  }).join("");
}

function buildRow(rank, row) {
  return `
    <tr>
      <td>${rank}</td>
      <td>${escapeHtml(row.name)}</td>
      <td class="num">${formatNumber(row.earned)}</td>
      <td class="num">${formatNumber(row.spent)}</td>
      <td class="num"><b>${formatNumber(row.balance)}</b></td>
    </tr>
  `;
}

function applyFilters(rows) {
  let out = rows.slice();
  if (state.query) {
    const q = state.query.toLowerCase();
    out = out.filter(r => r.name.toLowerCase().includes(q));
  }
  out.sort((a, b) => b.balance - a.balance);
  return out;
}

function renderSkeleton(rows = 9) {
  const sk = (w = "100%") => `<div class="skeletonCell" style="width:${w}"></div>`;
  $tbody.innerHTML = Array.from({ length: rows }).map((_, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${sk("72%")}</td>
      <td class="num">${sk("56%")}</td>
      <td class="num">${sk("52%")}</td>
      <td class="num">${sk("46%")}</td>
    </tr>
  `).join("");
}

function render() {
  const rows = applyFilters(state.data[state.scope] || []);
  renderTop3(rows);

  const html = rows.map((r, idx) => buildRow(idx + 1, r)).join("");
  $tbody.innerHTML = html || `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;

  if (state.loadedAt) {
    const d = new Date(state.loadedAt);
    setStatus(`Обновлено: ${d.toLocaleString("ru-RU")}`);
  } else {
    setStatus("Данные временно недоступны");
  }
}

// ====== DATA LOAD ======
function mapRow(r) {
  return {
    name: safeText(r.name || r.employee || r["Сотрудник"]),
    earned: normalizeNumber(r.earned ?? r.accrued ?? r["Начислено"]),
    spent: normalizeNumber(r.spent ?? r["Потрачено"]),
    balance: normalizeNumber(r.balance ?? r["Остаток"]),
  };
}

async function loadRating() {
  setLoading(true);
  setStatus("Загрузка данных…");
  renderSkeleton(9);

  try {
    if (USE_MOCK) {
      const json = {
        updatedAt: new Date().toISOString(),
        operators: [
          { name: "Чайкова Ольга", earned: 1214, spent: 1000, balance: 214 },
          { name: "Мелкозёрова Екатерина", earned: 977, spent: 800, balance: 177 },
          { name: "Суслина Алина", earned: 927, spent: 800, balance: 127 },
        ],
        aup: [
          { name: "Ковальчук Анжелика", earned: 748, spent: 698, balance: 50 },
          { name: "Никитина Валерия", earned: 509, spent: 469, balance: 40 },
        ],
      };
      state.data.operators = (json.operators || []).map(mapRow);
      state.data.aup = (json.aup || []).map(mapRow);
      state.data.all = [...state.data.operators, ...state.data.aup];
      state.loadedAt = json.updatedAt;
      render();
      return;
    }

    const url = `${API_BASE}${RATING_ENDPOINT}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    state.data.operators = (json.operators || []).map(mapRow);
    state.data.aup = (json.aup || []).map(mapRow);
    state.data.all = (json.all && json.all.length)
      ? json.all.map(mapRow)
      : [...state.data.operators, ...state.data.aup];

    state.loadedAt = json.updatedAt || Date.now();
    render();
  } catch (e) {
    console.error(e);
    setStatus("Данные не загружены. Проверь API.", true);
    $top3.hidden = true;
    $tbody.innerHTML = `<tr><td colspan="5" class="muted">Нет данных</td></tr>`;
  } finally {
    setLoading(false);
  }
}

// ====== NAV / MOBILE ======
function closeMobileMenu() {
  if (!$mobilemenu) return;
  $mobilemenu.style.display = "none";
  $mobilemenu.setAttribute("aria-hidden", "true");
  $burger?.setAttribute("aria-expanded", "false");
}

$burger?.addEventListener("click", () => {
  const isOpen = $mobilemenu.style.display === "block";
  $mobilemenu.style.display = isOpen ? "none" : "block";
  $mobilemenu.setAttribute("aria-hidden", isOpen ? "true" : "false");
  $burger.setAttribute("aria-expanded", isOpen ? "false" : "true");
});

$mobilemenu?.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (a) closeMobileMenu();
});

// ====== TABS / SEARCH ======
$tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    $tabs.forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.scope = btn.dataset.scope;
    render();
  });
});

$search?.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

$refresh?.addEventListener("click", () => loadRating());

// ====== REVEAL ======
function initReveal() {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window) || els.length === 0) {
    els.forEach(el => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-visible");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  els.forEach(el => io.observe(el));
}

initReveal();
loadRating();
