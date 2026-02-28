export type ProductPricing =
  | {
      type: "perKg";
      pricePerKg: number;
      minWeightKg: number;
      maxWeightKg: number;
      stepKg: number;
      summaryLabel: string;
    }
  | {
      type: "fixed";
      price: number;
      summaryLabel: string;
    }
  | {
      type: "perItem";
      pricePerItem: number;
      minQty: number;
      maxQty: number;
      summaryLabel: string;
    };

export type Product = {
  id: string;
  name: string;
  pricing: ProductPricing;
};
