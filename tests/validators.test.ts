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
      fillings: ["Медовик"], decor: { type: "none", color: "белый", berries: "С ягодами" }
    };
    expect(getAllErrors(cupcakes)).toHaveProperty("fillings");
  });

  it("декор, запрещённый для продукта", () => {
    const cupcakes: OrderFormData = {
      ...base, productId: "cupcakes", weightKg: undefined, qty: 6,
      fillings: ["Сникерс"], decor: { type: "text", text: "Привет", position: "центр", color: "красный" }
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

describe("Киндер-Кантри: доступность по продуктам", () => {
  const withProduct = (
    productId: string,
    extra: Partial<OrderFormData> = {}
  ): OrderFormData => ({
    ...base,
    productId,
    weightKg: productId === "cake-by-kg" ? 3 : undefined,
    qty: undefined,
    fillings: ["Киндер-Кантри"],
    decor: { type: "none", color: "белый" },
    ...extra
  });

  it("доступна для торта по кг и всех бенто", () => {
    for (const id of ["cake-by-kg", "bento-s", "bento-m", "bento-l"]) {
      expect(getAllErrors(withProduct(id))).not.toHaveProperty("fillings");
    }
  });

  it("доступна для тортика в стаканчике", () => {
    expect(
      getAllErrors(withProduct("cup-cake", { qty: 3 }))
    ).not.toHaveProperty("fillings");
  });

  it("недоступна для капкейков", () => {
    const cupcakes = withProduct("cupcakes", {
      qty: 6,
      decor: { type: "none", color: "белый", berries: "Без ягод" }
    });
    expect(getAllErrors(cupcakes)).toHaveProperty("fillings");
  });
});

describe("несколько начинок для штучных продуктов", () => {
  const cups = (qty: number, fillings: string[]): OrderFormData => ({
    ...base,
    productId: "cup-cake",
    weightKg: undefined,
    qty,
    fillings,
    decor: { type: "none", color: "белый" }
  });

  it("одна начинка подходит всегда", () => {
    expect(getAllErrors(cups(1, ["Сникерс"]))).not.toHaveProperty("fillings");
  });

  it("меньше 3 шт — только одна начинка", () => {
    expect(getAllErrors(cups(2, ["Сникерс", "Медовик"]))).toHaveProperty(
      "fillings"
    );
  });

  it("6 шт — две начинки можно, три нельзя", () => {
    expect(getAllErrors(cups(6, ["Сникерс", "Медовик"]))).not.toHaveProperty(
      "fillings"
    );
    expect(
      getAllErrors(cups(6, ["Сникерс", "Медовик", "Банановый"]))
    ).toHaveProperty("fillings");
  });

  it("12 шт — до четырёх начинок", () => {
    expect(
      getAllErrors(
        cups(12, ["Сникерс", "Медовик", "Банановый", "Красный бархат"])
      )
    ).not.toHaveProperty("fillings");
  });

  it("повтор одной начинки не проходит", () => {
    expect(getAllErrors(cups(6, ["Сникерс", "Сникерс"]))).toHaveProperty(
      "fillings"
    );
  });

  it("у торта несколько начинок выбрать нельзя", () => {
    expect(
      getAllErrors({ ...base, fillings: ["Сникерс", "Медовик"] })
    ).toHaveProperty("fillings");
  });

  it("пустой список — ошибка", () => {
    expect(getAllErrors({ ...base, fillings: [] })).toHaveProperty("fillings");
  });
});
