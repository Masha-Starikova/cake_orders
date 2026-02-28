import type { OrderFormData } from "@/types/order";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateOrderForm(_order: OrderFormData): ValidationResult {
  return { valid: true, errors: [] };
}
