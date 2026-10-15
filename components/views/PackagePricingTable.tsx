import React from 'react';
import { Star, Check } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export interface PricingPackage {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
  description?: string;
}

interface PackagePricingTableProps {
  packages: PricingPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const PackagePricingTable: React.FC<PackagePricingTableProps> = ({ packages, selectedId, onSelect }) => {
  const { t } = useTranslation();
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // One row up to 4 packages wide; rows of 4 thereafter. Full literal classes so
  // Tailwind keeps them, and lower breakpoints stay readable (1 then 2 columns).
  const cols = Math.min(packages.length, 4);
  const lgCols = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[cols] || 'lg:grid-cols-4';

  return (
    <div className={`grid gap-6 items-stretch grid-cols-1 sm:grid-cols-2 ${lgCols}`}>
      {packages.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col w-full rounded-3xl border bg-white p-6 transition-all ${
              isSelected
                ? 'border-primary-500 ring-2 ring-primary-500/30 shadow-xl shadow-primary-500/10'
                : p.isRecommended
                  ? 'border-amber-300 shadow-lg shadow-amber-500/10'
                  : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
            }`}
          >
            {p.isRecommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-sm">
                <Star className="w-3 h-3 fill-amber-950" /> {t('packageComparison.recommended')}
              </span>
            )}

            <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-2">{p.name}</div>
            <div className={`mt-2 text-4xl font-black tracking-tight ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>{fmt(p.total)}</div>
            {p.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{p.description}</p>
            )}

            <div className="flex-1 min-h-[1.5rem]" />

            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={isSelected}
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-primary-50 hover:text-primary-700'
              }`}
            >
              {isSelected ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" strokeWidth={3} /> {t('packageComparison.selected')}
                </span>
              ) : (
                t('packageComparison.selectName', { name: p.name })
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};
