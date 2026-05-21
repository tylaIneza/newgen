'use client';
import { useEffect, useState, useCallback } from 'react';
import { productsApi } from '@/lib/api';
import type { Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, BarChart2, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';

const emptyForm = { name: '', quantity: '', low_stock_threshold: '5' };

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('can_manage_stock');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<'add' | 'edit' | 'stock' | 'import' | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState({ quantity: '', movement_type: 'IN', notes: '' });
  const [saving, setSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[]; total: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getAll({
        search: search || undefined,
        low_stock: lowStockOnly || undefined,
        limit: 100,
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [search, lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setSelected(null); setModal('add'); };
  const openEdit = (p: Product) => {
    setSelected(p);
    setForm({ name: p.name, quantity: String(p.quantity), low_stock_threshold: String(p.low_stock_threshold) });
    setModal('edit');
  };
  const openStock = (p: Product) => {
    setSelected(p);
    setStockForm({ quantity: '', movement_type: 'IN', notes: '' });
    setModal('stock');
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      if (modal === 'add') {
        await productsApi.create(form);
        toast.success('Product added');
      } else if (selected) {
        await productsApi.update(selected.id, form);
        toast.success('Product updated');
      }
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to save product');
    } finally { setSaving(false); }
  };

  const handleStockAdjust = async () => {
    if (!stockForm.quantity || !selected) return;
    setSaving(true);
    try {
      await productsApi.adjustStock(selected.id, stockForm);
      toast.success('Stock adjusted');
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to adjust stock');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}" from the system?`)) return;
    try {
      await productsApi.remove(id);
      toast.success('Product removed');
      load();
    } catch { toast.error('Failed to remove product'); }
  };

  const downloadTemplate = () => {
    const rows = [
      'name,quantity,low_stock_threshold',
      'Samsung Galaxy A55,20,5',
      'iPhone 15 128GB,10,3',
      'Tecno Spark 20 Pro,15,5',
      'Samsung 55" QLED TV,4,2',
      'LG 43" Full HD TV,6,2',
      'HP Laptop 15s i5,8,2',
      'Dell Inspiron 14 i3,5,2',
      'JBL Charge 5 Speaker,12,3',
      'Airpods Pro 2nd Gen,7,3',
      'Samsung Galaxy Buds2,10,3',
      'Anker PowerBank 20000mAh,20,5',
      'USB-C Charging Cable 1m,50,10',
      'iPhone Lightning Cable 1m,40,10',
      'Screen Protector Samsung A55,30,10',
      'Phone Case iPhone 15,25,10',
      'Wireless Charger 15W,15,5',
      'HDMI Cable 2m,25,5',
      'Memory Card 128GB,30,10',
      'Laptop Bag 15.6",12,3',
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products_import_sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await productsApi.importCSV(importFile);
      setImportResult(res.data);
      if (res.data.imported > 0) { load(); toast.success(`Imported ${res.data.imported} products`); }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products…" className="input pl-9 w-56" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded" />
            Low stock only
          </label>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => { setImportFile(null); setImportResult(null); setModal('import'); }} className="btn-secondary">
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button onClick={openAdd} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm text-gray-500">
        <span>{total} products total</span>
        <span>·</span>
        <span className="text-amber-600">{products.filter(p => p.quantity <= p.low_stock_threshold).length} low stock</span>
        <span>·</span>
        <span className="text-red-600">{products.filter(p => p.quantity === 0).length} out of stock</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : products.length === 0 ? (
          <EmptyState icon={Package} title="No products found"
            description="Add your first product to get started."
            action={canManage ? <button onClick={openAdd} className="btn-primary">Add Product</button> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-center px-4 py-3 font-medium">Qty</th>
                  <th className="text-center px-4 py-3 font-medium">Low Stock</th>
                  {canManage && <th className="text-center px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {products.map(p => {
                  const isLow = p.quantity <= p.low_stock_threshold;
                  const isOut = p.quantity === 0;
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-lg ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
                          {p.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                        {p.low_stock_threshold}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openStock(p)} title="Adjust Stock"
                              className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors">
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(p)} title="Edit"
                              className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(p.id, p.name)} title="Remove"
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Product' : 'Edit Product'}
        size="sm"
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : modal === 'add' ? 'Add Product' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Product Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input" placeholder="e.g. Samsung Galaxy A55" autoFocus />
          </div>
          {modal === 'add' && (
            <div>
              <label className="label">Initial Quantity</label>
              <input type="number" min="0" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="input" placeholder="0" />
            </div>
          )}
          <div>
            <label className="label">Low Stock Threshold</label>
            <input type="number" min="1" value={form.low_stock_threshold}
              onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })}
              className="input" placeholder="5" />
            <p className="text-xs text-gray-400 mt-1">Alert when quantity drops to or below this number</p>
          </div>
        </div>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={modal === 'stock'}
        onClose={() => setModal(null)}
        title={`Adjust Stock — ${selected?.name}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleStockAdjust} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm">
            Current stock: <span className="font-bold">{selected?.quantity}</span>
          </div>
          <div>
            <label className="label">Movement Type</label>
            <select value={stockForm.movement_type}
              onChange={e => setStockForm({ ...stockForm, movement_type: e.target.value })} className="input">
              <option value="IN">Stock In (add)</option>
              <option value="OUT">Stock Out (remove)</option>
              <option value="ADJUSTMENT">Set Exact Quantity</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="0" value={stockForm.quantity}
              onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })}
              className="input" placeholder="Enter quantity" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={stockForm.notes}
              onChange={e => setStockForm({ ...stockForm, notes: e.target.value })}
              className="input h-16 resize-none" placeholder="Reason for adjustment" />
          </div>
        </div>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        title="Import Products from CSV"
        size="md"
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-secondary">Close</button>
            <button onClick={handleImport} disabled={!importFile || importing} className="btn-primary">
              {importing ? 'Importing…' : 'Import'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">CSV Format</p>
            <p className="text-blue-600 dark:text-blue-400 text-xs font-mono">name, quantity, low_stock_threshold</p>
            <p className="text-blue-500 dark:text-blue-400 text-xs mt-1">
              Only <strong>name</strong> is required. Download the sample below — 20 electronics products ready to edit.
            </p>
            <button onClick={downloadTemplate}
              className="mt-2 flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 hover:underline">
              <Download className="w-3.5 h-3.5" /> Download sample (20 products)
            </button>
          </div>

          <div>
            <label className="label">Select CSV File</label>
            <input
              type="file" accept=".csv,text/csv"
              onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              className="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/30 file:text-indigo-700 dark:file:text-indigo-400 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  {importResult.imported} of {importResult.total} products imported successfully
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">{importResult.errors.length} errors</span>
                  </div>
                  <ul className="space-y-0.5">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
