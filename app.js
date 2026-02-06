// ====== CONFIG ======
const API_BASE = "https://YOUR-API-DOMAIN.example.com"; // <-- поменяем в понедельник
const RATING_ENDPOINT = "/api/rating"; // ожидаемый endpoint

// ====== STATE ======
let state = {
  scope: "all", // all | operators | aup
  query: "",
  data: { all: [], operators: [], aup: [] },
  loadedAt: null,
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
  $status.style.color = isError ? "#ffb3b3" : "";
}

function normalizeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  // "297,5" -> 297.5 ; "1 214" -> 1214
  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function safeText(v) {
  return (v ?? "").toString().trim();
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

function formatNumber(n) {
  // показываем 297.5 как 297,5
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
  // сортировка по balance desc
  out.sort((a, b) => b.balance - a.balance);
  return out;
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
    setStatus("Данные не загружены");
  }
}

// ====== DATA LOAD ======
async function loadRating() {
  setStatus("Загрузка данных…");
  try {
    const url = `${API_BASE}${RATING_ENDPOINT}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // ожидаем контракт:
    // { updatedAt, operators:[{name,earned,spent,balance}], aup:[...], all:[...] }
    state.data.operators = (json.operators || []).map(mapRow);
    state.data.aup = (json.aup || []).map(mapRow);

    // all можно отдать готовым, либо собрать сами:
    state.data.all = (json.all && json.all.length)
      ? json.all.map(mapRow)
      : [...state.data.operators, ...state.data.aup];

    state.loadedAt = json.updatedAt || Date.now();
    render();
  } catch (e) {
    console.error(e);
    setStatus("Ошибка загрузки рейтинга. Проверь API.", true);
  }
}

function mapRow(r) {
  return {
    name: safeText(r.name || r.employee || r["Сотрудник"]),
    earned: normalizeNumber(r.earned ?? r.accrued ?? r["Начислено"]),
    spent: normalizeNumber(r.spent ?? r["Потрачено"]),
    balance: normalizeNumber(r.balance ?? r["Остаток"]),
  };
}

// ====== EVENTS ======
$tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    $tabs.forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.scope = btn.dataset.scope;
    render();
  });
});

$search.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

$refresh.addEventListener("click", () => loadRating());

$burger.addEventListener("click", () => {
  const isOpen = $mobilemenu.style.display === "block";
  $mobilemenu.style.display = isOpen ? "none" : "block";
});

// старт
loadRating();

