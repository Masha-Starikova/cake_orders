import type { DecorData, DecorType } from "@/types/order";

// Ключ поля декора совпадает с именем свойства в DecorData.
export type DecorFieldKey =
  | "text"
  | "position"
  | "color"
  | "colors"
  | "font"
  | "size"
  | "berries"
  | "comment"
  | "reference";

export type DecorField = {
  key: DecorFieldKey;
  label: string;
  kind: "text" | "textarea" | "file" | "choice";
  required: boolean;
  placeholder?: string;
  // Только для kind: "choice".
  options?: string[];
};

export type DecorOption = {
  id: DecorType;
  title: string;
  description: string;
  // Есть ли доплата (её размер берётся из price-rules).
  hasSurcharge: boolean;
  // Текст плашки вместо «доплата» / «без доплаты».
  badgeLabel?: string;
  fields: DecorField[];
};

const commentField: DecorField = {
  key: "comment",
  label: "Комментарий",
  kind: "textarea",
  required: false,
  placeholder: "Ваши пожелания по декору"
};

export const decorOptions: DecorOption[] = [
  {
    id: "none",
    title: "Без декора",
    description: "Без декора, покрытие кремом любого цвета.",
    hasSurcharge: false,
    fields: [
      { key: "color", label: "Цвет", kind: "text", required: true },
      {
        key: "comment",
        label: "Комментарий",
        kind: "textarea",
        required: false,
        placeholder: "Ваши пожелания по декору"
      }
    ]
  },
  {
    id: "text",
    title: "Надпись",
    description:
      "Укажите текст, расположение, цвет, шрифт, размер. Детали можно описать в комментарии.",
    hasSurcharge: false,
    fields: [
      { key: "text", label: "Текст надписи", kind: "text", required: true },
      { key: "position", label: "Расположение", kind: "text", required: true },
      { key: "color", label: "Цвет", kind: "text", required: true },
      { key: "font", label: "Шрифт", kind: "text", required: false },
      { key: "size", label: "Размер", kind: "text", required: false },
      {
        key: "comment",
        label: "Комментарий",
        kind: "textarea",
        required: false,
        placeholder: "Ваши пожелания по декору"
      }
    ]
  },
  {
    id: "drawing",
    title: "Рисунок",
    description:
      "Не сложный рисунок, состоящий из 2–3 цветов, только контур. Укажите цвета, детали можно описать в комментарии и загрузить референс.",
    hasSurcharge: false,
    fields: [
      { key: "colors", label: "Цвета", kind: "text", required: false },
      {
        key: "comment",
        label: "Комментарий",
        kind: "textarea",
        required: true,
        placeholder: "Ваши пожелания по декору"
      },
      { key: "reference", label: "Референс (фото)", kind: "file", required: false }
    ]
  },
  {
    id: "drawing-complex",
    title: "Рисунок сложный",
    description:
      "Прорисованный полностью, больше 3 цветов, объёмный. Стоимость рассчитываем индивидуально — обсудим в Direct при подтверждении заказа.",
    hasSurcharge: true,
    badgeLabel: "цена в Direct",
    fields: [
      {
        key: "comment",
        label: "Комментарий",
        kind: "textarea",
        required: true,
        placeholder: "Ваши пожелания по декору"
      },
      { key: "reference", label: "Референс (фото)", kind: "file", required: true }
    ]
  },
  {
    id: "ruffles",
    title: "Рюши",
    description:
      "Кремовый декор. Укажите цвета, детали можно описать в комментарии и загрузить референс.",
    hasSurcharge: true,
    fields: [
      { key: "color", label: "Цвет", kind: "text", required: true },
      {
        key: "comment",
        label: "Комментарий",
        kind: "textarea",
        required: true,
        placeholder: "Ваши пожелания по декору"
      },
      { key: "reference", label: "Референс (фото)", kind: "file", required: false }
    ]
  }
];

// Какие виды декора доступны для продукта.
// Продукта нет в таблице — доступны все варианты.
const decorTypesByProduct: Record<string, DecorType[]> = {
  // Капкейки: только цвет шапочки и ягоды.
  cupcakes: ["none"],
  // Тортик в стаканчике: без сложного рисунка.
  "cup-cake": ["none", "text", "drawing", "ruffles"]
};

// Переопределения карточек декора для конкретного продукта.
const decorOverridesByProduct: Record<
  string,
  Partial<Record<DecorType, Partial<DecorOption>>>
> = {
  cupcakes: {
    none: {
      description: "Шапочка крема любого цвета. По желанию — свежие ягоды.",
      fields: [
        { key: "color", label: "Цвет шапочки", kind: "text", required: true },
        {
          key: "berries",
          label: "Украшение ягодами",
          kind: "choice",
          required: true,
          options: ["С ягодами", "Без ягод"]
        },
        commentField
      ]
    }
  }
};

export function getDecorOptionsForProduct(productId: string): DecorOption[] {
  const allowed = decorTypesByProduct[productId];
  const available = allowed
    ? decorOptions.filter((option) => allowed.includes(option.id))
    : decorOptions;

  const overrides = decorOverridesByProduct[productId];
  if (!overrides) {
    return available;
  }

  return available.map((option) => {
    const override = overrides[option.id];
    return override ? { ...option, ...override } : option;
  });
}

export const getDecorOption = (id: DecorType | "", productId?: string) =>
  (productId ? getDecorOptionsForProduct(productId) : decorOptions).find(
    (option) => option.id === id
  );

export const isDecorAllowedForProduct = (
  id: DecorType | "",
  productId: string
) => !!id && !!getDecorOption(id, productId);

export type DecorSummaryDetail = { label: string; value: string };
export type DecorSummary = { title: string; details: DecorSummaryDetail[] };

// Человекочитаемая сводка выбранного декора — для экрана подтверждения
// и будущей отправки в Telegram / Google Sheets.
export function buildDecorSummary(
  decor: DecorData,
  productId?: string
): DecorSummary | null {
  const option = getDecorOption(decor.type, productId);
  if (!option) {
    return null;
  }

  const details: DecorSummaryDetail[] = [];
  for (const field of option.fields) {
    let value: string | undefined;
    if (field.key === "reference") {
      value = decor.referenceFileName;
    } else {
      const key = field.key as Exclude<DecorFieldKey, "reference">;
      value = decor[key];
    }
    if (value) {
      details.push({ label: field.label, value });
    }
  }

  return { title: option.title, details };
}
