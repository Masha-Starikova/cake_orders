import { buildDecorSummary } from "@/config/decor";
import { products } from "@/config/products";
import { directCodeFor, generateOrderId } from "@/lib/order-id";
import { calculatePrice } from "@/lib/pricing";
import type { OrderFormData, SavedOrder } from "@/types/order";

// Сборка обработанного заказа: сервер добавляет номер, время, цену и
// человекочитаемые строки, которые дальше одинаково уходят в таблицу
// и в Telegram.

export function productLabelFor(order: OrderFormData): {
  productLabel: string;
  sizeLabel: string;
} {
  const product = products.find((item) => item.id === order.productId);
  if (!product) {
    return { productLabel: order.productId, sizeLabel: "" };
  }
  if (product.pricing.type === "perKg") {
    const sizeLabel = order.weightKg ? `${order.weightKg} кг` : "";
    return { productLabel: `${product.name} ${sizeLabel}`.trim(), sizeLabel };
  }
  if (product.pricing.type === "perItem") {
    const sizeLabel = order.qty ? `×${order.qty}` : "";
    return { productLabel: `${product.name} ${sizeLabel}`.trim(), sizeLabel };
  }
  return { productLabel: product.name, sizeLabel: "" };
}

// "05.09.2026 15:42" по Москве, без запятой: такой формат Google Sheets
// распознаёт как дату и время.
export function formatMoscow(date: Date): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

export function buildSavedOrder(
  order: OrderFormData,
  options: { now?: Date; orderId?: string } = {}
): SavedOrder {
  const now = options.now ?? new Date();
  const orderId = options.orderId ?? generateOrderId(order);
  const price = calculatePrice(order);
  const decorSummary = buildDecorSummary(order.decor, order.productId);
  const { productLabel, sizeLabel } = productLabelFor(order);

  return {
    ...order,
    orderId,
    createdAt: now.toISOString(),
    createdAtLabel: formatMoscow(now),
    productLabel,
    sizeLabel,
    decorLabel: decorSummary?.title ?? "",
    decorDetails:
      decorSummary?.details.map((d) => `${d.label}: ${d.value}`).join("; ") ??
      "",
    cakePrice: price.cakePrice,
    decorPrice: price.decorPrice,
    decorQuoted: price.decorQuoted,
    totalPrice: price.totalPrice,
    directCode: directCodeFor(orderId)
  };
}
