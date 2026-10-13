import type { Filling } from "@/types/filling";

// Единый источник правды по начинкам: название, описание для карточки
// и ограничения по продуктам. Форма, валидация и номер заказа берут
// данные отсюда, чтобы списки нигде не разъезжались.

// Обязательный уточняющий вопрос к начинке: ягоды, вид бисквита и т. п.
// Показывается, когда начинку выбрали, и уходит в заказ подпунктом.
export type FillingOptionGroup = {
  key: string;
  // Вопрос в форме.
  label: string;
  // Подпись в сводке заказа, в таблице и в Telegram.
  summaryLabel: string;
  required: boolean;
  options: string[];
};

// Ягоды предлагаются к нескольким начинкам, поэтому группа одна на всех.
const berriesGroup: FillingOptionGroup = {
  key: "berries",
  label: "По желанию можно добавить в начинку:",
  summaryLabel: "Ягоды",
  required: true,
  options: ["Клубника", "Малина", "Вишня", "Без ягод"]
};

export type FillingCard = {
  name: string;
  description: string;
  optionGroups?: FillingOptionGroup[];
  // Начинка доступна только для этих продуктов. Поле не задано —
  // доступна для всех, кроме перечисленных в excludedFillingsByProduct.
  onlyForProducts?: string[];
};

// Продукты-торты: классический по кг и все бенто.
export const cakeProductIds = ["cake-by-kg", "bento-s", "bento-m", "bento-l"];

export const fillingCards: FillingCard[] = [
  {
    name: "Нежнейший пломбир",
    description:
      "Шифоновый бисквит с натуральными семенами ванили, крем с добавлением мягкого творога, напоминающий вкус мороженого пломбир.",
    optionGroups: [berriesGroup]
  },
  {
    name: "Молочная девочка",
    description:
      "Очень нежные коржи с добавлением сгущенного молока, крем на основе жирных сливок и сгущенного молока"
  },
  {
    name: "Красный бархат",
    description:
      "Нежнейший бисквит на кефире, крем с добавлением мягкого творога.",
    optionGroups: [berriesGroup]
  },
  {
    name: "Морковный с солёной карамелью",
    description:
      "Шифоновый морковный бисквит с добавлением корицы, воздушный крем на основе мягкого творога, слои солёной карамели"
  },
  {
    name: "Сникерс",
    description:
      "Влажный шоколадный бисквит, крем на основе мягкого творога, с добавлением жареного арахиса и соленой карамели"
  },
  {
    name: "Шоколадная классика",
    description:
      "Влажный шоколадный бисквит, крем на основе мягкого творога с добавлением шоколадно-ореховой пасты.",
    optionGroups: [berriesGroup]
  },
  {
    name: "Банановый",
    description:
      "Влажный бисквит с добавлением сахара мусковадо, нежный крем с натуральными семенами ванили с добавлением свежих бананов, мягкой карамели и хрустящего кокосового слоя"
  },
  {
    name: "Медовик",
    description:
      "Нежные медовые коржи, с добавлением творожно-сметанного крема и мягкой карамели"
  },
  {
    name: "Киндер-Кантри",
    description:
      "Ванильный крем с добавлением белого шоколада, прослойка шоколадного ганаша и хрустящая начинка «киндер-кантри» с воздушным рисом.",
    optionGroups: [
      {
        key: "biscuit",
        label: "Бисквит на выбор:",
        summaryLabel: "Бисквит",
        required: true,
        options: ["шоколадный", "ванильный"]
      }
    ],
    // Только торты и тортик в стаканчике. Для капкейков недоступна.
    onlyForProducts: [...cakeProductIds, "cup-cake"]
  }
];

export const fillings: Filling[] = fillingCards.map((card) => card.name);

export const getFillingCard = (name: string) =>
  fillingCards.find((card) => card.name === name);

// Начинки, которые нельзя выбрать для конкретного продукта.
export const excludedFillingsByProduct: Record<string, string[]> = {
  cupcakes: ["Молочная девочка", "Медовик"]
};

export const isFillingAllowedForProduct = (
  filling: string,
  productId: string
) => {
  const card = getFillingCard(filling);
  if (card?.onlyForProducts && !card.onlyForProducts.includes(productId)) {
    return false;
  }
  return !(excludedFillingsByProduct[productId] ?? []).includes(filling);
};

