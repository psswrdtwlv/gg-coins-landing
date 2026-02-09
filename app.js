const API = "./api/rating"; // worker endpoint на GH Pages проксируется (как у тебя было)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const $tabs = $$("#tabs .tab");
const $search = $("#search");
const $refresh = $("#refresh");
const $status = $("#status");
const $tbody = $("#tbody");

let RAW = [];
let scope = "all";
let q = "";

function setStatus(text) {
  if ($status) $status.textContent = text;
}

function setActiveTab(nextScope) {
  scope = nextScope;
  $tabs.forEach((b) => b.classList.toggle("active", b.dataset.scope === scope));
  render();
}

function norm(s) {
  return String(s || "").trim();
}

function toNum(v) {
  const n = Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function matchScope(row) {
  const type = (row.type || "").toLowerCase();
  if (scope === "all") return true;
  if (scope === "operators") return type === "operator" || type === "оператор";
  if (scope === "aup") return type === "aup" || type === "ауп";
  return true;
}

function matchQuery(row) {
  if (!q) return true;
  const name = (row.name || "").toLowerCase();
  return name.includes(q);
}

function render() {
  if (!$tbody) return;

  const rows = RAW
    .filter(matchScope)
    .filter(matchQuery)
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

  if (!rows.length) {
    $tbody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">Нет данных</td>
      </tr>
    `;
    return;
  }

  $tbody.innerHTML = rows
    .map((r, i) => {
      const earned = toNum(r.earned);
      const spent = toNum(r.spent);
      const balance = toNum(r.balance);

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${norm(r.name)}</td>
          <td><b>${earned}</b></td>
          <td><b>${spent}</b></td>
          <td><b>${balance}</b></td>
        </tr>
      `;
    })
    .join("");
}

async function load() {
  try {
    setStatus("Загружаю данные…");
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // ожидаем массив объектов
    RAW = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
    setStatus(RAW.length ? `Загружено: ${RAW.length}` : "Данные не загружены");
    render();
  } catch (e) {
    console.error(e);
    RAW = [];
    setStatus("Ошибка загрузки данных");
    render();
  }
}

/* EVENTS */
$tabs.forEach((btn) => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.scope));
});

if ($search) {
  $search.addEventListener("input", (e) => {
    q = String(e.target.value || "").trim().toLowerCase();
    render();
  });
}

if ($refresh) {
  $refresh.addEventListener("click", () => load());
}

/* INIT */
setActiveTab("all");
load();
