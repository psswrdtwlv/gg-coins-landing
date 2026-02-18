import fs from "node:fs";
import XLSX from "xlsx";

const WEBHOOK_BASE = process.env.BITRIX_WEBHOOK_BASE; // https://.../rest/2773/<secret>/
const FILE_ID = process.env.BITRIX_FILE_ID;           // 202937

if (!WEBHOOK_BASE) throw new Error("BITRIX_WEBHOOK_BASE is not set");
if (!FILE_ID) throw new Error("BITRIX_FILE_ID is not set");

async function bitrixCall(method, params = {}) {
  const base = WEBHOOK_BASE.endsWith("/") ? WEBHOOK_BASE : WEBHOOK_BASE + "/";
  const url = new URL(base + method + ".json");

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Bitrix HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  if (data.error) {
    throw new Error(`Bitrix ${data.error}: ${data.error_description || ""}`);
  }
  return data.result;
}

function assertXlsx(buffer) {
  // XLSX = ZIP -> PK\x03\x04
  if (!(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
    const head = buffer.subarray(0, 250).toString("utf8");
    throw new Error(`Downloaded content is not XLSX (likely HTML). Head: ${head}`);
  }
}

function toNumber(v) {
  // поддержка "1 234,56" и "1234.56"
  const s = String(v ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(row) {
  const name =
    row["Сотрудник"] ?? row["ФИО"] ?? row["Фамилия"] ?? row["Name"] ?? row["Employee"] ?? "";

  const earned =
    row["Начислено"] ?? row["Начисления"] ?? row["Earned"] ?? row["Accrued"] ?? 0;

  const spent =
    row["Потрачено"] ?? row["Списано"] ?? row["Spent"] ?? row["Debited"] ?? 0;

  const balance =
    row["Остаток"] ?? row["Баланс"] ?? row["Balance"] ?? row["Available"] ?? 0;

  const tg = row["Telegram"] ?? row["TG"] ?? row["Телеграм"] ?? "";
  const email = row["Email"] ?? row["Почта"] ?? "";

  return {
    name: String(name || "").trim(),
    earned: toNumber(earned),
    spent: toNumber(spent),
    balance: toNumber(balance),
    tg: String(tg || "").trim(),
    email: String(email || "").trim(),
  };
}

function sheetToPeople(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in XLSX`);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map(normalizeRow)
    .filter((r) => r.name);
}

async function main() {
  // 1) получаем DOWNLOAD_URL
  const info = await bitrixCall("disk.file.get", { id: FILE_ID });
  const downloadUrl = info?.DOWNLOAD_URL;
  if (!downloadUrl) throw new Error("DOWNLOAD_URL is missing in disk.file.get result");

  // 2) скачиваем XLSX
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  assertXlsx(buffer);

  // 3) парсим XLSX
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // листы должны называться РОВНО так
  const operators = sheetToPeople(workbook, "Операторы");
  const aup = sheetToPeople(workbook, "АУП");

  // 4) итоговый json
  const out = {
    updatedAt: new Date().toISOString(),
    operators,
    aup
  };

  fs.writeFileSync("rating.json", JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: operators=${operators.length}, aup=${aup.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
