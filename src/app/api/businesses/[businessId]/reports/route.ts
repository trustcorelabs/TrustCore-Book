import { reportingData } from "@/server/insights";
import { reportCsv } from "@/features/reporting/metrics";
import { RateLimitExceededError } from "@/server/rate-limit";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params,
    q = new URL(request.url).searchParams;
  let d;
  try {
    d = await reportingData(
      businessId,
      { from: q.get("from") ?? undefined, to: q.get("to") ?? undefined },
      true,
    );
  } catch (e) {
    if (e instanceof RateLimitExceededError)
      return Response.json(
        { error: "Too many export requests." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    throw e;
  }
  if (d.error || d.truncated)
    return Response.json(
      { error: d.error ?? "Narrow the date range before exporting." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  return new Response(
    reportCsv(
      d.rows.map((a) => ({
        ...a,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        service: a.serviceNameSnapshot ?? a.service.name,
        staff: a.staff.name,
      })),
      d.scope.business.timezone,
    ),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointments-${d.from}-${d.to}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
