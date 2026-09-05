import { clearRange, readRange, writeRange } from "@/lib/server/sheets";

// Даты, на которые заказы не принимаются. Хранятся в листе Blocked,
// колонка A, формат YYYY-MM-DD. Кондитер может править и руками в таблице.
// Кэш на минуту: форму открывают чаще, чем меняют список.

const SHEET = "Blocked";
const CACHE_MS = 60_000;

let cache: { dates: string[]; at: number } | null = null;

export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

// Google может отдать дату как "2026-09-14", "14.09.2026" или "14/9/2026".
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (isIsoDate(value)) {
    return value;
  }
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export async function getBlockedDates(
  options: { fresh?: boolean } = {}
): Promise<{ ok: true; dates: string[] } | { ok: false; error: string; dates: string[] }> {
  const now = Date.now();
  if (!options.fresh && cache && now - cache.at < CACHE_MS) {
    return { ok: true, dates: cache.dates };
  }
  const result = await readRange(`${SHEET}!A2:A`);
  if (!result.ok) {
    // При ошибке отдаём последнее известное, чтобы форма не ломалась.
    return { ok: false, error: result.error, dates: cache?.dates ?? [] };
  }
  const dates = Array.from(
    new Set(
      result.values
        .map((row) => normalizeDate(row[0] ?? ""))
        .filter((d): d is string => !!d)
    )
  ).sort();
  cache = { dates, at: now };
  return { ok: true, dates };
}

export async function setBlockedDates(
  dates: string[]
): Promise<{ ok: true; dates: string[] } | { ok: false; error: string }> {
  const clean = Array.from(new Set(dates.filter(isIsoDate))).sort();
  const cleared = await clearRange(`${SHEET}!A2:B`);
  if (!cleared.ok) {
    return { ok: false, error: cleared.error };
  }
  if (clean.length > 0) {
    // Апостроф: хранить как текст, чтобы Google не менял формат даты.
    const written = await writeRange(
      `${SHEET}!A2:A${clean.length + 1}`,
      clean.map((d) => [`'${d}`])
    );
    if (!written.ok) {
      return { ok: false, error: written.error };
    }
  }
  cache = { dates: clean, at: Date.now() };
  return { ok: true, dates: clean };
}
