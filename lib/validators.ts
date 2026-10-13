import { getDecorOption } from "@/config/decor";
import {
  fillingOptionKey,
  fillings,
  isFillingAllowedForProduct,
  maxFillingsFor,
  optionGroupsFor
} from "@/config/fillings";
import { products } from "@/config/products";
import type { OrderFormData } from "@/types/order";

// Единая валидация формы заказа. Используется и в браузере (по шагам),
// и на сервере (все шаги сразу плюс строгие проверки).
// Ключи ошибок совпадают с полями формы: "weightKg", "decor.text", ...

export type OrderErrors = Record<string, string>;
export type OrderStep = 1 | 2 | 3 | 4;

export const MAX_LENGTHS = {
  name: 100,
  phone: 30,
  instagram: 100,
  address: 300,
  comment: 1000,
  decorText: 300,
  decorField: 200,
  decorComment: 1000
} as const;

// Базовые проверки, которые видит пользователь на каждом шаге.
export type ValidationContext = {
  // Даты, закрытые администратором (YYYY-MM-DD).
  blockedDates?: ReadonlySet<string> | readonly string[];
};

export const BLOCKED_DATE_MESSAGE = "На эту дату заказы не принимаются";

const isBlocked = (date: string, ctx?: ValidationContext) => {
  const blocked = ctx?.blockedDates;
  if (!blocked) {
    return false;
  }
  return Array.isArray(blocked)
    ? blocked.includes(date)
    : (blocked as ReadonlySet<string>).has(date);
};

export function getStepErrors(
  order: OrderFormData,
  step: OrderStep,
  ctx?: ValidationContext
): OrderErrors {
  const errors: OrderErrors = {};
  const product = products.find((item) => item.id === order.productId);

  if (step === 1) {
    if (!order.productId || !product) {
      errors.productId = "Выберите продукт";
    } else if (product.pricing.type === "perKg") {
      const { minWeightKg, maxWeightKg, stepKg } = product.pricing;
      const w = order.weightKg;
      if (!w) {
        errors.weightKg = "Укажите вес";
      } else if (
        w < minWeightKg ||
        w > maxWeightKg ||
        Math.abs(((w - minWeightKg) / stepKg) % 1) > 1e-9
      ) {
        errors.weightKg = `Вес от ${minWeightKg} до ${maxWeightKg} кг`;
      }
    } else if (product.pricing.type === "perItem") {
      const { minQty, maxQty } = product.pricing;
      const q = order.qty;
      if (!q) {
        errors.qty = "Укажите количество";
      } else if (!Number.isInteger(q) || q < minQty || q > maxQty) {
        errors.qty = `Количество от ${minQty} до ${maxQty}`;
      }
    }
  }

  if (step === 2) {
    const selected = order.fillings ?? [];
    const limit = maxFillingsFor(order.productId, order.qty);

    if (selected.length === 0) {
      errors.fillings = "Выберите начинку";
    } else if (new Set(selected).size !== selected.length) {
      errors.fillings = "Начинка выбрана дважды";
    } else if (selected.some((name) => !fillings.includes(name))) {
      errors.fillings = "Такой начинки нет";
    } else if (
      selected.some((name) => !isFillingAllowedForProduct(name, order.productId))
    ) {
      errors.fillings = "Эта начинка недоступна для выбранного продукта";
    } else if (selected.length > limit) {
      errors.fillings =
        limit === 1
          ? "Для этого количества доступна только одна начинка"
          : `Для этого количества можно выбрать не больше ${limit} начинок`;
    }

    // Обязательные подпункты выбранных начинок: ягоды, вид бисквита.
    for (const name of selected) {
      for (const group of optionGroupsFor(name)) {
        const value = (order.fillingOptions ?? {})[
          fillingOptionKey(name, group.key)
        ];
        const key = `fillingOption.${fillingOptionKey(name, group.key)}`;
        if (group.required && !value) {
          errors[key] = "Выберите вариант";
        } else if (value && !group.options.includes(value)) {
          errors[key] = "Выберите вариант из списка";
        }
      }
    }
  }

  if (step === 3) {
    const decorOption = getDecorOption(order.decor.type, order.productId);
    if (!decorOption) {
      errors["decor.type"] = "Выберите декор";
    } else {
      for (const field of decorOption.fields) {
        if (field.key === "reference") {
          if (field.required && !order.decor.referenceFileName) {
            errors["decor.reference"] = "Прикрепите фото";
          }
          continue;
        }
        const value = order.decor[field.key];
        if (field.required && !value) {
          errors[`decor.${field.key}`] = "Заполните поле";
        } else if (value) {
          const limit =
            field.key === "comment"
              ? MAX_LENGTHS.decorComment
              : field.key === "text"
                ? MAX_LENGTHS.decorText
                : MAX_LENGTHS.decorField;
          if (value.length > limit) {
            errors[`decor.${field.key}`] = `Не длиннее ${limit} символов`;
          }
        }
        if (field.kind === "choice" && value && !field.options?.includes(value)) {
          errors[`decor.${field.key}`] = "Выберите вариант из списка";
        }
      }
    }
  }

  if (step === 4) {
    if (!order.dueDate) {
      errors.dueDate = "Укажите дату";
    } else if (!isValidDueDate(order.dueDate)) {
      errors.dueDate = "Дата не раньше завтрашнего дня";
    } else if (isBlocked(order.dueDate, ctx)) {
      errors.dueDate = BLOCKED_DATE_MESSAGE;
    }
    if (!order.name?.trim()) {
      errors.name = "Введите имя";
    } else if (order.name.length > MAX_LENGTHS.name) {
      errors.name = `Не длиннее ${MAX_LENGTHS.name} символов`;
    }
    if (!order.phone?.trim()) {
      errors.phone = "Введите телефон";
    } else if (!isValidPhone(order.phone)) {
      errors.phone = "Введите 10 цифр номера после +7";
    }
    if (order.deliveryType === "delivery" && !order.address?.trim()) {
      errors.address = "Укажите адрес доставки";
    } else if ((order.address?.length ?? 0) > MAX_LENGTHS.address) {
      errors.address = `Не длиннее ${MAX_LENGTHS.address} символов`;
    }
    if ((order.instagram?.length ?? 0) > MAX_LENGTHS.instagram) {
      errors.instagram = `Не длиннее ${MAX_LENGTHS.instagram} символов`;
    }
    if ((order.comment?.length ?? 0) > MAX_LENGTHS.comment) {
      errors.comment = `Не длиннее ${MAX_LENGTHS.comment} символов`;
    }
    if (order.deliveryType !== "pickup" && order.deliveryType !== "delivery") {
      errors.deliveryType = "Выберите способ получения";
    }
  }

  return errors;
}

