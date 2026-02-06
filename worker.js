import * as XLSX from "xlsx";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS (чтобы GH Pages спокойно ходил)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders });
    }

    if (url.pathname !== "/api/rating") {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    try {
      const xlsxUrl = env.XLSX_URL;
      if (!xlsxUrl) {
        return new Response(JSON.stringify({ error: "XLSX_URL is not set" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const xRes = await fetch(xlsxUrl, {
        headers: env.AUTH_HEADER ? { "Authorization": env.AUTH_HEADER } : {},
      });
      if (!xRes.ok) throw new Error(`Failed to fetch xlsx: HTTP ${xRes.status}`);

      const arrayBuffer = await xRes.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });

      // ВАЖНО: в понедельник решим: 2 листа (Operators/AUP) или один общий.
      // Пока поддержим обе схемы:
      const parsed = parseWorkbook(wb);

      const body = JSON.stringify({
        updatedAt: new Date().toISOString(),
        operators: parsed.operators,
        aup: parsed.aup,
        all: [],
      });

      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60", // 1 мин кэш
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

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

/**
 * Поддерживаем 2 схемы:
 * A) Есть листы с названиями вроде "Оператор", "Operators", "АУП", "AUP"
 * B) Один лист, где таблица идет блоками (как у тебя в примере: слева операторы, справа АУП)
 */
function parseWorkbook(wb) {
  const sheetNames = wb.SheetNames;

  // 1) Пытаемся найти отдельные листы
  const opName = sheetNames.find(n => /оператор|operators/i.test(n));
  const aupName = sheetNames.find(n => /ауп|aup/i.test(n));

  if (opName || aupName) {
    return {
      operators: opName ? parseSimpleTable(wb.Sheets[opName]) : [],
      aup: aupName ? parseSimpleTable(wb.Sheets[aupName]) : [],
    };
  }

  // 2) Иначе парсим первый лист как "две таблицы рядом"
  const first = wb.Sheets[sheetNames[0]];
  return parseSideBySideTables(first);
}

function parseSimpleTable(sheet) {
  // ожидаем заголовки: Сотрудник | Начислено | Потрачено | Остаток
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  // допускаем разные названия колонок
  return rows
    .map(r => ({
      name: getText(r["Сотрудник"] ?? r["Employee"] ?? r["Name"] ?? r["ФИО"]),
      earned: normalizeNumber(r["Начислено Granat Coin"] ?? r["Начислено"] ?? r["Granat Coin"]),
      spent: normalizeNumber(r["Потрачено Granat Coin"] ?? r["Потрачено"]),
      balance: normalizeNumber(r["Остаток Granat Coin"] ?? r["Остаток"] ?? r["Остаток Gc"]),
    }))
    .filter(x => x.name.length > 0);
}

function parseSideBySideTables(sheet) {
  // Берем матрицу значений
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Идея: ищем строку заголовков, где есть "Сотрудник" и "Остаток"
  // и определяем 2 блока: левый и правый (обычно правый начинается после пустой колонки)
  let headerRowIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i].map(x => String(x).toLowerCase());
    if (row.some(c => c.includes("сотрудник")) && row.some(c => c.includes("остаток"))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return { operators: [], aup: [] };

  const header = matrix[headerRowIdx].map(v => String(v).trim());

  // Находим границу: первое пустое значение после левого блока
  let split = header.findIndex((v, idx) => idx > 0 && v === "");
  if (split === -1) {
    // если нет пустой — пробуем по повтору "Сотрудник"
    const secondEmployee = header.findIndex((v, idx) => idx > 0 && /Сотрудник/i.test(v));
    split = secondEmployee !== -1 ? secondEmployee : Math.floor(header.length / 2);
  }

  // Левый блок колонки 0..split-1, правый split..end
  const leftCols = header.slice(0, split);
  const rightCols = header.slice(split);

  function mapBlock(row, cols, offset) {
    const obj = {};
    cols.forEach((c, j) => obj[c] = row[offset + j]);
    return obj;
  }

  const operators = [];
  const aup = [];

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const left = mapBlock(row, leftCols, 0);
    const right = mapBlock(row, rightCols, split);

    const leftName = getText(left["Оператор"] ?? left["Сотрудник"] ?? left["Сотрудник АУП"] ?? left["ФИО"] ?? leftCols[0]);
    const rightName = getText(right["Сотрудник АУП"] ?? right["Сотрудник"] ?? right["Оператор"] ?? right["ФИО"] ?? rightCols[0]);

    if (leftName) {
      operators.push({
        name: leftName,
        earned: normalizeNumber(left["Начислено Granat Coin"] ?? left["Granat Coin"] ?? left["Начислено"]),
        spent: normalizeNumber(left["Потрачено Granat Coin"] ?? left["Потрачено"]),
        balance: normalizeNumber(left["Остаток Granat Coin"] ?? left["Остаток"] ?? left["Остаток Gc"]),
      });
    }
    if (rightName) {
      aup.push({
        name: rightName,
        earned: normalizeNumber(right["Granat Coin"] ?? right["Начислено Granat Coin"] ?? right["Начислено"]),
        spent: normalizeNumber(right["Потрачено Gc"] ?? right["Потрачено Granat Coin"] ?? right["Потрачено"]),
        balance: normalizeNumber(right["Остаток Gc"] ?? right["Остаток Granat Coin"] ?? right["Остаток"]),
      });
    }
  }

  return { operators, aup };
}

