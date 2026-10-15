
import React, { useState } from 'react';
import { Plus, MonitorPlay, MoreVertical, Edit2, Trash2, Copy, Search, LayoutTemplate, Clock, Link2, FileText } from 'lucide-react';
import { Button, Card, SearchInput, KebabMenu, Badge } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { CreatePresentationModal } from '../modals/CreatePresentationModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface PresentationsDashboardViewProps {
  onCreate: () => void;
  onEdit: (id: string) => void;
}

const MOCK_PRESENTATIONS = [
    { 
        id: 'pres-1', 
        title: 'Interior Template', 
        updated: '2 hours ago', 
        thumbnail: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800',
        status: 'Draft',
        linkedEstimate: 'Interior'
    },
    { 
        id: 'pres-2', 
        title: 'Commercial Exterior Template', 
        updated: '1 day ago', 
        thumbnail: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800',
        status: 'Published',
        linkedEstimate: 'Exterior'
    },
    { 
        id: 'pres-3', 
        title: 'Commercial Template', 
        updated: '3 days ago', 
        thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800',
        status: 'Draft',
        linkedEstimate: 'Commercial'
    },
    { 
        id: 'pres-4', 
        title: 'Residential Template', 
        updated: '1 week ago', 
        thumbnail: 'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&q=80&w=800',
        status: 'Draft',
        linkedEstimate: 'Residential'
    },
];

export const PresentationsDashboardView = ({ onCreate, onEdit }: PresentationsDashboardViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredPresentations = MOCK_PRESENTATIONS.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNew = (name: string, templateSources: string[]) => {
      // In a real app, use name and sources to initialize
      console.log("Creating presentation:", name, templateSources);
      onCreate();
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      <CreatePresentationModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreate={handleCreateNew} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.PresentationsDashboardView.pageTitle')}</h1>
          <p className={Typography.lead}>{t('views.PresentationsDashboardView.pageSubtitle')}</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} size="lg" className="w-full md:w-auto shadow-xl shadow-primary-500/20">
            <Plus className="w-5 h-5 mr-2" /> {t('views.PresentationsDashboardView.create')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('views.PresentationsDashboardView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      {filteredPresentations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* Presentation Cards */}
            {filteredPresentations.map(pres => (
                <div 
                    key={pres.id} 
                    className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden flex flex-col cursor-pointer"
                    onClick={() => onEdit(pres.id)}
                >
                    <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative overflow-hidden group-hover:shadow-inner">
                        {/* Background Image (Hero) */}
                        <img src={pres.thumbnail} alt={pres.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                        
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 z-20">
                            <Badge color={pres.status === 'Published' ? 'green' : 'gray'}>{pres.status}</Badge>
                        </div>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors line-clamp-2">{pres.title}</h3>
                            <div onClick={e => e.stopPropagation()}>
                                <KebabMenu items={[
                                    { label: t('views.PresentationsDashboardView.menuEdit'), icon: Edit2, onClick: () => onEdit(pres.id) },
                                    { label: t('views.PresentationsDashboardView.menuDuplicate'), icon: Copy, onClick: () => {} },
                                    { label: t('views.PresentationsDashboardView.menuDelete'), icon: Trash2, onClick: () => {}, className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                                ]} />
                            </div>
                        </div>
                        
                        <div className="mt-auto space-y-3">
                            {/* Template Tag */}
                            <div className="flex flex-wrap gap-2">
                                 <Badge color="blue" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800 uppercase tracking-wider text-[10px]">
                                    {pres.linkedEstimate}
                                 </Badge>
                            </div>

                            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{pres.updated}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <LayoutTemplate className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('views.PresentationsDashboardView.emptyTitle')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{t('views.PresentationsDashboardView.emptyBody')}</p>
            <Button onClick={() => setIsCreateModalOpen(true)} variant="secondary" className="mt-6 w-full md:w-auto">{t('views.PresentationsDashboardView.createFirst')}</Button>
        </div>
      )}
    </div>
  );
};
