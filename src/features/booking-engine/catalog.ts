type Item = {
  id: string;
  name: string;
  kind: string;
  durationMinutes: number;
  price: { toString(): string };
  active: boolean;
};
export type CatalogLine = {
  serviceId: string;
  name: string;
  kind: string;
  quantity: number;
  unitPrice: string;
  durationMinutes: number;
};
function minor(price: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price))
    throw Error("Invalid catalog price");
  const [whole, fraction = ""] = price.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function quoteCatalog(
  base: Item,
  addons: Item[],
  components: { quantity: number; component: Item }[] = [],
) {
  if (
    !base.active ||
    !["SERVICE", "PACKAGE"].includes(base.kind) ||
    addons.length > 6 ||
    new Set(addons.map((a) => a.id)).size !== addons.length
  )
    throw Error("Unavailable catalog selection");
  const lines: CatalogLine[] = [];
  const line = (item: Item, quantity = 1): CatalogLine => ({
    serviceId: item.id,
    name: item.name,
    kind: item.kind,
    quantity,
    unitPrice: item.price.toString(),
    durationMinutes: item.durationMinutes,
  });
  let duration = base.durationMinutes;
  if (base.kind === "PACKAGE") {
    if (!components.length || components.length > 10)
      throw Error("Invalid package");
    duration = 0;
    for (const { quantity, component } of components) {
      if (
        !component.active ||
        component.kind === "PACKAGE" ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 10
      )
        throw Error("Unavailable package component");
      duration += component.durationMinutes * quantity;
      lines.push(line(component, quantity));
    }
  }
  // The package price is an explicit fixed offer, not an inferred component total.
  lines.unshift(line({ ...base, durationMinutes: duration }));
  let amount = minor(base.price.toString());
  for (const addon of addons) {
    if (!addon.active || addon.kind !== "ADDON")
      throw Error("Unavailable add-on");
    amount += minor(addon.price.toString());
    duration += addon.durationMinutes;
    lines.push(line(addon));
  }
  if (
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 720 ||
    amount > 9999999999n
  )
    throw Error("Selection exceeds booking limits");
  return {
    durationMinutes: duration,
    price: `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`,
    snapshot: lines,
  };
}
