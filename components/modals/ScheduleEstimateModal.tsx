
import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, Select, TextArea } from '../UI';
import { CrewMember, Appointment } from '../../types';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { syncToGoogleCalendar, queueReminders } from '../../services/calendarService';
import { useTranslation } from '@/i18n/LanguageContext';

interface ScheduleEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: string; // Optional if editing
  entityType?: 'Lead' | 'Client'; // Optional if editing
  entityName?: string; // Optional if editing
  address?: string; // Optional if editing
  salesStaff: CrewMember[];
  onSave: (appointment: Appointment) => void;
  appointmentToEdit?: Appointment | null; // New prop for editing
}

export const ScheduleEstimateModal = ({ 
  isOpen, 
  onClose, 
  entityId, 
  entityType,
  entityName,
  address,
  salesStaff, 
  onSave,
  appointmentToEdit
}: ScheduleEstimateModalProps) => {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [estimatorId, setEstimatorId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (appointmentToEdit) {
        // Edit Mode: Pre-fill data
        const dt = new Date(appointmentToEdit.date);
        setDate(dt.toISOString().split('T')[0]);
        setTime(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })); // HH:mm format
        setDuration(appointmentToEdit.durationMinutes);
        setEstimatorId(appointmentToEdit.estimatorId);
        setNotes(appointmentToEdit.notes || '');
      } else {
        // Create Mode: Defaults
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(tomorrow.toISOString().split('T')[0]);
        setTime('09:00');
        setDuration(60);
        setNotes('');
        if (salesStaff.length > 0) setEstimatorId(salesStaff[0].id);
      }
    }
  }, [isOpen, appointmentToEdit, salesStaff]);

  const handleSave = async () => {
      if (!date || !time || !estimatorId) return;

      setIsSyncing(true);

      const startDateTime = new Date(`${date}T${time}`);
      
      const newAppointment: Appointment = {
          id: appointmentToEdit ? appointmentToEdit.id : `appt-${Date.now()}`,
          title: appointmentToEdit ? appointmentToEdit.title : `Estimate: ${entityName}`,
          date: startDateTime.toISOString(),
          durationMinutes: duration,
          estimatorId: estimatorId,
          // Preserve existing links if editing, else use props
          leadId: appointmentToEdit ? appointmentToEdit.leadId : (entityType === 'Lead' ? entityId : undefined),
          clientId: appointmentToEdit ? appointmentToEdit.clientId : (entityType === 'Client' ? entityId : undefined),
          address: appointmentToEdit ? appointmentToEdit.address : (address || ''),
          notes: notes,
          status: appointmentToEdit ? appointmentToEdit.status : 'Scheduled',
          remindersSent: appointmentToEdit ? appointmentToEdit.remindersSent : false,
      };

      // 1. Hook: Sync to Google
      // In edit mode, this might update the existing event
      const syncResult = await syncToGoogleCalendar(newAppointment);
      newAppointment.googleCalendarEventId = syncResult.eventId;

      // 2. Hook: Queue Reminders
      queueReminders(newAppointment);

      // 3. Save locally
      onSave(newAppointment);
      
      setIsSyncing(false);
      onClose();
  };

  if (!isOpen) return null;

  // Determine display info
  const displayName = appointmentToEdit ? appointmentToEdit.title.replace('Estimate: ', '') : entityName;
  const displayAddress = appointmentToEdit ? appointmentToEdit.address : address;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={appointmentToEdit ? t('modals.ScheduleEstimateModal.editAppointment') : t('modals.ScheduleEstimateModal.scheduleEstimate')}>
      <div className="space-y-6">
        
        {/* Context Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 font-bold text-sm">
                <User className="w-4 h-4" /> {displayName}
            </div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 text-xs">
                <MapPin className="w-3 h-3" /> {displayAddress || t('modals.ScheduleEstimateModal.noAddressOnFile')}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.ScheduleEstimateModal.dateLabel')}</label>
                <div className="relative">
                    <input 
                        type="date" 
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white font-medium"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                    <Calendar className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.ScheduleEstimateModal.timeLabel')}</label>
                <div className="relative">
                    <input 
                        type="time" 
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white font-medium"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                    />
                    <Clock className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.ScheduleEstimateModal.assignedEstimatorLabel')}</label>
                <Select 
                    value={estimatorId}
                    onChange={setEstimatorId}
                    options={salesStaff.map(s => ({ label: s.name, value: s.id }))}
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.ScheduleEstimateModal.durationLabel')}</label>
                <Select 
                    value={duration}
                    onChange={(v) => setDuration(Number(v))}
                    options={[
                        { label: t('modals.ScheduleEstimateModal.duration15Min'), value: 15 },
                        { label: t('modals.ScheduleEstimateModal.duration30Min'), value: 30 },
                        { label: t('modals.ScheduleEstimateModal.duration45Min'), value: 45 },
                        { label: t('modals.ScheduleEstimateModal.duration1Hour'), value: 60 },
                        { label: t('modals.ScheduleEstimateModal.duration1Point5Hours'), value: 90 },
                        { label: t('modals.ScheduleEstimateModal.duration2Hours'), value: 120 },
                    ]}
                />
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.ScheduleEstimateModal.appointmentNotesLabel')}</label>
            <TextArea
                value={notes}
                onChange={setNotes}
                placeholder={t('modals.ScheduleEstimateModal.notesPlaceholder')}
                rows={3}
            />
        </div>

        <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.ScheduleEstimateModal.cancelButton')}</Button>
            <Button onClick={handleSave} className="flex-[2] shadow-lg shadow-primary-500/20" disabled={isSyncing}>
                {isSyncing ? t('modals.ScheduleEstimateModal.syncingButton') : (appointmentToEdit ? t('modals.ScheduleEstimateModal.saveChangesButton') : t('modals.ScheduleEstimateModal.scheduleAppointmentButton'))}
            </Button>
        </div>
        
        {!appointmentToEdit && (
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                {t('modals.ScheduleEstimateModal.syncNote')}
            </p>
        )}
      </div>
    </Modal>
  );
};
