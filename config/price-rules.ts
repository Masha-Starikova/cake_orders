import type { DecorType } from "@/types/order";

export const priceRules = {
  baseKgPrice: 0,
  extraDecorPrice: 0
};

// Размер заказа, от которого зависит доплата за декор.
export type DecorSizeInput = { weightKg?: number; qty?: number };

// Декор, стоимость которого не считается автоматически:
// её обсуждаем в Direct при подтверждении заказа.
export const quotedDecorTypes: DecorType[] = ["drawing-complex"];
export const quotedDecorLabel = "по договорённости";
export const quotedDecorNote =
  "Стоимость сложного рисунка рассчитываем индивидуально — обсудим в Direct при подтверждении заказа.";

export const isQuotedDecor = (type: DecorType | "" | undefined) =>
  !!type && quotedDecorTypes.includes(type as DecorType);

// Доплата за рюши — фиксированная для бенто.
const rufflesFixedByProduct: Record<string, number> = {
  "bento-s": 250,
  "bento-m": 350,
  "bento-l": 450
};

// Доплата за рюши:
//  - торт по кг: 2 кг — 450 ₽, дальше +100 ₽ за каждый кг (10 кг — 1250 ₽);
//  - бенто: S — 250 ₽, M — 350 ₽, L — 450 ₽;
//  - тортик в стаканчике: 1 шт — 150 ₽, дальше +100 ₽ за штуку;
//  - капкейки: 2 шт — 200 ₽, дальше +70 ₽ за штуку.
export function rufflesSurcharge(
  productId: string,
  size: DecorSizeInput
): number {
  const fixed = rufflesFixedByProduct[productId];
  if (fixed !== undefined) {
    return fixed;
  }

  if (productId === "cake-by-kg") {
    const weightKg = size.weightKg ?? 0;
    return weightKg >= 2 ? 450 + (weightKg - 2) * 100 : 0;
  }

  if (productId === "cup-cake") {
    const qty = size.qty ?? 0;
    return qty > 0 ? 150 + (qty - 1) * 100 : 0;
  }

  if (productId === "cupcakes") {
    const qty = size.qty ?? 0;
    return qty > 0 ? Math.max(0, 200 + (qty - 2) * 70) : 0;
  }

  return 0;
}

// Доплата за декор с фиксированным прайсом. Первый уровень — тип декора,
// второй — «размер»:
//  - для торта по кг ключ = вес в кг ("2".."10");
//  - для остальных продуктов ключ = id продукта.
// Рюши считаются формулой (rufflesSurcharge), сложный рисунок — по договорённости.
// Значения-заглушки 0 — проставить реальные цифры, когда будет прайс.
// Отсутствующий ключ трактуется как 0.
export const decorSurcharge: Record<DecorType, Record<string, number>> = {
  none: {},
  text: {},
  drawing: {
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "bento-s": 0,
    "bento-m": 0,
    "bento-l": 0,
    "cup-cake": 0,
    cupcakes: 0
  },
  "drawing-complex": {},
  ruffles: {}
};
