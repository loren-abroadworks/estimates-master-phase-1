
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, TextInput, Select, Button, Toggle, PhoneInput } from '../UI';
import { CrewMember, CrewScheduleEntry } from '../../types';
import { Trash2, Upload, User, Shield, Check, Lock, Calendar, Clock, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (emp: CrewMember) => void;
  onDelete?: (id: string) => void; 
  employeeToEdit?: CrewMember;
  initialTab?: 'profile' | 'schedule';
}

const ROLES = [
    { label: 'Owner', value: 'Owner' },
    { label: 'Estimator / Sales', value: 'Estimator' },
    { label: 'Project Manager', value: 'Project Manager' },
    { label: 'Foreman / Crew Lead', value: 'Foreman' },
    { label: 'Painter', value: 'Painter' },
    { label: 'Apprentice', value: 'Apprentice' },
    { label: 'Admin', value: 'Admin' },
];

const PERMISSIONS = [
    { id: 'estimates', label: 'Manage Estimates', description: 'Create, edit, and send estimates' },
    { id: 'financials', label: 'View Financials', description: 'See profits, margins, and costs' },
    { id: 'schedule', label: 'Manage Schedule', description: 'Assign crews and jobs' },
    { id: 'settings', label: 'Admin Settings', description: 'Configure app settings and rates' },
];

