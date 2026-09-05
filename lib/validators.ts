import { getDecorOption } from "@/config/decor";
import { isFillingAllowedForProduct, fillings } from "@/config/fillings";
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
    if (!order.filling) {
      errors.filling = "Выберите начинку";
    } else if (!fillings.includes(order.filling)) {
      errors.filling = "Такой начинки нет";
    } else if (!isFillingAllowedForProduct(order.filling, order.productId)) {
      errors.filling = "Эта начинка недоступна для выбранного продукта";
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
      errors.phone = "Проверьте номер телефона";
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

// Телефон: после очистки 10–15 цифр.
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
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
