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
  // Начинки заказа. Для тортов и бенто всегда одна, для штучных
  // продуктов (стаканчики, капкейки) их может быть несколько —
  // предел зависит от количества штук, см. config/fillings.ts.
  fillings: string[];
  // Выбор подпунктов начинок: ключ «начинка::группа» → вариант.
  // Например «Красный бархат::berries» → «Клубника».
  fillingOptions: Record<string, string>;
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

// Заказ после обработки на сервере: исходные поля + то, что клиенту
// доверять нельзя (номер, время, цена) + готовые строки для таблицы и Telegram.
export type SavedOrder = OrderFormData & {
  orderId: string;
  // Начинки одной строкой вместе с подпунктами:
  // "Красный бархат (Клубника), Медовик". В таком виде уходит в Google Sheets.
  filling: string;
  createdAt: string; // ISO
  createdAtLabel: string; // "05.09.2026 13:32" по Москве
  productLabel: string; // "Классический торт 3 кг"
  sizeLabel: string; // "3 кг" | "×12" | ""
  decorLabel: string; // "Надпись"
  decorDetails: string; // "Текст: С днём рождения; Цвет: розовый"
  cakePrice: number;
  decorPrice: number;
  decorQuoted: boolean;
  totalPrice: number;
  directCode: string; // "ZAKAZCBH4821"
};
