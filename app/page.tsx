"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { CakeNextButton } from "@/components/CakeNextButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { brandName, instagramUrl } from "@/config/app";
import {
  buildDecorSummary,
  getDecorOption,
  getDecorOptionsForProduct,
  isDecorAllowedForProduct,
  type DecorField
} from "@/config/decor";
import { isFillingAllowedForProduct } from "@/config/fillings";
import { quotedDecorLabel, quotedDecorNote } from "@/config/price-rules";
import { products } from "@/config/products";
import { calculatePrice } from "@/lib/pricing";
import type { DecorType, OrderFormData, OrderPricingInput } from "@/types/order";
import type { Product } from "@/types/product";

type ProductCardMeta = {
  title: string;
  price: string;
  details: string;
};

const productMetaById: Record<string, ProductCardMeta> = {
  "cake-by-kg": {
    title: "Класический торт",
    price: "3000 ₽/кг",
    details: "Нужен выбор веса до 10 КГ"
  },
  "bento-s": {
    title: "Бенто S",
    price: "1700 ₽",
    details: "Вес ~500 г, на 1–2 персоны"
  },
  "bento-m": {
    title: "Бенто M",
    price: "3200 ₽",
    details: "Вес 1 кг, на 4–5 персон"
  },
  "bento-l": {
    title: "Бенто L",
    price: "4300 ₽",
    details: "Вес 1,5 кг, на 6–8 персон"
  },
  "cup-cake": {
    title: "Тортик в стаканчике",
    price: "600 ₽/шт",
    details: "Нужен выбор количества"
  },
  cupcakes: {
    title: "Капкейки",
    price: "350 ₽/шт",
    details: "Нужен выбор количества"
  }
};

const fillingCards = [
  {
    name: "Нежнейший пломбир",
    description:
      "Шифоновый бисквит с натуральными семенами ванили, крем с добавлением мягкого творога, напоминающий вкус мороженого пломбир. По желанию можно добавить клубнику/малину/вишню"
  },
  {
    name: "Молочная девочка",
    description:
      "Очень нежные коржи с добавлением сгущенного молока, крем на основе жирных сливок и сгущенного молока"
  },
  {
    name: "Красный бархат",
    description:
      "Нежнейший бисквит на кефире, крем с добавлением мягкого творога. По желанию можно добавить клубнику/малину/вишню"
  },
  {
    name: "Морковный с солёной карамелью",
    description:
      "Шифоновый морковный бисквит с добавлением корицы, воздушный крем на основе мягкого творога, слои солёной карамели"
  },
  {
    name: "Сникерс",
    description:
      "Влажный шоколадный бисквит, крем на основе мягкого творога, с добавлением жареного арахиса и соленой карамели"
  },
  {
    name: "Шоколадная классика",
    description:
      "Влажный шоколадный бисквит, крем на основе мягкого творога с добавлением шоколадно-ореховой пасты. По желанию можно добавить клубнику/малину/вишню"
  },
  {
    name: "Банановый",
    description:
      "Влажный бисквит с добавлением сахара мусковадо, нежный крем с натуральными семенами ванили с добавлением свежих бананов, мягкой карамели и хрустящего кокосового слоя"
  },
  {
    name: "Медовик",
    description:
      "Нежные медовые коржи, с добавлением творожно-сметанного крема и мягкой карамели"
  }
];

const productCodeById: Record<string, string> = {
  "bento-s": "S",
  "bento-m": "M",
  "bento-l": "L",
  "cake-by-kg": "T",
  "cup-cake": "G",
  cupcakes: "K"
};

const fillingCodeByName: Record<string, string> = {
  "Нежнейший пломбир": "NP",
  "Молочная девочка": "MD",
  "Красный бархат": "KB",
  "Морковный с солёной карамелью": "MK",
  "Морковный с соленой карамелью": "MK",
  "Сникерс": "CN",
  "Шоколадная классика": "SH",
  "Банановый": "BA",
  "Медовик": "ME"
};

const formatDate = (value: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long"
  });
};

