export default function Loading() {
  return (
    <main
      id="main"
      className="mx-auto max-w-7xl p-6 md:p-10"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <p role="status" className="eyebrow mb-7">
        Getting your workspace ready…
      </p>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-3 h-9 w-2/3 rounded-xl bg-muted" />
        <div className="mb-9 h-4 w-1/2 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["purple", "sky", "pink", "teal"].map((t) => (
            <div key={t} className="surface p-6">
              <div className={`tone-${t} mb-5 size-11 rounded-xl`} />
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="mt-4 h-3 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="surface h-72" />
          <div className="surface h-72" />
        </div>
      </div>
    </main>
  );
}