export const fillingsForProduct = (productId: string) =>
  fillingCards.filter((card) => isFillingAllowedForProduct(card.name, productId));

// ---------------------------------------------------------------------------
// Несколько начинок в одном заказе.
//
// Штучные продукты (стаканчики, капкейки) можно собрать ассорти: одна
// начинка на каждые itemsPerFilling штук. 3 шт — 1 начинка, 6 шт — до 2,
// 12 шт — до 4. Сколько именно штук каждой начинки, клиент уточняет
// в комментарии к заказу.
//
// Чтобы изменить правило, достаточно поправить itemsPerFilling здесь.
// ---------------------------------------------------------------------------

export const multiFillingRules: Record<string, { itemsPerFilling: number }> = {
  "cup-cake": { itemsPerFilling: 3 },
  cupcakes: { itemsPerFilling: 3 }
};

export const isMultiFillingProduct = (productId: string) =>
  productId in multiFillingRules;

// Сколько начинок разрешено при таком количестве штук.
// Для продуктов без правила — всегда 1.
export function maxFillingsFor(productId: string, qty?: number): number {
  const rule = multiFillingRules[productId];
  if (!rule) {
    return 1;
  }
  const available = fillingsForProduct(productId).length;
  const byQty = Math.floor((qty ?? 0) / rule.itemsPerFilling);
  return Math.max(1, Math.min(byQty, available));
}

// Подпись-подсказка под выбором начинок: "Вы выбрали 12 шт — можно до
// 4 начинок, по 3 шт каждой."
export function fillingLimitHint(productId: string, qty?: number): string {
  const rule = multiFillingRules[productId];
  if (!rule) {
    return "";
  }
  const max = maxFillingsFor(productId, qty);
  const items = qty ?? 0;
  if (max === 1) {
    // Две начинки появляются только при удвоенном шаге: при шаге 3 это 6 шт.
    const forTwo = rule.itemsPerFilling * 2;
    return `Вы выбрали ${items} шт — доступна 1 начинка. Одна начинка на каждые ${rule.itemsPerFilling} шт: от ${forTwo} шт можно собрать ассорти из двух вкусов.`;
  }
  return `Вы выбрали ${items} шт — можно выбрать от 1 до ${max} начинок, по ${rule.itemsPerFilling} шт каждой. Сколько именно штук каждой начинки, напишите в комментарии на последнем шаге.`;
}

// ---------------------------------------------------------------------------
// Подпункты начинок.
//
// Выбор хранится плоским словарём: ключ «начинка::группа», значение — вариант.
// Плоский вид удобно передавать на сервер и класть в черновик заказа.
// ---------------------------------------------------------------------------

export const fillingOptionKey = (filling: string, groupKey: string) =>
  `${filling}::${groupKey}`;

export const optionGroupsFor = (filling: string): FillingOptionGroup[] =>
  getFillingCard(filling)?.optionGroups ?? [];

export const hasFillingOptions = (filling: string) =>
  optionGroupsFor(filling).length > 0;

export type FillingDetail = { label: string; value: string };
export type FillingChoice = { name: string; details: FillingDetail[] };

// Собирает выбранные начинки вместе с их подпунктами.
export function buildFillingChoices(
  fillings: readonly string[] | undefined,
  options: Record<string, string> | undefined
): FillingChoice[] {
  return (fillings ?? []).map((name) => ({
    name,
    details: optionGroupsFor(name)
      .map((group) => ({
        label: group.summaryLabel,
        value: (options ?? {})[fillingOptionKey(name, group.key)] ?? ""
      }))
      .filter((d) => d.value)
  }));
}

// Одной строкой для таблицы: «Красный бархат (Клубника), Медовик».
export function fillingsText(choices: readonly FillingChoice[]): string {
  return choices
    .map((c) =>
      c.details.length
        ? `${c.name} (${c.details.map((d) => d.value).join(", ")})`
        : c.name
    )
    .join(", ");
}

// Убирает выбор подпунктов у начинок, которых больше нет в заказе.
export function pruneFillingOptions(
  fillings: readonly string[],
  options: Record<string, string>
): Record<string, string> {
  const allowed = new Set(
    fillings.flatMap((name) =>
      optionGroupsFor(name).map((g) => fillingOptionKey(name, g.key))
    )
  );
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(options ?? {})) {
    if (allowed.has(key)) {
      next[key] = value;
    }
  }
  return next;
}
