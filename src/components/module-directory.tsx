import { ArrowUpRight, Layers2 } from "lucide-react";
import { Badge } from "./ui/badge";
import Link from "next/link";
import { modules, moduleHref } from "@/features/registry";
import { PageHeading } from "./ui/page-heading";
import { Card } from "./ui/card";
export function ModuleDirectory({
  businessId,
  platformAdmin = false,
}: {
  businessId: string;
  platformAdmin?: boolean;
}) {
  return (
    <>
      <PageHeading
        title="All modules"
        description="Explore your workspace. Planned workflows are clearly marked."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modules
          .filter((m) => platformAdmin || m.id !== "platform-admin")
          .map((module, index) => (
            <Link key={module.id} href={moduleHref(module, businessId)}>
              <Card className="flex h-full min-w-0 flex-col transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/40">
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className={`icon-tile tone-${["purple", "sky", "teal", "pink", "amber"][index % 5]}`}
                  >
                    <Layers2 size={21} />
                  </span>
                  <ArrowUpRight size={17} className="text-muted-foreground" />
                </div>
                <Badge tone={module.status === "scaffold" ? "amber" : "teal"}>
                  {module.status === "scaffold"
                    ? "Not implemented"
                    : "Foundation available"}
                </Badge>
                <h2 className="mb-3 mt-2 text-lg font-semibold">
                  {module.title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {module.summary}
                </p>
              </Card>
            </Link>
          ))}
      </div>
    </>
  );
}
