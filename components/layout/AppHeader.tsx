
import React from 'react';
import { Menu, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export const AppHeader = ({
  onBack,
  canGoBack,
  onMenuClick,
  title = "Interior Estimate Form",
  breadcrumbs = ["Estimates"]
}: {
  onBack?: () => void,
  canGoBack?: boolean,
  onMenuClick?: () => void,
  title?: string,
  breadcrumbs?: string[]
}) => {
  const { t } = useTranslation();
  return (
  <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-16 md:h-20 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm print:hidden transition-colors">
    <div className="flex items-center gap-3 md:gap-4">
       {/* Mobile Menu Button - Visible on Mobile and Tablet (below lg) */}
       <button 
         onClick={onMenuClick}
         className="lg:hidden p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
       >
         <Menu className="w-6 h-6" />
       </button>

       {/* Back Button */}
       <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
         <button 
            onClick={canGoBack ? onBack : undefined}
            disabled={!canGoBack}
            className={`p-2 rounded-full transition-colors ${canGoBack ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer' : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'}`}
         >
            <ArrowLeft className="w-6 h-6" />
         </button>
         <button className="p-2 rounded-full text-gray-200 dark:text-gray-700 cursor-not-allowed hidden md:block"><ArrowRight className="w-6 h-6" /></button>
       </div>
       
       <div className="h-6 md:h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
       
       {/* Title Area */}
       <div className="flex items-center gap-2 md:gap-3 text-base md:text-lg font-medium text-gray-600 dark:text-gray-400 truncate">
          {breadcrumbs.map((crumb, index) => (
             <React.Fragment key={index}>
               <span className="hidden md:inline hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer transition-colors">{crumb}</span>
               <span className="hidden md:inline text-gray-300 dark:text-gray-600">|</span>
             </React.Fragment>
          ))}
          <span className="text-gray-900 dark:text-white font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-2 md:px-3 py-1 rounded-lg text-sm md:text-base truncate">{title}</span>
       </div>
    </div>
    
    {/* Right Actions */}
    <div className="flex items-center gap-3 md:gap-6">
       <div className="w-64 hidden md:block">
         <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder={t('layout.AppHeader.searchPlaceholder')}
              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-transparent group-hover:bg-white dark:group-hover:bg-gray-700 group-hover:border-gray-200 dark:group-hover:border-gray-600 rounded-lg text-base focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400 text-gray-900 dark:text-white transition-all"
            />
         </div>
       </div>
    </div>
  </header>
  );
};

export default AppHeader;
