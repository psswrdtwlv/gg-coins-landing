// scripts/build-rating.mjs
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const XLSX_URL = process.env.BITRIX_XLSX_URL;
if (!XLSX_URL) {
  console.error("BITRIX_XLSX_URL is not set");
  process.exit(1);
}

function normalizeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getText(v) {
  return (v ?? "").toString().trim();
}

function parseSimpleTable(sheet, type) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((r) => ({
      type,
      name: getText(r["Сотрудник"] ?? r["Employee"] ?? r["Name"] ?? r["ФИО"]),
      earned: normalizeNumber(r["Начислено Granat Coin"] ?? r["Начислено"] ?? r["Granat Coin"]),
      spent: normalizeNumber(r["Потрачено Granat Coin"] ?? r["Потрачено"]),
      balance: normalizeNumber(r["Остаток Granat Coin"] ?? r["Остаток"] ?? r["Остаток Gc"]),
    }))
    .filter((x) => x.name.length > 0);
}

function parseSideBySideTables(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i].map((x) => String(x).toLowerCase());
    if (row.some((c) => c.includes("сотрудник")) && row.some((c) => c.includes("остаток"))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return { operators: [], aup: [] };

  const header = matrix[headerRowIdx].map((v) => String(v).trim());

  let split = header.findIndex((v, idx) => idx > 0 && v === "");
  if (split === -1) {
    const secondEmployee = header.findIndex((v, idx) => idx > 0 && /Сотрудник/i.test(v));
    split = secondEmployee !== -1 ? secondEmployee : Math.floor(header.length / 2);
  }

  const leftCols = header.slice(0, split);
  const rightCols = header.slice(split);

  function mapBlock(row, cols, offset) {
    const obj = {};
    cols.forEach((c, j) => (obj[c] = row[offset + j]));
    return obj;
  }

  const operators = [];
  const aup = [];

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];

    const left = mapBlock(row, leftCols, 0);
    const right = mapBlock(row, rightCols, split);

    const leftName = getText(left["Оператор"] ?? left["Сотрудник"] ?? left["ФИО"] ?? leftCols[0]);
    const rightName = getText(right["Сотрудник АУП"] ?? right["Сотрудник"] ?? right["ФИО"] ?? rightCols[0]);

    if (leftName) {
      operators.push({
        type: "operator",
        name: leftName,
        earned: normalizeNumber(left["Начислено Granat Coin"] ?? left["Granat Coin"] ?? left["Начислено"]),
        spent: normalizeNumber(left["Потрачено Granat Coin"] ?? left["Потрачено"]),
        balance: normalizeNumber(left["Остаток Granat Coin"] ?? left["Остаток"] ?? left["Остаток Gc"]),
      });
    }
    if (rightName) {
      aup.push({
        type: "aup",
        name: rightName,
        earned: normalizeNumber(right["Granat Coin"] ?? right["Начислено Granat Coin"] ?? right["Начислено"]),
        spent: normalizeNumber(right["Потрачено Gc"] ?? right["Потрачено Granat Coin"] ?? right["Потрачено"]),
        balance: normalizeNumber(right["Остаток Gc"] ?? right["Остаток Granat Coin"] ?? right["Остаток"]),
      });
    }
  }

  return { operators, aup };
}

function parseWorkbook(wb) {
  const sheetNames = wb.SheetNames;

  const opName = sheetNames.find((n) => /оператор|operators/i.test(n));
  const aupName = sheetNames.find((n) => /ауп|aup/i.test(n));

  if (opName || aupName) {
    return {
      operators: opName ? parseSimpleTable(wb.Sheets[opName], "operator") : [],
      aup: aupName ? parseSimpleTable(wb.Sheets[aupName], "aup") : [],
    };
  }

  const first = wb.Sheets[sheetNames[0]];
  return parseSideBySideTables(first);
}

async function main() {
  const res = await fetch(XLSX_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch xlsx: HTTP ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  const parsed = parseWorkbook(wb);
  const all = [...(parsed.operators || []), ...(parsed.aup || [])];

  const out = {
    updatedAt: new Date().toISOString(),
    all,
    operators: parsed.operators,
    aup: parsed.aup,
  };

  const outPath = path.resolve(process.cwd(), "rating.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Wrote ${outPath} (${all.length} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
