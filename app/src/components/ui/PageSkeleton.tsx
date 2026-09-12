function Shimmer({ className }: { className: string }) {
  return <div className={`dp-shimmer rounded-[10px] bg-bg-card ${className}`} />;
}

/** Full-page skeleton shown by Next.js `loading.tsx` while a route's server
    data is being fetched. Mimics the real shell (sidebar + top bar) so the
    transition doesn't flash to a bare white/black page. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex min-h-screen bg-bg-app" aria-busy="true" aria-label="Loading">
      <div className="hidden md:flex md:w-[62px] lg:w-[236px] shrink-0 flex-col gap-2 border-r border-line-hairline bg-bg-rail p-3">
        <div className="dp-shimmer mb-4 h-[22px] w-[22px] rounded-md bg-bg-hover" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dp-shimmer h-8 rounded-[7px] bg-bg-hover" />
        ))}
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-3 border-b border-line-hairline px-4 py-3">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="ml-auto h-8 w-[210px]" />
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-8 w-32" />
        </div>
        <div className="mx-auto flex w-full max-w-[2000px] flex-1 flex-col gap-5 px-4 py-6 lg:px-6">
          <Shimmer className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-24" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <Shimmer key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
