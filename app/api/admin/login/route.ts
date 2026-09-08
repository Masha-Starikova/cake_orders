import { checkPassword, cookieHeader, issueToken } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

// Простая защита от перебора: 5 попыток в минуту с одного адреса.
const attempts = new Map<string, number[]>();

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) {
    return Response.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(body.password ?? "")) {
    attempts.set(ip, [...recent, now]);
    return Response.json({ ok: false, error: "wrong_password" }, { status: 401 });
  }

  attempts.delete(ip);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookieHeader(issueToken(), request) } }
  );
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookieHeader(null, request) } });
}
