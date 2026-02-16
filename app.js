// ====== Bitrix -> XLSX (GitHub Pages only) ======
const XLSX_URL =
  "https://bitrix24public.com/b24-3w0uz1.bitrix24.ru/docs/pub/46e72c30ac01029e3a4245b0dce74c11/download/?&token=q7tz2rb1doin";

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
  scope = nextScope || "all";
  $tabs.forEach((b) => b.classList.toggle("active", b.dataset.scope === scope));
  render();
}

function norm(s) {
  return String(s || "").trim();
}

function toNum(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number(s);
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
    .sort((a, b) => toNum(b.balance) - toNum(a.balance));

  if (!rows.length) {
    $tbody.innerHTML = `
      <tr><td colspan="5" class="muted">Нет данных</td></tr>
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

function pickSheetName(names, re, fallbackIdx) {
  return names.find((n) => re.test(n)) || names[fallbackIdx] || names[0] || "";
}

function parseSheet(sheet, type) {
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((r) => ({
      type,
      name: norm(r["Сотрудник"] ?? r["ФИО"] ?? r["Employee"] ?? r["Name"]),
      earned: toNum(
        r["Начислено"] ??
          r["Начислено Granat Coin"] ??
          r["Earned"] ??
          r["Granat Coin"]
      ),
      spent: toNum(r["Потрачено"] ?? r["Потрачено Granat Coin"] ?? r["Spent"]),
      balance: toNum(
        r["Остаток"] ??
          r["Остаток Granat Coin"] ??
          r["Остаток Gc"] ??
          r["Balance"]
      ),
    }))
    .filter((x) => x.name);
}

async function load() {
  try {
    setStatus("Загружаю данные…");

    // cache-bust чтобы GH/браузер не держали старую версию
    const url = XLSX_URL + (XLSX_URL.includes("?") ? "&" : "?") + "_=" + Date.now();

    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });

    const names = wb.SheetNames || [];
    if (!names.length) throw new Error("В XLSX нет листов");

    // ищем по названиям листов. если не нашли — берём 1-й и 2-й
    const opName = pickSheetName(names, /оператор|operators/i, 0);
    const aupName = pickSheetName(names, /ауп|aup/i, 1);

    const operators = opName ? parseSheet(wb.Sheets[opName], "operator") : [];
    const aup = aupName ? parseSheet(wb.Sheets[aupName], "aup") : [];

    RAW = [...operators, ...aup];

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
