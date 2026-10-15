
import React from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { ProjectToolbar } from './sections/ProjectToolbar';
import { TemplateToolbar } from './sections/TemplateToolbar';
import { EstimateHeader } from './sections/EstimateHeader';
import { ClientInfo } from './sections/ClientInfo';
import { ScopeOfWork } from './sections/ScopeOfWork';
import { Notes } from './sections/Notes';
import { PaintCard } from './sections/PaintCard';
import { PaintMaterialsSummary } from './sections/PaintMaterialsSummary';
import { LaborSummary } from './sections/LaborSummary';
import { Finalize } from './sections/Finalize';
import { EstimateArea, MiscLineItem, GlobalSettings, PaintColorEntry, Material, EstimateRow, ProductionRate, TermsTemplate } from '../../../types';
import { AreaNavigator } from '../../widgets/AreaNavigator';

interface EstimateFormLayoutProps {
  // New Prop to control visibility
  hideHeader?: boolean;
  mode?: 'estimate' | 'template'; // Control mode

  // Optional package switcher, rendered as a labeled section atop the estimate content.
  packagesSlot?: React.ReactNode;

  // Overflow (⋮) menu actions, forwarded to the project toolbar.
  menuItems?: { label: string; onClick: () => void; icon?: React.ElementType; className?: string }[];

  // Page Title
  formTitle?: string;
  isInvoiceMode?: boolean;

  // Project Toolbar Props
  projectName: string;
  setProjectName: (name: string) => void;
  estimateNumber: string;
  viewMode: 'edit' | 'client';
  setViewMode: (mode: 'edit' | 'client') => void;

  // Template Specific
  templateDescription?: string;
  setTemplateDescription?: (desc: string) => void;
  selectedScopeIds?: string[];
  onUpdateScopes?: (ids: string[]) => void;

  // Header Props
  salesman: any;
  onOpenSalesmanModal: () => void;

  // Client Info Props
  customer: any;
  jobAddress: any;
  estimateDate: string;
  validUntilDate: string;
  onOpenEditClient: () => void;
  onOpenEditJobSite: () => void;
  onOpenEditDates: () => void;

  // Paint Card Props
  paintColors: PaintColorEntry[];
  materials: Material[];
  getGallonsForPaintRow: (colorCode: string, productId: string) => number;
  openAreaSelector: (context: 'paint-row' | 'line-item', rowId?: string) => void;
  removeSurfaceFromRow: (rowId: string, surfaceName: string) => void;
  openAddSurfaceModal: (rowId: string) => void;
  updatePaintRow: (id: string, field: string, value: any) => void;
  openColorModal: (rowId: string) => void;
  openSheenModal: (rowId: string) => void;
  openProductModal: (rowId: string) => void; 
  removePaintRow: (id: string) => void;
  addPaintRow: () => void;
  paintSectionRef: React.RefObject<HTMLDivElement | null>;
  onShowBreakdown?: (colorCode: string) => void;

  // Scope of Work Props
  formLayout: string[];
  estimateAreas: EstimateArea[];
  lineItems: Record<string, MiscLineItem>;
  areaSummaries: { id: string; totalHours: number; totalCost: number }[];
  settings: GlobalSettings;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleRowDragStart: (e: React.DragEvent, areaId: string, rowId: string) => void;
  handleRowDrop: (e: React.DragEvent, areaId: string, targetRowId: string) => void;
  handleUpdateAreaName: (areaId: string, currentName: string, newName: string) => void;
  handleDeleteAreaBlock: (id: string) => void;
  handleDuplicateArea: (areaId: string) => void;
  setIsColumnConfigOpen: (val: boolean) => void;
  handleSaveAreaAsTemplate: (area: EstimateArea) => void;
  openRichTextModal: (id: string, initialValue: string, title: string) => void;
  updateAreaOptional: (areaId: string, isOptional: boolean) => void;
  setEstimateAreas: React.Dispatch<React.SetStateAction<EstimateArea[]>>;
  updateAreaRow: (areaId: string, rowId: string, field: keyof EstimateRow | string, value: any) => void;
  deleteAreaRow: (areaId: string, rowId: string) => void;
  handleOpenBreakdown: (areaName: string, row: EstimateRow) => void;
  updateAreaNote: (areaId: string, note: string | undefined) => void;
  handleDeleteMiscItemBlock: (id: string) => void;
  updateMiscLineItem: (id: string, field: keyof MiscLineItem, value: any) => void;
  openAddItemModal: (areaId: string) => void;
  setIsLineItemModalOpen: (val: boolean) => void;

