import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return 'RWF ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

export function truncate(str: string, n = 30): string {
  return str.length > n ? `${str.slice(0, n)}...` : str;
}

export function profitColor(value: number): string {
  if (value > 0) return 'text-emerald-500';
  if (value < 0) return 'text-red-500';
  return 'text-gray-500';
}

export function stockStatus(quantity: number, threshold: number): {
  label: string; color: string; bg: string;
} {
  if (quantity === 0) return { label: 'Out of Stock', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30' };
  if (quantity <= threshold) return { label: 'Low Stock', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30' };
  return { label: 'In Stock', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
}