export const AddEmployeeModal = ({ isOpen, onClose, onSave, onDelete, employeeToEdit, initialTab = 'profile' }: AddEmployeeModalProps) => {
  const { t } = useTranslation();
  const translatedRoles = [
    { label: t('modals.AddEmployeeModal.roleOwner'), value: 'Owner' },
    { label: t('modals.AddEmployeeModal.roleEstimator'), value: 'Estimator' },
    { label: t('modals.AddEmployeeModal.roleProjectManager'), value: 'Project Manager' },
    { label: t('modals.AddEmployeeModal.roleForeman'), value: 'Foreman' },
    { label: t('modals.AddEmployeeModal.rolePainter'), value: 'Painter' },
    { label: t('modals.AddEmployeeModal.roleApprentice'), value: 'Apprentice' },
    { label: t('modals.AddEmployeeModal.roleAdmin'), value: 'Admin' },
  ];
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule'>(initialTab);
  const [formData, setFormData] = useState<Partial<CrewMember>>({
    name: '',
    role: 'Painter',
    email: '',
    phone: '',
    status: 'Active',
    photo: '',
    permissions: [],
    color: '#3b82f6',
    schedule: {}
  });

  // Schedule State
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
        // Reset week to start on current week's Monday
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0,0,0,0);
        setCurrentWeekStart(monday);
        setActiveTab(initialTab); // Set active tab from prop on open

        if (employeeToEdit) {
            setFormData({
                ...employeeToEdit,
                permissions: employeeToEdit.permissions || [],
                color: employeeToEdit.color || '#3b82f6',
                schedule: employeeToEdit.schedule || {}
            });
        } else {
            setFormData({
                name: '',
                role: 'Painter',
                email: '',
                phone: '',
                status: 'Active',
                photo: '',
                permissions: [],
                color: '#3b82f6',
                schedule: {}
            });
        }
    }
  }, [isOpen, employeeToEdit, initialTab]);
  
  const handleSave = () => {
      if (!formData.name) return;
      
      const newEmployee: CrewMember = {
          id: employeeToEdit?.id || `cm-${Date.now()}`,
          name: formData.name || '',
          role: formData.role || 'Painter',
          email: formData.email,
          phone: formData.phone,
          status: formData.status as 'Active' | 'Inactive',
          photo: formData.photo || undefined,
          permissions: formData.permissions || [],
          color: formData.color,
          schedule: formData.schedule
      };
      
      onSave(newEmployee);
  };

  const handleDelete = () => {
      if (employeeToEdit && onDelete) {
          if (window.confirm(t('modals.AddEmployeeModal.confirmRemove'))) {
              onDelete(employeeToEdit.id);
              onClose();
          }
      }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, photo: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const togglePermission = (permId: string) => {
      const current = formData.permissions || [];
      const updated = current.includes(permId)
          ? current.filter(p => p !== permId)
          : [...current, permId];
      setFormData(prev => ({ ...prev, permissions: updated }));
  };

  // --- SCHEDULE LOGIC ---

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 5; i++) { // Mon-Fri
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        dates.push(d);
    }
    return dates;
  }, [currentWeekStart]);

  const navigateWeek = (dir: number) => {
      const newStart = new Date(currentWeekStart);
      newStart.setDate(currentWeekStart.getDate() + (dir * 7));
      setCurrentWeekStart(newStart);
  };

  const updateDaySchedule = (dateStr: string, field: keyof CrewScheduleEntry, value: any) => {
      const currentSchedule = formData.schedule || {};
      const entry = currentSchedule[dateStr] || { date: dateStr, startTime: '08:00', endTime: '17:00', isOff: false, reason: '' };
      
      const newEntry = { ...entry, [field]: value };
      
      setFormData(prev => ({
          ...prev,
          schedule: {
              ...prev.schedule,
              [dateStr]: newEntry
          }
      }));
  };

  const copyPreviousWeek = () => {
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(currentWeekStart.getDate() - 7);
      
      const newSchedule = { ...formData.schedule };
      let hasCopied = false;

      for (let i = 0; i < 5; i++) {
          const sourceDate = new Date(prevWeekStart);
          sourceDate.setDate(prevWeekStart.getDate() + i);
          const sourceKey = sourceDate.toISOString().split('T')[0];
          
          const targetDate = new Date(currentWeekStart);
          targetDate.setDate(currentWeekStart.getDate() + i);
          const targetKey = targetDate.toISOString().split('T')[0];

          if (newSchedule[sourceKey]) {
              newSchedule[targetKey] = {
                  ...newSchedule[sourceKey],
                  date: targetKey
              };
              hasCopied = true;
          } else {
              // Reset to default if previous week had nothing explicitly set
              newSchedule[targetKey] = {
                  date: targetKey,
                  startTime: '08:00',
                  endTime: '17:00',
                  isOff: false,
                  reason: ''
              };
          }
      }

      if (hasCopied || Object.keys(newSchedule).length > 0) {
          setFormData(prev => ({ ...prev, schedule: newSchedule }));
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={employeeToEdit ? t('modals.AddEmployeeModal.editTitle') : t('modals.AddEmployeeModal.addTitle')} maxWidth="md:max-w-3xl">
      <div className="flex flex-col h-full">
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'profile' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
                {t('modals.AddEmployeeModal.tabProfile')}
            </button>
            <button
                onClick={() => setActiveTab('schedule')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'schedule' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
                {t('modals.AddEmployeeModal.tabSchedule')}
            </button>
        </div>

        {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer">
                    <div 
                        className="w-24 h-24 rounded-full bg-gray-100 border-4 overflow-hidden flex items-center justify-center mb-2 shadow-sm group-hover:border-primary-400 transition-colors"
                        style={{ borderColor: formData.color }}
                    >
                        {formData.photo ? (
                            <img src={formData.photo} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-10 h-10 text-gray-300" />
                        )}
                    </div>
                    <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold uppercase">{t('modals.AddEmployeeModal.photoChange')}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                </div>
                <span className="text-xs text-gray-400 font-medium">{t('modals.AddEmployeeModal.uploadPhoto')}</span>
            </div>
            
            <TextInput
                label={t('modals.AddEmployeeModal.fullName')}
                placeholder={t('modals.AddEmployeeModal.fullNamePlaceholder')}
                value={formData.name || ''}
                onChange={(v) => setFormData({...formData, name: v})}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">{t('modals.AddEmployeeModal.roleLabel')}</label>
                    <Select 
                        value={formData.role || 'Painter'} 
                        onChange={(v) => setFormData({...formData, role: v})} 
                        options={translatedRoles}
                    />
                </div>
                <PhoneInput
                    label={t('modals.AddEmployeeModal.phoneNumber')}
                    placeholder={t('modals.AddEmployeeModal.phonePlaceholder')}
                    value={formData.phone || ''}
                    onChange={(v) => setFormData({...formData, phone: v})}
                />
            </div>

            <TextInput
                label={t('modals.AddEmployeeModal.emailAddress')}
                placeholder={t('modals.AddEmployeeModal.emailPlaceholder')}
                value={formData.email || ''}
                onChange={(v) => setFormData({...formData, email: v})}
            />

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                    <div className="font-bold text-gray-900">{t('modals.AddEmployeeModal.activeStatus')}</div>
                    <div className="text-sm text-gray-500">{t('modals.AddEmployeeModal.activeStatusDesc')}</div>
                </div>
                <Toggle 
                    label="" 
                    checked={formData.status === 'Active'} 
                    onChange={(v) => setFormData({...formData, status: v ? 'Active' : 'Inactive'})} 
                />
            </div>

            {/* Permissions Section */}
            <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> {t('modals.AddEmployeeModal.accessPermissions')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PERMISSIONS.map(perm => {
                        const isSelected = (formData.permissions || []).includes(perm.id);
                        return (
                            <div 
                                key={perm.id}
                                onClick={() => togglePermission(perm.id)}
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-primary-50 border-primary-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors ${isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-300'}`}>
                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                    <div className={`text-sm font-bold ${isSelected ? 'text-primary-900' : 'text-gray-700'}`}>{t(`modals.AddEmployeeModal.perm_${perm.id}_label` as any)}</div>
                                    <div className="text-xs text-gray-500">{t(`modals.AddEmployeeModal.perm_${perm.id}_desc` as any)}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        )}

        {activeTab === 'schedule' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Week Navigation */}
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                    <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors shadow-sm">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {t('modals.AddEmployeeModal.weekOf', { date: currentWeekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) })}
                        </div>
                        <button 
                            onClick={() => {
                                const today = new Date();
                                const day = today.getDay();
                                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                                const monday = new Date(today.setDate(diff));
                                monday.setHours(0,0,0,0);
                                setCurrentWeekStart(monday);
                            }}
                            className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider hover:underline"
                        >
                            {t('modals.AddEmployeeModal.returnToCurrentWeek')}
                        </button>
                    </div>
                    <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors shadow-sm">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={copyPreviousWeek}
                        className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" /> {t('modals.AddEmployeeModal.copyPreviousWeek')}
                    </button>
                </div>

                <div className="space-y-3">
                    {weekDates.map(date => {
                        const dateKey = date.toISOString().split('T')[0];
                        const entry = formData.schedule?.[dateKey] || { startTime: '08:00', endTime: '17:00', isOff: false, reason: '' };
                        const isToday = new Date().toDateString() === date.toDateString();

                        return (
                            <div key={dateKey} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${entry.isOff ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} ${isToday ? 'ring-2 ring-primary-500/20 border-primary-300 dark:border-primary-600' : ''}`}>
                                <div className="w-24 shrink-0">
                                    <div className={`text-sm font-bold ${isToday ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                        {date.getDate()} {date.toLocaleDateString(undefined, { month: 'short' })}
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    {entry.isOff ? (
                                        <div className="col-span-2">
                                            <input 
                                                type="text"
                                                placeholder={t('modals.AddEmployeeModal.timeOffReason')}
                                                className="w-full px-3 py-1.5 rounded-lg border text-sm bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-primary-400/20 outline-none placeholder-gray-400 dark:placeholder-gray-600"
                                                value={entry.reason || ''}
                                                onChange={(e) => updateDaySchedule(dateKey, 'reason', e.target.value)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <input 
                                                    type="time" 
                                                    className="w-full px-3 py-1.5 rounded-lg border text-sm font-bold focus:ring-2 focus:ring-primary-400/20 outline-none transition-colors bg-white dark:bg-gray-900 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white"
                                                    value={entry.startTime}
                                                    onChange={(e) => updateDaySchedule(dateKey, 'startTime', e.target.value)}
                                                />
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="time" 
                                                    className="w-full px-3 py-1.5 rounded-lg border text-sm font-bold focus:ring-2 focus:ring-primary-400/20 outline-none transition-colors bg-white dark:bg-gray-900 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white"
                                                    value={entry.endTime}
                                                    onChange={(e) => updateDaySchedule(dateKey, 'endTime', e.target.value)}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button 
                                    onClick={() => updateDaySchedule(dateKey, 'isOff', !entry.isOff)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 w-20 flex justify-center ${entry.isOff ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'}`}
                                >
                                    {entry.isOff ? t('modals.AddEmployeeModal.statusOff') : t('modals.AddEmployeeModal.statusWorking')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-auto">
            {employeeToEdit && onDelete && activeTab === 'profile' && (
                <Button variant="danger" onClick={handleDelete} className="px-4 shadow-sm" title={t('modals.AddEmployeeModal.removeMember')}>
                    <Trash2 className="w-5 h-5" />
                </Button>
            )}
            <div className="flex gap-3 flex-1 justify-end">
                <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.AddEmployeeModal.cancel')}</Button>
                <Button onClick={handleSave} className="flex-[2] shadow-lg shadow-primary-500/20">{t('modals.AddEmployeeModal.saveMember')}</Button>
            </div>
        </div>
      </div>
    </Modal>
  );
};
