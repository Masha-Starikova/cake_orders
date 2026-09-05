import { getBlockedDates } from "@/lib/server/blocked-dates";

// Публично: список закрытых дат для календаря в форме.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getBlockedDates();
  return Response.json(
    { dates: result.dates },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
