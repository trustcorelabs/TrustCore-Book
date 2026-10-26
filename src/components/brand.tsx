import Link from "next/link";
/** Original TrustCore Book product mark; the parent TrustCore Labs logo is separate. */
export function ProductMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M32 3.5 55.8 17.2v29.6L32 60.5 8.2 46.8V17.2L32 3.5Z"
        fill="#111111"
        stroke="#D4A017"
        strokeWidth="3"
      />
      <path
        d="M20 23h24v21H20V23Zm0 7h24M25 19v8m14-8v8"
        stroke="#D4A017"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m26 36 4.1 4.1L39 32"
        stroke="#D4A017"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl"
      aria-label="TrustCore Book home"
    >
      <ProductMark />
      <span>
        TrustCore{" "}
        <span className="font-normal text-muted-foreground">Book</span>
      </span>
    </Link>
  );
}
