
import React, { useState, useMemo } from 'react';
import { Plus, Search, User, Mail, Phone, MoreVertical, Edit2, Trash2, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { Card, Button, SearchInput, KebabMenu, Badge } from '../UI';
import { CrewMember } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface EmployeeManagerViewProps {
  employees: CrewMember[];
  onAdd: () => void;
  onEdit: (e: CrewMember, tab?: 'profile' | 'schedule') => void;
  onDelete: (id: string) => void;
}

export const EmployeeManagerView = ({ employees, onAdd, onEdit, onDelete }: EmployeeManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (e.role && e.role.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [employees, searchTerm]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.EmployeeManagerView.teamAndAccess')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.EmployeeManagerView.manageEmployeesSubheading')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> 
          <Plus className="w-5 h-5 mr-2" /> {t('settings.EmployeeManagerView.addMember')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.EmployeeManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => (
          <Card key={emp.id} className="p-6 relative group overflow-visible hover:border-primary-300 dark:hover:border-primary-500 transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
             <div className="absolute top-4 right-4">
                <KebabMenu 
                    onEdit={() => onEdit(emp)}
                    onDelete={() => onDelete(emp.id)}
                />
             </div>
             
             <div className="flex items-start gap-4 mb-4">
                <div 
                    className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 border-4 shadow-sm overflow-hidden flex-shrink-0 transition-colors"
                    style={{ borderColor: emp.color || '#e5e7eb' }}
                >
                    {emp.photo ? (
                        <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                            <User className="w-8 h-8" />
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{emp.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge color="blue">{emp.role}</Badge>
                        {emp.status === 'Inactive' && <Badge color="gray">{t('settings.EmployeeManagerView.inactive')}</Badge>}
                    </div>
                </div>
             </div>

             <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="truncate">{emp.email || t('settings.EmployeeManagerView.noEmail')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>{emp.phone || t('settings.EmployeeManagerView.noPhone')}</span>
                </div>
                {emp.color && (
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: emp.color }} />
                        <span>{t('settings.EmployeeManagerView.assignedColor')}</span>
                    </div>
                )}
             </div>

             <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                 <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full justify-center bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    onClick={() => onEdit(emp, 'schedule')} 
                 >
                     <Calendar className="w-3.5 h-3.5 mr-2" /> {t('settings.EmployeeManagerView.manageSchedule')}
                 </Button>
             </div>
          </Card>
        ))}
        
        {filteredEmployees.length === 0 && (
           <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                 <User className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.EmployeeManagerView.noTeamMembersFound')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.EmployeeManagerView.emptyStateBody')}</p>
           </div>
        )}
      </div>
    </div>
  );
};
