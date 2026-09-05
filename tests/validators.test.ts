import { describe, expect, it } from "vitest";
import { getAllErrors, isValidDueDate, isValidPhone } from "@/lib/validators";
import { sampleOrder } from "./fixtures";
import type { OrderFormData } from "@/types/order";

const base: OrderFormData = { ...sampleOrder, dueDate: "2999-01-01" };

describe("validateOrderForm", () => {
  it("валидный заказ без ошибок", () => {
    expect(getAllErrors(base)).toEqual({});
  });

  it("неизвестный продукт", () => {
    expect(getAllErrors({ ...base, productId: "pizza" })).toHaveProperty("productId");
  });

  it("вес вне диапазона", () => {
    expect(getAllErrors({ ...base, weightKg: 11 })).toHaveProperty("weightKg");
    expect(getAllErrors({ ...base, weightKg: 2.5 })).toHaveProperty("weightKg");
  });

  it("начинка, запрещённая для продукта", () => {
    const cupcakes: OrderFormData = {
      ...base, productId: "cupcakes", weightKg: undefined, qty: 6,
      filling: "Медовик", decor: { type: "none", color: "белый", berries: "С ягодами" }
    };
    expect(getAllErrors(cupcakes)).toHaveProperty("filling");
  });

  it("декор, запрещённый для продукта", () => {
    const cupcakes: OrderFormData = {
      ...base, productId: "cupcakes", weightKg: undefined, qty: 6,
      filling: "Сникерс", decor: { type: "text", text: "Привет", position: "центр", color: "красный" }
    };
    expect(getAllErrors(cupcakes)).toHaveProperty("decor.type");
  });

  it("обязательные поля декора", () => {
    expect(getAllErrors({ ...base, decor: { type: "text" } })).toMatchObject({
      "decor.text": expect.any(String),
      "decor.position": expect.any(String),
      "decor.color": expect.any(String)
    });
  });

  it("сложный рисунок требует фото", () => {
    expect(
      getAllErrors({ ...base, decor: { type: "drawing-complex", comment: "хочу" } })
    ).toHaveProperty("decor.reference");
  });

  it("адрес обязателен при доставке", () => {
    expect(getAllErrors({ ...base, address: "" })).toHaveProperty("address");
    expect(getAllErrors({ ...base, address: "", deliveryType: "pickup" })).not.toHaveProperty("address");
  });

  it("плохой телефон и дата в прошлом", () => {
    expect(getAllErrors({ ...base, phone: "123" })).toHaveProperty("phone");
    expect(getAllErrors({ ...base, dueDate: "2020-01-01" })).toHaveProperty("dueDate");
  });

  it("слишком длинный комментарий", () => {
    expect(getAllErrors({ ...base, comment: "x".repeat(1001) })).toHaveProperty("comment");
  });
});

describe("isValidPhone / isValidDueDate", () => {
  it("телефон 10–15 цифр", () => {
    expect(isValidPhone("+7 (999) 123-45-67")).toBe(true);
    expect(isValidPhone("89991234567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });

  it("дата не раньше завтра", () => {
    const now = new Date("2026-09-05T15:00:00");
    expect(isValidDueDate("2026-09-05", now)).toBe(false);
    expect(isValidDueDate("2026-09-06", now)).toBe(true);
    expect(isValidDueDate("06.09.2026", now)).toBe(false);
  });
});

describe("закрытые даты", () => {
  it("закрытая дата не проходит, открытая проходит", () => {
    const ctx = { blockedDates: ["2999-01-01"] };
    expect(getAllErrors(base, ctx)).toHaveProperty("dueDate");
    expect(getAllErrors({ ...base, dueDate: "2999-01-02" }, ctx)).not.toHaveProperty("dueDate");
    expect(getAllErrors(base, { blockedDates: new Set(["2999-01-01"]) })).toHaveProperty("dueDate");
  });
});
