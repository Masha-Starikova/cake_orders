import { describe, expect, it } from "vitest";
import { generateOrderId } from "@/lib/order-id";
import { buildSavedOrder } from "@/lib/order-summary";
import { escapeHtml, formatOrderMessage } from "@/lib/server/telegram";
import { sampleOrder } from "./fixtures";

describe("generateOrderId", () => {
  it("код продукта + код начинки + 4 цифры", () => {
    const id = generateOrderId({ productId: "cake-by-kg", filling: "Красный бархат" }, () => 0.5);
    expect(id).toBe("TKB5500");
  });

  it("неизвестные значения дают X/XX", () => {
    expect(generateOrderId({ productId: "?", filling: "?" }, () => 0)).toBe("XXX1000");
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
    expect(text).toContain("#CBH4821");
    expect(text).toContain("Красный бархат");
    expect(text).toContain("14 сентября");
    expect(text).toContain("ул. Пример, 5");
    expect(text).toContain("9 000 ₽");
    expect(text).toContain("ZAKAZCBH4821");
    expect(text).toContain("⚠️");
  });
});
