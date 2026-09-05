export type DecorType =
  | "none"
  | "text"
  | "drawing"
  | "drawing-complex"
  | "ruffles";

export type DecorData = {
  type: DecorType | "";
  color?: string;
  colors?: string;
  text?: string;
  position?: string;
  font?: string;
  size?: string;
  // Украшение ягодами — только для капкейков.
  berries?: string;
  comment?: string;
  referenceFileName?: string;
  referenceDataUrl?: string;
};

export type OrderFormData = {
  productId: string;
  weightKg?: number;
  qty?: number;
  filling: string;
  decor: DecorData;
  dueDate: string;
  deliveryType: "pickup" | "delivery";
  name: string;
  phone: string;
  instagram?: string;
  address?: string;
  comment?: string;
};

export type OrderPricingInput = Pick<
  OrderFormData,
  "productId" | "weightKg" | "qty" | "decor"
>;
