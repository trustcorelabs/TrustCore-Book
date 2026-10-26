"use client";
import {
  CatalogFields,
  type CatalogFieldsValue,
  type CatalogOption,
} from "@/components/catalog-fields";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Clock3, Pencil, Archive, RotateCcw } from "lucide-react";
import { editCatalogRecord } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
type Service = CatalogFieldsValue & {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  active: boolean;
};
function ServiceRow({
  businessId,
  service,
  currency,
  readOnly = false,
  index = 0,
  categories = [],
  options = [],
}: {
  businessId: string;
  service: Service;
  currency: string;
  readOnly?: boolean;
  index?: number;
  categories?: { id: string; name: string }[];
  options?: CatalogOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(service.name);
  const [durationMinutes, setDuration] = useState(
    String(service.durationMinutes),
  );
  const [price, setPrice] = useState(service.price);
  const [active, setActive] = useState(service.active);
  const [catalog, setCatalog] = useState<CatalogFieldsValue>({
    kind: service.kind,
    categoryId: service.categoryId,
    components: service.components,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(nextActive = active) {
    setBusy(true);
    setMessage("");
    try {
      const result = await editCatalogRecord(businessId, "services", {
        ...catalog,
        id: service.id,
        name,
        durationMinutes,
        price,
        active: nextActive,
      });
      setMessage(result.error ?? result.success ?? "");
      if (result.success) {
        setActive(nextActive);
        router.refresh();
      }
    } catch {
      setMessage("Unable to update service.");
    } finally {
      setBusy(false);
    }
  }
  const tone = ["purple", "pink", "sky", "teal"][index % 4];
  const summary = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={`icon-tile tone-${tone}`}>
          <Sparkles size={21} />
        </span>
        <StatusBadge status={service.active ? "active" : "archived"} />
      </div>
      <h3 className="mt-5 break-words text-base font-bold">{service.name}</h3>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 size={14} />
          {service.durationMinutes} min
        </span>
        <span className="text-lg font-bold">
          {money(service.price, currency)}
        </span>
      </div>
      {!readOnly && (
        <span className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs font-semibold text-primary-ink">
          <Pencil size={13} />
          Edit service or availability
        </span>
      )}
    </>
  );
  if (readOnly) return <article className="editor-card">{summary}</article>;
  return (
    <details className="editor-card">
      <summary>{summary}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mt-5"
      >
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`service-name-${service.id}`}>Name</label>
            <Input
              id={`service-name-${service.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          <div>
            <label htmlFor={`service-duration-${service.id}`}>
              Duration (minutes)
            </label>
            <Input
              id={`service-duration-${service.id}`}
              type="number"
              min="5"
              max="720"
              value={durationMinutes}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor={`service-price-${service.id}`}>
              Price ({currency})
            </label>
            <Input
              id={`service-price-${service.id}`}
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <CatalogFields
            id={service.id}
            initial={catalog}
            onChange={setCatalog}
            categories={categories}
            options={options}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Available for booking
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save service"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void save(!service.active)}
            >
              {service.active ? <Archive size={15} /> : <RotateCcw size={15} />}{" "}
              {service.active ? "Archive service" : "Restore service"}
            </Button>
          </div>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="notice mt-4">
          {message}
        </p>
      )}
    </details>
  );
}
export function ServiceEditor({
  businessId,
  services,
  currency,
  readOnly = false,
  categories = [],
}: {
  categories?: { id: string; name: string }[];
  businessId: string;
  services: Service[];
  currency: string;
  readOnly?: boolean;
}) {
  return (
    <section
      aria-label="Service catalog"
      className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      {services.map((service, index) => (
        <ServiceRow
          key={service.id}
          businessId={businessId}
          service={service}
          currency={currency}
          categories={categories}
          options={services}
          index={index}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}
