"use client";
import { useState } from "react";
export type CatalogOption = {
  id: string;
  name: string;
  kind: string;
  durationMinutes: number;
};
export type CatalogFieldsValue = {
  kind: string;
  categoryId: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  components: { componentId: string; quantity: number }[];
};
export function CatalogFields({
  id,
  categories = [],
  options = [],
  initial,
  onChange,
}: {
  id: string;
  categories?: { id: string; name: string }[];
  options?: CatalogOption[];
  initial?: CatalogFieldsValue;
  onChange?: (value: CatalogFieldsValue) => void;
}) {
  const [value, setValue] = useState<CatalogFieldsValue>(
    initial ?? {
      kind: "SERVICE",
      categoryId: null,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      components: [],
    },
  );
  function update(next: CatalogFieldsValue) {
    setValue(next);
    onChange?.(next);
  }
  return (
    <div className="grid min-w-0 gap-4 sm:col-span-full sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-kind`}>Offer type</label>
        <select
          className="input"
          id={`${id}-kind`}
          name="kind"
          value={value.kind}
          onChange={(e) =>
            update({
              ...value,
              kind: e.target.value,
              components: e.target.value === "PACKAGE" ? value.components : [],
            })
          }
        >
          <option value="SERVICE">Service</option>
          <option value="PACKAGE">Fixed-price package</option>
          <option value="ADDON">Optional add-on</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-category`}>Category</label>
        <select
          id={`${id}-category`}
          name="categoryId"
          className="input"
          value={value.categoryId ?? ""}
          onChange={(e) =>
            update({ ...value, categoryId: e.target.value || null })
          }
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(["bufferBeforeMinutes", "bufferAfterMinutes"] as const).map(
        (key, i) => (
          <div key={key}>
            <label htmlFor={`${id}-${key}`}>
              {i ? "Recovery after (minutes)" : "Preparation before (minutes)"}
            </label>
            <input
              className="input"
              id={`${id}-${key}`}
              name={key}
              type="number"
              min="0"
              max="180"
              required
              value={value[key]}
              onChange={(e) =>
                update({ ...value, [key]: Number(e.target.value) })
              }
            />
          </div>
        ),
      )}
      {value.kind === "PACKAGE" && (
        <input
          type="hidden"
          name="durationMinutes"
          value={value.components.reduce(
            (sum, c) =>
              sum +
              (options.find((o) => o.id === c.componentId)?.durationMinutes ??
                0) *
                c.quantity,
            0,
          )}
        />
      )}
      <input
        type="hidden"
        name="components"
        value={JSON.stringify(value.components)}
      />
      {value.kind === "PACKAGE" && (
        <fieldset className="space-y-3 sm:col-span-full">
          <legend className="text-sm font-semibold">Package components</legend>
          <p className="text-xs leading-6 text-muted-foreground">
            The price above is the package&apos;s fixed offer price. Duration is
            calculated from the selected components. Assign qualified staff to
            the package itself.
          </p>
          {options
            .filter((o) => o.id !== id && o.kind !== "PACKAGE")
            .map((o) => {
              const chosen = value.components.find(
                (c) => c.componentId === o.id,
              );
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3">
                  <label className="mb-0 flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!chosen}
                      onChange={(e) =>
                        update({
                          ...value,
                          components: e.target.checked
                            ? [
                                ...value.components,
                                { componentId: o.id, quantity: 1 },
                              ]
                            : value.components.filter(
                                (c) => c.componentId !== o.id,
                              ),
                        })
                      }
                    />
                    {o.name} · {o.durationMinutes} min
                  </label>
                  {chosen && (
                    <input
                      className="input max-w-20"
                      type="number"
                      min="1"
                      max="10"
                      aria-label={`${o.name} quantity`}
                      value={chosen.quantity}
                      onChange={(e) =>
                        update({
                          ...value,
                          components: value.components.map((c) =>
                            c.componentId === o.id
                              ? { ...c, quantity: Number(e.target.value) }
                              : c,
                          ),
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
          {!options.length && (
            <p className="text-xs text-muted-foreground">
              Create ordinary services before building a package.
            </p>
          )}
        </fieldset>
      )}
      <p className="text-xs leading-6 text-muted-foreground sm:col-span-full">
        Buffers reserve staff time within working hours. The larger of staff and
        service buffers applies; they are not added together.
      </p>
    </div>
  );
}
