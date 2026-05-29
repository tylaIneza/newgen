import { cn } from '@/lib/utils';

export default function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
