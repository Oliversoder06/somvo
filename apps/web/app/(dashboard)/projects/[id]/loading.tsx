export default function ProjectDetailLoading() {
  return (
    <div className="fade-up">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-9 h-9 rounded-lg bg-elevated animate-pulse" />
        <div className="h-7 w-64 rounded-md bg-elevated animate-pulse" />
      </div>
      <div className="card flex flex-wrap items-center gap-6 mb-8">
        <div className="h-5 w-24 rounded bg-elevated animate-pulse" />
        <div className="h-4 w-40 rounded bg-elevated animate-pulse" />
        <div className="h-4 w-20 rounded bg-elevated animate-pulse" />
        <div className="h-4 w-36 rounded bg-elevated animate-pulse ml-auto" />
      </div>
      <div className="card h-80 flex items-center justify-center">
        <div className="h-8 w-48 rounded bg-elevated animate-pulse" />
      </div>
    </div>
  );
}
