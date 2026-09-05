// Сжатие фото-референса в браузере перед отправкой: фото с телефона
// весит 5–8 МБ, после уменьшения до 1600 px по длинной стороне и JPEG 0.8
// остаётся 300–600 КБ. Меньше трафика, быстрее отправка, укладывается
// в лимиты сервера и Telegram.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // до сжатия
const MAX_SIDE = 1600;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Это не изображение");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Фото больше 15 МБ, выберите другое");
  }

  const bitmap = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Совсем старый браузер: отправим как есть.
    return readAsDataUrl(file);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Не удалось прочитать файл"));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}
