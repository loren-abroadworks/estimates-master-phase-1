
import React, { useState, useRef, useEffect } from 'react';
import { Plus, UserPlus, Phone, Mail, MapPin, ArrowRight, Loader2, GripVertical, Check, Briefcase, Archive, RotateCcw, Filter, XCircle, Star, LayoutGrid, List, Calendar, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Button, Card, Badge, SearchInput, KebabMenu } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { Lead, LeadStatus, PipelineStage } from '../../types';
import { AddLeadModal } from '../modals/AddLeadModal';
import { DEFAULT_PIPELINE_STAGES } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface LeadsDashboardViewProps {
  leads: Lead[];
  clients: any[]; // Passed to modal for duplicate check
  pipelineStages?: PipelineStage[];
  onAddLead: (lead: Lead) => void;
  onConvertLead: (leadId: string) => void;
  onUpdateLeadStatus?: (leadId: string, status: LeadStatus) => void;
  onViewLead?: (leadId: string) => void;
  onEditLead?: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
}

// Updated Next Stage Logic
const NEXT_STAGE_MAP: Record<string, LeadStatus | null> = {
    'New': 'Contacted',
    'Contacted': 'Scheduled',
    'Scheduled': 'Pending',
    'Pending': 'Sold',
    'Sold': null,
};

