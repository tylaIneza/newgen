'use client';
import { useEffect, useState, useCallback } from 'react';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { DollarSign, ShoppingCart, TrendingUp, RefreshCw, Plus } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import Link from 'next/link';

export default function SellerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await analyticsApi.getSellerDashboard();
      setData(res.data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useSocket('new_sale', () => fetchData(true));

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-center text-gray-500 py-20">Failed to load dashboard.</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue Today" value={data.today?.revenue || 0} isCurrency
          icon={DollarSign} iconColor="text-indigo-600" />
        <StatCard title="Transactions Today" value={data.today?.transactions || 0}
          icon={ShoppingCart} iconColor="text-purple-600" iconBg="bg-purple-100 dark:bg-purple-900/30" />
        <StatCard title="Weekly Revenue" value={data.weekly?.revenue || 0} isCurrency
          icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          subtitle={`${data.weekly?.transactions || 0} transactions`} />
        <div className="stat-card items-center justify-center">
          <Link href="/sales" className="btn-primary w-full justify-center">
            <Plus className="w-4 h-4" /> New Sale
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Revenue This Week</h3>
          {data.daily_trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.daily_trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,114,128,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false}
                  tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  contentStyle={{ borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-16">No data yet for this week.</p>
          )}
        </div>

        {/* Top Products */}
        <div className="card p-5">
          <h3 className="section-title mb-4">My Top Products</h3>
          {data.top_products?.length ? (
            <div className="space-y-3">
              {data.top_products.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{p.product_name}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{p.qty_sold} units sold</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No sales this week yet.</p>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card p-5">
        <h3 className="section-title mb-4">Recent Transactions</h3>
        {data.recent_sales?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left pb-3 font-medium">Invoice</th>
                  <th className="text-left pb-3 font-medium">Items</th>
                  <th className="text-left pb-3 font-medium">Date</th>
                  <th className="text-right pb-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.recent_sales.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 font-medium text-indigo-600 dark:text-indigo-400">{s.invoice_number}</td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">{s.items_count} items</td>
                    <td className="py-3 text-gray-500">{formatDateTime(s.created_at)}</td>
                    <td className="py-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(s.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No sales yet. Start selling!</p>
        )}
      </div>
    </div>
  );
}
