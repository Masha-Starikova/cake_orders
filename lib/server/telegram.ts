import { DELIVERY_LABELS } from "@/lib/server/sheets";
import { buildFillingChoices } from "@/config/fillings";
import type { SavedOrder } from "@/types/order";

// Уведомление о новом заказе в Telegram-группу кондитера.
// Бот только отправляет: без webhook и входящих команд.

const CAPTION_LIMIT = 1024; // лимит подписи к фото
const TEXT_LIMIT = 4096; // лимит обычного сообщения

export type TelegramResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string };

export function escapeHtml(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Разделитель тысяч — обычный пробел, чтобы не зависеть от ICU в Node.
export const money = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;

// Подпись поля референса из config/decor.ts. В сообщение попадает
// только она, без имени файла.
const REFERENCE_LABEL = "Референс (фото)";

const formatDueDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

export function formatOrderMessage(
  order: SavedOrder,
  options: { sheetsError?: string; sheetUrl?: string } = {}
): string {
  const e = escapeHtml;
  const lines: string[] = [];

  lines.push(`🎂 <b>Новый заказ ${e(order.orderId)}</b>`);
  lines.push("");
  lines.push(`<b>${e(order.productLabel)}</b>`);
  const choices = buildFillingChoices(order.fillings, order.fillingOptions);
  const word = choices.length > 1 ? "Начинки" : "Начинка";
  if (choices.some((c) => c.details.length)) {
    // Есть уточнения вроде ягод или вида бисквита — показываем списком,
    // чтобы было видно, что к какой начинке относится.
    lines.push(`${word}:`);
    for (const choice of choices) {
      const extra = choice.details
        .map((d) => `${d.label}: ${d.value}`)
        .join(", ");
      lines.push(`  • ${e(choice.name)}${extra ? ` — ${e(extra)}` : ""}`);
    }
  } else {
    lines.push(`${word}: ${e(choices.map((c) => c.name).join(", "))}`);
  }
  if (order.decorLabel) {
    lines.push(`Декор: ${e(order.decorLabel)}`);
    for (const part of order.decorDetails.split("; ").filter(Boolean)) {
      // У референса показываем только сам факт: имя файла читать незачем,
      // фото всё равно приходит в чат следующим сообщением.
      lines.push(
        part.startsWith(REFERENCE_LABEL)
          ? `  • ${REFERENCE_LABEL}`
          : `  • ${e(part)}`
      );
    }
  }
  lines.push("");
  lines.push(`К дате: ${e(formatDueDate(order.dueDate))}`);
  const delivery = DELIVERY_LABELS[order.deliveryType];
  lines.push(
    order.deliveryType === "delivery" && order.address
      ? `${delivery}: ${e(order.address)}`
      : delivery
  );
  const contact = [order.name, order.phone, order.instagram]
    .filter(Boolean)
    .map((v) => e(v))
    .join(" · ");
  lines.push(contact);
  if (order.comment) {
    lines.push("");
    lines.push(`💬 ${e(order.comment)}`);
  }
  lines.push("");
  const decorPart = order.decorQuoted
    ? "декор по договорённости"
    : `декор ${money(order.decorPrice)}`;
  lines.push(
    `Торт ${money(order.cakePrice)} + ${decorPart} = <b>${money(order.totalPrice)}</b>`
  );
  lines.push("");
  lines.push(`Код для Direct: <code>${e(order.directCode)}</code>`);
  if (options.sheetUrl) {
    lines.push(`📊 <a href="${options.sheetUrl}">Открыть таблицу</a>`);
  }
  if (options.sheetsError) {
    lines.push("");
    lines.push(`⚠️ В таблицу не записалось: ${e(options.sheetsError)}`);
  }

  return truncate(lines.join("\n"), TEXT_LIMIT);
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function readEnv() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы");
  }
  return { api: `https://api.telegram.org/bot${token}`, chatId };
}

// С российских сетей api.telegram.org отвечает нестабильно: часть попыток
// упирается в таймаут. Поэтому короткий таймаут и несколько повторов.
const ATTEMPTS = 4;
const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method: string, body: FormData | object): Promise<TelegramResult> {
  let env: { api: string; chatId: string };
  try {
    env = readEnv();
  } catch (error) {
    return { ok: false, error: String(error) };
  }
  const isForm = body instanceof FormData;
  if (isForm) {
    body.set("chat_id", env.chatId);
  }
  const payload = isForm ? body : JSON.stringify({ chat_id: env.chatId, ...body });

  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${env.api}/${method}`, {
        method: "POST",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      const data = (await response.json()) as {
        ok: boolean;
        description?: string;
        result?: { message_id: number };
      };
      if (data.ok) {
        return { ok: true, messageId: data.result?.message_id ?? 0 };
      }
      // Ответ пришёл, но Telegram отказал (неверный chat_id, разметка):
      // повторять бессмысленно.
      return { ok: false, error: `Telegram ${method}: ${data.description ?? response.status}` };
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause?.code;
      lastError = cause ?? (error instanceof Error ? error.name : String(error));
      if (attempt < ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  return { ok: false, error: `Telegram ${method}: сеть недоступна после ${ATTEMPTS} попыток (${lastError})` };
}

export function sendMessage(text: string): Promise<TelegramResult> {
  return call("sendMessage", {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

// data URL (base64) → Blob для multipart-загрузки.
export function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  const [, mime, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  return { blob: new Blob([bytes], { type: mime }), ext };
}

export async function sendPhoto(
  dataUrl: string,
  caption?: string
): Promise<TelegramResult> {
  const photo = dataUrlToBlob(dataUrl);
  if (!photo) {
    return { ok: false, error: "Telegram sendPhoto: референс не является изображением" };
  }
  const form = new FormData();
  form.set("photo", photo.blob, `reference.${photo.ext}`);
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  return call("sendPhoto", form);
}

export async function notifyNewOrder(
  order: SavedOrder,
  options: { sheetsError?: string; sheetUrl?: string } = {}
): Promise<TelegramResult> {
  const text = formatOrderMessage(order, options);
  const photo = order.decor.referenceDataUrl;

  if (!photo) {
    return sendMessage(text);
  }
  if (text.length <= CAPTION_LIMIT) {
    return sendPhoto(photo, text);
  }
  const sent = await sendMessage(text);
  if (!sent.ok) {
    return sent;
  }
  return sendPhoto(photo);
}
