import { isAdmin } from "@/lib/server/admin-auth";
import { getBlockedDates, isIsoDate, setBlockedDates } from "@/lib/server/blocked-dates";

export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return unauthorized();
  }
  const result = await getBlockedDates({ fresh: true });
  return Response.json(result.ok ? { ok: true, dates: result.dates } : { ok: false, error: result.error, dates: result.dates });
}

export async function PUT(request: Request) {
  if (!isAdmin(request)) {
    return unauthorized();
  }
  const body = (await request.json().catch(() => ({}))) as { dates?: unknown };
  if (!Array.isArray(body.dates) || !body.dates.every((d) => typeof d === "string" && isIsoDate(d))) {
    return Response.json({ ok: false, error: "bad_dates" }, { status: 400 });
  }
  if (body.dates.length > 366) {
    return Response.json({ ok: false, error: "too_many" }, { status: 400 });
  }
  const result = await setBlockedDates(body.dates);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
