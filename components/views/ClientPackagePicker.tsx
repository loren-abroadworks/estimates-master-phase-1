import React from 'react';
import { Star, Check } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export interface PickerPackage {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
}

interface ClientPackagePickerProps {
  packages: PickerPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  showPrice?: boolean;
}

export const ClientPackagePicker: React.FC<ClientPackagePickerProps> = ({ packages, selectedId, onSelect, orientation = 'horizontal', showPrice = true }) => {
  const { t } = useTranslation();
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const isVertical = orientation === 'vertical';
  return (
    <div className={`flex gap-2.5 print:hidden ${isVertical ? 'flex-col' : 'flex-wrap justify-center'}`}>
      {packages.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(p.id)}
            className={`group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all ${
              isVertical ? 'w-full' : 'min-w-[9rem]'
            } ${
              isSelected
                ? 'border-primary-500 bg-primary-50 shadow-md shadow-primary-500/10'
                : p.isRecommended
                  ? 'border-amber-300 bg-amber-50/50 shadow-sm shadow-amber-500/10 hover:border-amber-400'
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
            }`}
          >
            {p.isRecommended && (
              <span
                data-testid={`pick-recommended-${p.id}`}
                className="inline-flex items-center gap-1 self-start rounded-full bg-amber-400 text-amber-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm"
              >
                <Star className="w-3 h-3 fill-amber-950" /> {t('packageComparison.recommended')}
              </span>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider truncate min-w-0 ${isSelected ? 'text-primary-700' : 'text-gray-500'}`}>{p.name}</span>
              <span
                aria-hidden
                className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-gray-300 text-transparent group-hover:border-primary-300'
                }`}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            </div>
            {showPrice && (
              <span className={`text-2xl font-black tracking-tight leading-none ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>{fmt(p.total)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
