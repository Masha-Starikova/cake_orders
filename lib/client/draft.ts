import type { OrderFormData } from "@/types/order";

// ---------------------------------------------------------------------------
// Черновик заказа в localStorage.
//
// Человек может обновить страницу, потерять связь или случайно закрыть
// вкладку — заполненные поля не должны пропадать. Форма сохраняется при
// каждом изменении, восстанавливается при загрузке и стирается после
// успешной отправки.
//
// DRAFT_VERSION увеличиваем, если меняется структура OrderFormData: старый
// черновик тогда просто игнорируется, а не ломает форму.
// ---------------------------------------------------------------------------

export const DRAFT_KEY = "cake-orders:draft";
export const DRAFT_VERSION = 3;
// Черновик живёт сутки: вернуться к заказу завтра — нормально,
// через неделю — уже нет.
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const emptyFormData: OrderFormData = {
  productId: "",
  weightKg: undefined,
  qty: undefined,
  fillings: [],
  fillingOptions: {},
  decor: { type: "" },
  dueDate: "",
  deliveryType: "pickup",
  name: "",
  phone: "",
  instagram: "",
  address: "",
  comment: ""
};

export type Draft = {
  version: number;
  savedAt: number;
  step: 1 | 2 | 3 | 4;
  showOrder: boolean;
  formData: OrderFormData;
};

// Хранилище недоступно в приватном режиме и на сервере — везде возвращаем
// null вместо исключения.
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(now = Date.now()): Draft | null {
  const store = storage();
  if (!store) {
    return null;
  }
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const draft = JSON.parse(raw) as Draft;
    if (draft?.version !== DRAFT_VERSION || !draft.formData) {
      return null;
    }
    if (now - (draft.savedAt ?? 0) > DRAFT_TTL_MS) {
      return null;
    }
    // Полей могло не быть в сохранённом черновике — добираем из пустой формы.
    return {
      ...draft,
      step: ([1, 2, 3, 4] as const).includes(draft.step) ? draft.step : 1,
      formData: {
        ...emptyFormData,
        ...draft.formData,
        fillings: Array.isArray(draft.formData.fillings)
          ? draft.formData.fillings
          : [],
        fillingOptions:
          draft.formData.fillingOptions &&
          typeof draft.formData.fillingOptions === "object"
            ? draft.formData.fillingOptions
            : {},
        decor: { ...emptyFormData.decor, ...(draft.formData.decor ?? {}) }
      }
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  const store = storage();
  if (!store) {
    return;
  }
  const write = (value: Draft) =>
    store.setItem(DRAFT_KEY, JSON.stringify(value));
  try {
    write(draft);
  } catch {
    // Чаще всего это переполнение хранилища из-за фото-референса.
    // Сохраняем черновик без фото: лучше потерять картинку, чем всю форму.
    try {
      write({
        ...draft,
        formData: {
          ...draft.formData,
          decor: { ...draft.formData.decor, referenceDataUrl: undefined }
        }
      });
    } catch {
      // Хранилище недоступно — работаем без черновика.
    }
  }
}

export function clearDraft(): void {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    // Ничего не делаем: черновик просто не очистится.
  }
}
