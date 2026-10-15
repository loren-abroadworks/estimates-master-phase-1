
import React, { useState } from 'react';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Briefcase, Archive, Trash2, Edit2, Star, Check, User, FileText, MoreVertical, X, Send, Clock
} from 'lucide-react';
import { Button, Badge, KebabMenu } from '../UI';
import { Lead, Client, LeadStatus, Appointment } from '../../types';
import { AddLeadModal } from '../modals/AddLeadModal';
import { ScheduleEstimateModal } from '../modals/ScheduleEstimateModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { Typography, Spacing } from '../../theme/designSystem';
import { MOCK_SALESMEN } from '../../data/mockData';
import { useTranslation } from '@/i18n/LanguageContext';

interface LeadDetailViewProps {
  lead: Lead;
  allLeads: Lead[];
  allClients: Client[];
  onBack: () => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
  onConvert: (id: string) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onSchedule?: (appointment: Appointment) => void;
}

export const LeadDetailView = ({ 
  lead, 
  allLeads,
  allClients,
  onBack, 
  onUpdateStatus, 
  onConvert, 
  onEditLead, 
  onDeleteLead,
  onSchedule
}: LeadDetailViewProps) => {
  const { t } = useTranslation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Note State
  const [newNote, setNewNote] = useState('');
  
  const handleArchive = () => {
    onUpdateStatus(lead.id, 'Archived');
    onBack();
  };

  const handleDelete = () => {
    onDeleteLead(lead.id);
    onBack();
  };

  const handleAddNote = () => {
      if (!newNote.trim()) return;
      
      const timestamp = new Date().toLocaleString();
      const entry = `[${timestamp}] ${newNote}`;
      const updatedNotes = lead.notes ? `${entry}\n\n${lead.notes}` : entry;
      
      onEditLead({ ...lead, notes: updatedNotes });
      setNewNote('');
  };

  const handleRatingChange = (rating: number) => {
      onEditLead({ ...lead, qualityRating: rating });
  };

  const PIPELINE_STEPS = ['New', 'Contacted', 'Scheduled', 'Pending', 'Sold', 'Lost'];

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      {/* Modals */}
      <AddLeadModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={onEditLead}
        existingLeads={allLeads}
        existingClients={allClients}
        leadToEdit={lead}
      />
      
      <ScheduleEstimateModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        entityId={lead.id}
        entityType="Lead"
        entityName={`${lead.firstName} ${lead.lastName}`}
        address={lead.address}
        salesStaff={MOCK_SALESMEN as any} 
        onSave={(apt) => {
            if (onSchedule) onSchedule(apt);
            setIsScheduleModalOpen(false);
        }}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('views.LeadDetailView.deleteLead')}
        message={t('views.LeadDetailView.deleteLeadConfirm')}
      />

      {/* Back Link */}
      <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-2 mb-6 font-bold text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('views.LeadDetailView.backToPipeline')}
      </button>

      {/* --- HEADER --- */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              
              {/* Profile Info */}
              <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-3xl border border-blue-100 dark:border-blue-800 shrink-0">
                      {lead.firstName.charAt(0)}
                  </div>
                  <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-heading leading-tight">
                            {lead.firstName} {lead.lastName}
                        </h1>
                        <div className="flex items-center gap-0.5 group">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => handleRatingChange(star)}
                                    className="focus:outline-none transition-transform active:scale-90 hover:scale-110"
                                    title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                >
                                    <Star 
                                        className={`w-5 h-5 transition-colors ${
                                            (lead.qualityRating || 0) >= star 
                                            ? 'fill-amber-400 text-amber-400' 
                                            : 'text-gray-300 dark:text-gray-600 hover:text-amber-200 dark:hover:text-amber-500'
                                        }`} 
                                    />
                                </button>
                            ))}
                            {(lead.qualityRating || 0) > 0 && (
                                <button 
                                    onClick={() => handleRatingChange(0)} 
                                    className="ml-1 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={t('views.LeadDetailView.clearRating')}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {lead.city ? `${lead.city}, ${lead.state}` : t('views.LeadDetailView.noLocation')}
                          </div>
                          <Badge color="gray" className="uppercase text-[10px] tracking-wider">{lead.source || 'Website'}</Badge>
                          <span className="text-gray-400 dark:text-gray-500">{t('views.LeadDetailView.createdDate', { date: new Date(lead.date).toLocaleDateString() })}</span>
                      </div>
                  </div>
              </div>

              {/* Actions Toolbar */}
              <div className="flex flex-wrap gap-3 items-center self-start lg:self-center mt-4 lg:mt-0">
                  <Button 
                    onClick={() => setIsScheduleModalOpen(true)}
                    variant="secondary"
                    size="lg"
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                      <Calendar className="w-5 h-5 mr-2" /> {t('views.LeadDetailView.schedule')}
                  </Button>

                  <Button 
                    onClick={() => onConvert(lead.id)}
                    variant="primary"
                    size="lg"
                    className="shadow-md shadow-primary-500/20"
                  >
                      <Briefcase className="w-5 h-5 mr-2" /> {t('views.LeadDetailView.convert')}
                  </Button>
                  
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center w-12 h-12 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                    <KebabMenu 
                        items={[
                            { label: t('views.LeadDetailView.editLead'), icon: Edit2, onClick: () => setIsEditModalOpen(true) },
                            { label: t('views.LeadDetailView.archiveLead'), icon: Archive, onClick: handleArchive },
                            { label: t('views.LeadDetailView.deleteLead'), icon: Trash2, onClick: () => setIsDeleteModalOpen(true), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                        ]}
                    />
                  </div>
              </div>
          </div>

          {/* Pipeline Status Bar */}
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
              <div className="flex w-full bg-gray-50 dark:bg-gray-900 rounded-xl p-1 gap-1 overflow-x-auto hide-scrollbar">
                  {PIPELINE_STEPS.map((step) => {
                      const isActive = lead.status === step;
                      return (
                          <button
                              key={step}
                              onClick={() => onUpdateStatus(lead.id, step as LeadStatus)}
                              className={`
                                flex-1 min-w-[100px] py-3 px-4 rounded-lg text-sm font-bold text-center transition-all flex items-center justify-center gap-2 whitespace-nowrap
                                ${isActive 
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
                                }
                              `}
                          >
                              {isActive && <Check className="w-4 h-4" />}
                              {step}
                          </button>
                      )
                  })}
              </div>
          </div>
      </div>

      {/* --- MAIN GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* --- LEFT COLUMN --- */}
          <div className="space-y-8">
              
              {/* Contact Info Card */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6 text-gray-500 dark:text-gray-400">
                      <User className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('views.LeadDetailView.contactInformation')}</span>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                              <Phone className="w-5 h-5" />
                          </div>
                          <div>
                              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">{t('views.LeadDetailView.phone')}</div>
                              <div className="text-gray-900 dark:text-white font-bold text-lg">{lead.phone}</div>
                          </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl flex items-center gap-4">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                              <Mail className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">{t('views.LeadDetailView.email')}</div>
                              <div className="text-gray-900 dark:text-white font-bold text-lg truncate w-full">{lead.email}</div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Job Location Card */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6 text-gray-500 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('views.LeadDetailView.jobLocation')}</span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-700/50 mb-6">
                      <div className="font-bold text-gray-900 dark:text-white text-lg mb-1">{lead.address}</div>
                      <div className="text-gray-500 dark:text-gray-400">{lead.city}, {lead.state} {lead.zip}</div>
                  </div>

                  {/* Map View */}
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden mb-6 border border-gray-200 dark:border-gray-700 relative group">
                      <iframe 
                          width="100%" 
                          height="100%" 
                          frameBorder="0" 
                          scrolling="no" 
                          marginHeight={0} 
                          marginWidth={0} 
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(`${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                          className="filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                          title={t('views.LeadDetailView.jobLocationMap')}
                      />
                      <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('views.LeadDetailView.autoId')}</span>
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold font-mono">{lead.generatedJobId || lead.id}</span>
                  </div>
              </div>
          </div>

          {/* --- RIGHT COLUMN (NOTES) --- */}
          <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Add New Note Card */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-gray-500 dark:text-gray-400">
                      <Edit2 className="w-4 h-4" />
                      <div className="text-xs font-bold uppercase tracking-widest">{t('views.LeadDetailView.addNewNote')}</div>
                  </div>
                  <div className="relative">
                      <textarea 
                          className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl resize-none outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-300 dark:focus:border-primary-600 transition-all text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                          placeholder={t('views.LeadDetailView.notePlaceholder')}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                      />
                      <div className="absolute bottom-3 right-3">
                          <button 
                            onClick={handleAddNote}
                            disabled={!newNote.trim()}
                            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors shadow-sm"
                          >
                              <Send className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              </div>

              {/* Notes History Feed */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-6 text-gray-500 dark:text-gray-400">
                      <FileText className="w-4 h-4" />
                      <div className="text-xs font-bold uppercase tracking-widest">{t('views.LeadDetailView.notesHistory')}</div>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                      {lead.notes ? (
                          lead.notes.split('\n\n').map((noteSegment, idx) => {
                              // Basic parsing to try and extract timestamp if formatted like "[Date] Note"
                              const match = noteSegment.match(/^\[(.*?)\]\s(.*)/s);
                              const timestamp = match ? match[1] : t('views.LeadDetailView.previousNote');
                              const content = match ? match[2] : noteSegment;

                              return (
                                  <div key={idx} className="flex gap-4 group">
                                      <div className="flex flex-col items-center">
                                          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 mt-2 ring-4 ring-white dark:ring-gray-800" />
                                          <div className="w-px h-full bg-gray-100 dark:bg-gray-700 my-1 group-last:hidden" />
                                      </div>
                                      <div className="flex-1 pb-4">
                                          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                              {timestamp}
                                          </div>
                                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                              {content}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
                      ) : (
                          <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic text-sm">
                              {t('views.LeadDetailView.noNotesYet')}
                          </div>
                      )}
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
