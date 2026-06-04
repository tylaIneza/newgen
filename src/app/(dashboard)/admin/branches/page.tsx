'use client';
import { useState, useEffect } from 'react';
import { branchesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Branch } from '@/types';
import toast from 'react-hot-toast';
import { GitBranch, Plus, Pencil, Trash2, MapPin, Users, ShoppingCart, Package, Check, X as IconX } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BranchesPage() {
  const { user } = useAuth();
  // branch_id===null → super-admin; branch_id===undefined → old session, treat as admin until refreshed
  const isSuperAdmin = user?.role === 'admin';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Branch | null>(null);
  const [form, setForm]         = useState({ name: '', location: '' });
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    try {
      const { data } = await branchesApi.getAll();
      setBranches(data.branches);
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', location: '' });
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, location: b.location || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Branch name is required');
    setSaving(true);
    try {
      if (editing) {
        await branchesApi.update(editing.id, { name: form.name, location: form.location || undefined });
        toast.success('Branch updated');
      } else {
        await branchesApi.create({ name: form.name, location: form.location || undefined });
        toast.success('Branch created');
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Branch) => {
    if (b.id === 1 && b.is_active) return toast.error('Cannot deactivate the Main Branch');
    try {
      await branchesApi.update(b.id, { is_active: !b.is_active });
      toast.success(b.is_active ? 'Branch deactivated' : 'Branch activated');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update branch');
    }
  };

  const handleDelete = async (b: Branch) => {
    if (b.id === 1) return toast.error('Cannot delete the Main Branch');
    if (!confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await branchesApi.remove(b.id);
      toast.success('Branch deleted');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete branch');
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            Branches
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Each branch operates independently with its own sales, stock, expenses, and savings.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {editing ? `Edit: ${editing.name}` : 'New Branch'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kigali Downtown"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. KN 5 Ave, Kigali"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(b => (
            <div key={b.id}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-2xl border p-5 space-y-4',
                b.is_active
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-gray-100 dark:border-gray-800 opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{b.name}</span>
                    {b.id === 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">MAIN</span>
                    )}
                    {!b.is_active && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-md">INACTIVE</span>
                    )}
                  </div>
                  {b.location && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {b.location}
                    </div>
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(b)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(b)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                      title={b.is_active ? 'Deactivate' : 'Activate'}>
                      {b.is_active ? <IconX className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                    {b.id !== 1 && (
                      <button onClick={() => handleDelete(b)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <Users className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{b.user_count ?? 0}</div>
                  <div className="text-[10px] text-gray-500">Users</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <ShoppingCart className="w-4 h-4 text-green-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{b.sale_count ?? 0}</div>
                  <div className="text-[10px] text-gray-500">Sales</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <Package className="w-4 h-4 text-purple-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{b.product_count ?? 0}</div>
                  <div className="text-[10px] text-gray-500">Products</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
