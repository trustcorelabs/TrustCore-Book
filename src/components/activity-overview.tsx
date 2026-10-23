import { ChartNoAxesCombined } from "lucide-react";
import { Card } from "./ui/card";
import { StatusBadge } from "./ui/badge";
export function ActivityOverview({ statuses }: { statuses: string[] }) {
  const groups = [
    { status: "CONFIRMED", tone: "sky" },
    { status: "PENDING", tone: "amber" },
    { status: "COMPLETED", tone: "green" },
    { status: "CANCELLED", tone: "pink" },
    { status: "NO_SHOW", tone: "purple" },
  ];
  return (
    <Card>
      <div className="mb-6 flex items-center gap-3">
        <span className="icon-tile tone-green">
          <ChartNoAxesCombined size={20} />
        </span>
        <div>
          <h2 className="font-semibold">Appointment activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Status breakdown · latest {statuses.length} records
          </p>
        </div>
      </div>
      {statuses.length ? (
        <dl className="space-y-4">
          {groups.map(({ status, tone }) => {
            const count = statuses.filter((s) => s === status).length;
            return (
              <div key={status}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <dt>
                    <StatusBadge status={status} />
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {count}{" "}
                    <span className="font-normal text-muted-foreground">
                      / {statuses.length}
                    </span>
                  </dd>
                </div>
                <div
                  aria-hidden="true"
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`tone-${tone} h-full rounded-full`}
                    style={{
                      backgroundColor: "currentColor",
                      width: count ? `${(count / statuses.length) * 100}%` : 0,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </dl>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-9 text-center">
          <p className="text-sm font-semibold">
            Your activity story starts here
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            A real breakdown will appear when appointments are recorded. There’s
            no activity to chart yet.
          </p>
        </div>
      )}
    </Card>
  );
}
