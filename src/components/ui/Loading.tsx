export function PageSkeleton() {
  return (
    <div className="animate-pulse p-5 lg:p-6" aria-label="Loading subsystem">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="shimmer h-2 w-24 rounded-sm" />
          <div className="shimmer mt-4 h-9 w-64 rounded-sm" />
          <div className="shimmer mt-3 h-3 w-96 max-w-full rounded-sm" />
        </div>
        <div className="shimmer h-8 w-28 rounded-sm" />
      </div>
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="panel h-64 lg:col-span-8">
          <div className="shimmer m-4 h-4 w-40 rounded-sm" />
          <div className="shimmer m-4 h-44 rounded-sm" />
        </div>
        <div className="panel h-64 lg:col-span-4">
          <div className="shimmer m-4 h-4 w-32 rounded-sm" />
          <div className="shimmer m-4 h-44 rounded-sm" />
        </div>
        <div className="panel h-44 lg:col-span-4">
          <div className="shimmer m-4 h-4 w-28 rounded-sm" />
          <div className="shimmer m-4 h-24 rounded-sm" />
        </div>
        <div className="panel h-44 lg:col-span-4">
          <div className="shimmer m-4 h-4 w-28 rounded-sm" />
          <div className="shimmer m-4 h-24 rounded-sm" />
        </div>
        <div className="panel h-44 lg:col-span-4">
          <div className="shimmer m-4 h-4 w-28 rounded-sm" />
          <div className="shimmer m-4 h-24 rounded-sm" />
        </div>
      </div>
    </div>
  )
}
