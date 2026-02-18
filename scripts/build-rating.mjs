import fs from "node:fs";
import XLSX from "xlsx";

const WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE;
const FILE_ID = process.env.BITRIX_FILE_ID;

if (!WEBHOOK_BASE) throw new Error("BITRIX_WEBHOOK_BASE is not set");
if (!FILE_ID) throw new Error("BITRIX_FILE_ID is not set");

async function bitrixCall(method, params = {}) {
  const base = WEBHOOK_BASE.endsWith("/") ? WEBHOOK_BASE : WEBHOOK_BASE + "/";
  const url = new URL(base + method + ".json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(`Bitrix HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  if (data.error) throw new Error(`Bitrix ${data.error}: ${data.error_description || ""}`);

  return data.result;
}

function assertXlsx(buffer) {
  // XLSX = zip -> PK\x03\x04
  const ok = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (!ok) {
    const head = buffer.subarray(0, 250).toString("utf8");
    throw new Error(`Downloaded content is not XLSX (likely HTML). Head: ${head}`);
  }
}

function toNumber(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toTg(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // приводим к виду @username если уже похоже на ник
  if (s.startsWith("@")) return s;
  // если там номер/текст — оставим как есть
  return s;
}

/**
 * Читает лист как массив массивов (строки/колонки),
 * чтобы не зависеть от “кривой шапки”.
 */
function sheetToAoA(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in XLSX`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

/**
 * Операторы:
 * row 1: заголовки
 * col 1 = Оператор
 * col 4 = Ник тг
 * col 10 = Начислено Granat Coin
 * col 11 = Потрачено Gc
 * col 12 = Остаток Coins
 */
function parseOperators(workbook) {
  const aoa = sheetToAoA(workbook, "Операторы");
  // aoa[0] — заголовки
  const out = [];

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    const name = String(row[0] || "").trim();        // col 1
    if (!name) continue;

    const tg = toTg(row[3]);                         // col 4
    const earned = toNumber(row[9]);                 // col 10
    const spent = toNumber(row[10]);                 // col 11
    const balance = toNumber(row[11]);               // col 12

    out.push({
      group: "Операторы",
      name,
      tg,
      earned,
      spent,
      balance
    });
  }

  return out;
}

/**
 * АУП:
 * первые 3 строки — шапка, данные начинаются с 4-й строки
 * col 1 = Сотрудник
 * col 2 = Ник ТГ
 * col 4 = Granat Coin (начислено)
 * col 5 = Потрачено Gc
 * col 6 = Остаток Gc
 */
function parseAup(workbook) {
  const aoa = sheetToAoA(workbook, "АУП");
  const out = [];

  for (let i = 3; i < aoa.length; i++) { // старт с 4-й строки (index 3)
    const row = aoa[i];
    const name = String(row[0] || "").trim();        // col 1
    if (!name) continue;

    const tg = toTg(row[1]);                         // col 2
    const earned = toNumber(row[3]);                 // col 4
    const spent = toNumber(row[4]);                  // col 5
    const balance = toNumber(row[5]);                // col 6

    out.push({
      group: "АУП",
      name,
      tg,
      earned,
      spent,
      balance
    });
  }

  return out;
}

async function main() {
  const info = await bitrixCall("disk.file.get", { id: FILE_ID });
  const downloadUrl = info?.DOWNLOAD_URL;
  if (!downloadUrl) throw new Error("DOWNLOAD_URL is missing in disk.file.get result");

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  assertXlsx(buffer);

  const workbook = XLSX.read(buffer, { type: "buffer" });

  const operators = parseOperators(workbook);
  const aup = parseAup(workbook);
  const all = operators.concat(aup);

  // ВАЖНО: делаю output и “раздельно”, и “всё вместе”
  // чтобы фронту было проще.
  const out = {
    updatedAt: new Date().toISOString(),
    operators,
    aup,
    all
  };

  fs.writeFileSync("rating.json", JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: operators=${operators.length}, aup=${aup.length}, all=${all.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
