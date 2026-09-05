import type { OrderFormData } from "@/types/order";

// Номер заказа: код продукта + код начинки + 4 случайные цифры.
// Пример: торт по кг + Красный бархат → "TKB4821".

export const productCodeById: Record<string, string> = {
  "bento-s": "S",
  "bento-m": "M",
  "bento-l": "L",
  "cake-by-kg": "T",
  "cup-cake": "G",
  cupcakes: "K"
};

export const fillingCodeByName: Record<string, string> = {
  "Нежнейший пломбир": "NP",
  "Молочная девочка": "MD",
  "Красный бархат": "KB",
  "Морковный с солёной карамелью": "MK",
  "Морковный с соленой карамелью": "MK",
  Сникерс: "CN",
  "Шоколадная классика": "SH",
  Банановый: "BA",
  Медовик: "ME"
};

export function generateOrderId(
  order: Pick<OrderFormData, "productId" | "filling">,
  random: () => number = Math.random
): string {
  const productCode = productCodeById[order.productId] ?? "X";
  const fillingCode = fillingCodeByName[order.filling] ?? "XX";
  const digits = Math.floor(1000 + random() * 9000);
  return `${productCode}${fillingCode}${digits}`;
}

export const directCodeFor = (orderId: string) => `ZAKAZ${orderId}`;
