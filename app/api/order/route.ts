import { buildSavedOrder } from "@/lib/order-summary";
import { getBlockedDates } from "@/lib/server/blocked-dates";
import { appendLog, appendOrder } from "@/lib/server/sheets";
import { notifyNewOrder } from "@/lib/server/telegram";
import { validateOrderForm } from "@/lib/validators";
import type { OrderFormData } from "@/types/order";

// POST /api/order
// 1. отсечь мусор  2. валидация  3. пересчёт цены и номер (сервер главный)
// 4. Google Sheets  5. Telegram  6. ответ. Каналы независимы: заказ принят,
// если сработал хотя бы один.

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024 * 1024; // референс в base64 + поля
const MAX_REFERENCE_BYTES = 6 * 1024 * 1024;
const RATE_LIMIT = { windowMs: 60_000, max: 5 };

// Простой лимитер в памяти процесса: IP → времена последних запросов.
const hits = new Map<string, number[]>();
function isRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    hits.clear();
  }
  return recent.length > RATE_LIMIT.max;
}

type Body = Partial<OrderFormData> & { website?: string };

const json = (body: object, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(ip)) {
    return json({ ok: false, error: "too_many_requests" }, 429);
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // Honeypot: скрытое поле, которое люди не видят, а боты заполняют.
  if (body.website) {
    return json({ ok: true, orderId: "", spam: true });
  }

  const order = normalize(body);

  if ((order.decor.referenceDataUrl?.length ?? 0) > MAX_REFERENCE_BYTES) {
    return json({ ok: false, errors: { "decor.reference": "Фото слишком большое" } }, 422);
  }

  const blocked = await getBlockedDates();
  const { valid, errors } = validateOrderForm(order, { blockedDates: blocked.dates });
  if (!valid) {
    return json({ ok: false, errors }, 422);
  }

  const saved = buildSavedOrder(order);

  const sheets = await appendOrder(saved);
  if (!sheets.ok) {
    console.error(`[order ${saved.orderId}] ${sheets.error}`);
  }

  const telegram = await notifyNewOrder(saved, {
    sheetsError: sheets.ok ? undefined : sheets.error,
    sheetUrl: sheetUrl()
  });
  if (!telegram.ok) {
    console.error(`[order ${saved.orderId}] ${telegram.error}`);
    if (sheets.ok) {
      await appendLog(saved.orderId, "telegram_failed", telegram.error);
    }
  }

  if (!sheets.ok && !telegram.ok) {
    return json({ ok: false, error: "delivery_failed", orderId: saved.orderId }, 502);
  }

  return json({
    ok: true,
    orderId: saved.orderId,
    directCode: saved.directCode,
    cakePrice: saved.cakePrice,
    decorPrice: saved.decorPrice,
    decorQuoted: saved.decorQuoted,
    totalPrice: saved.totalPrice,
    productLabel: saved.productLabel,
    sheetsSaved: sheets.ok,
    telegramSent: telegram.ok
  });
}

function sheetUrl(): string | undefined {
  const id = process.env.GOOGLE_SHEETS_ID?.trim();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : undefined;
}

const str = (v: unknown, max = 5000) =>
  typeof v === "string" ? v.slice(0, max).trim() : "";
// Список начинок: не больше 20 позиций, каждая обрезается по длине.
// Дубликаты и недопустимые названия отсеет валидация.
const strList = (v: unknown, max = 100) =>
  Array.isArray(v)
    ? v
        .map((item) => str(item, max))
        .filter(Boolean)
        .slice(0, 20)
    : [];
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Приводим тело к OrderFormData: только известные поля, только строки/числа.
function normalize(body: Body): OrderFormData {
  const decor = (body.decor ?? {}) as Record<string, unknown>;
  return {
    productId: str(body.productId, 50),
    weightKg: num(body.weightKg),
    qty: num(body.qty),
    fillings: strList(body.fillings, 100),
    decor: {
      type: str(decor.type, 30) as OrderFormData["decor"]["type"],
      color: str(decor.color) || undefined,
      colors: str(decor.colors) || undefined,
      text: str(decor.text) || undefined,
      position: str(decor.position) || undefined,
      font: str(decor.font) || undefined,
      size: str(decor.size) || undefined,
      berries: str(decor.berries) || undefined,
      comment: str(decor.comment) || undefined,
      referenceFileName: str(decor.referenceFileName, 200) || undefined,
      referenceDataUrl:
        typeof decor.referenceDataUrl === "string" ? decor.referenceDataUrl : undefined
    },
    dueDate: str(body.dueDate, 10),
    deliveryType: body.deliveryType === "delivery" ? "delivery" : "pickup",
    name: str(body.name, 200),
    phone: str(body.phone, 50),
    instagram: str(body.instagram, 200) || undefined,
    address: str(body.address, 500) || undefined,
    comment: str(body.comment, 2000) || undefined
  };
}
