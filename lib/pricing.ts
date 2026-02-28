import { products } from "@/config/products";
import type { OrderPricingInput } from "@/types/order";

type PriceResult = {
  totalPrice: number;
  summary: string;
};

export function calculatePrice(data: OrderPricingInput): PriceResult {
  const product = products.find((item) => item.id === data.productId);

  if (!product) {
    return { totalPrice: 0, summary: "" };
  }

  if (product.pricing.type === "perKg") {
    if (!data.weightKg) {
      return { totalPrice: 0, summary: "" };
    }

    const totalPrice = data.weightKg * product.pricing.pricePerKg;
    return {
      totalPrice,
      summary: `${product.pricing.summaryLabel} ${data.weightKg} кг (${product.pricing.pricePerKg} ₽/кг)`
    };
  }

  if (product.pricing.type === "fixed") {
    return {
      totalPrice: product.pricing.price,
      summary: product.pricing.summaryLabel
    };
  }

  if (!data.qty) {
    return { totalPrice: 0, summary: "" };
  }

  const totalPrice = data.qty * product.pricing.pricePerItem;
  return {
    totalPrice,
    summary: `${product.pricing.summaryLabel} ×${data.qty}`
  };
}
