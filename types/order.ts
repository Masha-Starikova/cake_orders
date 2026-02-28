export type OrderFormData = {
  productId: string;
  weightKg?: number;
  qty?: number;
  filling: string;
  dueDate: string;
  deliveryType: "pickup" | "delivery";
  name: string;
  phone: string;
  instagram?: string;
  address?: string;
  comment?: string;
  referenceUrl?: string;
};

export type OrderPricingInput = Pick<OrderFormData, "productId" | "weightKg" | "qty">;
