import { createHmac, timingSafeEqual } from "node:crypto";

// Вход администратора по паролю из ADMIN_PASSWORD. После входа ставится
// httpOnly-cookie с подписью HMAC от пароля, живёт 30 дней.

export const ADMIN_COOKIE = "cake_admin";
const MAX_AGE = 30 * 24 * 60 * 60;

function password(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value && value.length >= 8 ? value : null;
}

function sign(value: string): string {
  return createHmac("sha256", password() ?? "").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(candidate: string): boolean {
  const expected = password();
  return !!expected && safeEqual(candidate, expected);
}

export function issueToken(): string {
  const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${expires}.${sign(expires)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !password()) {
    return false;
  }
  const [expires, signature] = token.split(".");
  if (!expires || !signature) {
    return false;
  }
  if (Number(expires) < Math.floor(Date.now() / 1000)) {
    return false;
  }
  return safeEqual(signature, sign(expires));
}

// Флаг Secure ставим только если сам запрос пришёл по HTTPS (Caddy передаёт
// X-Forwarded-Proto). Иначе браузер отбросит cookie при заходе по IP/HTTP.
export function cookieHeader(token: string | null, request?: Request): string {
  const base = `${ADMIN_COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax`;
  const proto =
    request?.headers.get("x-forwarded-proto") ??
    (request ? new URL(request.url).protocol.replace(":", "") : "");
  const secure = proto === "https" ? "; Secure" : "";
  return token ? `${base}; Max-Age=${MAX_AGE}${secure}` : `${base}; Max-Age=0${secure}`;
}

export function readCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  return match?.slice(ADMIN_COOKIE.length + 1);
}

export const isAdmin = (request: Request) => verifyToken(readCookie(request));
