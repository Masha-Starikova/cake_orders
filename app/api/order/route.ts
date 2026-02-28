export const runtime = "edge";

export async function POST() {
  return Response.json(
    {
      ok: true,
      message: "Эндпоинт заказа будет добавлен позже."
    },
    { status: 200 }
  );
}
