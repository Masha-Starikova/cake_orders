import { getAccessToken } from "@/lib/server/google-auth";
import type { SavedOrder } from "@/types/order";

// Запись заказов в Google Sheets. Одна функция знает порядок колонок
// (orderToRow), одна умеет добавлять строку (appendRow). Ошибки не
// выбрасываются наружу: возвращаем { ok: false, error }.

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const ORDERS_SHEET = "Orders";
const LOG_SHEET = "Log";

export type SheetsResult =
  | { ok: true; range: string }
  | { ok: false; error: string };

// Google при USER_ENTERED трактует ячейку, начинающуюся с = + - @,
// как формулу. Телефон "+7…" или Instagram "@anna" сломали бы ячейку.
// Апостроф в начале заставляет хранить значение как текст.
export function safeCell(value: string | undefined | null): string {
  const text = (value ?? "").toString().trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export const DELIVERY_LABELS: Record<SavedOrder["deliveryType"], string> = {
  pickup: "Самовывоз",
  delivery: "Доставка"
};

const QUOTED_LABEL = "по договорённости";

// Порядок строго соответствует заголовкам A..T листа Orders.
export function orderToRow(order: SavedOrder): (string | number)[] {
  return [
    order.createdAtLabel, // A Создан
    safeCell(order.orderId), // B Номер
    "Новый", // C Статус
    safeCell(order.productLabel), // D Продукт
    safeCell(order.sizeLabel), // E Вес/кол-во
    safeCell(order.filling), // F Начинка
    safeCell(order.decorLabel), // G Декор
    safeCell(order.decorDetails), // H Детали декора
    safeCell(order.decor.referenceFileName), // I Референс
    order.dueDate, // J К дате (YYYY-MM-DD, Google распознает дату)
    DELIVERY_LABELS[order.deliveryType], // K Получение
    safeCell(order.address), // L Адрес
    safeCell(order.name), // M Имя
    safeCell(order.phone), // N Телефон
    safeCell(order.instagram), // O Instagram
    safeCell(order.comment), // P Комментарий
    order.cakePrice, // Q Цена торта
    order.decorQuoted ? QUOTED_LABEL : order.decorPrice, // R Доплата за декор
    order.totalPrice, // S Итого
    safeCell(order.directCode) // T Код Direct
  ];
}

// Общий запрос к Sheets API с токеном. Ошибки возвращаются, не бросаются.
async function sheetsRequest<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  if (!sheetId) {
    return { ok: false, error: "GOOGLE_SHEETS_ID не задан" };
  }
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API}/${sheetId}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error?.message ?? `HTTP ${response.status}` };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

const enc = (range: string) => encodeURIComponent(range);

export async function readRange(
  range: string
): Promise<{ ok: true; values: string[][] } | { ok: false; error: string }> {
  const result = await sheetsRequest<{ values?: string[][] }>(`values/${enc(range)}`);
  return result.ok ? { ok: true, values: result.data.values ?? [] } : result;
}

export async function writeRange(
  range: string,
  values: (string | number)[][]
): Promise<SheetsResult> {
  const result = await sheetsRequest<{ updatedRange?: string }>(
    `values/${enc(range)}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values }) }
  );
  return result.ok ? { ok: true, range: result.data.updatedRange ?? "" } : result;
}

export async function clearRange(range: string): Promise<SheetsResult> {
  const result = await sheetsRequest<{ clearedRange?: string }>(
    `values/${enc(range)}:clear`,
    { method: "POST", body: "{}" }
  );
  return result.ok ? { ok: true, range: result.data.clearedRange ?? "" } : result;
}

async function appendRow(
  sheet: string,
  row: (string | number)[]
): Promise<SheetsResult> {
  // OVERWRITE: писать в первую пустую строку под таблицей, а не вставлять
  // новую. Существующая строка сохраняет выпадающий список и форматы колонок.
  const result = await sheetsRequest<{ updates?: { updatedRange?: string } }>(
    `values/${enc(`${sheet}!A:T`)}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`,
    { method: "POST", body: JSON.stringify({ values: [row] }) }
  );
  if (!result.ok) {
    return { ok: false, error: `Sheets ${sheet}: ${result.error}` };
  }
  return { ok: true, range: result.data.updates?.updatedRange ?? "" };
}

export function appendOrder(order: SavedOrder): Promise<SheetsResult> {
  return appendRow(ORDERS_SHEET, orderToRow(order));
}

// Лист Log: время, номер заказа, событие, детали.
export function appendLog(
  orderId: string,
  event: string,
  details: string
): Promise<SheetsResult> {
  const time = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour12: false
  });
  return appendRow(LOG_SHEET, [
    time,
    safeCell(orderId),
    safeCell(event),
    safeCell(details)
  ]);
}