export const LeadsDashboardView = ({ leads, clients, pipelineStages, onAddLead, onConvertLead, onUpdateLeadStatus, onViewLead, onEditLead, onDeleteLead }: LeadsDashboardViewProps) => {
  const { t } = useTranslation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  
  // Drag over state for visual effect
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // New States for Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [viewArchived, setViewArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  
  // Scroll Container Ref for Drag-to-Scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Modal Editing State
  const [leadToEdit, setLeadToEdit] = useState<Lead | undefined>(undefined);

  // Filter out archived stages. Keep 'Sold' on board as success state.
  const activeStages = (pipelineStages || DEFAULT_PIPELINE_STAGES).filter(
      stage => !['Lost', 'Archived'].includes(stage.id)
  );

  useEffect(() => {
    const handleGlobalDragEnd = () => {
        setDraggedLeadId(null);
        setDragOverColumnId(null);
    };
    
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const handleEditClick = (lead: Lead) => {
      setLeadToEdit(lead);
      setIsAddModalOpen(true);
  }

  const handleDeleteClick = (id: string) => {
      if (onDeleteLead && window.confirm(t('views.LeadsDashboardView.confirmDeleteLead'))) {
          onDeleteLead(id);
      }
  }

  const handleConvertClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setConvertingId(id);
      setTimeout(() => {
          if (onUpdateLeadStatus) {
              onUpdateLeadStatus(id, 'Sold');
          }
          setConvertingId(null);
      }, 600);
  };

  const handleNextStageClick = (e: React.MouseEvent, lead: Lead) => {
      e.stopPropagation();
      const nextStatus = NEXT_STAGE_MAP[lead.status];
      if (nextStatus && onUpdateLeadStatus) {
          onUpdateLeadStatus(lead.id, nextStatus);
      }
  };

  const handleArchiveClick = (e: React.MouseEvent, leadId: string) => {
      e.stopPropagation();
      if (onUpdateLeadStatus) {
          onUpdateLeadStatus(leadId, 'Archived');
      }
  };

  const handleLostClick = (e: React.MouseEvent, leadId: string) => {
      e.stopPropagation();
      if (onUpdateLeadStatus) {
          onUpdateLeadStatus(leadId, 'Lost');
      }
  };

  const handleRestoreClick = (e: React.MouseEvent, leadId: string) => {
      e.stopPropagation();
      if (onUpdateLeadStatus) {
          onUpdateLeadStatus(leadId, 'New'); // Restore to 'New' by default
      }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
      setDraggedLeadId(leadId);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      
      // Drag-to-Scroll Logic (Only active in Kanban)
      if (viewMode === 'kanban') {
        const container = scrollContainerRef.current;
        if (container) {
            const { left, right } = container.getBoundingClientRect();
            // Responsive threshold: smaller edge detection for mobile
            const threshold = window.innerWidth < 768 ? 80 : 150; 
            const speed = window.innerWidth < 768 ? 8 : 15; 

            if (e.clientX > right - threshold) {
                container.scrollLeft += speed;
            } else if (e.clientX < left + threshold) {
                container.scrollLeft -= speed;
            }
        }
      }
  };

  const handleColumnDragOver = (e: React.DragEvent, stageId: string) => {
      e.preventDefault();
      // Only update if changed to prevent render spam, though React batches
      if (draggedLeadId && dragOverColumnId !== stageId) {
          setDragOverColumnId(stageId);
      }
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
      e.preventDefault();
      if (draggedLeadId && onUpdateLeadStatus) {
          onUpdateLeadStatus(draggedLeadId, status as LeadStatus);
      }
      setDraggedLeadId(null);
      setDragOverColumnId(null);
  };

  // Helper to calculate time ago
  const getTimeAgo = (dateStr: string) => {
      const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      return `${days} days ago`;
  };

  // Filtering Logic
  const filteredLeads = leads.filter(lead => {
      const matchesSearch = 
          (lead.firstName + ' ' + lead.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.city?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Lost, Archived, and Converted are treated as "Archived" view items. Sold is kept on active board.
      const isArchived = ['Archived', 'Lost', 'Converted'].includes(lead.status);
      const matchesView = viewArchived ? isArchived : !isArchived;

      return matchesSearch && matchesView;
  });

  return (
    <div id="leads-pipeline-board" className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8 flex flex-col`}>
      <AddLeadModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setLeadToEdit(undefined); }} 
        onSave={(l) => {
            if (leadToEdit && onEditLead) onEditLead(l);
            else onAddLead(l);
        }}
        existingLeads={leads}
        existingClients={clients}
        leadToEdit={leadToEdit}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 flex-shrink-0 w-full">
        <div className="max-w-2xl">
          <h1 className={`${Typography.h1} mb-4`}>{t('views.LeadsDashboardView.leadPipeline')}</h1>
          <p className={Typography.lead}>{t('views.LeadsDashboardView.leadPipelineDesc')}</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto md:ml-auto justify-start md:justify-end">
            <Button 
                onClick={() => setViewArchived(!viewArchived)} 
                variant="secondary" 
                size="lg"
                className={`w-full md:w-auto h-14 ${viewArchived ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 shadow-inner' : ''}`}
            >
                <Archive className="w-5 h-5 mr-2" /> 
                {viewArchived ? t('views.LeadsDashboardView.viewActive') : t('views.LeadsDashboardView.viewArchived')}
            </Button>
            <Button onClick={() => { setLeadToEdit(undefined); setIsAddModalOpen(true); }} size="lg" className="w-full md:w-auto h-14 shadow-xl shadow-primary-500/20">
                <UserPlus className="w-5 h-5" /> {t('views.LeadsDashboardView.addNewLead')}
            </Button>
        </div>
      </div>

      {/* Toolbar: Search + View Toggle */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between items-center">
          <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.LeadsDashboardView.searchPlaceholder')}
              className="w-full lg:max-w-md"
          />
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 self-start lg:self-auto w-full lg:w-auto">
              <button 
                onClick={() => setViewMode('kanban')}
                className={`flex-1 lg:flex-none p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                title={t('views.LeadsDashboardView.kanbanBoardView')}
              >
                  <LayoutGrid className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase hidden sm:inline">{t('views.LeadsDashboardView.boardLabel')}</span>
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`flex-1 lg:flex-none p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                title={t('views.LeadsDashboardView.tableView')}
              >
                  <List className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase hidden sm:inline">{t('views.LeadsDashboardView.tableLabel')}</span>
              </button>
          </div>
      </div>

      {/* View Header for Archived State */}
      {viewArchived && (
          <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Archive className="w-5 h-5" /> {t('views.LeadsDashboardView.archivedLeads')}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('views.LeadsDashboardView.showingArchivedItems', { count: filteredLeads.length })}</span>
          </div>
      )}

      {/* Main Content Area */}
      <div 
        ref={scrollContainerRef}
        onDragOver={handleDragOver}
        className="flex-1 overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth"
      >
          {viewArchived ? (
              // List View for Archived (Existing)
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLeads.map(lead => (
                      <div key={lead.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white">{lead.firstName} {lead.lastName}</h3>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{lead.email}</div>
                              </div>
                              <button 
                                  onClick={(e) => handleRestoreClick(e, lead.id)}
                                  className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                                  title={t('views.LeadsDashboardView.restoreLeadToNew')}
                              >
                                  <RotateCcw className="w-4 h-4" />
                              </button>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                              <Badge color={
                                  (lead.status === 'Sold' || lead.status === 'Converted') ? 'green' : 
                                  (lead.status === 'Lost' ? 'red' : 'gray')
                              }>
                                  {lead.status}
                              </Badge>
                              <span className="text-xs text-gray-400">{getTimeAgo(lead.date)}</span>
                          </div>
                      </div>
                  ))}
                  {filteredLeads.length === 0 && (
                      <div className="col-span-full text-center py-12 text-gray-400 italic">{t('views.LeadsDashboardView.noArchivedLeads')}</div>
                  )}
              </div>
          ) : viewMode === 'table' ? (
              // New Table View
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm min-w-[900px]">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider w-[25%]">{t('views.LeadsDashboardView.colLeadName')}</th>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.LeadsDashboardView.colStatus')}</th>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.LeadsDashboardView.colContact')}</th>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.LeadsDashboardView.colLocation')}</th>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.LeadsDashboardView.colSource')}</th>
                              <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.LeadsDashboardView.colCreated')}</th>
                              <th className="px-6 py-4 text-right w-20"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                         {filteredLeads.map(lead => (
                             <tr key={lead.id} onClick={() => onViewLead && onViewLead(lead.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                                 <td className="px-6 py-4">
                                     <div className="flex items-center gap-2">
                                         <span className="font-bold text-gray-900 dark:text-white text-base">{lead.firstName} {lead.lastName}</span>
                                         {(lead.qualityRating || 0) > 0 && (
                                            <div className="flex items-center text-amber-400">
                                                <span className="text-xs font-bold text-amber-700 dark:text-amber-500 mr-0.5">{lead.qualityRating}</span>
                                                <Star className="w-3 h-3 fill-current" />
                                            </div>
                                         )}
                                     </div>
                                 </td>
                                 <td className="px-6 py-4">
                                     <Badge color={
                                         lead.status === 'New' ? 'blue' : 
                                         lead.status === 'Contacted' ? 'gray' : 
                                         lead.status === 'Scheduled' ? 'amber' : 
                                         lead.status === 'Pending' ? 'purple' : 
                                         (lead.status === 'Lost' ? 'red' : 
                                         (lead.status === 'Archived' ? 'gray' : 'green'))
                                     }>
                                         {lead.status}
                                     </Badge>
                                 </td>
                                 <td className="px-6 py-4">
                                     <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400 gap-0.5">
                                         <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {lead.phone}</div>
                                         <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {lead.email}</div>
                                     </div>
                                 </td>
                                 <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                     {lead.city}, {lead.state}
                                 </td>
                                 <td className="px-6 py-4">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                         {lead.source}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                     {new Date(lead.date).toLocaleDateString()}
                                 </td>
                                 <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                     <KebabMenu 
                                        items={[
                                            { label: t('views.LeadsDashboardView.menuEdit'), icon: Edit2, onClick: () => handleEditClick(lead) },
                                            { label: t('views.LeadsDashboardView.menuMarkAsSold'), icon: Briefcase, onClick: () => {
                                                setConvertingId(lead.id);
                                                setTimeout(() => { if (onUpdateLeadStatus) onUpdateLeadStatus(lead.id, 'Sold'); setConvertingId(null); }, 500);
                                            }},
                                            { label: t('views.LeadsDashboardView.menuArchive'), icon: Archive, onClick: () => onUpdateLeadStatus && onUpdateLeadStatus(lead.id, 'Archived') },
                                            { label: t('views.LeadsDashboardView.menuDelete'), icon: Trash2, onClick: () => handleDeleteClick(lead.id), className: 'text-red-600 hover:bg-red-50' }
                                        ]}
                                     />
                                 </td>
                             </tr>
                         ))}
                         {filteredLeads.length === 0 && (
                             <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">{t('views.LeadsDashboardView.noLeadsFound')}</td></tr>
                         )}
                      </tbody>
                  </table>
              </div>
          ) : (
              // Kanban View
              <div className="flex gap-6 min-w-[1000px] w-full h-full">
                  {activeStages.map((stage) => {
                      const stageLeads = filteredLeads.filter(l => l.status === stage.id);
                      const isDropTarget = dragOverColumnId === stage.id;

                      return (
                          <div 
                            key={stage.id} 
                            className={`flex-1 min-w-[280px] flex flex-col rounded-2xl bg-gray-50/50 dark:bg-gray-800/50 border transition-colors duration-200
                                ${isDropTarget 
                                    ? 'bg-primary-50/80 dark:bg-primary-900/20 border-primary-300 ring-2 ring-primary-200' 
                                    : 'border-transparent'
                                }
                                ${draggedLeadId && !isDropTarget ? 'border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/50 dark:hover:bg-gray-700/50' : ''}
                            `}
                            onDragOver={(e) => handleColumnDragOver(e, stage.id)}
                            onDrop={(e) => handleDrop(e, stage.id)}
                          >
                              {/* Column Header */}
                              <div className={`stage-header p-4 rounded-t-2xl border-b-4 ${stage.border} bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center mb-4`}>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide">{stage.label}</h3>
                                  <span className={`stage-count text-xs font-bold px-2 py-1 rounded-full ${stage.color}`}>
                                      {stageLeads.length}
                                  </span>
                              </div>

                              {/* Cards Container */}
                              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-3 custom-scrollbar">
                                  {stageLeads.map((lead) => (
                                      <div 
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        onClick={() => onViewLead && onViewLead(lead.id)}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer active:cursor-grabbing group relative"
                                      >
                                          {/* Drag Handle (Visual Only) */}
                                          <div className="absolute top-4 right-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <GripVertical className="w-4 h-4" />
                                          </div>

                                          <div className="mb-3">
                                              <div className="flex justify-between items-start pr-6">
                                                  <div className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-1">
                                                      {lead.firstName} {lead.lastName}
                                                  </div>
                                                  {(lead.qualityRating || 0) > 0 && (
                                                      <div className="flex items-center gap-0.5 text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-800 ml-1">
                                                          <span className="text-xs font-bold text-amber-700 dark:text-amber-500 mr-0.5">{lead.qualityRating}</span>
                                                          <Star className="w-3 h-3 fill-current" />
                                                      </div>
                                                  )}
                                              </div>
                                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1">
                                                  <MapPin className="w-3 h-3" />
                                                  <span className="truncate max-w-[180px]">{lead.city}, {lead.state}</span>
                                              </div>
                                          </div>

                                          <div className="flex flex-wrap gap-2 mb-4">
                                              {/* Date Badge First */}
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                  <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                                                  {new Date(lead.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                              </span>
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                  {lead.source}
                                              </span>
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                  {getTimeAgo(lead.date)}
                                              </span>
                                          </div>

                                          <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700">
                                              <div className="flex gap-1">
                                                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title={lead.phone} onClick={(e) => e.stopPropagation()}>
                                                      <Phone className="w-4 h-4" />
                                                  </button>
                                                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title={lead.email} onClick={(e) => e.stopPropagation()}>
                                                      <Mail className="w-4 h-4" />
                                                  </button>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                  {/* Mark Lost Button */}
                                                  <button
                                                      className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                                      title={t('views.LeadsDashboardView.markAsLost')}
                                                      onClick={(e) => handleLostClick(e, lead.id)}
                                                  >
                                                      <XCircle className="w-4 h-4" />
                                                  </button>

                                                  {/* Archive Button */}
                                                  <button
                                                      className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                                      title={t('views.LeadsDashboardView.archiveLead')}
                                                      onClick={(e) => handleArchiveClick(e, lead.id)}
                                                  >
                                                      <Archive className="w-4 h-4" />
                                                  </button>

                                                  {/* Move Next Button (if available) */}
                                                  {NEXT_STAGE_MAP[lead.status] && (
                                                      <button
                                                          className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition-colors"
                                                          title={t('views.LeadsDashboardView.moveToStage', { stage: NEXT_STAGE_MAP[lead.status] })}
                                                          onClick={(e) => handleNextStageClick(e, lead)}
                                                      >
                                                          <ArrowRight className="w-4 h-4" />
                                                      </button>
                                                  )}

                                                  {/* Convert Button - Primary Style */}
                                                  <Button 
                                                      size="sm"
                                                      variant="primary"
                                                      className="h-9 w-9 !p-0 rounded-full shadow-md shadow-primary-500/20"
                                                      onClick={(e) => handleConvertClick(e, lead.id)}
                                                      disabled={convertingId === lead.id}
                                                      title={t('views.LeadsDashboardView.menuMarkAsSold')}
                                                  >
                                                      {convertingId === lead.id ? (
                                                          <Loader2 className="w-4 h-4 animate-spin" />
                                                      ) : (
                                                          <Briefcase className="w-4 h-4" />
                                                      )}
                                                  </Button>
                                              </div>
                                          </div>
                                      </div>
                                  ))}

                                  {/* Empty State Drop Zone Hint */}
                                  {stageLeads.length === 0 && (
                                      <div className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm font-medium italic transition-colors ${isDropTarget ? 'border-primary-300 bg-primary-50/50' : 'border-gray-200 dark:border-gray-700'}`}>
                                          {t('views.LeadsDashboardView.dropLeadsHere')}
                                      </div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>
    </div>
  );
};
