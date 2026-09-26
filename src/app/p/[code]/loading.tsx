import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
