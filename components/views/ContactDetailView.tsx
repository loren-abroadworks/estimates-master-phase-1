
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Phone, Mail, MapPin, Plus, Building2, Briefcase, Star, Clock, FileText, ChevronDown, MessageSquare, Eye, FileCheck, DollarSign, Send, StickyNote, ArrowUpRight, X, Edit2, Check, Save, ArrowDown, ArrowUp, Calendar, Trash2, Link2, Receipt } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { getSelectedPackage } from '../../services/packages';
import { Button, Card, Badge, Modal, Select, TextArea, KebabMenu } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { Client, ClientProperty, ConfiguredScope, Invoice, WorkOrder, Estimate, Job, Appointment, CrewMember, Lead } from '../../types';
import { AddPropertyModal } from '../modals/AddPropertyModal';
import { CreateEstimateModal } from '../modals/CreateEstimateModal';
import { RichTextEditorModal } from '../modals/RichTextEditorModal';
import { ActiveProjectsModal, LifetimeValueModal } from '../modals/ContactStatsModals';
import { LocationDetailsModal } from '../modals/LocationDetailsModal';
import { ScheduleEstimateModal } from '../modals/ScheduleEstimateModal';
import { AddContactModal } from '../modals/AddContactModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { ClientSelectionModal } from '../modals/ClientSelectionModal';
import { MOCK_SALESMEN } from '../../data/mockData';

interface ContactDetailViewProps {
  client: Client;
  onBack: () => void;
  onAddProperty: (clientId: string, property: ClientProperty) => void;
  onStartEstimate: (client: Client, property: ClientProperty, selection: { type: string, template: string }) => void;
  onStartInvoice?: (client: Client, property: ClientProperty, selection: { type: string, template: string }) => void;
  onCreateInvoice?: () => void;
  scopes: ConfiguredScope[];
  templates: any[];
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  invoices: Invoice[]; 
  workOrders: WorkOrder[]; 
  estimates: Estimate[];
  jobs: Job[];
  onViewInvoice?: (id: string) => void;
  onViewEstimate?: (id: string) => void;
  // New props
  onSaveAppointment?: (apt: Appointment) => void;
  salesStaff?: CrewMember[];
  onViewJob?: (id: string) => void;
  leads?: Lead[];
  onLinkLead?: (leadId: string, clientId: string) => void;
}

const JOB_STAGES = ['ESTIMATE', 'PENDING', 'SOLD', 'PRODUCTION', 'CLOSED', 'MARKETING'];

type SortOption = 'DateNewest' | 'DateOldest' | 'AmountHigh' | 'AmountLow';