export default function HomePage() {
  const [showOrder, setShowOrder] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [success, setSuccess] = useState<{
    orderId: string;
    totalPrice: number;
    summary: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nextWobble, setNextWobble] = useState(false);
  const nextWobbleTimeoutRef = useRef<number | null>(null);
  const [formData, setFormData] = useState<OrderFormData>({
    productId: "",
    weightKg: undefined,
    qty: undefined,
    filling: "",
    decor: { type: "" },
    dueDate: "",
    deliveryType: "pickup",
    name: "",
    phone: "",
    instagram: "",
    address: "",
    comment: ""
  });

  const minDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === formData.productId),
    [formData.productId]
  );

  // Начинки и виды декора зависят от выбранного продукта.
  const availableFillings = useMemo(
    () =>
      fillingCards.filter((filling) =>
        isFillingAllowedForProduct(filling.name, formData.productId)
      ),
    [formData.productId]
  );

  const availableDecorOptions = useMemo(
    () => getDecorOptionsForProduct(formData.productId),
    [formData.productId]
  );

  const priceInfo = useMemo(
    () => calculatePrice(formData as OrderPricingInput),
    [formData]
  );
  const formattedPrice = priceInfo.totalPrice
    ? `${priceInfo.totalPrice.toLocaleString("ru-RU")} ₽`
    : "—";
  const formattedCakePrice = priceInfo.cakePrice
    ? `${priceInfo.cakePrice.toLocaleString("ru-RU")} ₽`
    : "—";
  const formattedDecorPrice = priceInfo.decorQuoted
    ? quotedDecorLabel
    : `${priceInfo.decorPrice.toLocaleString("ru-RU")} ₽`;

  const decorSummary = useMemo(
    () => buildDecorSummary(formData.decor, formData.productId),
    [formData.decor, formData.productId]
  );

  const orderProductLabel = useMemo(() => {
    if (!selectedProduct) {
      return "";
    }
    const meta = productMetaById[selectedProduct.id];
    if (selectedProduct.pricing.type === "perKg") {
      return `${meta?.title ?? selectedProduct.name} ${
        formData.weightKg ?? selectedProduct.pricing.minWeightKg
      } кг`;
    }
    if (selectedProduct.pricing.type === "perItem") {
      return `${meta?.title ?? selectedProduct.name} ×${
        formData.qty ?? selectedProduct.pricing.minQty
      }`;
    }
    return meta?.title ?? selectedProduct.name;
  }, [formData.qty, formData.weightKg, selectedProduct]);

  const orderDateLabel = useMemo(
    () => formatDate(formData.dueDate),
    [formData.dueDate]
  );

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const [directCopied, setDirectCopied] = useState(false);

  const handleCopyDirectCode = async () => {
    const code = `ZAKAZ${success?.orderId ?? ""}`;
    if (!code || code === "ZAKAZ") {
      return;
    }
    await copyToClipboard(code);
    setDirectCopied(true);
    setTimeout(() => setDirectCopied(false), 1000);
  };

  const handleShowOrder = () => {
    setShowOrder(true);
    setTimeout(() => {
      document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const triggerNextWobble = () => {
    setNextWobble(true);
    if (nextWobbleTimeoutRef.current) {
      window.clearTimeout(nextWobbleTimeoutRef.current);
    }
    nextWobbleTimeoutRef.current = window.setTimeout(() => {
      setNextWobble(false);
    }, 600);
  };

  const handleBackToHero = () => {
    setShowOrder(false);
    setStep(1);
    setErrors({});
  };

  const updateFormField = <K extends keyof OrderFormData>(
    field: K,
    value: OrderFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field as string]) {
        return prev;
      }
      const { [field as string]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const updateDecorField = <K extends keyof OrderFormData["decor"]>(
    field: K,
    value: OrderFormData["decor"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      decor: { ...prev.decor, [field]: value }
    }));
    setErrors((prev) => {
      const errorKey = `decor.${field as string}`;
      if (!prev[errorKey]) {
        return prev;
      }
      const { [errorKey]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleDecorSelect = (type: DecorType) => {
    setFormData((prev) => ({
      ...prev,
      // При смене типа сбрасываем поля предыдущего декора.
      decor: prev.decor.type === type ? prev.decor : { type }
    }));
    setErrors((prev) => {
      const rest: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith("decor")) {
          rest[key] = value;
        }
      }
      return rest;
    });
  };

  const handleDecorFile = (file: File | null) => {
    if (!file) {
      updateDecorField("referenceFileName", undefined);
      updateDecorField("referenceDataUrl", undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        decor: {
          ...prev.decor,
          referenceFileName: file.name,
          referenceDataUrl:
            typeof reader.result === "string" ? reader.result : undefined
        }
      }));
    };
    reader.readAsDataURL(file);
    setErrors((prev) => {
      if (!prev["decor.reference"]) {
        return prev;
      }
      const { ["decor.reference"]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleProductSelect = (productId: string) => {
    const nextProduct = products.find((product) => product.id === productId);
    const pricing = nextProduct?.pricing;

    setFormData((prev) => ({
      ...prev,
      productId: nextProduct ? productId : "",
      weightKg: pricing?.type === "perKg" ? pricing.minWeightKg : undefined,
      qty: pricing?.type === "perItem" ? pricing.minQty : undefined,
      // Начинка и декор могут быть недоступны для нового продукта — сбрасываем.
      filling:
        nextProduct && isFillingAllowedForProduct(prev.filling, productId)
          ? prev.filling
          : "",
      decor:
        nextProduct && isDecorAllowedForProduct(prev.decor.type, productId)
          ? prev.decor
          : { type: "" }
    }));
    setErrors((prev) => {
      const rest: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (
          key !== "productId" &&
          key !== "weightKg" &&
          key !== "qty" &&
          key !== "filling" &&
          !key.startsWith("decor")
        ) {
          rest[key] = value;
        }
      }
      return rest;
    });
  };

  const adjustStepValue = (delta: number) => {
    if (!selectedProduct) {
      return;
    }

    if (selectedProduct.pricing.type === "perKg") {
      const current = formData.weightKg ?? selectedProduct.pricing.minWeightKg;
      const nextValue = Math.min(
        selectedProduct.pricing.maxWeightKg,
        Math.max(selectedProduct.pricing.minWeightKg, current + delta)
      );
      updateFormField("weightKg", nextValue);
      return;
    }

    if (selectedProduct.pricing.type === "perItem") {
      const current = formData.qty ?? selectedProduct.pricing.minQty;
      const nextValue = Math.min(
        selectedProduct.pricing.maxQty,
        Math.max(selectedProduct.pricing.minQty, current + delta)
      );
      updateFormField("qty", nextValue);
    }
  };

  const renderStepper = (product: Product) => {
    if (product.pricing.type === "perKg") {
      return (
        <div className="stepper-block">
          <p className="stepper-label">Выберите вес (кг)</p>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => adjustStepValue(-1)}
              disabled={
                (formData.weightKg ?? product.pricing.minWeightKg) <=
                product.pricing.minWeightKg
              }
              aria-label="Уменьшить вес"
            >
              −
            </button>
            <span className="stepper-value">
              {formData.weightKg ?? product.pricing.minWeightKg} кг
            </span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => adjustStepValue(1)}
              disabled={
                (formData.weightKg ?? product.pricing.minWeightKg) >=
                product.pricing.maxWeightKg
              }
              aria-label="Увеличить вес"
            >
              +
            </button>
          </div>
          {errors.weightKg && <p className="field-error">{errors.weightKg}</p>}
        </div>
      );
    }

    if (product.pricing.type === "perItem") {
      return (
        <div className="stepper-block">
          <p className="stepper-label">Выберите количество</p>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => adjustStepValue(-1)}
              disabled={
                (formData.qty ?? product.pricing.minQty) <=
                product.pricing.minQty
              }
              aria-label="Уменьшить количество"
            >
              −
            </button>
            <span className="stepper-value">
              {formData.qty ?? product.pricing.minQty} шт.
            </span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => adjustStepValue(1)}
              disabled={
                (formData.qty ?? product.pricing.minQty) >=
                product.pricing.maxQty
              }
              aria-label="Увеличить количество"
            >
              +
            </button>
          </div>
          {errors.qty && <p className="field-error">{errors.qty}</p>}
        </div>
      );
    }

    return null;
  };

  const renderDecorField = (field: DecorField) => {
    const errorKey =
      field.key === "reference" ? "decor.reference" : `decor.${field.key}`;
    const error = errors[errorKey];

    if (field.kind === "file") {
      return (
        <div className="field" key={field.key}>
          <label htmlFor={`decor-${field.key}`}>
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <input
            id={`decor-${field.key}`}
            type="file"
            accept="image/*"
            className="decor-file-input"
            onChange={(event) =>
              handleDecorFile(event.target.files?.[0] ?? null)
            }
          />
          {formData.decor.referenceDataUrl && (
            <div className="decor-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formData.decor.referenceDataUrl}
                alt={formData.decor.referenceFileName ?? "Референс"}
              />
              <button
                type="button"
                className="decor-preview__remove"
                onClick={() => handleDecorFile(null)}
              >
                Удалить фото
              </button>
            </div>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
      );
    }

    const decorKey = field.key as Exclude<typeof field.key, "reference">;
    const value = formData.decor[decorKey] ?? "";

    if (field.kind === "choice") {
      return (
        <div className="field" key={field.key}>
          <label>
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <div className="toggle-group">
            {(field.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                className={`toggle-option ${
                  value === option ? "is-active" : ""
                }`}
                onClick={() => updateDecorField(decorKey, option)}
                aria-pressed={value === option}
              >
                {option}
              </button>
            ))}
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
      );
    }

    return (
      <div className="field" key={field.key}>
        <label htmlFor={`decor-${field.key}`}>
          {field.label}
          {field.required ? " *" : ""}
        </label>
        {field.kind === "textarea" ? (
          <textarea
            id={`decor-${field.key}`}
            rows={3}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateDecorField(decorKey, event.target.value)}
          />
        ) : (
          <input
            id={`decor-${field.key}`}
            type="text"
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateDecorField(decorKey, event.target.value)}
          />
        )}
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  };

  const getStepErrors = (currentStep: 1 | 2 | 3 | 4) => {
    const nextErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.productId) {
        nextErrors.productId = "Выберите продукт";
      }
      if (selectedProduct?.pricing.type === "perKg" && !formData.weightKg) {
        nextErrors.weightKg = "Укажите вес";
      }
      if (selectedProduct?.pricing.type === "perItem" && !formData.qty) {
        nextErrors.qty = "Укажите количество";
      }
    }

    if (currentStep === 2) {
      if (!formData.filling) {
        nextErrors.filling = "Выберите начинку";
      } else if (
        !isFillingAllowedForProduct(formData.filling, formData.productId)
      ) {
        nextErrors.filling = "Эта начинка недоступна для выбранного продукта";
      }
    }

    if (currentStep === 3) {
      const decorOption = getDecorOption(formData.decor.type, formData.productId);
      if (!decorOption) {
        nextErrors["decor.type"] = "Выберите декор";
      } else {
        for (const field of decorOption.fields) {
          if (!field.required) {
            continue;
          }
          if (field.key === "reference") {
            if (!formData.decor.referenceFileName) {
              nextErrors["decor.reference"] = "Прикрепите фото";
            }
            continue;
          }
          const decorKey = field.key as Exclude<typeof field.key, "reference">;
          if (!formData.decor[decorKey]) {
            nextErrors[`decor.${decorKey}`] = "Заполните поле";
          }
        }
      }
    }

    if (currentStep === 4) {
      if (!formData.dueDate) {
        nextErrors.dueDate = "Укажите дату";
      }
      if (!formData.name) {
        nextErrors.name = "Введите имя";
      }
      if (!formData.phone) {
        nextErrors.phone = "Введите телефон";
      }
      if (formData.deliveryType === "delivery" && !formData.address) {
        nextErrors.address = "Укажите адрес доставки";
      }
    }

    return nextErrors;
  };

  const validateStep = (currentStep: 1 | 2 | 3 | 4) => {
    const nextErrors = getStepErrors(currentStep);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateAll = () => {
    const combinedErrors = {
      ...getStepErrors(1),
      ...getStepErrors(2),
      ...getStepErrors(3),
      ...getStepErrors(4)
    };
    setErrors(combinedErrors);
    return Object.keys(combinedErrors).length === 0;
  };

  const handleNext = () => {
    const isValid = validateStep(step);
    if (isValid) {
      setStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
      return;
    }
    triggerNextWobble();
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateAll()) {
      return;
    }

    const productCode = productCodeById[formData.productId] ?? "X";
    const fillingCode = fillingCodeByName[formData.filling] ?? "XX";
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderId = `${productCode}${fillingCode}${randomDigits}`;
    const priceSummary = calculatePrice(formData as OrderPricingInput);
    setSuccess({
      orderId,
      totalPrice: priceSummary.totalPrice,
      summary: priceSummary.summary
    });
  };

  const resetForm = () => {
    setFormData({
      productId: "",
      weightKg: undefined,
      qty: undefined,
      filling: "",
      decor: { type: "" },
      dueDate: "",
      deliveryType: "pickup",
      name: "",
      phone: "",
      instagram: "",
      address: "",
      comment: ""
    });
    setErrors({});
    setStep(1);
    setSuccess(null);
    setDirectCopied(false);
  };

  return (
    <div className="page-stack">
      {!showOrder && (
        <main className="page">
          <div className="logo-row">
            <Image
              src="/brand/logo.png"
              alt="the cake club"
              height={144}
              width={720}
              priority
              style={{ width: "auto", height: "144px" }}
            />
          </div>
          <header className="hero">
            <p className="eyebrow">Онлайн-заказ</p>
            <h1 className="title">{brandName}</h1>
            <p className="subtitle">
              Заполните короткую форму в 4 шага — и мы подтвердим заказ в Direct.
            </p>
          </header>
          <PrimaryButton type="button" onClick={handleShowOrder}>
            Оформить заказ
          </PrimaryButton>
        </main>
      )}

      {showOrder && (
        <>
          <section id="order" className="order-section">
            <div className="section-header">
              {!success && (
                <h2 className="section-title">
                  {step === 2
                    ? "Выбор начинки"
                    : step === 3
                      ? "Выбор декора"
                      : step === 4
                        ? "Оформление заказа"
                        : "Форма заказа"}
                </h2>
              )}
              {!success && step === 1 && (
                <p className="section-subtitle">
                  Заполните 4 шага — и мы подтвердим заказ в Direct.
                </p>
              )}
            </div>
            {success ? (
              <div className="success-card">
                <h3 className="success-heading">Ваш заказ</h3>
                <div className="order-summary">
                  <div className="order-summary__row order-summary__row--product">
                    <span className="order-summary__value order-summary__value--product">
                      {orderProductLabel}
                    </span>
                  </div>
                  <div className="order-summary__row">
                    <span className="order-summary__label">Начинка</span>
                    <span className="order-summary__value">
                      {formData.filling}
                    </span>
                  </div>
                  {decorSummary && (
                    <>
                      <div className="order-summary__row">
                        <span className="order-summary__label">Декор</span>
                        <span className="order-summary__value">
                          {decorSummary.title}
                        </span>
                      </div>
                      {decorSummary.details.map((detail) => (
                        <div
                          className="order-summary__row order-summary__row--sub"
                          key={detail.label}
                        >
                          <span className="order-summary__label">
                            {detail.label}
                          </span>
                          <span className="order-summary__value">
                            {detail.value}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="order-summary__row">
                    <span className="order-summary__label">К дате</span>
                    <span className="order-summary__value">
                      {orderDateLabel}
                    </span>
                  </div>
                  <div className="order-summary__row">
                    <span className="order-summary__label">Получение</span>
                    <span className="order-summary__value">
                      {formData.deliveryType === "delivery"
                        ? "Доставка"
                        : "Самовывоз"}
                    </span>
                  </div>
                  {formData.deliveryType === "delivery" && formData.address && (
                    <div className="order-summary__row">
                      <span className="order-summary__label">Адрес</span>
                      <span className="order-summary__value">
                        {formData.address}
                      </span>
                    </div>
                  )}
                  <div className="order-summary__row">
                    <span className="order-summary__label">Имя</span>
                    <span className="order-summary__value">
                      {formData.name}
                    </span>
                  </div>
                  <div className="order-summary__row">
                    <span className="order-summary__label">Телефон</span>
                    <span className="order-summary__value">
                      {formData.phone}
                    </span>
                  </div>
                  {formData.instagram && (
                    <div className="order-summary__row">
                      <span className="order-summary__label">Instagram</span>
                      <span className="order-summary__value">
                        {formData.instagram}
                      </span>
                    </div>
                  )}
                  {formData.comment && (
                    <div className="order-summary__row">
                      <span className="order-summary__label">Комментарий</span>
                      <span className="order-summary__value">
                        {formData.comment}
                      </span>
                    </div>
                  )}
                </div>

                <div className="price-box price-box--breakdown">
                  <div className="price-row">
                    <span>Стоимость торта</span>
                    <strong>{formattedCakePrice}</strong>
                  </div>
                  <div className="price-row">
                    <span>Доплата за декор</span>
                    <strong>{formattedDecorPrice}</strong>
                  </div>
                  <div className="price-row price-row--total">
                    <span>Итого</span>
                    <strong>
                      {success.totalPrice.toLocaleString("ru-RU")} ₽
                    </strong>
                  </div>
                  {priceInfo.decorQuoted && (
                    <p className="price-note">{quotedDecorNote}</p>
                  )}
                </div>

                <p className="success-title">ЗАКАЗ СОЗДАН</p>
                <div className="order-summary">
                  <div className="order-summary__row">
                    <span className="order-summary__label">Номер заказа</span>
                    <span className="order-summary__value">
                      {success.orderId}
                    </span>
                  </div>
                  <div className="order-summary__row">
                    <span className="order-summary__label">
                      Напишите в Direct код
                    </span>
                    <span className="order-summary__value order-summary__value--code">
                      <strong className="direct-code">
                        ZAKAZ{success.orderId}
                      </strong>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={handleCopyDirectCode}
                        aria-label="Скопировать код для Direct"
                      >
                        {directCopied ? "✅" : "⧉"}
                      </button>
                    </span>
                  </div>
                </div>
                <p className="direct-note">мы подтвердим и уточним детали.</p>
                <div className="form-actions">
                  <a
                    className="btn btn-secondary"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть Direct
                  </a>
                  <button className="btn" type="button" onClick={resetForm}>
                    Создать новый заказ
                  </button>
                </div>
              </div>
            ) : (
              <form className="order-form" onSubmit={handleSubmit}>
                <p className="step-indicator">ШАГ {step} ИЗ 4</p>
                {step === 1 && (
                  <div className="form-step">
                    <div className="product-grid">
                      {products.map((product) => {
                        const meta = productMetaById[product.id];
                        return (
                          <button
                            key={product.id}
                            type="button"
                            className={`product-card ${
                              formData.productId === product.id
                                ? "is-selected"
                                : ""
                            }`}
                            onClick={() => handleProductSelect(product.id)}
                            aria-pressed={formData.productId === product.id}
                          >
                            <span className="product-title">
                              {meta?.title ?? product.name}
                            </span>
                            <span className="product-price">
                              {meta?.price ?? ""}
                            </span>
                            <span className="product-details">
                              {meta?.details ?? ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.productId && (
                      <p className="field-error">{errors.productId}</p>
                    )}
                    {selectedProduct ? renderStepper(selectedProduct) : null}
                    <div className="price-box">
                      Стоимость: <strong>{formattedPrice}</strong>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="form-step">
                    <div className="filling-grid">
                      {availableFillings.map((filling) => (
                        <button
                          key={filling.name}
                          type="button"
                          className={`filling-card ${
                            formData.filling === filling.name
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() =>
                            updateFormField("filling", filling.name)
                          }
                          aria-pressed={formData.filling === filling.name}
                        >
                          <span className="filling-title">{filling.name}</span>
                          <span className="filling-description">
                            {filling.description}
                          </span>
                        </button>
                      ))}
                    </div>
                    {errors.filling && (
                      <p className="field-error">{errors.filling}</p>
                    )}
                    <p className="helper-text">
                      Начинка без доплаты
                      {availableFillings.length < fillingCards.length
                        ? " · для этого продукта доступны не все начинки"
                        : ""}
                    </p>
                  </div>
                )}
                {step === 3 && (
                  <div className="form-step">
                    <div className="decor-grid">
                      {availableDecorOptions.map((option) => {
                        const isSelected = formData.decor.type === option.id;
                        return (
                          <div
                            key={option.id}
                            className={`decor-card ${
                              isSelected ? "is-selected" : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="decor-card__head"
                              onClick={() => handleDecorSelect(option.id)}
                              aria-pressed={isSelected}
                            >
                              <span className="decor-card__titles">
                                <span className="decor-title">
                                  {option.title}
                                </span>
                                <span
                                  className={`decor-badge ${
                                    option.hasSurcharge
                                      ? "decor-badge--paid"
                                      : ""
                                  }`}
                                >
                                  {option.badgeLabel ??
                                    (option.hasSurcharge
                                      ? "доплата"
                                      : "без доплаты")}
                                </span>
                              </span>
                              <span className="decor-description">
                                {option.description}
                              </span>
                            </button>
                            {isSelected && (
                              <div className="decor-fields">
                                {option.fields.map((field) =>
                                  renderDecorField(field)
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {errors["decor.type"] && (
                      <p className="field-error">{errors["decor.type"]}</p>
                    )}
                    <div className="price-box price-box--breakdown">
                      <div className="price-row">
                        <span>Стоимость торта</span>
                        <strong>{formattedCakePrice}</strong>
                      </div>
                      <div className="price-row">
                        <span>Доплата за декор</span>
                        <strong>{formattedDecorPrice}</strong>
                      </div>
                      <div className="price-row price-row--total">
                        <span>Итого</span>
                        <strong>{formattedPrice}</strong>
                      </div>
                      {priceInfo.decorQuoted && (
                        <p className="price-note">{quotedDecorNote}</p>
                      )}
                    </div>
                  </div>
                )}
                {step === 4 && (
                  <div className="form-step">
                    <div className="field">
                      <label htmlFor="dueDate">К какому числу нужно</label>
                      <input
                        id="dueDate"
                        type="date"
                        className="date-input"
                        min={minDate}
                        value={formData.dueDate}
                        onChange={(event) =>
                          updateFormField("dueDate", event.target.value)
                        }
                      />
                      {errors.dueDate && (
                        <p className="field-error">{errors.dueDate}</p>
                      )}
                    </div>
                    <div className="field">
                      <label>Тип получения</label>
                      <div className="toggle-group">
                        <label
                          className={`toggle-option ${
                            formData.deliveryType === "pickup"
                              ? "is-active"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryType"
                            value="pickup"
                            checked={formData.deliveryType === "pickup"}
                            onChange={() =>
                              updateFormField("deliveryType", "pickup")
                            }
                          />
                          Самовывоз
                        </label>
                        <label
                          className={`toggle-option ${
                            formData.deliveryType === "delivery"
                              ? "is-active"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryType"
                            value="delivery"
                            checked={formData.deliveryType === "delivery"}
                            onChange={() =>
                              updateFormField("deliveryType", "delivery")
                            }
                          />
                          Доставка
                        </label>
                      </div>
                    </div>
                    {formData.deliveryType === "delivery" && (
                      <div className="field">
                        <label htmlFor="address">Адрес</label>
                        <input
                          id="address"
                          type="text"
                          value={formData.address ?? ""}
                          onChange={(event) =>
                            updateFormField("address", event.target.value)
                          }
                          placeholder="Город, улица, дом"
                        />
                        {errors.address && (
                          <p className="field-error">{errors.address}</p>
                        )}
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="name">Имя</label>
                      <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(event) =>
                          updateFormField("name", event.target.value)
                        }
                        placeholder="Как к вам обращаться"
                      />
                      {errors.name && (
                        <p className="field-error">{errors.name}</p>
                      )}
                    </div>
                    <div className="field">
                      <label htmlFor="phone">Телефон</label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(event) =>
                          updateFormField("phone", event.target.value)
                        }
                        placeholder="+7"
                      />
                      {errors.phone && (
                        <p className="field-error">{errors.phone}</p>
                      )}
                    </div>
                    <div className="field">
                      <label htmlFor="instagram">
                        Instagram (необязательно)
                      </label>
                      <input
                        id="instagram"
                        type="text"
                        value={formData.instagram ?? ""}
                        onChange={(event) =>
                          updateFormField("instagram", event.target.value)
                        }
                        placeholder="@username"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="comment">Комментарий (необязательно)</label>
                      <textarea
                        id="comment"
                        rows={3}
                        value={formData.comment ?? ""}
                        onChange={(event) =>
                          updateFormField("comment", event.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="form-actions">
                  {step === 1 && (
                    <button
                      className="back-peek-btn"
                      type="button"
                      onClick={handleBackToHero}
                      aria-label="Назад"
                    >
                      <span className="back-peek-btn__label">Назад</span>
                    </button>
                  )}
                  {step > 1 && (
                    <button
                      className="back-peek-btn"
                      type="button"
                      onClick={handleBack}
                      aria-label="Назад"
                    >
                      <span className="back-peek-btn__label">Назад</span>
                    </button>
                  )}
                  {step < 4 && (
                    <CakeNextButton
                      onClick={handleNext}
                      shake={nextWobble}
                      ariaLabel="Далее"
                    />
                  )}
                  {step === 4 && (
                    <button className="btn" type="submit">
                      Оформить заказ
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>
          <footer className="page-footer">
            <Image
              src="/brand/logo.png"
              alt="the cake club"
              height={80}
              width={420}
              style={{ width: "auto", height: "120px" }}
            />
          </footer>
        </>
      )}
    </div>
  );
}
