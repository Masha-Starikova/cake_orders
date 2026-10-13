import { describe, expect, it } from "vitest";
import { generateOrderId } from "@/lib/order-id";
import { buildSavedOrder } from "@/lib/order-summary";
import { escapeHtml, formatOrderMessage } from "@/lib/server/telegram";
import { sampleOrder } from "./fixtures";

describe("generateOrderId", () => {
  it("код продукта + код начинки + 3 цифры", () => {
    const id = generateOrderId({ productId: "cake-by-kg", fillings: ["Красный бархат"] }, () => 0.5);
    expect(id).toBe("TKB550");
  });

  it("неизвестные значения дают X/XX", () => {
    expect(generateOrderId({ productId: "?", fillings: ["?"] }, () => 0)).toBe("XXX100");
  });
});

describe("buildSavedOrder", () => {
  const saved = buildSavedOrder(sampleOrder, {
    now: new Date("2026-09-05T10:32:00Z"),
    orderId: "TKB1234"
  });

  it("считает цену на сервере и собирает подписи", () => {
    expect(saved.cakePrice).toBe(9000);
    expect(saved.decorPrice).toBe(0);
    expect(saved.totalPrice).toBe(9000);
    expect(saved.productLabel).toBe("Класический торт 3 кг");
    expect(saved.sizeLabel).toBe("3 кг");
    expect(saved.decorLabel).toBe("Надпись");
    expect(saved.decorDetails).toContain("Текст надписи: С днём рождения");
    expect(saved.directCode).toBe("ZAKAZTKB1234");
    expect(saved.createdAtLabel).toBe("05.09.2026 13:32");
  });

  it("рюши на бенто дают доплату", () => {
    const bento = buildSavedOrder({
      ...sampleOrder, productId: "bento-m", weightKg: undefined,
      decor: { type: "ruffles", color: "белый", comment: "нежно" }
    });
    expect(bento.cakePrice).toBe(3200);
    expect(bento.decorPrice).toBe(350);
    expect(bento.totalPrice).toBe(3550);
  });
});

describe("telegram message", () => {
  it("экранирует HTML в пользовательских полях", () => {
    expect(escapeHtml("<b>a & b</b>")).toBe("&lt;b&gt;a &amp; b&lt;/b&gt;");
    const text = formatOrderMessage({ ...sampleOrder, comment: "<script>x</script>" });
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;");
  });

  it("содержит ключевые поля", () => {
    const text = formatOrderMessage(sampleOrder, { sheetsError: "403" });
    expect(text).toContain("Новый заказ CBH4821");
    expect(text).toContain("Красный бархат");
    expect(text).toContain("14 сентября");
    expect(text).toContain("ул. Пример, 5");
    expect(text).toContain("9 000 ₽");
    expect(text).toContain("ZAKAZCBH4821");
    expect(text).toContain("⚠️");
  });
});

describe("телефон в едином виде", () => {
  it("нормализуется из любого ввода", () => {
    const variants = [
      "9128459382",
      "89128459382",
      "+7 912 845-93-82",
      "8 (912) 845 93 82",
      "+79128459382"
    ];
    for (const phone of variants) {
      expect(buildSavedOrder({ ...sampleOrder, phone }).phone).toBe("+79128459382");
    }
  });

  it("в сообщение Telegram уходит тот же вид", () => {
    const saved = buildSavedOrder({ ...sampleOrder, phone: "89128459382" });
    expect(formatOrderMessage(saved)).toContain("+79128459382");
  });
});

describe("сообщение в Telegram без лишних значков", () => {
  const text = formatOrderMessage({
    ...sampleOrder,
    decor: { type: "drawing", comment: "котик", referenceFileName: "IMG_3998.jpeg" },
    decorDetails: "Комментарий: котик; Референс (фото): IMG_3998.jpeg"
  });

  it("номер заказа без решётки", () => {
    expect(text).toContain("Новый заказ CBH4821");
    expect(text).not.toContain("#CBH4821");
  });

  it("у референса нет имени файла", () => {
    expect(text).toContain("Референс (фото)");
    expect(text).not.toContain("IMG_3998.jpeg");
    expect(text).not.toContain("📎");
  });

  it("убраны значки у даты, получения, контакта и суммы", () => {
    for (const icon of ["📅", "🏠", "🚚", "👤", "💰"]) {
      expect(text).not.toContain(icon);
    }
  });

  it("сами данные на месте", () => {
    expect(text).toContain("14 сентября");
    expect(text).toContain("Доставка: ул. Пример, 5");
    expect(text).toContain("Анна");
    expect(text).toContain("9 000 ₽");
  });
});
