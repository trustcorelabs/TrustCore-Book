import { Construction } from "lucide-react";
import type { ModuleDefinition } from "@/features/registry";
import { PageHeading } from "./ui/page-heading";
import { Card } from "./ui/card";
export function ModulePlaceholder({ module }: { module: ModuleDefinition }) {
  return (
    <section aria-label={module.title}>
      <PageHeading
        eyebrow="Workspace module"
        title={module.title}
        description={module.summary}
      />
      <Card className="max-w-2xl border-dashed">
        <span className="icon-tile tone-amber mb-5">
          <Construction size={22} aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">Not implemented</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          This module’s full workflow is planned. No action is available here
          yet.
        </p>
      </Card>
    </section>
  );
}
