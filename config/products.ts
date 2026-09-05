import type { Product } from "@/types/product";

export const products: Product[] = [
  {
    id: "cake-by-kg",
    name: "Класический торт",
    pricing: {
      type: "perKg",
      pricePerKg: 3000,
      minWeightKg: 2,
      maxWeightKg: 10,
      stepKg: 1,
      summaryLabel: "Торт"
    }
  },
  {
    id: "bento-s",
    name: "Бенто S",
    pricing: {
      type: "fixed",
      price: 1700,
      summaryLabel: "Бенто S"
    }
  },
  {
    id: "bento-m",
    name: "Бенто M",
    pricing: {
      type: "fixed",
      price: 3200,
      summaryLabel: "Бенто M"
    }
  },
  {
    id: "bento-l",
    name: "Бенто L",
    pricing: {
      type: "fixed",
      price: 4300,
      summaryLabel: "Бенто L"
    }
  },
  {
    id: "cup-cake",
    name: "Тортик в стаканчике",
    pricing: {
      type: "perItem",
      pricePerItem: 600,
      minQty: 1,
      maxQty: 50,
      summaryLabel: "Тортик в стаканчике"
    }
  },
  {
    id: "cupcakes",
    name: "Капкейки",
    pricing: {
      type: "perItem",
      pricePerItem: 350,
      minQty: 1,
      maxQty: 60,
      summaryLabel: "Капкейки"
    }
  }
];
