export default function ProjectsLoading() {
  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-8">
        <div className="h-9 w-40 rounded-md bg-elevated animate-pulse" />
        <div className="h-10 w-32 rounded-md bg-elevated animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-28 rounded-md bg-elevated animate-pulse mb-4" />
            <div className="h-5 w-3/4 rounded bg-elevated animate-pulse mb-3" />
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 rounded bg-elevated animate-pulse" />
              <div className="h-4 w-20 rounded bg-elevated animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
