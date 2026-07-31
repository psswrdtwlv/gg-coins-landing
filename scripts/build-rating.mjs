import fs from "node:fs";
import { parse } from "csv-parse/sync";

const SHEET_ID = "1S2c4DtCYXHeF1FyBV31XCZZLPVFS9qBIdWyJ8dOS6PE";

const OPERATORS_GID = "0";
const AUP_GID = "1528848510";

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
  if (s.startsWith("@")) return s;
  return s;
}

async function loadSheet(gid) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Google Sheets HTTP ${res.status}`);
  }

  const text = await res.text();

  return parse(text, {
    columns: false,
    skip_empty_lines: false
  });
}

function parseOperators(rows) {
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const name = String(row[0] || "").trim();

    if (!name) continue;

    out.push({
      group: "Операторы",
      name,
      tg: toTg(row[3]),
      earned: toNumber(row[9]),
      spent: toNumber(row[10]),
      balance: toNumber(row[11])
    });
  }

  return out;
}

function parseAup(rows) {
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const name = String(row[0] || "").trim();

    if (!name) continue;

    out.push({
      group: "АУП",
      name,
      tg: toTg(row[1]),
      earned: toNumber(row[3]),
      spent: toNumber(row[4]),
      balance: toNumber(row[5])
    });
  }

  return out;
}

async function main() {
  const operatorRows = await loadSheet(OPERATORS_GID);
  const aupRows = await loadSheet(AUP_GID);

  const operators = parseOperators(operatorRows);
  const aup = parseAup(aupRows);

  const all = [...operators, ...aup];

  const out = {
    updatedAt: new Date().toISOString(),
    operators,
    aup,
    all
  };

  fs.writeFileSync(
    "rating.json",
    JSON.stringify(out, null, 2),
    "utf8"
  );

  console.log(
    `OK: operators=${operators.length}, aup=${aup.length}, all=${all.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
