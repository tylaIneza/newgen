'use client';
import { useState, useEffect, useCallback } from 'react';
import { branchesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Branch } from '@/types';

const STORAGE_KEY = 'selected_branch_id';

export function useBranch() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';

  const [branches, setBranches]       = useState<Branch[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);

  // On mount: load persisted branch selection or use user's own branch
  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setSelectedId(stored ? parseInt(stored) : null);
    } else {
      setSelectedId(user.branch_id);
    }
  }, [user, isSuperAdmin]);

  // Fetch branch list (all users need this for display)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    branchesApi.getAll()
      .then(r => setBranches(r.data.branches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectBranch = useCallback((id: number | null) => {
    if (!isSuperAdmin) return;
    setSelectedId(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, [isSuperAdmin]);

  const selectedBranch = branches.find(b => b.id === selectedId) || null;

  return {
    branches,
    loading,
    selectedId,
    selectedBranch,
    selectBranch,
    isSuperAdmin,
    currentBranchName: isSuperAdmin
      ? (selectedBranch?.name || 'All Branches')
      : (branches.find(b => b.id === user?.branch_id)?.name || ''),
  };
}
