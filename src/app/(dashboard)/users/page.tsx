'use client';
import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { User } from '@/types';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Users, CheckCircle, XCircle, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PERMISSIONS = [
  { id: 1, name: 'can_sell', label: 'Can Sell' },
  { id: 2, name: 'can_view_reports', label: 'View Reports' },
  { id: 3, name: 'can_manage_stock', label: 'Manage Stock' },
  { id: 4, name: 'can_manage_expenses', label: 'Manage Expenses' },
  { id: 5, name: 'can_export_reports', label: 'Export Reports' },
];

const ROLES = [
  { id: '2', label: 'Seller', description: 'Can sell products and view own stats' },
  { id: '3', label: 'Manager', description: 'Can approve expenses, view reports, manage stock' },
  { id: '1', label: 'Admin', description: 'Full system access' },
];

const emptyForm = {
  name: '', email: '', password: '', role_id: '2', phone: '', permissions: [] as number[],
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll();
      setUsers(res.data.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(emptyForm);
    setSelected(null);
    setModal('add');
  };

  const openEdit = async (u: User) => {
    try {
      const res = await usersApi.getOne(u.id);
      const user = res.data.user;
      setSelected(user);
      const customPerms = user.permissions?.filter((p: any) => p.is_custom).map((p: any) => p.id) || [];
      setForm({
        name: user.name, email: user.email, password: '',
        role_id: String(user.role_id), phone: user.phone || '',
        permissions: customPerms,
      });
      setModal('edit');
    } catch { toast.error('Failed to load user'); }
  };

  const togglePermission = (id: number) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.email || (modal === 'add' && !form.password)) {
      toast.error('Name, email and password are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, role_id: parseInt(form.role_id) };
      if (modal === 'add') {
        await usersApi.create(payload);
        toast.success('User created');
      } else if (selected) {
        const { password, ...rest } = payload;
        await usersApi.update(selected.id, password ? payload : rest);
        toast.success('User updated');
      }
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to save user');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id: number, name: string, isActive: boolean) => {
    if (id === currentUser?.id) { toast.error("Can't deactivate your own account"); return; }
    const action = isActive ? 'deactivate' : 're-activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user "${name}"?`)) return;
    try {
      if (isActive) {
        await usersApi.remove(id);
        toast.success('User deactivated');
      } else {
        await usersApi.update(id, { is_active: true });
        toast.success('User re-activated');
      }
      load();
    } catch { toast.error(`Failed to ${action} user`); }
  };

  const handlePermanentDelete = async (id: number, name: string) => {
    if (id === currentUser?.id) { toast.error("Can't delete your own account"); return; }
    if (!confirm(`PERMANENTLY DELETE "${name}"?\n\nThis cannot be undone. The user will be removed from the system forever.`)) return;
    try {
      await usersApi.permanentDelete(id);
      toast.success('User permanently deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold">{users.filter(u => u.is_active).length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Sellers</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'seller').length}</p>
          </div>
        </div>
      </div>

      {/* Manager count row */}
      {users.some(u => u.role === 'manager') && (
        <div className="card p-4 flex items-center gap-3 border-l-4 border-amber-400">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {users.filter(u => u.role === 'manager').length} Manager{users.filter(u => u.role === 'manager').length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400">Can approve expenses and view analytics</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : users.length === 0 ? (
          <EmptyState icon={Users} title="No users found"
            action={<button onClick={openAdd} className="btn-primary">Add User</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Last Login</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={u.role === 'admin' ? 'purple' : u.role === 'manager' ? 'warning' : 'info'}
                        className="capitalize"
                      >{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? 'success' : 'danger'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.last_login ? formatDateTime(u.last_login) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(u)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (<>
                          <button onClick={() => handleDeactivate(u.id, u.name, u.is_active)}
                            title={u.is_active ? 'Deactivate' : 'Re-activate'}
                            className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600'}`}>
                            {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handlePermanentDelete(u.id, u.name)} title="Delete permanently"
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add User' : 'Edit User'} size="md"
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : modal === 'add' ? 'Create User' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input" placeholder="John Smith" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="input" placeholder="john@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{modal === 'add' ? 'Password *' : 'New Password (optional)'}</label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input" placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="input" placeholder="+1 234 567 8900" />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <div className="space-y-2 mt-1">
              {ROLES.map(r => (
                <label key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    form.role_id === r.id
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                  <input type="radio" name="role" value={r.id} checked={form.role_id === r.id}
                    onChange={() => setForm({ ...form, role_id: r.id, permissions: [] })}
                    className="text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {form.role_id === '2' && (
            <div>
              <label className="label">Additional Permissions for Seller</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PERMISSIONS.filter(p => p.name !== 'can_sell').map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input type="checkbox" checked={form.permissions.includes(p.id)}
                      onChange={() => togglePermission(p.id)} className="rounded text-indigo-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
