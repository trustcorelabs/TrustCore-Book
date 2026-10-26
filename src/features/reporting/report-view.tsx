import { Card } from "@/components/ui/card";
import { appointmentMetrics, type ReportRecord } from "./metrics";
export function ReportView({
  rows,
  from,
  to,
  timezone,
  truncated = false,
}: {
  rows: ReportRecord[];
  from: string;
  to: string;
  timezone: string;
  truncated?: boolean;
}) {
  const m = appointmentMetrics(rows, from, to, timezone),
    maximum = Math.max(1, ...m.days.map((d) => d.count));
  return (
    <section aria-label="Appointment reporting">
      {truncated && (
        <p className="notice mb-5" role="status">
          Partial dataset: first 10,000 appointments. Narrow the date range.
          Exports are disabled for partial datasets.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Appointments", String(m.total)],
          ["Completed visits", String(m.completed)],
          [
            "Cancellation rate",
            m.cancellationRate === null
              ? "—"
              : `${(m.cancellationRate * 100).toFixed(1)}%`,
          ],
          [
            "No-show rate",
            m.noShowRate === null ? "—" : `${(m.noShowRate * 100).toFixed(1)}%`,
          ],
        ].map(([title, value]) => (
          <Card key={title}>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-semibold">Appointments by business-local date</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            All statuses; grouped by scheduled start date in {timezone}.
          </p>
          {m.total ? (
            <>
              <div
                className="mt-6 flex h-36 items-end gap-1"
                aria-hidden="true"
              >
                {m.days.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.count}`}
                    className="min-w-0 flex-1 rounded-t bg-primary/75"
                    style={{
                      height: d.count ? `${(d.count / maximum) * 100}%` : "2px",
                    }}
                  />
                ))}
              </div>
              <details className="mt-5">
                <summary className="min-h-11 py-3 text-xs font-semibold text-primary-ink">
                  View accessible daily totals
                </summary>
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  {m.days.map((d) => (
                    <div
                      key={d.day}
                      className="flex justify-between gap-3 border-b border-border py-2"
                    >
                      <dt>{d.day}</dt>
                      <dd>{d.count}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          ) : (
            <p className="mt-8 rounded-xl border border-dashed border-border p-7 text-sm text-muted-foreground">
              No appointments in this date range. No trend is inferred.
            </p>
          )}
        </Card>
        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold">Service popularity</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Recorded visits excluding cancellations and no-shows.
            </p>
            <dl className="mt-4 space-y-3">
              {m.services.map((s, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <dt>{s.name}</dt>
                  <dd className="font-semibold">{s.count}</dd>
                </div>
              ))}
            </dl>
            {!m.services.length && (
              <p className="mt-4 text-sm text-muted-foreground">
                No eligible visits to summarize.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Completed service time</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Appointment duration for completed visits, not attendance tracking
              or capacity utilization.
            </p>
            <dl className="mt-4 space-y-3">
              {m.staff.map((s, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <dt>{s.name}</dt>
                  <dd>{s.minutes} min</dd>
                </div>
              ))}
            </dl>
            {!m.staff.length && (
              <p className="mt-4 text-sm text-muted-foreground">
                No completed visits in this range.
              </p>
            )}
          </Card>
        </div>
      </div>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Cancellation and no-show rates use all appointments starting in this
        range as the denominator. Prices are not collected revenue. Financial
        reporting remains unavailable until verified payment/bookkeeping data is
        connected.
      </p>
    </section>
  );
}