// Initial Mock Conversations Data
const INITIAL_CONVERSATIONS = [
    { id: 'c1', type: 'system_paid', title: 'Invoice #1024 Paid', date: 'Today, 10:30 AM', icon: DollarSign, color: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400' },
    { id: 'c2', type: 'email', title: 'Re: Schedule Confirmation', body: 'Great, see you then!', direction: 'inbound', date: 'Yesterday, 4:15 PM', icon: Mail, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'c3', type: 'system_signed', title: 'Estimate #EST-2024-001 Signed', date: 'Yesterday, 2:00 PM', icon: FileCheck, color: 'text-primary-700 bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400' },
    { id: 'c4', type: 'sms', title: 'SMS Message', body: 'Just sent over the estimate for the interior work.', direction: 'outbound', date: 'Jan 15, 9:00 AM', icon: MessageSquare, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
    { id: 'c5', type: 'system_viewed', title: 'Client Viewed Estimate', date: 'Jan 15, 8:45 AM', icon: Eye, color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
];

export const ContactDetailView = ({ 
  client, 
  onBack, 
  onAddProperty, 
  onStartEstimate,
  onStartInvoice, 
  onCreateInvoice, 
  scopes, 
  templates, 
  onEditClient, 
  onDeleteClient,
  invoices, 
  workOrders, 
  estimates, 
  jobs, 
  onViewInvoice, 
  onViewEstimate,
  onSaveAppointment,
  salesStaff,
  onViewJob,
  leads = [],
  onLinkLead
}: ContactDetailViewProps) => {
  const { t } = useTranslation();
  const [isAddPropOpen, setIsAddPropOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isLTVModalOpen, setIsLTVModalOpen] = useState(false);
  const [isActiveProjectsModalOpen, setIsActiveProjectsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  // Location Details Modal State
  const [isLocationDetailsOpen, setIsLocationDetailsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<ClientProperty | null>(null);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'history' | 'conversations' | 'notes'>('history');
  
  // Create Mode State (Estimate vs Invoice)
  const [createMode, setCreateMode] = useState<'estimate' | 'invoice'>('estimate');

  // Job Sorting
  const [jobSortOption, setJobSortOption] = useState<SortOption>('DateNewest');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [timelineItems, setTimelineItems] = useState(INITIAL_CONVERSATIONS);

  // Note State (Replaced old Note Card State)
  const [newNote, setNewNote] = useState('');

  // Create New Menu State
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Messaging State
  const [msgType, setMsgType] = useState<'Email' | 'SMS'>('Email');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  // Edit Modal State
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);

  // Delete State
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  
  // Link Lead State
  const [isLinkLeadModalOpen, setIsLinkLeadModalOpen] = useState(false);

  // Mock staff if not provided
  const staff = salesStaff || MOCK_SALESMEN as unknown as CrewMember[];

  // Fallback for clients list (for duplicate check in modal)
  const clients = [client];

  // --- JOB DATA GENERATION ---
  // Combine Invoices and Estimates to create a comprehensive job list
  const clientJobs = useMemo(() => {
      // Get Invoices for this client
      const relatedInvoices = invoices.filter(inv => inv.clientId === client.id);
      
      const outputJobs = [];
      const processedEstimateIds = new Set<string>();

      // 1. Process Invoices (Usually represent later stages)
      relatedInvoices.forEach(inv => {
          if (inv.estimateId) processedEstimateIds.add(inv.estimateId);
          
          // Resolve Linked Estimate & Job
          const linkedEst = estimates.find(e => e.id === inv.estimateId);
          const linkedJob = jobs.find(j => j.invoiceId === inv.id || (linkedEst && j.estimateId === linkedEst.id));
          
          let statusColor = 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
          let stageIndex = 0; // Default ESTIMATE
          let isEstimateView = false;
          let displayStatus: string = inv.status;
          let isJobView = false;

          // Override status from Job Stage if linked
          if (linkedJob && ['In Production', 'Scheduled', 'Completed'].includes(linkedJob.stage)) {
              displayStatus = linkedJob.stage;
              isJobView = true;
              
              if (linkedJob.stage === 'In Production') {
                  statusColor = 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                  stageIndex = 3;
              } else if (linkedJob.stage === 'Scheduled') {
                  statusColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                  stageIndex = 2; // Sold -> Production
              } else if (linkedJob.stage === 'Completed') {
                  statusColor = 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
                  stageIndex = 4;
              }
          } else {
              // SPECIAL LOGIC based on invoice only: 
              if (inv.status === 'Sent') {
                  if (!linkedEst || (linkedEst.status === 'Approved' || linkedEst.status === 'Paid')) {
                      statusColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                      stageIndex = 2; 
                      displayStatus = 'Invoice Sent';
                      isEstimateView = false; 
                  } else {
                      statusColor = 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                      stageIndex = 1; 
                      displayStatus = 'Estimate Sent';
                      isEstimateView = true;
                  }
              } else if (inv.status === 'Partially Paid') {
                  statusColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                  stageIndex = 2;
              } else if (inv.status === 'Paid') {
                  statusColor = 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
                  stageIndex = 4;
              } else if (inv.status === 'Overdue') {
                  statusColor = 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
                  stageIndex = 4;
              }
          }

          // Resolve Target ID for Click
          const targetId = isJobView && linkedJob ? linkedJob.id : (isEstimateView && linkedEst ? linkedEst.id : inv.id);
          
          // Display the Job Number if available, otherwise the invoice or estimate number
          const displayNumber = linkedJob ? linkedJob.jobNumber : (isEstimateView && linkedEst ? linkedEst.projectInfo.number : inv.number);

          outputJobs.push({
              id: inv.id,
              targetId,
              isEstimate: isEstimateView,
              isJob: isJobView,
              jobId: displayNumber,
              title: inv.projectName,
              address: inv.jobAddress || client.address,
              status: displayStatus, 
              stageIndex,
              created: new Date(inv.createdDate).toLocaleDateString(),
              amount: inv.totalAmount,
              statusColor
          });
      });

      // 2. Process Estimates not covered by invoices (e.g. Drafts)
      const clientEstimates = estimates.filter(est => est.customer.id === client.id);
      
      clientEstimates.forEach(est => {
          if (processedEstimateIds.has(est.id)) return;
          
          const linkedJob = jobs.find(j => j.estimateId === est.id);

          let statusColor = 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
          let stageIndex = 0;
          let displayStatus: string = est.status;
          let isJobView = false;

          if (linkedJob && ['In Production', 'Scheduled', 'Completed'].includes(linkedJob.stage)) {
              // Override if job stage advanced even without invoice (edge case)
              displayStatus = linkedJob.stage;
              isJobView = true;
              stageIndex = 3; 
          } else {
              if (est.status === 'Sent') {
                  statusColor = 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                  stageIndex = 1;
                  displayStatus = 'Estimate Sent';
              } else if (est.status === 'Approved') {
                  statusColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                  stageIndex = 2;
              } else if (est.status === 'Draft') {
                  displayStatus = 'Draft Estimate';
              }
          }

          const displayNumber = linkedJob ? linkedJob.jobNumber : est.projectInfo.number;
          const targetId = isJobView && linkedJob ? linkedJob.id : est.id;

          outputJobs.push({
              id: est.id,
              targetId,
              isEstimate: !isJobView,
              isJob: isJobView,
              jobId: displayNumber,
              title: est.projectName,
              address: est.jobAddress.address,
              status: displayStatus,
              stageIndex,
              created: new Date(est.projectInfo.date).toLocaleDateString(),
              amount: getSelectedPackage(est).financials?.baseGrandTotal,
              statusColor
          });
      });
      
      return outputJobs;
  }, [invoices, estimates, client.id, client.address, jobs]);

  // Sorted Jobs
  const sortedJobs = useMemo(() => {
      let sorted = [...clientJobs];
      switch (jobSortOption) {
          case 'DateNewest':
              return sorted.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).reverse(); 
          case 'DateOldest':
              return sorted.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
          case 'AmountHigh':
              return sorted.sort((a, b) => b.amount - a.amount);
          case 'AmountLow':
              return sorted.sort((a, b) => a.amount - b.amount);
          default:
              return sorted;
      }
  }, [clientJobs, jobSortOption]);

  // Calculate stats
  const totalJobCount = clientJobs.length;
  const activeJobCount = clientJobs.filter(j => j.status !== 'Paid' && j.status !== 'Closed').length;
  const lifetimeValue = clientJobs.reduce((acc, job) => acc + job.amount, 0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateEstimateClick = () => {
      setIsCreateMenuOpen(false);
      setCreateMode('estimate');
      if (client.properties.length === 1) {
          setSelectedPropertyId(client.properties[0].id);
          setIsEstimateModalOpen(true);
      } else {
          if (client.properties.length > 0) setSelectedPropertyId(client.properties[0].id);
          setIsJobModalOpen(true);
      }
  };

  const handleCreateInvoiceClick = () => {
      setIsCreateMenuOpen(false);
      setCreateMode('invoice');
      if (client.properties.length === 1) {
          setSelectedPropertyId(client.properties[0].id);
          setIsEstimateModalOpen(true);
      } else {
          if (client.properties.length > 0) setSelectedPropertyId(client.properties[0].id);
          setIsJobModalOpen(true);
      }
  };

  const confirmPropertySelection = () => {
      setIsJobModalOpen(false);
      setIsEstimateModalOpen(true);
  };

  const handleEstimateCreate = (selection: { type: string, template: string }) => {
      const prop = client.properties.find(p => p.id === selectedPropertyId);
      if (prop) {
          if (createMode === 'invoice' && onStartInvoice) {
              onStartInvoice(client, prop, selection);
          } else {
              onStartEstimate(client, prop, selection);
          }
          setIsEstimateModalOpen(false);
      }
  };

  const handleSaveNote = (content: string) => {
      if (!content) return;
      const newNote = {
          id: `note-${Date.now()}`,
          type: 'note',
          title: t('views.ContactDetailView.internalNote'),
          body: content,
          date: t('views.ContactDetailView.justNow'),
          icon: StickyNote,
          color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
          direction: 'internal'
      };
      setTimelineItems(prev => [newNote, ...prev]);
      setActiveTab('conversations'); 
  };

  const handleAddNote = () => {
      if (!newNote.trim()) return;
      
      const timestamp = new Date().toLocaleString();
      const entry = `[${timestamp}] ${newNote}`;
      const updatedNotes = client.notes ? `${entry}\n\n${client.notes}` : entry;
      
      onEditClient({ ...client, notes: updatedNotes });
      setNewNote('');
  };

  const handleConversationClick = (item: any) => {
      // Placeholder for interaction with timeline items
      console.log('Conversation item clicked:', item);
  };

  const handleLocationClick = (property: ClientProperty) => {
      setSelectedLocation(property);
      setIsLocationDetailsOpen(true);
  };

  const handleRatingChange = (rating: number) => {
      onEditClient({ ...client, qualityRating: rating });
  };

  // Filter jobs for the selected location
  const locationJobs = React.useMemo(() => {
      if (!selectedLocation) return [];
      return clientJobs.filter(job => job.address.includes(selectedLocation.address));
  }, [selectedLocation, clientJobs]);

  const getSortLabel = (opt: SortOption) => {
      switch(opt) {
          case 'DateNewest': return t('views.ContactDetailView.sortDateNewest');
          case 'DateOldest': return t('views.ContactDetailView.sortDateOldest');
          case 'AmountHigh': return t('views.ContactDetailView.sortAmountHigh');
          case 'AmountLow': return t('views.ContactDetailView.sortAmountLow');
          default: return t('views.ContactDetailView.sort');
      }
  };

  const handleEditClick = () => {
      setClientToEdit(client);
      setIsEditContactModalOpen(true);
  };

  const handleSaveContact = (updatedClient: Client) => {
      onEditClient(updatedClient);
      setIsEditContactModalOpen(false);
      setClientToEdit(null);
  };

  const handleDeleteClient = () => {
      setClientToDelete(client.id);
  };

  const confirmDelete = () => {
      if (clientToDelete) {
          onDeleteClient(clientToDelete);
          setClientToDelete(null);
      }
  };

  const handleSendMessage = () => {
      if (!msgBody) return;
      const newMsg = {
          id: `msg-${Date.now()}`,
          type: msgType.toLowerCase(),
          title: msgType === 'Email' ? (msgSubject || t('views.ContactDetailView.emailSent')) : t('views.ContactDetailView.smsSent'),
          body: msgBody,
          direction: 'outbound',
          date: t('views.ContactDetailView.justNow'),
          icon: msgType === 'Email' ? Mail : MessageSquare,
          color: msgType === 'Email' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' : 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400'
      };
      setTimelineItems(prev => [newMsg, ...prev]);
      setMsgBody('');
      setMsgSubject('');
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      <AddPropertyModal 
        isOpen={isAddPropOpen} 
        onClose={() => setIsAddPropOpen(false)} 
        onSave={(prop) => onAddProperty(client.id, prop)} 
      />

      <CreateEstimateModal 
        isOpen={isEstimateModalOpen} 
        onClose={() => setIsEstimateModalOpen(false)} 
        onCreate={handleEstimateCreate} 
        scopes={scopes}
        templates={templates}
        mode={createMode}
      />
      
      <RichTextEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        initialValue=""
        onSave={handleSaveNote}
        title={t('views.ContactDetailView.addInternalNote')}
      />

      <AddContactModal 
        isOpen={isEditContactModalOpen} 
        onClose={() => { setIsEditContactModalOpen(false); setClientToEdit(null); }}
        onSave={handleSaveContact}
        existingClients={clients}
        clientToEdit={clientToEdit}
      />

      <ClientSelectionModal 
        isOpen={isLinkLeadModalOpen}
        onClose={() => setIsLinkLeadModalOpen(false)}
        onSelect={(item) => {
             // item is Lead since we only pass leads
             if (onLinkLead) onLinkLead(item.id, client.id);
             setIsLinkLeadModalOpen(false);
        }}
        clients={[]} // Pass empty to only show leads
        leads={leads.filter(l => !l.clientId)} // Only show unassigned leads
      />

      <LifetimeValueModal
        isOpen={isLTVModalOpen}
        onClose={() => setIsLTVModalOpen(false)}
        jobs={clientJobs}
      />

      <ActiveProjectsModal 
        isOpen={isActiveProjectsModalOpen}
        onClose={() => setIsActiveProjectsModalOpen(false)}
        jobs={clientJobs}
        onViewJob={(id) => {
            setIsActiveProjectsModalOpen(false);
            if (onViewJob) onViewJob(id); // Use new job navigation
            else setActiveTab('history');
        }}
      />

      <LocationDetailsModal
        isOpen={isLocationDetailsOpen}
        onClose={() => setIsLocationDetailsOpen(false)}
        property={selectedLocation}
        jobs={locationJobs}
        onViewJob={(id) => {
            setIsLocationDetailsOpen(false);
            if (onViewJob) onViewJob(id);
            else setActiveTab('history');
        }}
      />

      <ScheduleEstimateModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)}
        entityId={client.id}
        entityType="Client"
        entityName={client.name}
        address={client.address}
        salesStaff={staff}
        onSave={(apt) => {
            if (onSaveAppointment) onSaveAppointment(apt);
        }}
      />

      <ConfirmationModal 
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={confirmDelete}
        title={t('views.ContactDetailView.deleteClientTitle')}
        message={t('views.ContactDetailView.deleteClientMessage')}
        confirmLabel={t('views.ContactDetailView.deleteClientConfirm')}
      />

      <Modal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} title={t('views.ContactDetailView.selectJobLocation')}>
          <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">{t('views.ContactDetailView.whichProperty', { createMode })}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {client.properties.map(p => (
                      <label key={p.id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedPropertyId === p.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
                          <input 
                            type="radio" 
                            name="property" 
                            checked={selectedPropertyId === p.id} 
                            onChange={() => setSelectedPropertyId(p.id)}
                            className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                          />
                          <div>
                              <div className="font-bold text-gray-900 dark:text-white">{p.address}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{p.city}, {p.state} {p.zip}</div>
                          </div>
                      </label>
                  ))}
              </div>
              <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setIsJobModalOpen(false)} className="flex-1">{t('views.ContactDetailView.cancel')}</Button>
                  <Button onClick={confirmPropertySelection} className="flex-1">{t('views.ContactDetailView.continue')}</Button>
              </div>
          </div>
      </Modal>

      {/* --- HEADER SECTION --- */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-8 mb-8 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-visible">
        
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 relative z-10">
            <div className="space-y-4 w-full">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white font-heading tracking-tight">
                        {client.name}
                    </h1>
                    <div className="flex gap-0.5 sm:gap-1 items-center group">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => handleRatingChange(star)}
                                className="focus:outline-none transition-transform active:scale-90 hover:scale-110"
                                title={t('views.ContactDetailView.rateStar', { star })}
                            >
                                <Star 
                                    className={`w-4 h-4 sm:w-6 sm:h-6 transition-colors ${
                                        (client.qualityRating || 0) >= star 
                                        ? 'fill-amber-400 text-amber-400' 
                                        : 'text-gray-300 dark:text-gray-600 hover:text-amber-200 dark:hover:text-amber-500'
                                    }`} 
                                />
                            </button>
                        ))}
                        {(client.qualityRating || 0) > 0 && (
                            <button 
                                onClick={() => handleRatingChange(0)} 
                                className="ml-1 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t('views.ContactDetailView.clearRating')}
                            >
                                <X className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-gray-500 dark:text-gray-400 font-medium text-sm md:text-base pl-1 md:pl-2">
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {client.phone}
                    </div>
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {client.email}
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {client.address}
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-auto mt-4 lg:mt-0">
                {/* Mobile Layout (< sm) - Stacked buttons for responsiveness */}
                <div className="flex flex-col gap-3 sm:hidden">
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" onClick={() => setIsScheduleModalOpen(true)} className="flex-1 whitespace-nowrap justify-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <Calendar className="w-4 h-4 mr-2" /> {t('views.ContactDetailView.scheduleEstimate')}
                        </Button>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center w-12 h-12 shadow-sm flex-none">
                            <KebabMenu
                                items={[
                                    { label: t('views.ContactDetailView.editContact'), icon: Edit2, onClick: handleEditClick },
                                    { label: t('views.ContactDetailView.linkExistingLead'), icon: Link2, onClick: () => setIsLinkLeadModalOpen(true) },
                                    { label: t('views.ContactDetailView.deleteContact'), icon: Trash2, onClick: handleDeleteClient, className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="relative w-full" ref={createMenuRef}>
                        <Button 
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
                            className="shadow-xl shadow-primary-500/20 w-full font-bold flex items-center justify-center gap-2 whitespace-nowrap"
                            variant="primary"
                        >
                            <Plus className="w-5 h-5" />
                            {t('views.ContactDetailView.createNew')}
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {isCreateMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={handleCreateEstimateClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newEstimate')}
                                </button>
                                <button onClick={handleCreateEstimateClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newJob')}
                                </button>
                                <button onClick={handleCreateInvoiceClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors border-t border-gray-50 dark:border-gray-700">
                                    <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                        <Receipt className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newInvoice')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Layout (>= sm) */}
                <div className="hidden sm:flex flex-row gap-3 items-center">
                    <Button variant="secondary" onClick={() => setIsScheduleModalOpen(true)} className="flex-1 lg:flex-none whitespace-nowrap justify-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Calendar className="w-4 h-4 mr-2" /> {t('views.ContactDetailView.scheduleEstimate')}
                    </Button>
                    
                    <div className="relative flex-1 lg:flex-none" ref={createMenuRef}>
                        <Button 
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
                            className="shadow-xl shadow-primary-500/20 w-full font-bold flex items-center justify-center gap-2 whitespace-nowrap"
                            variant="primary"
                        >
                            <Plus className="w-5 h-5" />
                            {t('views.ContactDetailView.createNew')}
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {isCreateMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={handleCreateEstimateClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newEstimate')}
                                </button>
                                <button onClick={handleCreateEstimateClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newJob')}
                                </button>
                                <button onClick={handleCreateInvoiceClick} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors border-t border-gray-50 dark:border-gray-700">
                                    <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                        <Receipt className="w-4 h-4" />
                                    </div>
                                    {t('views.ContactDetailView.newInvoice')}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center w-12 h-12 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex-none">
                        <KebabMenu
                            items={[
                                { label: t('views.ContactDetailView.editContact'), icon: Edit2, onClick: handleEditClick },
                                { label: t('views.ContactDetailView.linkExistingLead'), icon: Link2, onClick: () => setIsLinkLeadModalOpen(true) },
                                { label: t('views.ContactDetailView.deleteContact'), icon: Trash2, onClick: handleDeleteClient, className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                            ]}
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- LEFT COLUMN --- */}
          <div className="space-y-8">
              
              {/* Service Locations */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-heading">{t('views.ContactDetailView.serviceLocations')}</h3>
                      <button onClick={() => setIsAddPropOpen(true)} className="text-primary-600 hover:text-primary-700 transition-colors">
                          <Plus className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="space-y-3">
                      {client.properties.map((prop, idx) => (
                          <div 
                            key={prop.id} 
                            onClick={() => handleLocationClick(prop)}
                            className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md cursor-pointer transition-all group relative"
                          >
                              <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-400 shrink-0 mt-0.5 group-hover:text-primary-500 group-hover:border-primary-200 dark:group-hover:border-primary-500 transition-colors">
                                      <MapPin className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1">
                                      <div className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{prop.address}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{prop.city}, {prop.state} {prop.zip}</div>
                                  </div>
                                  <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Customer Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-heading mb-6">{t('views.ContactDetailView.customerStats')}</h3>
                  <div className="space-y-5">
                      <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-700 pb-2">
                          <span className="text-gray-500 dark:text-gray-400 font-medium">{t('views.ContactDetailView.totalJobs')}</span>
                          <span className="font-bold text-gray-900 dark:text-white">{totalJobCount}</span>
                      </div>
                      <div 
                        className="flex justify-between items-center border-b border-gray-50 dark:border-gray-700 pb-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 -m-1 rounded transition-colors group"
                        onClick={() => setIsActiveProjectsModalOpen(true)}
                      >
                          <span className="text-gray-500 dark:text-gray-400 font-medium group-hover:text-primary-700 dark:group-hover:text-primary-400 flex items-center gap-1">
                              {t('views.ContactDetailView.activeJobs')} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </span>
                          <span className={`font-bold ${activeJobCount > 0 ? 'text-amber-600' : 'text-gray-400 dark:text-gray-500'}`}>{activeJobCount}</span>
                      </div>
                      <div 
                        className="flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 -m-1 rounded transition-colors group"
                        onClick={() => setIsLTVModalOpen(true)}
                      >
                          <span className="text-gray-500 dark:text-gray-400 font-medium group-hover:text-primary-700 dark:group-hover:text-primary-400 flex items-center gap-1">
                              {t('views.ContactDetailView.totalValue')} <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">${lifetimeValue.toLocaleString()}</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="lg:col-span-2">
              {/* Tabs with Sort Option */}
              <div className="flex flex-col sm:flex-row justify-between items-end border-b border-gray-200 dark:border-gray-700 mb-8 px-2 gap-4">
                  <div className="flex gap-8 w-full sm:w-auto overflow-x-auto">
                      <button 
                        onClick={() => setActiveTab('history')}
                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${activeTab === 'history' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                          {t('views.ContactDetailView.tabJobHistory')}
                          {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
                      </button>
                      <button 
                        onClick={() => setActiveTab('conversations')}
                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${activeTab === 'conversations' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                          {t('views.ContactDetailView.tabConversations')}
                          {activeTab === 'conversations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
                      </button>
                      <button 
                        onClick={() => setActiveTab('notes')}
                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${activeTab === 'notes' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                          {t('views.ContactDetailView.tabNotes')}
                          {activeTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
                      </button>
                  </div>

                  {activeTab === 'history' && (
                      <div className="relative pb-2" ref={sortMenuRef}>
                          <button 
                              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700"
                          >
                              {getSortLabel(jobSortOption)}
                              <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {isSortMenuOpen && (
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                  <button onClick={() => { setJobSortOption('DateNewest'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${jobSortOption === 'DateNewest' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                                      <Calendar className="w-3.5 h-3.5" /> {t('views.ContactDetailView.sortDateNewest')}
                                  </button>
                                  <button onClick={() => { setJobSortOption('DateOldest'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${jobSortOption === 'DateOldest' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                                      <ArrowUp className="w-3.5 h-3.5" /> {t('views.ContactDetailView.sortDateOldest')}
                                  </button>
                                  <button onClick={() => { setJobSortOption('AmountHigh'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${jobSortOption === 'AmountHigh' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                                      <ArrowDown className="w-3.5 h-3.5" /> {t('views.ContactDetailView.sortAmountHigh')}
                                  </button>
                                  <button onClick={() => { setJobSortOption('AmountLow'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${jobSortOption === 'AmountLow' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                                      <ArrowUp className="w-3.5 h-3.5" /> {t('views.ContactDetailView.sortAmountLow')}
                                  </button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {activeTab === 'history' && (
                  /* Jobs List */
                  <div className="space-y-6">
                      {clientJobs.length > 0 ? clientJobs.sort((a, b) => {
                          if (jobSortOption === 'DateNewest') return new Date(b.created).getTime() - new Date(a.created).getTime();
                          if (jobSortOption === 'DateOldest') return new Date(a.created).getTime() - new Date(b.created).getTime();
                          if (jobSortOption === 'AmountHigh') return b.amount - a.amount;
                          if (jobSortOption === 'AmountLow') return a.amount - b.amount;
                          return 0;
                      }).map((job) => (
                          <div 
                            key={job.id} 
                            onClick={() => {
                                if (job.isJob && onViewJob) onViewJob(job.targetId);
                                else if (job.isEstimate && onViewEstimate) onViewEstimate(job.targetId);
                                else if (onViewInvoice) onViewInvoice(job.targetId);
                            }}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          >
                              {/* Job Header */}
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{job.title}</h3>
                                      <div className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-wide">{job.jobId}</div>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${job.statusColor}`}>
                                      {job.status}
                                  </span>
                              </div>

                              {/* Location */}
                              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-6">
                                  <MapPin className="w-4 h-4" /> {job.address}
                              </div>

                              {/* Progress Bar */}
                              <div className="mb-6">
                                  <div className="flex h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                                      {/* Progress Segment */}
                                      <div 
                                        className={`h-full ${job.stageIndex >= 4 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${((job.stageIndex + 0.5) / JOB_STAGES.length) * 100}%` }} 
                                      />
                                  </div>
                                  <div className="justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:flex">
                                      {JOB_STAGES.map((stage, idx) => (
                                          <span key={stage} className={idx <= job.stageIndex ? (job.stageIndex >= 4 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400') : ''}>
                                              {stage}
                                          </span>
                                      ))}
                                  </div>
                              </div>

                              {/* Footer */}
                              <div className="flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-4">
                                  <div className="text-xs text-gray-400">{t('views.ContactDetailView.created', { date: job.created })}</div>
                                  <div className="font-bold text-gray-900 dark:text-white text-xl">${job.amount.toLocaleString()}</div>
                              </div>
                          </div>
                      )) : (
                          <div className="flex flex-col items-center justify-center min-h-[300px] w-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                              <p className="text-gray-400 italic mb-4">{t('views.ContactDetailView.noJobHistory')}</p>
                              <Button variant="secondary" onClick={handleCreateEstimateClick}>{t('views.ContactDetailView.startFirstEstimate')}</Button>
                          </div>
                      )}
                  </div>
              )}
              
              {activeTab === 'conversations' && (
                  /* Conversations List (Timeline) */
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm flex flex-col h-[600px]">
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                          {timelineItems.map((item) => (
                              <div 
                                key={item.id} 
                                className={`flex gap-4 group ${
                                    (item.type === 'system_signed' || item.type === 'system_paid' || item.type === 'system_viewed') 
                                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 -m-2 rounded-xl transition-colors' 
                                    : ''
                                }`}
                                onClick={() => handleConversationClick(item)}
                              >
                                  {/* Icon Column */}
                                  <div className="flex flex-col items-center">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.color}`}>
                                          <item.icon className="w-5 h-5" />
                                      </div>
                                      <div className="w-px h-full bg-gray-100 dark:bg-gray-700 my-2 group-last:hidden"></div>
                                  </div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 pb-6">
                                      <div className="flex justify-between items-start mb-1">
                                          <h4 className={`font-bold text-sm ${item.type === 'note' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                                              {item.title}
                                              {(item.type === 'system_signed' || item.type === 'system_paid') && <ArrowUpRight className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                          </h4>
                                          <span className="text-xs text-gray-400 whitespace-nowrap">{item.date}</span>
                                      </div>
                                      {item.body && (
                                          <div className={`text-sm p-3 rounded-xl mt-2 border ${
                                              item.type === 'note' ? 'bg-amber-50 dark:bg-amber-900/20 text-gray-800 dark:text-gray-200 border-amber-100 dark:border-amber-800' :
                                              item.direction === 'outbound' ? 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-100 dark:border-blue-800'
                                          }`}>
                                              <div dangerouslySetInnerHTML={{ __html: item.body }} />
                                          </div>
                                      )}
                                      {!item.body && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                              {t('views.ContactDetailView.clickToViewDetails')}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      {/* Message Input Area */}
                      <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-2xl">
                          <div className="space-y-3">
                              {/* Header input for Email */}
                              {msgType === 'Email' && (
                                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                      <input 
                                          type="text" 
                                          placeholder={t('views.ContactDetailView.subjectPlaceholder')}
                                          value={msgSubject}
                                          onChange={(e) => setMsgSubject(e.target.value)}
                                          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400 transition-all text-sm font-bold shadow-sm text-black dark:text-white"
                                      />
                                  </div>
                              )}
                              
                              <div className="relative">
                                  <textarea 
                                    rows={2}
                                    value={msgBody}
                                    onChange={(e) => setMsgBody(e.target.value)}
                                    placeholder={t('views.ContactDetailView.typeMessagePlaceholder', { msgType: msgType.toLowerCase() })}
                                    className="w-full pl-4 pr-12 py-3 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400 transition-all text-sm shadow-sm text-black dark:text-white resize-none min-h-[64px]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                  />
                                  <button 
                                      onClick={handleSendMessage}
                                      className="absolute right-2 bottom-3 p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm"
                                  >
                                      <Send className="w-4 h-4 text-white" />
                                  </button>
                              </div>
                          </div>
                          <div className="flex gap-4 mt-3 px-1">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                  <input 
                                    type="radio" 
                                    name="msgType" 
                                    checked={msgType === 'Email'} 
                                    onChange={() => setMsgType('Email')}
                                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                                  /> {t('views.ContactDetailView.msgTypeEmail')}
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                  <input
                                    type="radio"
                                    name="msgType"
                                    checked={msgType === 'SMS'}
                                    onChange={() => setMsgType('SMS')}
                                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                                  /> {t('views.ContactDetailView.msgTypeSMS')}
                              </label>
                          </div>
                      </div>
                  </div>
              )}
              
              {activeTab === 'notes' && (
                  <div className="flex flex-col gap-6">
                      {/* Add New Note Card */}
                      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-4 text-gray-500 dark:text-gray-400">
                              <Edit2 className="w-4 h-4" />
                              <div className="text-xs font-bold uppercase tracking-widest">{t('views.ContactDetailView.addNewNote')}</div>
                          </div>
                          <div className="relative">
                              <textarea 
                                  className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl resize-none outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-300 dark:focus:border-primary-600 transition-all text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                  placeholder={t('views.ContactDetailView.newNotePlaceholder')}
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
                              <div className="text-xs font-bold uppercase tracking-widest">{t('views.ContactDetailView.notesHistory')}</div>
                          </div>

                          <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                              {client.notes ? (
                                  client.notes.split('\n\n').map((noteSegment, idx) => {
                                      // Basic parsing to try and extract timestamp if formatted like "[Date] Note"
                                      const match = noteSegment.match(/^\[(.*?)\]\s(.*)/s);
                                      const timestamp = match ? match[1] : t('views.ContactDetailView.previousNote');
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
                                      {t('views.ContactDetailView.noNotesYet')}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