  // New Paint Mode Props
  paintingModeColorId?: string | null;
  handlePaintRow?: (areaId: string, rowId: string) => void;

  // Palette Logic Props
  paintColorsState?: PaintColorEntry[];
  setPaintColorsState?: React.Dispatch<React.SetStateAction<PaintColorEntry[]>>;
  setPaintingModeColorId?: (id: string | null) => void;
  onAddColor?: () => void;
  onEditColor?: (id: string) => void;
  onRemoveColor?: (id: string) => void;
  
  // New Color Check
  checkForNewColor?: (colorCode: string) => void;

  // Notes Props
  notes: { customer: string; internal: string; };
  setNotes: React.Dispatch<React.SetStateAction<{ customer: string; internal: string; }>>;

  // Materials Summary Props
  calculatedPaintMaterials: any[];
  sundries: any[];
  materialsTotal: number;
  handleSundryChange: (id: string, field: 'count' | 'unitPrice', value: number) => void;
  handleMaterialDelete: (id: string) => void;
  setIsSundryModalOpen: (val: boolean) => void;

  // Labor Summary Props
  grandTotalData: any[];
  grandTotalSum: { app: number; prep: number; total: number; };

  // Finalize Props
  financials: {
    selectedAccessTierId: string;
    selectedHeightTierId: string;
    taxId: string;
    baseGrandTotal: number;
    burdenRate?: number;
    opexRate?: number;
    baseTaxAmount?: number;
    baseDiscountAmount?: number;
  };
  setFinancials: React.Dispatch<React.SetStateAction<any>>;
  pricingMethod: 'hourly' | 'labor';
  setPricingMethod: (method: 'hourly' | 'labor') => void;
  finalize: { deposit: string; terms: string; };
  setFinalize: React.Dispatch<React.SetStateAction<{ deposit: string; terms: string; }>>;
  baseTotals: { hours: number; };
  baseMiscTotal: number;
  paintCost?: number;
  sundriesCost?: number;
  
  // Terms Templates
  termsTemplates?: TermsTemplate[];
  
  // New: Override Handler
  onToggleMiscOverhead?: (exclude: boolean) => void;
  excludeMiscOverhead?: boolean;

  onMoveColumn?: (fromIndex: number, toIndex: number) => void;
  setActiveAreaForConfig?: (id: string | null) => void;

  // Added rates prop
  rates: ProductionRate[];
  isExterior?: boolean;

  // Send Logic
  onSend?: () => void;
  onSaveDraft?: () => void;

  // --- Read Only / Status Props ---
  status?: string;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMarkPaid?: () => void;
  onMarkApproved?: () => void;
  onViewInvoice?: () => void;
  onViewWorkOrder?: () => void;
  onCreateInvoice?: () => void; 
}

