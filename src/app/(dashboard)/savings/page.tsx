'use client';
import { useEffect, useState, useCallback } from 'react';
import { savingsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  PiggyBank, DollarSign, TrendingUp, Calendar, RefreshCw,
  Download, Filter, ChevronLeft, ChevronRight, Zap, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, LineChart, Line, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface SavingRecord {
  id: number;
  amount: number;
  revenue_today: number;
  remaining_revenue: number;
  date: string;
  created_at: string;
}

interface DashStats {
  revenue_today: number;
  daily_saving_target: number;
  saving_today: number;
  projected_saving: number;
  remaining_revenue: number;
  saving_recorded: boolean;
  total_savings_month: number;
  days_saved_month: number;
  total_savings_year: number;
  days_saved_year: number;
}

interface MonthlyData {
  total_saved: number;
  total_revenue: number;
  total_remaining: number;
  days_saved: number;
  savings: SavingRecord[];
}

interface YearlyData {
  total_saved: number;
  total_revenue: number;
  days_saved: number;
  monthly: Array<{
    month: number;
    total_saved: number;
    total_revenue: number;
    days_saved: number;
  }>;
}

export default function SavingsPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter();
  const isAdmin      = user?.role === 'admin';
  const canSeeSavings = isAdmin || hasPermission('can_view_savings');

  const [tab, setTab]         = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [stats, setStats]     = useState<DashStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [yearly, setYearly]   = useState<YearlyData | null>(null);
  const [records, setRecords] = useState<SavingRecord[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering]       = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const now       = new Date();
  const [selYear, setSelYear]   = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [filterDate, setFilterDate] = useState('');

  const LIMIT = 20;

  useEffect(() => {
    if (!authLoading && !canSeeSavings) { router.replace('/admin'); }
  }, [authLoading, canSeeSavings, router]);

  const loadStats = useCallback(async () => {
    try { const r = await savingsApi.getDashboardStats(); setStats(r.data); } catch {}
  }, []);

  const loadDaily = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: LIMIT };
      if (filterDate) params.date = filterDate;
      const r = await savingsApi.getAll(params);
      setRecords(r.data.savings);
      setTotal(r.data.total);
    } catch {}
    finally { setLoading(false); }
  }, [page, filterDate]);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const r = await savingsApi.getMonthly({ year: selYear, month: selMonth });
      setMonthly(r.data);
    } catch {}
    finally { setLoading(false); }
  }, [selYear, selMonth]);

  const loadYearly = useCallback(async () => {
    setLoading(true);
    try {
      const r = await savingsApi.getYearly({ year: selYear });
      setYearly(r.data);
    } catch {}
    finally { setLoading(false); }
  }, [selYear]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (tab === 'daily')   loadDaily();
    if (tab === 'monthly') loadMonthly();
    if (tab === 'yearly')  loadYearly();
  }, [tab, loadDaily, loadMonthly, loadYearly]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const r = await savingsApi.triggerSaving();
      toast.success(r.data.message);
      loadStats(); loadDaily();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed');
    } finally { setTriggering(false); }
  };

  const handleRecalculateAll = async () => {
    if (!confirm('Recalculate all savings records using actual sales data for each day?')) return;
    setRecalculating(true);
    try {
      const r = await savingsApi.recalculateAll();
      toast.success(r.data.message);
      loadStats(); loadDaily(); loadMonthly(); loadYearly();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Recalculation failed');
    } finally { setRecalculating(false); }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text('Tyla Shop MIS — Savings Report', pageW / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    if (tab === 'daily') {
      doc.text(`Daily Savings — All Records`, pageW / 2, 26, { align: 'center' });
      autoTable(doc, {
        startY: 32,
        head: [['Date', 'Revenue', 'Saved', 'Remaining']],
        body: records.map(r => [
          formatDate(r.date),
          formatCurrency(r.revenue_today),
          formatCurrency(r.amount),
          formatCurrency(r.remaining_revenue),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
      });
    } else if (tab === 'monthly' && monthly) {
      doc.text(`Monthly Savings — ${MONTH_NAMES[selMonth - 1]} ${selYear}`, pageW / 2, 26, { align: 'center' });
      autoTable(doc, {
        startY: 32,
        head: [['Date', 'Revenue', 'Saved', 'Remaining']],
        body: monthly.savings.map(r => [
          formatDate(r.date),
          formatCurrency(r.revenue_today),
          formatCurrency(r.amount),
          formatCurrency(r.remaining_revenue),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
      });
    } else if (tab === 'yearly' && yearly) {
      doc.text(`Yearly Savings — ${selYear}`, pageW / 2, 26, { align: 'center' });
      autoTable(doc, {
        startY: 32,
        head: [['Month', 'Days Saved', 'Total Saved', 'Total Revenue']],
        body: yearly.monthly.map(m => [
          MONTH_NAMES[m.month - 1],
          m.days_saved.toString(),
          formatCurrency(m.total_saved),
          formatCurrency(m.total_revenue),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
      });
    }
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated ${new Date().toLocaleString()}`, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.save(`savings_report_${tab}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalPages = Math.ceil(total / LIMIT);

  const tooltipStyle = {
    contentStyle: { background: '#1f2937', border: 'none', borderRadius: 12, color: '#f9fafb', fontSize: 12 },
    labelStyle: { color: '#9ca3af' },
  };

  if (authLoading) return <LoadingSpinner />;
  if (!canSeeSavings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-500" /> Daily Savings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automatic 17,500 RWF daily savings from revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={handleRecalculateAll} disabled={recalculating}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculating…' : 'Fix Records'}
            </button>
          )}
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" /> Export PDF
          </button>
          {isAdmin && (
            <button onClick={handleTrigger} disabled={triggering || stats?.saving_recorded}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              <Zap className="w-4 h-4" />
              {triggering ? 'Processing…' : stats?.saving_recorded ? 'Saved Today ✓' : 'Record Today\'s Saving'}
            </button>
          )}
        </div>
      </div>

      {/* Top Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Revenue Today" value={stats.revenue_today} isCurrency
            icon={DollarSign} iconColor="text-blue-700" iconBg="bg-blue-100 dark:bg-blue-900/30" />
          <StatCard title="Daily Saving" value={stats.projected_saving} isCurrency
            icon={PiggyBank} iconColor="text-emerald-600" iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            subtitle={`Target: ${formatCurrency(stats.daily_saving_target)}`} />
          <div className={`stat-card ${stats.remaining_revenue < 0 ? 'border border-red-200 dark:border-red-800' : ''}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${stats.remaining_revenue < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
              <TrendingUp className={`w-5 h-5 ${stats.remaining_revenue < 0 ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Remaining Revenue</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${stats.remaining_revenue < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {stats.remaining_revenue < 0 ? '-' : ''}{formatCurrency(Math.abs(stats.remaining_revenue))}
              </p>
              {stats.remaining_revenue < 0 && <p className="text-xs text-red-500 mt-1 font-medium">⚠ Deficit</p>}
            </div>
          </div>
          <StatCard title="Total This Month" value={stats.total_savings_month} isCurrency
            icon={Activity} iconColor="text-violet-600" iconBg="bg-violet-100 dark:bg-violet-900/30"
            subtitle={`${stats.days_saved_month} days`} />
          <StatCard title="Total This Year" value={stats.total_savings_year} isCurrency
            icon={Calendar} iconColor="text-amber-600" iconBg="bg-amber-100 dark:bg-amber-900/30"
            subtitle={`${stats.days_saved_year} days`} />
        </div>
      )}

      {/* Today's saving banner */}
      {stats && (
        <div className={`rounded-2xl p-5 text-white shadow-lg ${
          !stats.saving_recorded ? 'bg-gradient-to-r from-gray-600 to-gray-500'
          : stats.remaining_revenue < 0 ? 'bg-gradient-to-r from-red-700 to-rose-600'
          : 'bg-gradient-to-r from-emerald-600 to-teal-600'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <PiggyBank className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Today's Saving Status</p>
                <p className="text-3xl font-extrabold tabular-nums">{formatCurrency(stats.projected_saving)}</p>
                {stats.remaining_revenue < 0 && (
                  <p className="text-sm text-white/80 mt-1">⚠ Revenue short by {formatCurrency(Math.abs(stats.remaining_revenue))}</p>
                )}
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-xs text-white/70 uppercase tracking-wide">Revenue</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.revenue_today)}</p>
              </div>
              <div>
                <p className="text-xs text-white/70 uppercase tracking-wide">After Saving</p>
                <p className={`text-lg font-bold tabular-nums ${stats.remaining_revenue < 0 ? 'text-red-200' : ''}`}>
                  {stats.remaining_revenue < 0 ? '-' : ''}{formatCurrency(Math.abs(stats.remaining_revenue))}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/70 uppercase tracking-wide">Status</p>
                <p className="text-lg font-bold">{stats.saving_recorded ? '✓ Recorded' : '⏳ Pending'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {(['daily', 'monthly', 'yearly'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ─── DAILY TAB ─── */}
      {tab === 'daily' && (
        <div className="space-y-5">
          {/* Filter row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="w-4 h-4" />
            </div>
            <input type="date" value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setPage(1); }}
              className="input-field text-sm h-9 w-44" />
            {filterDate && (
              <button onClick={() => { setFilterDate(''); setPage(1); }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                Clear
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">{total} records</span>
          </div>

          {loading ? <LoadingSpinner /> : (
            <>
              {/* Trend chart */}
              {records.length > 1 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Savings Trend</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={[...records].reverse()}>
                      <defs>
                        <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Area type="monotone" dataKey="amount" name="Saved" stroke="#10b981" fill="url(#sgGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="revenue_today" name="Revenue" stroke="#1d4ed8" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left p-4 font-semibold text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Saved</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Remaining</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {records.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">No savings records found</td></tr>
                    ) : records.map(r => {
                      const rate = r.revenue_today > 0 ? ((r.amount / r.revenue_today) * 100).toFixed(1) : '0';
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 font-medium text-gray-900 dark:text-white">{formatDate(r.date)}</td>
                          <td className="p-4 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(r.revenue_today)}</td>
                          <td className="p-4 text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <PiggyBank className="w-3.5 h-3.5" />{formatCurrency(r.amount)}
                            </span>
                          </td>
                          <td className={`p-4 text-right tabular-nums font-medium ${r.remaining_revenue < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {r.remaining_revenue < 0 ? '-' : ''}{formatCurrency(Math.abs(r.remaining_revenue))}
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── MONTHLY TAB ─── */}
      {tab === 'monthly' && (
        <div className="space-y-5">
          {/* Month/Year selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              className="input-field text-sm h-9 w-36">
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
              className="input-field text-sm h-9 w-28">
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? <LoadingSpinner /> : monthly && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Saved</p>
                  <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{formatCurrency(monthly.total_saved)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Revenue</p>
                  <p className="text-2xl font-extrabold text-blue-700 tabular-nums">{formatCurrency(monthly.total_revenue)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Remaining</p>
                  <p className="text-2xl font-extrabold text-blue-600 tabular-nums">{formatCurrency(monthly.total_remaining)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Days Saved</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{monthly.days_saved}</p>
                </div>
              </div>

              {/* Bar chart */}
              {monthly.savings.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    {MONTH_NAMES[selMonth - 1]} {selYear} — Daily Breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthly.savings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(8)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="revenue_today" name="Revenue" fill="#1d4ed8" radius={[4,4,0,0]} />
                      <Bar dataKey="amount" name="Saved" fill="#10b981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Table */}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left p-4 font-semibold text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Saved</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {monthly.savings.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-10 text-gray-400">No savings for this month</td></tr>
                    ) : monthly.savings.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="p-4 font-medium text-gray-900 dark:text-white">{formatDate(r.date)}</td>
                        <td className="p-4 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(r.revenue_today)}</td>
                        <td className="p-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(r.amount)}</td>
                        <td className={`p-4 text-right tabular-nums ${r.remaining_revenue < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {r.remaining_revenue < 0 ? '-' : ''}{formatCurrency(Math.abs(r.remaining_revenue))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {monthly.savings.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold border-t border-gray-100 dark:border-gray-800">
                        <td className="p-4 text-gray-700 dark:text-gray-300">Total</td>
                        <td className="p-4 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(monthly.total_revenue)}</td>
                        <td className="p-4 text-right tabular-nums text-emerald-600">{formatCurrency(monthly.total_saved)}</td>
                        <td className="p-4 text-right tabular-nums text-blue-600">{formatCurrency(monthly.total_remaining)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── YEARLY TAB ─── */}
      {tab === 'yearly' && (
        <div className="space-y-5">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
              className="input-field text-sm h-9 w-28">
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? <LoadingSpinner /> : yearly && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Saved {selYear}</p>
                  <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{formatCurrency(yearly.total_saved)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Revenue {selYear}</p>
                  <p className="text-2xl font-extrabold text-blue-700 tabular-nums">{formatCurrency(yearly.total_revenue)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Days Saved</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{yearly.days_saved}</p>
                </div>
              </div>

              {/* Line chart */}
              {yearly.monthly.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly Growth — {selYear}</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={yearly.monthly.map(m => ({ ...m, month_name: MONTH_NAMES[m.month - 1].slice(0, 3) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                      <XAxis dataKey="month_name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="total_saved" name="Total Saved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                      <Line type="monotone" dataKey="total_revenue" name="Revenue" stroke="#1d4ed8" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Monthly breakdown table */}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left p-4 font-semibold text-gray-500 dark:text-gray-400">Month</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Days Saved</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Total Saved</th>
                      <th className="text-right p-4 font-semibold text-gray-500 dark:text-gray-400">Avg/Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {yearly.monthly.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">No savings for {selYear}</td></tr>
                    ) : yearly.monthly.map(m => (
                      <tr key={m.month} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="p-4 font-medium text-gray-900 dark:text-white">{MONTH_NAMES[m.month - 1]}</td>
                        <td className="p-4 text-right text-gray-600 dark:text-gray-300">{m.days_saved}</td>
                        <td className="p-4 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(m.total_revenue)}</td>
                        <td className="p-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(m.total_saved)}</td>
                        <td className="p-4 text-right tabular-nums text-gray-500">
                          {m.days_saved > 0 ? formatCurrency(m.total_saved / m.days_saved) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {yearly.monthly.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold border-t border-gray-100 dark:border-gray-800">
                        <td className="p-4 text-gray-700 dark:text-gray-300">Total</td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{yearly.days_saved}</td>
                        <td className="p-4 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(yearly.total_revenue)}</td>
                        <td className="p-4 text-right tabular-nums text-emerald-600">{formatCurrency(yearly.total_saved)}</td>
                        <td className="p-4 text-right tabular-nums text-gray-500">
                          {yearly.days_saved > 0 ? formatCurrency(yearly.total_saved / yearly.days_saved) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
