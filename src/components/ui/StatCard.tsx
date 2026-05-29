import { cn, formatCurrency } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  isCurrency?: boolean;
  trend?: number;
  subtitle?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-700',
  iconBg   = 'bg-blue-100 dark:bg-blue-950/40',
  isCurrency,
  trend,
  subtitle,
  className,
}: StatCardProps) {
  const displayValue = isCurrency ? formatCurrency(Number(value)) : value;
  const positive     = trend !== undefined && trend >= 0;

  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        {trend !== undefined && (
          <span className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
            positive
              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
          )}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">{displayValue}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