export const EstimateFormLayout: React.FC<EstimateFormLayoutProps> = (props) => {
  const { t } = useTranslation();
  return (
    <div className={props.hideHeader ? "" : "w-full max-w-[1200px] mx-auto my-4 md:my-6 px-4 md:px-6 lg:px-8"}>
      {/* TOOLBAR SWITCHING */}
      {props.mode === 'template' ? (
          <TemplateToolbar
              templateName={props.projectName}
              setTemplateName={props.setProjectName}
              description={props.templateDescription || ''}
              setDescription={props.setTemplateDescription || (() => {})}
              onSave={props.onSaveDraft || (() => {})}
              onBack={props.onDelete || (() => {})} // Back handled by delete prop in this setup
              scopes={props.settings.scopes}
              selectedScopeIds={props.selectedScopeIds}
              onUpdateScopes={props.onUpdateScopes}
          />
      ) : (
          !props.hideHeader && (
            <div id="estimate-toolbar-section">
                <ProjectToolbar
                    projectName={props.projectName}
                    setProjectName={props.setProjectName}
                    estimateNumber={props.estimateNumber}
                    viewMode={props.viewMode}
                    setViewMode={props.setViewMode}
                    onSend={props.onSend}
                    onSaveDraft={props.onSaveDraft}
                    isInvoiceMode={props.isInvoiceMode}
                    // Status & Actions
                    status={props.status}
                    readOnly={props.readOnly}
                    onEdit={props.onEdit}
                    onDelete={props.onDelete}
                    onMarkPaid={props.onMarkPaid}
                    onMarkApproved={props.onMarkApproved}
                    onViewInvoice={props.onViewInvoice}
                    onViewWorkOrder={props.onViewWorkOrder}
                    onCreateInvoice={props.onCreateInvoice}
                    menuItems={props.menuItems}
                />
            </div>
          )
      )}

      <div className={props.hideHeader ? "" : "bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border border-gray-200 dark:border-gray-700 transition-colors"}>
        {/* HEADER & CLIENT INFO - HIDE IF TEMPLATE */}
        {props.mode !== 'template' && !props.hideHeader && (
            <>
            <EstimateHeader
                salesman={props.salesman}
                onOpenSalesmanModal={props.readOnly ? () => {} : props.onOpenSalesmanModal}
                title={props.formTitle}
            />
            <div className="px-4 md:px-12 pt-8" id="estimate-client-section">
                <ClientInfo
                    customer={props.customer}
                    jobAddress={props.jobAddress}
                    estimateDate={props.estimateDate}
                    validUntilDate={props.validUntilDate}
                    onOpenEditClient={props.readOnly ? () => {} : props.onOpenEditClient}
                    onOpenEditJobSite={props.readOnly ? () => {} : props.onOpenEditJobSite}
                    onOpenEditDates={props.readOnly ? () => {} : props.onOpenEditDates}
                />
            </div>
            </>
        )}

        <div className={props.hideHeader ? "space-y-6 md:space-y-12" : "p-4 md:p-12 space-y-6 md:space-y-12"}>

          {/* Packages section */}
          {props.packagesSlot && (
            <div id="packages-section" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('packageSwitcher.sectionTitle')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('packageSwitcher.sectionHelp')}</p>
              </div>
              {props.packagesSlot}
            </div>
          )}

          {/* Paint Card Moved to Top */}
          <div id="paint-card-section">
            <PaintCard
                paintColors={props.paintColors}
                materials={props.materials}
                estimateAreas={props.estimateAreas}
                getGallonsForPaintRow={props.getGallonsForPaintRow}
                updatePaintRow={props.updatePaintRow}
                openColorModal={props.openColorModal}
                openSheenModal={props.openSheenModal}
                openProductModal={props.openProductModal}
                removePaintRow={props.removePaintRow}
                addPaintRow={props.onAddColor || props.addPaintRow}
                paintSectionRef={props.paintSectionRef}
                openAreaSelector={props.openAreaSelector}
                removeSurfaceFromRow={props.removeSurfaceFromRow}
                openAddSurfaceModal={props.openAddSurfaceModal}
                onTogglePaintMode={props.setPaintingModeColorId}
                onEditColor={props.onEditColor}
                onShowBreakdown={props.onShowBreakdown}
                readOnly={props.readOnly}
            />
          </div>

          {/* Main Content Area */}
          <div id="scope-section">
            <ScopeOfWork
                formLayout={props.formLayout}
                estimateAreas={props.estimateAreas}
                lineItems={props.lineItems}
                areaSummaries={props.areaSummaries}
                settings={props.settings}
                materials={props.materials}
                paintColors={props.paintColors}
                handleDragStart={props.handleDragStart}
                handleDragOver={props.handleDragOver}
                handleDrop={props.handleDrop}
                handleRowDragStart={props.handleRowDragStart}
                handleRowDrop={props.handleRowDrop}
                handleUpdateAreaName={props.handleUpdateAreaName}
                handleDeleteAreaBlock={props.handleDeleteAreaBlock}
                handleDuplicateArea={props.handleDuplicateArea}
                setIsColumnConfigOpen={props.setIsColumnConfigOpen}
                handleSaveAreaAsTemplate={props.handleSaveAreaAsTemplate}
                openRichTextModal={props.openRichTextModal}
                updateAreaOptional={props.updateAreaOptional}
                setEstimateAreas={props.setEstimateAreas}
                updateAreaRow={props.updateAreaRow}
                deleteAreaRow={props.deleteAreaRow}
                handleOpenBreakdown={props.handleOpenBreakdown}
                updateAreaNote={props.updateAreaNote}
                handleDeleteMiscItemBlock={props.handleDeleteMiscItemBlock}
                updateMiscLineItem={props.updateMiscLineItem}
                openAddItemModal={props.openAddItemModal}
                setIsLineItemModalOpen={props.setIsLineItemModalOpen}
                
                // Pass Paint Mode Props
                paintingModeColorId={props.paintingModeColorId}
                handlePaintRow={props.handlePaintRow}
                checkForNewColor={props.checkForNewColor}
                onMoveColumn={props.onMoveColumn}
                setActiveAreaForConfig={props.setActiveAreaForConfig}
                
                // Pass rates
                rates={props.rates}
                isExterior={props.isExterior}
                readOnly={props.readOnly}
            />
          </div>

          <Notes
            notes={props.notes}
            setNotes={props.setNotes}
          />

          <PaintMaterialsSummary
            calculatedPaintMaterials={props.calculatedPaintMaterials}
            sundries={props.sundries}
            materialsTotal={props.materialsTotal}
            handleSundryChange={props.handleSundryChange}
            handleMaterialDelete={props.handleMaterialDelete}
            setIsSundryModalOpen={props.setIsSundryModalOpen}
          />

          <LaborSummary
            grandTotalData={props.grandTotalData}
            grandTotalSum={props.grandTotalSum}
          />

          {/* Render Finalize or Simplified Settings */}
          {props.hideHeader ? (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('views.EstimateForm.EstimateFormLayout.defaultTermsFinancials')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 relative">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('views.EstimateForm.EstimateFormLayout.defaultDepositTerms')}</label>
                          <textarea 
                            className="w-full bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 resize-none min-h-[120px]" 
                            rows={5} 
                            value={props.finalize.deposit} 
                            onChange={(e) => props.setFinalize({...props.finalize, deposit: e.target.value})} 
                          />
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 relative group">
                          <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">{t('views.EstimateForm.EstimateFormLayout.defaultContractTerms')}</label>
                              
                              {/* Template Selection for Terms */}
                              {props.termsTemplates && props.termsTemplates.length > 0 && (
                                <div className="relative">
                                    <select 
                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:border-primary-500 cursor-pointer hover:border-primary-400 transition-colors"
                                        onChange={(e) => {
                                            const tmpl = props.termsTemplates?.find(t => t.id === e.target.value);
                                            if (tmpl) props.setFinalize({...props.finalize, terms: tmpl.content});
                                        }}
                                        value=""
                                    >
                                        <option value="" disabled>{t('views.EstimateForm.EstimateFormLayout.loadTemplate')}</option>
                                        {props.termsTemplates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                              )}
                          </div>
                          <textarea 
                            className="w-full bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 resize-none min-h-[120px]" 
                            rows={5} 
                            value={props.finalize.terms} 
                            onChange={(e) => props.setFinalize({...props.finalize, terms: e.target.value})} 
                          />
                      </div>
                  </div>
              </div>
          ) : (
            <div id="estimate-finalize-section">
                <Finalize
                    settings={props.settings}
                    financials={props.financials}
                    setFinancials={props.setFinancials}
                    pricingMethod={props.pricingMethod}
                    setPricingMethod={props.setPricingMethod}
                    finalize={props.finalize}
                    setFinalize={props.setFinalize}
                    baseTotals={props.baseTotals}
                    baseMiscTotal={props.baseMiscTotal}
                    paintCost={props.paintCost || 0}
                    sundriesCost={props.sundriesCost || 0}
                    onToggleMiscOverhead={props.onToggleMiscOverhead}
                    excludeMiscOverhead={props.excludeMiscOverhead}
                    onSend={props.readOnly ? undefined : props.onSend} // Hide Send button if read-only (handled by toolbar)
                    isTemplate={props.mode === 'template'}
                />
            </div>
          )}
        </div>
      </div>
      
      {/* Rapid Navigation Dock */}
      {!props.hideHeader && (
        <AreaNavigator areas={props.estimateAreas} />
      )}
    </div>
  );
};
