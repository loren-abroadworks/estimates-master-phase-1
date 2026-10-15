import React from 'react';
import { Plus, Star } from 'lucide-react';
import { useTranslation } from '../../../i18n/LanguageContext';

export interface PackageTab {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
}

interface PackageSwitcherProps {
  packages: PackageTab[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRecommended: (id: string) => void;
}

export const PackageSwitcher: React.FC<PackageSwitcherProps> = ({
  packages, activeId, onSwitch, onAdd, onDuplicate, onRename, onDelete, onToggleRecommended,
}) => {
  const { t } = useTranslation();
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  return (
    <div className="flex items-center gap-2 flex-wrap px-3 pb-3 pt-2">
      {packages.map((p) => {
        const isActive = p.id === activeId;
        const starClass = p.isRecommended
          ? 'text-amber-400 fill-amber-400'
          : isActive ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-amber-400';
        return (
          <div
            key={p.id}
            className={`group relative flex items-center overflow-hidden rounded-xl text-sm font-bold transition-all ${
              isActive
                ? 'bg-primary-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleRecommended(p.id); }}
              aria-label={t('packageSwitcher.recommend')}
              aria-pressed={p.isRecommended}
              title={t('packageSwitcher.recommend')}
              className="pl-3 pr-1 py-2"
            >
              <Star data-testid={p.isRecommended ? `recommended-${p.id}` : undefined} className={`w-3.5 h-3.5 transition-colors ${starClass}`} />
            </button>
            <button
              onClick={() => onSwitch(p.id)}
              className={`flex items-center gap-2 pl-1 pr-4 py-2 ${isActive ? '' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              <span>{p.name}</span>
              <span className={`text-xs font-semibold ${isActive ? 'text-white/80' : 'text-gray-400'}`}>{fmt(p.total)}</span>
            </button>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        aria-label={t('packageSwitcher.addPackage')}
        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
      >
        <Plus className="w-4 h-4" /> {t('packageSwitcher.add')}
      </button>
      {/* Per-package actions for the active package */}
      <div className="ml-auto flex items-center gap-2 text-xs">
        <button onClick={() => onRename(activeId)} className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300">{t('packageSwitcher.rename')}</button>
        <button onClick={() => onDuplicate(activeId)} className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300">{t('packageSwitcher.duplicate')}</button>
        {packages.length > 1 && (
          <button onClick={() => onDelete(activeId)} className="px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-red-500">{t('packageSwitcher.delete')}</button>
        )}
      </div>
    </div>
  );
};
