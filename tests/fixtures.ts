import type { SavedOrder } from "@/types/order";

// Пример обработанного заказа для тестов: торт 3 кг, надпись, доставка.
export const sampleOrder: SavedOrder = {
  productId: "cake-by-kg",
  weightKg: 3,
  filling: "Красный бархат",
  decor: {
    type: "text",
    text: "С днём рождения",
    position: "по центру",
    color: "розовый"
  },
  dueDate: "2026-09-14",
  deliveryType: "delivery",
  address: "ул. Пример, 5",
  name: "Анна",
  phone: "+7 999 123-45-67",
  instagram: "@anna",
  comment: "без орехов",
  orderId: "CBH4821",
  createdAt: "2026-09-05T10:32:11.000Z",
  createdAtLabel: "05.09.2026 13:32",
  productLabel: "Классический торт 3 кг",
  sizeLabel: "3 кг",
  decorLabel: "Надпись",
  decorDetails: "Текст: С днём рождения; Расположение: по центру; Цвет: розовый",
  cakePrice: 9000,
  decorPrice: 0,
  decorQuoted: false,
  totalPrice: 9000,
  directCode: "ZAKAZCBH4821"
};
