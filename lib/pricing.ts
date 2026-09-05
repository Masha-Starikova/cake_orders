import {
  decorSurcharge,
  isQuotedDecor,
  rufflesSurcharge
} from "@/config/price-rules";
import { products } from "@/config/products";
import type { OrderPricingInput } from "@/types/order";
import type { Product } from "@/types/product";

type PriceResult = {
  cakePrice: number;
  decorPrice: number;
  totalPrice: number;
  // Доплата за декор не считается автоматически — обсуждаем в Direct.
  decorQuoted: boolean;
  summary: string;
};

// Ключ размера для таблицы доплат за декор:
//  - торт по кг -> вес в кг ("2".."10");
//  - остальные продукты -> id продукта.
function resolveSizeKey(product: Product, data: OrderPricingInput): string | null {
  if (product.pricing.type === "perKg") {
    return data.weightKg ? String(data.weightKg) : null;
  }
  return product.id;
}

export function calculateDecorSurcharge(data: OrderPricingInput): number {
  const product = products.find((item) => item.id === data.productId);
  const decorType = data.decor?.type;

  if (!product || !decorType || isQuotedDecor(decorType)) {
    return 0;
  }

  if (decorType === "ruffles") {
    return rufflesSurcharge(product.id, {
      weightKg: data.weightKg,
      qty: data.qty
    });
  }

  const table = decorSurcharge[decorType];
  if (!table) {
    return 0;
  }

  const sizeKey = resolveSizeKey(product, data);
  if (!sizeKey) {
    return 0;
  }

  return table[sizeKey] ?? 0;
}

const emptyResult: PriceResult = {
  cakePrice: 0,
  decorPrice: 0,
  totalPrice: 0,
  decorQuoted: false,
  summary: ""
};

export function calculatePrice(data: OrderPricingInput): PriceResult {
  const product = products.find((item) => item.id === data.productId);

  if (!product) {
    return emptyResult;
  }

  let cakePrice = 0;
  let summary = "";

  if (product.pricing.type === "perKg") {
    if (!data.weightKg) {
      return emptyResult;
    }
    cakePrice = data.weightKg * product.pricing.pricePerKg;
    summary = `${product.pricing.summaryLabel} ${data.weightKg} кг (${product.pricing.pricePerKg} ₽/кг)`;
  } else if (product.pricing.type === "fixed") {
    cakePrice = product.pricing.price;
    summary = product.pricing.summaryLabel;
  } else {
    if (!data.qty) {
      return emptyResult;
    }
    cakePrice = data.qty * product.pricing.pricePerItem;
    summary = `${product.pricing.summaryLabel} ×${data.qty}`;
  }

  const decorPrice = calculateDecorSurcharge(data);

  return {
    cakePrice,
    decorPrice,
    totalPrice: cakePrice + decorPrice,
    decorQuoted: isQuotedDecor(data.decor?.type),
    summary
  };
}
