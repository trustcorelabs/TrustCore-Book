import Link from "next/link";
import { Layers2 } from "lucide-react";
export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl"
      aria-label="TrustCore Book home"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl brand-mark">
        <Layers2 size={21} />
      </span>
      <span>
        TrustCore{" "}
        <span className="font-normal text-muted-foreground">Book</span>
      </span>
    </Link>
  );
}
