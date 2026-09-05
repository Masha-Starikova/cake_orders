import { createSign } from "node:crypto";

// Получение access token для Google Sheets API от имени сервис-аккаунта.
// Схема: подписываем короткий JWT приватным ключом и меняем его на токен
// у Google. Токен живёт 1 час; заказов мало, поэтому берём новый на каждый
// запрос и не кэшируем.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type GoogleEnv = {
  email: string;
  privateKey: string;
};

export function readGoogleEnv(): GoogleEnv {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  // В .env ключ хранится одной строкой с "\n" внутри; возвращаем переносы.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL или GOOGLE_PRIVATE_KEY не заданы"
    );
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY не похож на PEM-ключ");
  }
  return { email, privateKey };
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

export async function getAccessToken(): Promise<string> {
  const { email, privateKey } = readGoogleEnv();

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${payload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64url(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Google token: ${data.error ?? response.status} ${data.error_description ?? ""}`.trim()
    );
  }
  return data.access_token;
}
