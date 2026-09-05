import type { Filling } from "@/types/filling";

export const fillings: Filling[] = [
  "Нежнейший пломбир",
  "Молочная девочка",
  "Красный бархат",
  "Морковный с солёной карамелью",
  "Сникерс",
  "Шоколадная классика",
  "Банановый",
  "Медовик"
];

// Начинки, которые нельзя выбрать для конкретного продукта.
export const excludedFillingsByProduct: Record<string, string[]> = {
  cupcakes: ["Молочная девочка", "Медовик"]
};

export const isFillingAllowedForProduct = (
  filling: string,
  productId: string
) => !(excludedFillingsByProduct[productId] ?? []).includes(filling);
