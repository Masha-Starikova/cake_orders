import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  DRAFT_KEY,
  DRAFT_TTL_MS,
  DRAFT_VERSION,
  emptyFormData,
  loadDraft,
  saveDraft,
  type Draft
} from "@/lib/client/draft";

// Минимальный localStorage в памяти. onSet позволяет сымитировать
// переполнение хранилища.
function fakeStorage(onSet?: (key: string, value: string) => void) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      onSet?.(key, value);
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    }
  };
}

const install = (store: ReturnType<typeof fakeStorage>) => {
  vi.stubGlobal("window", { localStorage: store });
  return store;
};

const draftOf = (overrides: Partial<Draft> = {}): Draft => ({
  version: DRAFT_VERSION,
  savedAt: Date.now(),
  step: 2,
  showOrder: true,
  formData: {
    ...emptyFormData,
    productId: "cup-cake",
    qty: 6,
    fillings: ["Сникерс", "Медовик"],
    name: "Анна"
  },
  ...overrides
});

beforeEach(() => {
  install(fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("черновик заказа", () => {
  it("сохраняется и читается обратно", () => {
    const draft = draftOf();
    saveDraft(draft);
    const loaded = loadDraft();
    expect(loaded?.formData.fillings).toEqual(["Сникерс", "Медовик"]);
    expect(loaded?.formData.qty).toBe(6);
    expect(loaded?.step).toBe(2);
    expect(loaded?.showOrder).toBe(true);
  });

  it("пустое хранилище — ничего не возвращает", () => {
    expect(loadDraft()).toBeNull();
  });

  it("очистка удаляет черновик", () => {
    saveDraft(draftOf());
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("черновик другой версии игнорируется", () => {
    saveDraft(draftOf({ version: DRAFT_VERSION - 1 }));
    expect(loadDraft()).toBeNull();
  });

  it("черновик старше суток игнорируется", () => {
    const now = Date.now();
    saveDraft(draftOf({ savedAt: now - DRAFT_TTL_MS - 1000 }));
    expect(loadDraft(now)).toBeNull();
  });

  it("свежий черновик в пределах суток читается", () => {
    const now = Date.now();
    saveDraft(draftOf({ savedAt: now - DRAFT_TTL_MS + 60_000 }));
    expect(loadDraft(now)).not.toBeNull();
  });

  it("битый JSON не ломает форму", () => {
    const store = install(fakeStorage());
    store.data.set(DRAFT_KEY, "{не json");
    expect(loadDraft()).toBeNull();
  });

  it("недостающие поля добираются из пустой формы", () => {
    const store = install(fakeStorage());
    store.data.set(
      DRAFT_KEY,
      JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        step: 1,
        showOrder: true,
        formData: { productId: "cake-by-kg" }
      })
    );
    const loaded = loadDraft();
    expect(loaded?.formData.fillings).toEqual([]);
    expect(loaded?.formData.decor).toEqual({ type: "" });
    expect(loaded?.formData.deliveryType).toBe("pickup");
  });

  it("старый черновик без массива начинок не роняет чтение", () => {
    const store = install(fakeStorage());
    store.data.set(
      DRAFT_KEY,
      JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        step: 2,
        showOrder: true,
        formData: { ...emptyFormData, fillings: "Сникерс" }
      })
    );
    expect(loadDraft()?.formData.fillings).toEqual([]);
  });

  it("переполнение хранилища: сохраняем без фото, но с данными формы", () => {
    let firstAttempt = true;
    const store = install(
      fakeStorage((_key, value) => {
        // Первая попытка с тяжёлым фото падает, как настоящий localStorage.
        if (firstAttempt && value.includes("referenceDataUrl")) {
          firstAttempt = false;
          throw new Error("QuotaExceededError");
        }
      })
    );

    saveDraft(
      draftOf({
        formData: {
          ...emptyFormData,
          productId: "cake-by-kg",
          weightKg: 3,
          fillings: ["Медовик"],
          decor: {
            type: "drawing",
            comment: "котик",
            referenceFileName: "cat.jpg",
            referenceDataUrl: "data:image/jpeg;base64,AAAA"
          }
        }
      })
    );

    const loaded = loadDraft();
    expect(loaded?.formData.fillings).toEqual(["Медовик"]);
    expect(loaded?.formData.decor.comment).toBe("котик");
    // Фото потеряно, остальное на месте.
    expect(loaded?.formData.decor.referenceDataUrl).toBeUndefined();
    expect(store.data.has(DRAFT_KEY)).toBe(true);
  });

  it("недоступное хранилище не роняет страницу", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("приватный режим");
      }
    });
    expect(() => saveDraft(draftOf())).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
    expect(loadDraft()).toBeNull();
  });
});
