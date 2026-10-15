
import React from 'react';
import { Edit2, Hash, Eye, Save, Send, CheckCircle2, ClipboardList, Receipt, DollarSign, Lock } from 'lucide-react';
import { Button, KebabMenu } from '../../../UI';
import { Typography } from '../../../../theme/designSystem';
import { useTranslation } from '@/i18n/LanguageContext';

interface ProjectToolbarProps {
  projectName: string;
  setProjectName: (name: string) => void;
  estimateNumber: string;
  viewMode: 'edit' | 'client';
  setViewMode: (mode: 'edit' | 'client') => void;
  onSend?: () => void;
  onSaveDraft?: () => void;
  isInvoiceMode?: boolean;
  
  // Status & Actions
  status?: string;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMarkPaid?: () => void;
  onMarkApproved?: () => void;
  onViewInvoice?: () => void;
  onViewWorkOrder?: () => void;
  onCreateInvoice?: () => void;

  // Overflow (⋮) menu actions — packages toggle, delete, etc.
  menuItems?: { label: string; onClick: () => void; icon?: React.ElementType; className?: string }[];
}

export const ProjectToolbar: React.FC<ProjectToolbarProps> = ({
  projectName,
  setProjectName,
  estimateNumber,
  viewMode,
  setViewMode,
  onSend,
  onSaveDraft,
  isInvoiceMode,
  status = 'Draft',
  readOnly,
  onEdit,
  onDelete,
  onMarkPaid,
  onMarkApproved,
  onViewInvoice,
  onViewWorkOrder,
  onCreateInvoice,
  menuItems
}) => {
  const { t } = useTranslation();

  const getStatusBadge = () => {
      switch(status) {
          case 'Sent': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
          case 'Approved': return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
          case 'Paid': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-800/40 dark:text-green-200 dark:border-green-700';
          case 'Archived': return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
          default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      }
  };

  // --- Action Definitions ---
  
  const handleClientPreview = () => setViewMode('client');

  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 xl:gap-6 mb-6 md:mb-8 flex-wrap">
      <div className="flex-1 w-full xl:w-auto space-y-2 min-w-[300px]">
        <div className="group">
          <label className={`${Typography.label} flex items-center gap-2`}>
            {t('views.EstimateForm.sections.ProjectToolbar.projectName')}
            {!readOnly && (
                <span className="text-gray-300 dark:text-gray-600 font-medium normal-case tracking-normal text-[10px] md:text-xs transition-opacity opacity-50 group-hover:opacity-100">
                {t('views.EstimateForm.sections.ProjectToolbar.clickToEdit')}
                </span>
            )}
          </label>
          <div className="relative w-full">
            <input 
              type="text" 
              value={projectName} 
              disabled={readOnly}
              onChange={(e) => setProjectName(e.target.value)} 
              className={`text-2xl md:text-3xl lg:text-4xl font-extrabold bg-transparent border-b-2 border-transparent outline-none w-full font-heading transition-all px-0 py-1 ${
                readOnly 
                    ? 'text-gray-900 dark:text-white cursor-default' 
                    : 'hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-400 focus:ring-0 text-gray-900 dark:text-white'
              } ${projectName === 'New Estimate' || !projectName ? 'text-gray-300 dark:text-gray-600 placeholder-gray-300 dark:placeholder-gray-600' : ''}`}
              placeholder={t('views.EstimateForm.sections.ProjectToolbar.enterProjectName')}
            />
            {!readOnly && (
                <Edit2 className="w-5 h-5 text-gray-300 dark:text-gray-600 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm text-gray-600 dark:text-gray-300">
            <Hash className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-bold font-mono tracking-wide">{estimateNumber}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${getStatusBadge()}`}>
            {status}
          </div>
        </div>
      </div>
      
      {/* --- DESKTOP BUTTONS (MD+) --- */}
      <div className="hidden md:flex items-center gap-3 w-full md:w-auto mt-2 xl:mt-0 flex-shrink-0">

        {/* Always visible Client Preview (except Invoice Mode) */}
        {!isInvoiceMode && (
             <Button 
                variant="secondary" 
                onClick={handleClientPreview} 
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm justify-center px-4" 
                size="md"
                title={t('views.EstimateForm.sections.ProjectToolbar.clientView')}
            >
                <Eye className="w-5 h-5 xl:mr-2" />
                <span className="hidden xl:inline">{t('views.EstimateForm.sections.ProjectToolbar.clientPreview')}</span>
            </Button>
        )}

        {/* Read Only Actions */}
        {readOnly && (
            <>
                <Button 
                    variant="secondary" 
                    onClick={onEdit} 
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 shadow-sm justify-center px-4" 
                    size="md"
                    title={t('views.EstimateForm.sections.ProjectToolbar.unlockToEdit')}
                >
                    <Lock className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.edit')}</span>
                </Button>

                {status === 'Sent' && (
                    <>
                        <Button 
                            variant="secondary" 
                            onClick={onCreateInvoice}
                            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm justify-center px-4" 
                            size="md"
                        >
                            <DollarSign className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.createInvoice')}</span>
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={onMarkApproved}
                            className="shadow-lg shadow-primary-500/20 justify-center px-4" 
                            size="md"
                        >
                            <CheckCircle2 className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.markApproved')}</span>
                        </Button>
                    </>
                )}

                {status === 'Approved' && onViewInvoice && (
                    <Button 
                        variant="primary" 
                        onClick={onViewInvoice}
                        className="shadow-lg shadow-primary-500/20 justify-center px-4" 
                        size="md"
                    >
                        <Receipt className="w-4 h-4 md:mr-2" /> 
                        <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.viewInvoice')}</span>
                    </Button>
                )}

                {status === 'Paid' && (
                    <>
                        {onViewInvoice && (
                            <Button 
                                variant="secondary" 
                                onClick={onViewInvoice}
                                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm justify-center px-4" 
                                size="md"
                            >
                                <Receipt className="w-4 h-4 md:mr-2" /> 
                                <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.viewInvoice')}</span>
                            </Button>
                        )}
                        {onViewWorkOrder && (
                            <Button 
                                variant="primary" 
                                onClick={onViewWorkOrder}
                                className="shadow-lg shadow-primary-500/20 justify-center px-4" 
                                size="md"
                            >
                                <ClipboardList className="w-4 h-4 md:mr-2" />
                                <span className="hidden md:inline">{t('views.EstimateForm.sections.ProjectToolbar.viewWorkOrder')}</span>
                            </Button>
                        )}
                    </>
                )}
            </>
        )}

        {/* Draft Actions */}
        {!readOnly && (
            <>  
                <Button 
                    variant="secondary" 
                    onClick={onSaveDraft}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm justify-center px-4" 
                    size="md"
                    title={t('views.EstimateForm.sections.ProjectToolbar.saveDraft')}
                >
                    <Save className="w-5 h-5 xl:mr-2" />
                    <span className="hidden xl:inline">{t('views.EstimateForm.sections.ProjectToolbar.saveDraft')}</span>
                </Button>
                
                <Button
                    variant="primary"
                    onClick={onSend}
                    className="shadow-lg shadow-primary-500/20 justify-center px-6"
                    size="md"
                >
                    <Send className="w-5 h-5 mr-2" />
                    <span>{isInvoiceMode ? t('views.EstimateForm.sections.ProjectToolbar.sendInvoice') : t('views.EstimateForm.sections.ProjectToolbar.sendEstimate')}</span>
                </Button>
            </>
        )}

        {menuItems && menuItems.length > 0 && (
            <KebabMenu items={menuItems} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm" />
        )}
      </div>

      {/* --- MOBILE/TABLET BUTTONS (Hidden on Desktop) --- */}
      <div className="md:hidden flex items-center justify-between gap-3 w-full mt-4">
         {!readOnly ? (
            <>
                {!isInvoiceMode && (
                    <button
                        onClick={handleClientPreview}
                        className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
                        title={t('views.EstimateForm.sections.ProjectToolbar.clientPreview')}
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                )}

                {onSaveDraft && (
                    <button
                        onClick={onSaveDraft}
                        className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
                        title={t('views.EstimateForm.sections.ProjectToolbar.saveDraft')}
                    >
                        <Save className="w-5 h-5" />
                    </button>
                )}

                <Button 
                    variant="primary" 
                    onClick={onSend}
                    className="flex-1 shadow-lg shadow-primary-500/20 justify-center whitespace-nowrap" 
                    size="md"
                >
                    <Send className="w-5 h-5 mr-2" />
                    {isInvoiceMode ? t('views.EstimateForm.sections.ProjectToolbar.sendInvoice') : t('views.EstimateForm.sections.ProjectToolbar.sendEstimate')}
                </Button>
            </>
         ) : (
            <div className="flex-1 flex gap-2">
                {status === 'Sent' ? (
                    <Button 
                        variant="primary" 
                        onClick={onMarkApproved}
                        className="w-full shadow-lg shadow-primary-500/20 justify-center" 
                        size="md"
                    >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        {t('views.EstimateForm.sections.ProjectToolbar.markApproved')}
                    </Button>
                ) : status === 'Approved' && onViewInvoice ? (
                    <Button 
                        variant="primary" 
                        onClick={onViewInvoice}
                        className="w-full shadow-lg shadow-primary-500/20 justify-center" 
                        size="md"
                    >
                        <Receipt className="w-5 h-5 mr-2" />
                        {t('views.EstimateForm.sections.ProjectToolbar.viewInvoice')}
                    </Button>
                ) : status === 'Paid' && onViewWorkOrder ? (
                    <Button 
                        variant="primary" 
                        onClick={onViewWorkOrder}
                        className="w-full shadow-lg shadow-primary-500/20 justify-center" 
                        size="md"
                    >
                        <ClipboardList className="w-5 h-5 mr-2" />
                        {t('views.EstimateForm.sections.ProjectToolbar.viewWorkOrder')}
                    </Button>
                ) : (
                    <Button 
                        variant="secondary" 
                        onClick={onEdit} 
                        className="w-full justify-center" 
                        size="md"
                    >
                        <Lock className="w-5 h-5 mr-2" /> {t('views.EstimateForm.sections.ProjectToolbar.editEstimate')}
                    </Button>
                )}
            </div>
         )}

         {menuItems && menuItems.length > 0 && (
            <KebabMenu items={menuItems} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm" />
         )}
      </div>
    </div>
  );
};
