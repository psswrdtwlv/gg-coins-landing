// app.js
const API = "./rating.json"; // статический файл в репе

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const $tabs = $$("#tabs .tab");
const $search = $("#search");
const $refresh = $("#refresh");
const $status = $("#status");
const $tbody = $("#tbody");

let RAW = [];              // текущий список строк для фильтрации
let PAYLOAD = null;        // весь json (на всякий)
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
  // поддержка "1 234,56", "1234.56", "", null
  const s = String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getGroup(row) {
  // в нашем JSON поле group = "Операторы" / "АУП"
  const g = String(row.group || row.type || "").trim().toLowerCase();
  return g;
}

function matchScope(row) {
  if (scope === "all") return true;

  const g = getGroup(row);

  if (scope === "operators") {
    // поддержка разных вариантов
    return g === "операторы" || g === "оператор" || g === "operator" || g === "operators";
  }

  if (scope === "aup") {
    return g === "ауп" || g === "aup";
  }

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
    .sort((a, b) => toNum(b.balance) - toNum(a.balance));

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

function pickRows(data) {
  // поддержка нескольких форматов
  if (Array.isArray(data)) return data;

  // наш ожидаемый формат
  if (Array.isArray(data?.all)) return data.all;

  // fallback: если вдруг all не записали
  const ops = Array.isArray(data?.operators) ? data.operators : [];
  const aup = Array.isArray(data?.aup) ? data.aup : [];
  if (ops.length || aup.length) return ops.concat(aup);

  // старые форматы
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

async function load() {
  try {
    setStatus("Загружаю данные…");

    // ts чтобы не было кеша Pages/браузера
    const url = `${API}?ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    PAYLOAD = data;

    RAW = pickRows(data);

    // чуть более информативный статус
    const opsCount = Array.isArray(data?.operators)
      ? data.operators.length
      : RAW.filter((r) => getGroup(r) === "операторы" || getGroup(r) === "operator" || getGroup(r) === "operators").length;

    const aupCount = Array.isArray(data?.aup)
      ? data.aup.length
      : RAW.filter((r) => getGroup(r) === "ауп" || getGroup(r) === "aup").length;

    const updatedAt = data?.updatedAt ? ` · обновлено: ${data.updatedAt}` : "";
    setStatus(RAW.length ? `Загружено: ${RAW.length} (Операторы: ${opsCount}, АУП: ${aupCount})${updatedAt}` : "Данные не загружены");

    render();
  } catch (e) {
    console.error(e);
    RAW = [];
    PAYLOAD = null;
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