export function getAllErrors(
  order: OrderFormData,
  ctx?: ValidationContext
): OrderErrors {
  return {
    ...getStepErrors(order, 1, ctx),
    ...getStepErrors(order, 2, ctx),
    ...getStepErrors(order, 3, ctx),
    ...getStepErrors(order, 4, ctx)
  };
}

export function validateOrderForm(
  order: OrderFormData,
  ctx?: ValidationContext
): {
  valid: boolean;
  errors: OrderErrors;
} {
  const errors = getAllErrors(order, ctx);
  return { valid: Object.keys(errors).length === 0, errors };
}

// Телефон всегда хранится и показывается в одном виде: +7XXXXXXXXXX.
// В форме «+7» нарисован в поле и не редактируется, человек набирает
// 10 цифр начиная с девятки. Но вставить из буфера могут что угодно,
// поэтому нормализуем и на клиенте, и на сервере.

// Оставляет 10 значащих цифр российского номера.
// "9128459382" → "9128459382"; "89128459382" → "9128459382";
// "+7 912 845-93-82" → "9128459382".
export function phoneDigits(phone: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

// Единый вид для таблицы, Telegram и экрана заказа.
export function formatPhone(phone: string): string {
  const digits = phoneDigits(phone);
  return digits ? `+7${digits}` : "";
}

// Instagram тоже приводим к одному виду: @name. В поле «@» нарисован
// и не редактируется, но вставить могут и ссылку целиком.
export function instagramHandle(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);
}

export function formatInstagram(value: string | undefined): string {
  const handle = instagramHandle(value);
  return handle ? `@${handle}` : "";
}

// Российский мобильный: ровно 10 цифр после кода страны.
export function isValidPhone(phone: string): boolean {
  return phoneDigits(phone).length === 10;
}

// Дата в формате YYYY-MM-DD, не раньше завтра (по локальному времени).
export function isValidDueDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.getTime() >= tomorrow.getTime();
}
