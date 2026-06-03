'use client';
import { Menu, Sun, Moon, GitBranch, ChevronDown } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { isDark, toggle }  = useTheme();
  const { user, isAdmin }   = useAuth();
  const { branches, selectedId, selectedBranch, selectBranch, isSuperAdmin, currentBranchName } = useBranch();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-white hidden sm:block tracking-tight">
          {title}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Branch selector — only for super-admin */}
        {isSuperAdmin && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              <span className="max-w-[120px] truncate">{currentBranchName}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => { selectBranch(null); setDropdownOpen(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm font-medium transition-colors',
                    selectedId === null
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  All Branches
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700" />
                {branches.filter(b => b.is_active).map(b => (
                  <button
                    key={b.id}
                    onClick={() => { selectBranch(b.id); setDropdownOpen(false); }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors',
                      selectedId === b.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {b.name}
                    {b.location && <span className="text-xs text-gray-400 ml-1">— {b.location}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Branch badge for regular users */}
        {!isSuperAdmin && user?.branch_id && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium">
            <GitBranch className="w-3.5 h-3.5" />
            <span className="max-w-[100px] truncate">
              {branches.find(b => b.id === user.branch_id)?.name || 'Branch'}
            </span>
          </div>
        )}

        <button
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          {isDark
            ? <Sun className="w-[18px] h-[18px]" />
            : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <div className="flex items-center gap-3 pl-3 ml-1 border-l border-gray-200 dark:border-gray-700">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{user?.name}</p>
            <p className={cn(
              'text-[11px] font-semibold capitalize',
              isAdmin ? 'text-blue-600' : 'text-emerald-500'
            )}>
              {user?.role}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {user?.name?.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
