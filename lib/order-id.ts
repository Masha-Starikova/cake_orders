import type { OrderFormData } from "@/types/order";

// Номер заказа: код продукта + код начинки + 3 случайные цифры.
// Пример: торт по кг + Красный бархат → "TKB482".

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
  Медовик: "ME",
  "Киндер-Кантри": "KK"
};

// В номер попадает первая выбранная начинка: для ассорти из нескольких
// вкусов номер остаётся коротким и читаемым.
export function generateOrderId(
  order: Pick<OrderFormData, "productId" | "fillings">,
  random: () => number = Math.random
): string {
  const productCode = productCodeById[order.productId] ?? "X";
  const fillingCode = fillingCodeByName[order.fillings?.[0] ?? ""] ?? "XX";
  const digits = Math.floor(100 + random() * 900);
  return `${productCode}${fillingCode}${digits}`;
}

export const directCodeFor = (orderId: string) => `ZAKAZ${orderId}`;
