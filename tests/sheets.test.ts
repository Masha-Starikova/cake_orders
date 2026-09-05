import { describe, expect, it } from "vitest";
import { orderToRow, safeCell } from "@/lib/server/sheets";
import { sampleOrder } from "./fixtures";

describe("safeCell", () => {
  it("оставляет обычный текст как есть", () => {
    expect(safeCell("Анна")).toBe("Анна");
    expect(safeCell(undefined)).toBe("");
  });

  it("экранирует символы, с которых начинается формула", () => {
    expect(safeCell("+7 999 123-45-67")).toBe("'+7 999 123-45-67");
    expect(safeCell("@anna")).toBe("'@anna");
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("-5")).toBe("'-5");
  });
});

describe("orderToRow", () => {
  const row = orderToRow(sampleOrder);

  it("даёт ровно 20 колонок A..T", () => {
    expect(row).toHaveLength(20);
  });

  it("раскладывает поля по колонкам", () => {
    expect(row[0]).toBe("05.09.2026 13:32"); // A
    expect(row[1]).toBe("CBH4821"); // B
    expect(row[2]).toBe("Новый"); // C
    expect(row[3]).toBe("Классический торт 3 кг"); // D
    expect(row[5]).toBe("Красный бархат"); // F
    expect(row[9]).toBe("2026-09-14"); // J
    expect(row[10]).toBe("Доставка"); // K
    expect(row[13]).toBe("'+7 999 123-45-67"); // N телефон как текст
    expect(row[14]).toBe("'@anna"); // O
    expect(row[16]).toBe(9000); // Q число, не строка
    expect(row[18]).toBe(9000); // S
    expect(row[19]).toBe("ZAKAZCBH4821"); // T
  });

  it("для сложного рисунка пишет «по договорённости» вместо суммы", () => {
    const quoted = orderToRow({ ...sampleOrder, decorQuoted: true });
    expect(quoted[17]).toBe("по договорённости");
  });
});
