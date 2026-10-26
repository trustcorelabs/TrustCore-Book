import { industryPreset, vocabularyFor } from "./presets";
import { Card } from "@/components/ui/card";
export function SetupGuidance({
  business,
}: {
  business: { businessType?: string; terminologyMode?: string };
}) {
  const preset = industryPreset(business.businessType);
  const words = vocabularyFor(business);
  return (
    <Card className="mb-6">
      <p className="eyebrow">Set up for {preset.label.toLowerCase()}</p>
      <h2 className="mt-3 text-lg font-semibold">
        Build your {words.service.toLowerCase()} menu
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {preset.guidance}
      </p>
      <p className="mt-4 text-xs font-semibold">Ideas to get started</p>
      <ul
        className="mt-2 flex flex-wrap gap-2"
        aria-label="Service suggestions"
      >
        {preset.suggestions.map((name) => (
          <li
            className="rounded-full border border-border bg-background px-3 py-2 text-xs"
            key={name}
          >
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Suggestions only. Choose your own names, prices and durations when
        adding a {words.service.toLowerCase()}.
      </p>
    </Card>
  );
}
