export default function SettingsLoading() {
  return (
    <div className="fade-up">
      <div className="h-9 w-36 rounded-md bg-elevated animate-pulse mb-8" />
      <div className="space-y-6 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div className="h-4 w-24 rounded bg-elevated animate-pulse mb-5" />
            <div className="h-10 w-full rounded bg-elevated animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
