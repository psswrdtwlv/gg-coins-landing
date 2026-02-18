// app.js

// ===== simple auth gate (internal use) =====
const AUTH_KEY = "ggcoins_auth_v1";

(() => {
  const isLoginPage = /\/login\.html(\?|#|$)/.test(location.pathname);
  if (isLoginPage) return;

  const ok = localStorage.getItem(AUTH_KEY) === "1";
  if (!ok) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    location.replace(`./login.html?next=${encodeURIComponent(next)}`);
  }
})();

// ===== data =====
const API = "./rating.json"; // статический файл в репе

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const $tabs = $$("#tabs .tab");
const $search = $("#search");
const $refresh = $("#refresh");
const $status = $("#status");
const $tbody = $("#tbody");

// logout (если кнопка есть)
const $logout = $("#logout");
if ($logout) {
  $logout.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem(AUTH_KEY);
    location.replace("./login.html");
  });
}

let RAW = [];              // текущий список строк для фильтрации
let PAYLOAD = null;        // весь json (на всякий)
let scope = "all";
let q = "";

// сортировка
let sortKey = "balance";   // name | earned | spent | balance
let sortDir = "desc";      // asc | desc

// для “анимации роста позиции” между обновлениями
const PREV_RANKS_KEY = "ggcoins_prev_ranks_v1";
let prevRankByName = new Map();

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

function compareRows(a, b) {
  let A = a?.[sortKey];
  let B = b?.[sortKey];

  if (sortKey === "name") {
    A = String(A || "").toLowerCase();
    B = String(B || "").toLowerCase();
  } else {
    A = toNum(A);
    B = toNum(B);
  }

  if (A < B) return sortDir === "asc" ? -1 : 1;
  if (A > B) return sortDir === "asc" ? 1 : -1;
  return 0;
}

function balanceClass(balance) {
  const b = toNum(balance);
  if (b > 0) return "balance-pos";
  if (b < 0) return "balance-neg";
  return "balance-zero";
}

function tgLink(rawTg) {
  const s = String(rawTg || "").trim();
  if (!s) return null;

  const uname = s.startsWith("@") ? s.slice(1) : s;
  if (!/^[a-zA-Z0-9_]{3,}$/.test(uname)) return null;

  return `https://t.me/${uname}`;
}

function coinHTML(n) {
  return `<span class="coin"><span class="coin-dot" aria-hidden="true"></span><b>${n}</b></span>`;
}

function loadPrevRanksFromSession() {
  try {
    const raw = sessionStorage.getItem(PREV_RANKS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj || {}).map(([k, v]) => [k, Number(v)]));
  } catch {
    return new Map();
  }
}

function savePrevRanksToSession(map) {
  try {
    const obj = Object.fromEntries(map.entries());
    sessionStorage.setItem(PREV_RANKS_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function applySortIndicators() {
  const headers = $$("th[data-sort]");
  headers.forEach((th) => {
    th.classList.remove("asc", "desc");
    if (th.dataset.sort === sortKey) th.classList.add(sortDir);
  });
}

function bindSortHandlers() {
  const headers = $$("th[data-sort]");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;

      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = key === "name" ? "asc" : "desc";
      }

      applySortIndicators();
      render();
    });
  });
}

function render() {
  if (!$tbody) return;

  const rows = RAW
    .filter(matchScope)
    .filter(matchQuery)
    .sort(compareRows);

  if (!rows.length) {
    $tbody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">Нет данных</td>
      </tr>
    `;
    return;
  }

  // ранги для анимации позиции
  const nextRankByName = new Map();
  rows.forEach((r, idx) => nextRankByName.set(norm(r.name), idx + 1));

  $tbody.innerHTML = rows
    .map((r, i) => {
      const earned = toNum(r.earned);
      const spent = toNum(r.spent);
      const balance = toNum(r.balance);
      const name = norm(r.name);

      // топ-3 бейджи
      let rankHTML = `${i + 1}`;
      if (i === 0) rankHTML = `<span class="badge top1">1</span>`;
      if (i === 1) rankHTML = `<span class="badge top2">2</span>`;
      if (i === 2) rankHTML = `<span class="badge top3">3</span>`;

      // изменение позиции
      const prev = prevRankByName.get(name);
      const curr = i + 1;
      let moveHTML = "";
      if (prev && prev !== curr) {
        const diff = prev - curr;
        if (diff > 0) moveHTML = `<span class="pos-move pos-up">+${diff}</span>`;
        if (diff < 0) moveHTML = `<span class="pos-move pos-down">${diff}</span>`;
      } else if (prev && prev === curr) {
        moveHTML = `<span class="pos-move pos-same"></span>`;
      }

      // кнопка Telegram
      const link = tgLink(r.tg || r.telegram || "");
      const tgBtn = link
        ? `<a class="tg-btn" href="${link}" target="_blank" rel="noopener" aria-label="Написать в Telegram"><span class="tg-ic"></span></a>`
        : `<span class="tg-btn disabled" title="Нет Telegram"><span class="tg-ic"></span></span>`;

      return `
        <tr class="${i < 3 ? "row-animated" : ""}">
          <td><span class="rankcell">${rankHTML}${moveHTML}</span></td>
          <td>${name}</td>
          <td class="td-num">${coinHTML(earned)}</td>
          <td class="td-num">${coinHTML(spent)}</td>
          <td class="td-num ${balanceClass(balance)}">${coinHTML(balance)}</td>
          <td class="td-actions">${tgBtn}</td>
        </tr>
      `;
    })
    .join("");

  prevRankByName = nextRankByName;
  savePrevRanksToSession(prevRankByName);
}

function pickRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.all)) return data.all;

  const ops = Array.isArray(data?.operators) ? data.operators : [];
  const aup = Array.isArray(data?.aup) ? data.aup : [];
  if (ops.length || aup.length) return ops.concat(aup);

  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

async function load() {
  try {
    setStatus("Загружаю данные…");

    const url = `${API}?ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    PAYLOAD = data;
    RAW = pickRows(data);

    const opsCount = Array.isArray(data?.operators)
      ? data.operators.length
      : RAW.filter((r) => getGroup(r) === "операторы" || getGroup(r) === "operator" || getGroup(r) === "operators").length;

    const aupCount = Array.isArray(data?.aup)
      ? data.aup.length
      : RAW.filter((r) => getGroup(r) === "ауп" || getGroup(r) === "aup").length;

    const updatedAt = data?.updatedAt ? ` · обновлено: ${data.updatedAt}` : "";
    setStatus(RAW.length ? `Загружено: ${RAW.length} (Операторы: ${opsCount}, АУП: ${aupCount})${updatedAt}` : "Данные не загружены");

    prevRankByName = loadPrevRanksFromSession();
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
applySortIndicators();
bindSortHandlers();
setActiveTab("all");
load();
