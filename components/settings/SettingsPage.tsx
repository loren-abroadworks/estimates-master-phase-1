
import React, { useState } from 'react';
import {
  GlobalSettings, ProductionRate, Material, LineItemTemplate, TermsTemplate, PackageDescriptionTemplate,
  UnitType, ConfiguredScope, AreaTemplate, TaxRegion, ProductionRateCategory, DifficultyTier, CrewMember, ActivityLogEntry
} from '../../types';
import { SettingsLayout } from './SettingsLayout';
import { Modal, TextInput, InputGroup, Select, NumberInput, Button, Toggle, TextArea } from '../UI';
import { Wand2, TrendingUp, Trash2 } from 'lucide-react';
import { AddEmployeeModal } from '../modals/AddEmployeeModal';
import AddMaterialModal from '../modals/AddMaterialModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface SettingsPageProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  rates: ProductionRate[];
  setRates: React.Dispatch<React.SetStateAction<ProductionRate[]>>;
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  lineItemTemplates: LineItemTemplate[];
  setLineItemTemplates: React.Dispatch<React.SetStateAction<LineItemTemplate[]>>;
  termsTemplates: TermsTemplate[];
  setTermsTemplates: React.Dispatch<React.SetStateAction<TermsTemplate[]>>;
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  setPackageDescriptionTemplates: React.Dispatch<React.SetStateAction<PackageDescriptionTemplate[]>>;
  
  templates: any[];
  onCreateTemplate: () => void;
  onEditTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;

  onAddMaterial: () => void;
  onAddPaint: () => void;
  onEditMaterial: (m: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onToggleDefaultMaterial: (m: Material) => void;

  employees: CrewMember[];
  onAddEmployee: (e: CrewMember) => void;
  onEditEmployee: (e: CrewMember) => void;
  onDeleteEmployee: (id: string) => void;
  
  onRestartTour?: () => void;

  // Schedule activity log (audit trail of reschedules / moves / locks)
  activityLog?: ActivityLogEntry[];

  // Theme props
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = (props) => {
  const { t } = useTranslation();
  const { settings, setSettings, rates, setRates, lineItemTemplates, setLineItemTemplates, termsTemplates, setTermsTemplates, packageDescriptionTemplates, setPackageDescriptionTemplates, materials, setMaterials } = props;

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState<Partial<ProductionRate>>({ name: '', unit: UnitType.SQFT, baseRate: 150, defaultCoats: 2 });
  const [useSmartRateLogic, setUseSmartRateLogic] = useState(false);
  const [rateMultipliers, setRateMultipliers] = useState({ coat2: 1.25, coat3: 1.35, coat4: 1.5 });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configType, setConfigType] = useState<'discount' | 'height' | 'access' | null>(null);
  const [configItem, setConfigItem] = useState<any>({});

  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<Partial<ConfiguredScope>>({});

  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<Partial<AreaTemplate>>({});

  const [isLineItemModalOpen, setIsLineItemModalOpen] = useState(false);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [lineItemData, setLineItemData] = useState<Partial<LineItemTemplate>>({});

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [editingTermsId, setEditingTermsId] = useState<string | null>(null);
  const [termsData, setTermsData] = useState<Partial<TermsTemplate>>({});

  const [isPkgDescModalOpen, setIsPkgDescModalOpen] = useState(false);
  const [editingPkgDescId, setEditingPkgDescId] = useState<string | null>(null);
  const [pkgDescData, setPkgDescData] = useState<Partial<PackageDescriptionTemplate>>({});

  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [taxData, setTaxData] = useState<Partial<TaxRegion>>({});
  const [zipCodesString, setZipCodesString] = useState('');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryOldName, setEditingCategoryOldName] = useState<string | null>(null);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<CrewMember | undefined>(undefined);
  const [employeeModalTab, setEmployeeModalTab] = useState<'profile' | 'schedule'>('profile');

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialMode, setMaterialMode] = useState<'paint' | 'general'>('general');
  const [materialToEdit, setMaterialToEdit] = useState<Material | undefined>(undefined);

  const handleAddRate = (category?: string) => {
    setEditingRateId(null);
    setNewRate({ name: '', category: category || settings.productionRateCategories[0]?.name || 'General', unit: UnitType.SQFT, baseRate: 150, defaultCoats: 2 });
    setUseSmartRateLogic(false);
    setIsRateModalOpen(true);
  };

  const handleEditRate = (r: ProductionRate) => {
    setEditingRateId(r.id);
    setNewRate(r);
    setUseSmartRateLogic(false);
    setIsRateModalOpen(true);
  };

  const handleDeleteRate = (id: string) => {
    setRates(rates.filter(r => r.id !== id));
  };

  const updateRateValues = (base: number, mults: typeof rateMultipliers) => {
    const c2 = Math.round(base * mults.coat2);
    const c3 = Math.round(base * mults.coat3);
    const c4 = Math.round(base * mults.coat4);
    setNewRate(prev => ({
        ...prev, 
        baseRate: base,
        rate2ndCoat: c2,
        rate3rdCoat: c3,
        rate4thCoat: c4
    }));
  };

  const handleSaveRate = () => {
    if (!newRate.name) return;
    const rateToSave = { ...newRate, id: editingRateId || `pr-${Date.now()}` } as ProductionRate;
    if (editingRateId) {
        setRates(rates.map(r => r.id === editingRateId ? rateToSave : r));
    } else {
        setRates([...rates, rateToSave]);
    }
    setIsRateModalOpen(false);
  };

  const handleAddConfigItem = (type: 'discount' | 'height' | 'access') => {
    setConfigType(type);
    setConfigItem({ id: '', name: '', value: 0, multiplier: 1.0, type: 'percent' });
    setIsConfigModalOpen(true);
  };

  const handleEditConfigItem = (type: 'discount' | 'height' | 'access', item: any) => {
    setConfigType(type);
    setConfigItem({ ...item });
    setIsConfigModalOpen(true);
  };

  const handleDeleteConfigItem = (type: 'discount' | 'height' | 'access', id: string) => {
    if (type === 'discount') {
        setSettings({...settings, projectDiscounts: settings.projectDiscounts.filter(d => d.id !== id)});
    } else if (type === 'height') {
        setSettings({...settings, heightTiers: settings.heightTiers.filter(t => t.id !== id)});
    } else if (type === 'access') {
        setSettings({...settings, accessTiers: settings.accessTiers.filter(t => t.id !== id)});
    }
  };

  const handleSaveConfigItem = () => {
    if (!configType || !configItem.name) return;
    const id = configItem.id || `${configType === 'discount' ? 'disc' : (configType === 'height' ? 'ht' : 'acc')}-${Date.now()}`;
    const newItem = { ...configItem, id };

    if (configType === 'discount') {
        const list = settings.projectDiscounts.some(d => d.id === id) 
            ? settings.projectDiscounts.map(d => d.id === id ? newItem : d)
            : [...settings.projectDiscounts, newItem];
        setSettings({...settings, projectDiscounts: list});
    } else if (configType === 'height') {
        const list = settings.heightTiers.some(t => t.id === id)
            ? settings.heightTiers.map(t => t.id === id ? newItem : t)
            : [...settings.heightTiers, newItem];
        setSettings({...settings, heightTiers: list});
    } else if (configType === 'access') {
        const list = settings.accessTiers.some(t => t.id === id)
            ? settings.accessTiers.map(t => t.id === id ? newItem : t)
            : [...settings.accessTiers, newItem];
        setSettings({...settings, accessTiers: list});
    }
    setIsConfigModalOpen(false);
  };

  const handleAddScope = () => {
      setEditingScopeId(null);
      setScopeData({ name: '', description: '', defaultLaborRate: 65, defaultAreaTemplateIds: [], profitMargin: 0 });
      setIsScopeModalOpen(true);
  };
  const handleEditScope = (s: ConfiguredScope) => {
      setEditingScopeId(s.id);
      setScopeData(s);
      setIsScopeModalOpen(true);
  };
  const handleSaveScope = () => {
      if(!scopeData.name) return;
      const newScope = { ...scopeData, id: editingScopeId || `scope-${Date.now()}` } as ConfiguredScope;
      const list = editingScopeId 
        ? settings.scopes.map(s => s.id === editingScopeId ? newScope : s)
        : [...settings.scopes, newScope];
      setSettings({...settings, scopes: list});
      setIsScopeModalOpen(false);
  };
  const handleDeleteScope = (id: string) => {
      setSettings({...settings, scopes: settings.scopes.filter(s => s.id !== id)});
  };

  const handleAddArea = () => {
      setEditingAreaId(null);
      setAreaData({ name: '', scopeId: settings.scopes[0]?.id, defaultRateIds: [] });
      setIsAreaModalOpen(true);
  };
  const handleEditArea = (a: AreaTemplate) => {
      setEditingAreaId(a.id);
      setAreaData(a);
      setIsAreaModalOpen(true);
  };
  const handleSaveArea = () => {
      if(!areaData.name) return;
      const newArea = { ...areaData, id: editingAreaId || `area-${Date.now()}` } as AreaTemplate;
      const list = editingAreaId 
        ? settings.areaTemplates.map(a => a.id === editingAreaId ? newArea : a)
        : [...settings.areaTemplates, newArea];
      setSettings({...settings, areaTemplates: list});
      setIsAreaModalOpen(false);
  };
  const handleDeleteArea = (id: string) => {
      setSettings({...settings, areaTemplates: settings.areaTemplates.filter(a => a.id !== id)});
  };

  const handleAddLineItem = () => {
      setEditingLineItemId(null);
      setLineItemData({ type: 'priced', name: '', description: '', defaultPrice: 0, operationType: 'flat' });
      setIsLineItemModalOpen(true);
  };
  const handleEditLineItem = (t: LineItemTemplate) => {
      setEditingLineItemId(t.id);
      setLineItemData(t);
      setIsLineItemModalOpen(true);
  };
  const handleSaveLineItem = () => {
      if(!lineItemData.name) return;
      const newItem = { ...lineItemData, id: editingLineItemId || `li-${Date.now()}` } as LineItemTemplate;
      const list = editingLineItemId 
        ? lineItemTemplates.map(t => t.id === editingLineItemId ? newItem : t)
        : [...lineItemTemplates, newItem];
      setLineItemTemplates(list);
      setIsLineItemModalOpen(false);
  };
  const handleDeleteLineItem = (id: string) => {
      setLineItemTemplates(lineItemTemplates.filter(t => t.id !== id));
  };

  const handleAddTerms = () => {
      setEditingTermsId(null);
      setTermsData({ name: '', content: '' });
      setIsTermsModalOpen(true);
  };
  const handleEditTerms = (t: TermsTemplate) => {
      setEditingTermsId(t.id);
      setTermsData(t);
      setIsTermsModalOpen(true);
  };
  const handleSaveTerms = () => {
      if(!termsData.name) return;
      const newItem = { ...termsData, id: editingTermsId || `term-${Date.now()}` } as TermsTemplate;
      const list = editingTermsId 
        ? termsTemplates.map(t => t.id === editingTermsId ? newItem : t)
        : [...termsTemplates, newItem];
      setTermsTemplates(list);
      setIsTermsModalOpen(false);
  };
  const handleDeleteTerms = (id: string) => {
      setTermsTemplates(termsTemplates.filter(t => t.id !== id));
  };

  const handleAddPkgDesc = () => {
      setEditingPkgDescId(null);
      setPkgDescData({ name: '', description: '' });
      setIsPkgDescModalOpen(true);
  };
  const handleEditPkgDesc = (t: PackageDescriptionTemplate) => {
      setEditingPkgDescId(t.id);
      setPkgDescData(t);
      setIsPkgDescModalOpen(true);
  };
  const handleSavePkgDesc = () => {
      if (!pkgDescData.name) return;
      const newItem = { ...pkgDescData, id: editingPkgDescId || `pdt-${Date.now()}` } as PackageDescriptionTemplate;
      const list = editingPkgDescId
        ? packageDescriptionTemplates.map(t => t.id === editingPkgDescId ? newItem : t)
        : [...packageDescriptionTemplates, newItem];
      setPackageDescriptionTemplates(list);
      setIsPkgDescModalOpen(false);
  };
  const handleDeletePkgDesc = (id: string) => {
      setPackageDescriptionTemplates(packageDescriptionTemplates.filter(t => t.id !== id));
  };

  const handleAddTaxRegion = () => {
      setEditingTaxId(null);
      setTaxData({ name: '', salesTaxRate: 0, serviceTaxRate: 0, zipCodes: [] });
      setZipCodesString('');
      setIsTaxModalOpen(true);
  };
  const handleEditTaxRegion = (t: TaxRegion) => {
      setEditingTaxId(t.id);
      setTaxData(t);
      setZipCodesString(t.zipCodes.join(', '));
      setIsTaxModalOpen(true);
  };
  const handleSaveTaxRegion = () => {
      if(!taxData.name) return;
      const zips = zipCodesString.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const newItem = { ...taxData, zipCodes: zips, id: editingTaxId || `tr-${Date.now()}` } as TaxRegion;
      const list = editingTaxId 
        ? settings.taxRegions.map(t => t.id === editingTaxId ? newItem : t)
        : [...settings.taxRegions, newItem];
      setSettings({...settings, taxRegions: list});
      setIsTaxModalOpen(false);
  };
  const handleDeleteTaxRegion = (id: string) => {
      setSettings({...settings, taxRegions: settings.taxRegions.filter(t => t.id !== id)});
  };

  const handleAddCategory = () => {
      setNewCategoryName('');
      setEditingCategoryOldName(null);
      setIsCategoryModalOpen(true);
  };
  
  const handleEditCategory = (catName: string) => {
      setNewCategoryName(catName);
      setEditingCategoryOldName(catName);
      setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = () => {
      if(!newCategoryName) return;
      
      if (editingCategoryOldName) {
          const updatedCategories = settings.productionRateCategories.map(c => 
              c.name === editingCategoryOldName ? { ...c, name: newCategoryName } : c
          );
          setSettings({ ...settings, productionRateCategories: updatedCategories });
          
          const updatedRates = rates.map(r => 
              r.category === editingCategoryOldName ? { ...r, category: newCategoryName } : r
          );
          setRates(updatedRates);
      } else {
          const newCat = { id: `cat-${Date.now()}`, name: newCategoryName, scopeIds: [] };
          setSettings({...settings, productionRateCategories: [...settings.productionRateCategories, newCat]});
      }
      setIsCategoryModalOpen(false);
  };
  
  const handleDeleteCategory = (catName: string) => {
      setSettings({...settings, productionRateCategories: settings.productionRateCategories.filter(c => c.name !== catName)});
  };

  const handleAddEmployeeClick = () => {
      setEmployeeToEdit(undefined);
      setEmployeeModalTab('profile');
      setIsEmployeeModalOpen(true);
  };

  const handleEditEmployeeClick = (emp: CrewMember, tab: 'profile' | 'schedule' = 'profile') => {
      setEmployeeToEdit(emp);
      setEmployeeModalTab(tab);
      setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (emp: CrewMember) => {
      if (employeeToEdit) {
          props.onEditEmployee(emp);
      } else {
          props.onAddEmployee(emp);
      }
      setIsEmployeeModalOpen(false);
  };

  const handleAddPaint = () => {
      setMaterialMode('paint');
      setMaterialToEdit(undefined);
      setIsMaterialModalOpen(true);
  };

  const handleAddMaterial = () => {
      setMaterialMode('general');
      setMaterialToEdit(undefined);
      setIsMaterialModalOpen(true);
  };

  const handleEditMaterial = (m: Material) => {
      const isPaint = ['Paint', 'Primer', 'Stain'].includes(m.category);
      setMaterialMode(isPaint ? 'paint' : 'general');
      const defaults: any = { ...m };
      if (!isPaint && m.containers.length > 0) {
          defaults.price = m.containers[0].price;
          defaults.unitLabel = m.containers[0].sizeLabel;
      }
      setMaterialToEdit(defaults);
      setIsMaterialModalOpen(true);
  };

  const handleDeleteMaterial = (id: string) => {
      if (window.confirm(t('settings.SettingsPage.confirmDeleteItem'))) {
          setMaterials(materials.filter(m => m.id !== id));
      }
  };

  const handleToggleDefaultMaterial = (m: Material) => {
      setMaterials(materials.map(mat => mat.id === m.id ? { ...mat, isDefault: !mat.isDefault } : mat));
  };

  const handleSaveMaterial = (m: Material) => {
      if (materialToEdit) {
          setMaterials(materials.map(mat => mat.id === m.id ? m : mat));
      } else {
          setMaterials([...materials, m]);
      }
      setIsMaterialModalOpen(false);
  };

  return (
    <>
      <SettingsLayout 
        {...props}
        onAddRate={handleAddRate}
        onEditRate={handleEditRate}
        onDeleteRate={handleDeleteRate}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddConfigItem={handleAddConfigItem}
        onEditConfigItem={handleEditConfigItem}
        onDeleteConfigItem={handleDeleteConfigItem}
        onAddScope={handleAddScope}
        onEditScope={handleEditScope}
        onDeleteScope={handleDeleteScope}
        onAddArea={handleAddArea}
        onEditArea={handleEditArea}
        onDeleteArea={handleDeleteArea}
        onAddLineItem={handleAddLineItem}
        onEditLineItem={handleEditLineItem}
        onDeleteLineItem={handleDeleteLineItem}
        onAddTerms={handleAddTerms}
        onEditTerms={handleEditTerms}
        onDeleteTerms={handleDeleteTerms}
        packageDescriptionTemplates={packageDescriptionTemplates}
        onAddPkgDesc={handleAddPkgDesc}
        onEditPkgDesc={handleEditPkgDesc}
        onDeletePkgDesc={handleDeletePkgDesc}
        onAddTaxRegion={handleAddTaxRegion}
        onEditTaxRegion={handleEditTaxRegion}
        onDeleteTaxRegion={handleDeleteTaxRegion}
        onAddEmployee={handleAddEmployeeClick}
        onEditEmployee={handleEditEmployeeClick}
        onDeleteEmployee={props.onDeleteEmployee}
        
        onAddPaint={handleAddPaint}
        onAddMaterial={handleAddMaterial}
        onEditMaterial={handleEditMaterial}
        onDeleteMaterial={handleDeleteMaterial}
        onToggleDefaultMaterial={handleToggleDefaultMaterial}
        onRestartTour={props.onRestartTour}
        
        isDarkMode={props.isDarkMode}
        onToggleDarkMode={props.onToggleDarkMode}
      />

      <Modal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} title={editingRateId ? t('settings.SettingsPage.editSurfaceRate') : t('settings.SettingsPage.addSurfaceRate')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.surfaceRateName')} placeholder={t('settings.SettingsPage.enterName')} value={newRate.name || ''} onChange={(v) => setNewRate({...newRate, name: v})} />
              
              <InputGroup label={t('settings.SettingsPage.category')}>
                  <Select value={newRate.category || ''} onChange={(v) => setNewRate({...newRate, category: v})} options={settings.productionRateCategories.map(c => ({label: c.name, value: c.name}))} />
              </InputGroup>

              <div className="grid grid-cols-2 gap-6">
                  <InputGroup label={t('settings.SettingsPage.unitType')}>
                      <Select value={newRate.unit || UnitType.SQFT} onChange={(v) => setNewRate({...newRate, unit: v as UnitType})} options={[{label: t('settings.SettingsPage.sqft'), value: UnitType.SQFT}, {label: t('settings.SettingsPage.lnft'), value: UnitType.LNFT}, {label: t('settings.SettingsPage.item'), value: UnitType.ITEM}]} />
                  </InputGroup>
                  <NumberInput label={t('settings.SettingsPage.defaultCoats')} value={newRate.defaultCoats} onChange={(v) => setNewRate({...newRate, defaultCoats: v})} />
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">{t('settings.SettingsPage.efficiencyRates', { unit: newRate.unit })}</span>
                        <div className="flex items-center gap-2">
                            <Wand2 className={`w-3 h-3 ${useSmartRateLogic ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${useSmartRateLogic ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>{t('settings.SettingsPage.multiplier')}</span>
                            <Toggle 
                                label="" 
                                checked={useSmartRateLogic} 
                                onChange={(v) => {
                                    setUseSmartRateLogic(v);
                                    if (v) updateRateValues(newRate.baseRate || 150, rateMultipliers);
                                }} 
                            />
                        </div>
                  </div>
                  {useSmartRateLogic ? (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                            <NumberInput
                                label={t('settings.SettingsPage.coat1BaseRate')}
                                value={newRate.baseRate}
                                onChange={(v) => updateRateValues(v, rateMultipliers)}
                            />
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <NumberInput
                                        label={t('settings.SettingsPage.coat2Mult')}
                                        value={rateMultipliers.coat2}
                                        step={0.05}
                                        onChange={(val) => {
                                            const next = {...rateMultipliers, coat2: val};
                                            setRateMultipliers(next);
                                            updateRateValues(newRate.baseRate || 0, next);
                                        }}
                                    />
                                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1 font-bold">≈ {Math.round((newRate.baseRate || 0) * rateMultipliers.coat2)}</div>
                                </div>
                                <div>
                                    <NumberInput
                                        label={t('settings.SettingsPage.coat3Mult')}
                                        value={rateMultipliers.coat3}
                                        step={0.05}
                                        onChange={(val) => {
                                            const next = {...rateMultipliers, coat3: val};
                                            setRateMultipliers(next);
                                            updateRateValues(newRate.baseRate || 0, next);
                                        }}
                                    />
                                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1 font-bold">≈ {Math.round((newRate.baseRate || 0) * rateMultipliers.coat3)}</div>
                                </div>
                                <div>
                                    <NumberInput
                                        label={t('settings.SettingsPage.coat4Mult')}
                                        value={rateMultipliers.coat4}
                                        step={0.05}
                                        onChange={(val) => {
                                            const next = {...rateMultipliers, coat4: val};
                                            setRateMultipliers(next);
                                            updateRateValues(newRate.baseRate || 0, next);
                                        }}
                                    />
                                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-1 font-bold">≈ {Math.round((newRate.baseRate || 0) * rateMultipliers.coat4)}</div>
                                </div>
                            </div>
                        </div>
                  ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in">
                        <NumberInput label={t('settings.SettingsPage.firstCoat')} value={newRate.baseRate} onChange={(v) => setNewRate({...newRate, baseRate: v})} placeholder={t('settings.SettingsPage.required')} />
                        <NumberInput label={t('settings.SettingsPage.secondCoat')} value={newRate.rate2ndCoat} onChange={(v) => setNewRate({...newRate, rate2ndCoat: v})} placeholder={t('settings.SettingsPage.optional')} />
                        <NumberInput label={t('settings.SettingsPage.thirdCoat')} value={newRate.rate3rdCoat} onChange={(v) => setNewRate({...newRate, rate3rdCoat: v})} placeholder={t('settings.SettingsPage.optional')} />
                        <NumberInput label={t('settings.SettingsPage.fourthCoat')} value={newRate.rate4thCoat} onChange={(v) => setNewRate({...newRate, rate4thCoat: v})} placeholder={t('settings.SettingsPage.optional')} />
                      </div>
                  )}
              </div>
              <div className="flex gap-3 mt-4">
                  {editingRateId && (
                      <Button
                        variant="danger"
                        onClick={() => {
                            handleDeleteRate(editingRateId);
                            setIsRateModalOpen(false);
                        }}
                        className="px-4 shadow-sm"
                        title={t('settings.SettingsPage.deleteRate')}
                      >
                          <Trash2 className="w-5 h-5" />
                      </Button>
                  )}
                  <Button className="flex-1 justify-center" onClick={handleSaveRate}>{t('settings.SettingsPage.saveSurfaceRate')}</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title={configType === 'discount' ? t('settings.SettingsPage.editDiscount') : t('settings.SettingsPage.editDifficultyTier')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.name')} value={configItem.name || ''} onChange={(v) => setConfigItem({...configItem, name: v})} />
              
              {configType === 'discount' ? (
                  <div className="space-y-4">
                      <InputGroup label={t('settings.SettingsPage.type')}>
                          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                              <button
                                onClick={() => setConfigItem({...configItem, type: 'percent'})}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${configItem.type === 'percent' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                              >{t('settings.SettingsPage.percentage')}</button>
                              <button
                                onClick={() => setConfigItem({...configItem, type: 'flat'})}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${configItem.type === 'flat' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                              >{t('settings.SettingsPage.flatAmount')}</button>
                          </div>
                      </InputGroup>
                      <NumberInput
                        label={configItem.type === 'percent' ? t('settings.SettingsPage.valuePercent') : t('settings.SettingsPage.amountDollar')}
                        value={configItem.value}
                        onChange={(v) => setConfigItem({...configItem, value: v})}
                      />
                  </div>
              ) : (
                  <NumberInput label={t('settings.SettingsPage.multiplierLabel')} value={configItem.multiplier} onChange={(v) => setConfigItem({...configItem, multiplier: v})} step={0.05} />
              )}
              
              <Button className="w-full mt-4" onClick={handleSaveConfigItem}>{t('settings.SettingsPage.saveItem')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isScopeModalOpen} onClose={() => setIsScopeModalOpen(false)} title={t('settings.SettingsPage.editEstimateType')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.typeName')} placeholder={t('settings.SettingsPage.typeNamePlaceholder')} value={scopeData.name || ''} onChange={(v) => setScopeData({...scopeData, name: v})} />
              <TextArea label={t('settings.SettingsPage.description')} value={scopeData.description || ''} onChange={(v) => setScopeData({...scopeData, description: v})} rows={2} />
              <div className="grid grid-cols-1 gap-4">
                  <NumberInput label={t('settings.SettingsPage.defaultHourlyRate')} value={scopeData.defaultLaborRate} onChange={(v) => setScopeData({...scopeData, defaultLaborRate: v})} />
              </div>
              <Button className="w-full mt-4" onClick={handleSaveScope}>{t('settings.SettingsPage.saveEstimateType')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isAreaModalOpen} onClose={() => setIsAreaModalOpen(false)} title={t('settings.SettingsPage.editAreaTemplate')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.templateName')} placeholder={t('settings.SettingsPage.templateNamePlaceholder')} value={areaData.name || ''} onChange={(v) => setAreaData({...areaData, name: v})} />
              <InputGroup label={t('settings.SettingsPage.estimateTypeScope')}>
                  <Select value={areaData.scopeId || ''} onChange={(v) => setAreaData({...areaData, scopeId: v})} options={settings.scopes.map(s => ({label: s.name, value: s.id}))} />
              </InputGroup>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-3">{t('settings.SettingsPage.defaultSurfacesIncluded')}</span>
                  <div className="space-y-2">
                      {rates.map(rate => (
                          <label key={rate.id} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-primary-300">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 accent-primary-600"
                                checked={areaData.defaultRateIds?.includes(rate.id) || false}
                                onChange={(e) => {
                                    const current = areaData.defaultRateIds || [];
                                    if(e.target.checked) setAreaData({...areaData, defaultRateIds: [...current, rate.id]});
                                    else setAreaData({...areaData, defaultRateIds: current.filter(id => id !== rate.id)});
                                }}
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{rate.name}</span>
                          </label>
                      ))}
                  </div>
              </div>
              <Button className="w-full mt-4" onClick={handleSaveArea}>{t('settings.SettingsPage.saveAreaTemplate')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isLineItemModalOpen} onClose={() => setIsLineItemModalOpen(false)} title={t('settings.SettingsPage.editLineItemTemplate')}>
          <div className="space-y-6">
              <InputGroup label={t('settings.SettingsPage.itemType')}>
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                      <button onClick={() => setLineItemData({...lineItemData, type: 'priced'})} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${lineItemData.type === 'priced' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{t('settings.SettingsPage.pricedItem')}</button>
                      <button onClick={() => setLineItemData({...lineItemData, type: 'descriptive'})} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${lineItemData.type === 'descriptive' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{t('settings.SettingsPage.descriptive')}</button>
                  </div>
              </InputGroup>
              <TextInput label={t('settings.SettingsPage.templateName')} value={lineItemData.name || ''} onChange={(v) => setLineItemData({...lineItemData, name: v})} />
              <TextArea label={t('settings.SettingsPage.descriptionContent')} value={lineItemData.description || ''} onChange={(v) => setLineItemData({...lineItemData, description: v})} rows={3} />
              
              {lineItemData.type === 'priced' && (
                  <div className="grid grid-cols-2 gap-4">
                      <InputGroup label={t('settings.SettingsPage.calculation')}>
                          <Select value={lineItemData.operationType || 'flat'} onChange={(v) => setLineItemData({...lineItemData, operationType: v as 'flat' | 'percent'})} options={[{label: t('settings.SettingsPage.flatPrice'), value: 'flat'}, {label: t('settings.SettingsPage.percent'), value: 'percent'}]} />
                      </InputGroup>
                      
                      <div className="space-y-2">
                          <NumberInput
                            label={
                                (lineItemData.operationType !== 'percent' && settings.financialModel?.applyProfitToMisc)
                                    ? t('settings.SettingsPage.baseCost')
                                    : t('settings.SettingsPage.defaultValue')
                            }
                            value={lineItemData.defaultPrice}
                            onChange={(v) => setLineItemData({...lineItemData, defaultPrice: v})}
                          />
                          
                          {(lineItemData.operationType !== 'percent' && settings.financialModel?.applyProfitToMisc) && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-lg animate-in fade-in slide-in-from-top-1">
                                  <div className="flex items-center gap-2 mb-2 text-green-800 dark:text-green-300 text-xs font-bold uppercase tracking-wider">
                                      <TrendingUp className="w-3 h-3" /> {t('settings.SettingsPage.profitBreakdown', { pct: settings.financialModel?.miscExpenseProfit || 0 })}
                                  </div>
                                  <div className="flex justify-between items-center text-sm mb-1">
                                      <span className="text-green-700 dark:text-green-400">{t('settings.SettingsPage.costBasis')}</span>
                                      <span className="font-medium text-green-900 dark:text-green-200">${(lineItemData.defaultPrice || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm mb-2 border-b border-green-200 dark:border-green-700 pb-2">
                                      <span className="text-green-700 dark:text-green-400">{t('settings.SettingsPage.profit')}</span>
                                      <span className="font-medium text-green-900 dark:text-green-200">+${((lineItemData.defaultPrice || 0) * ((settings.financialModel?.miscExpenseProfit || 0) / 100)).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                      <span className="font-bold text-green-800 dark:text-green-300">{t('settings.SettingsPage.clientPrice')}</span>
                                      <span className="font-bold text-green-900 dark:text-green-100 text-lg">${((lineItemData.defaultPrice || 0) * (1 + (settings.financialModel?.miscExpenseProfit || 0) / 100)).toFixed(2)}</span>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}
              <Button className="w-full mt-4" onClick={handleSaveLineItem}>{t('settings.SettingsPage.saveTemplate')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title={t('settings.SettingsPage.editTermsTemplate')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.templateName')} value={termsData.name || ''} onChange={(v) => setTermsData({...termsData, name: v})} />
              <TextArea label={t('settings.SettingsPage.termsConditionsContent')} value={termsData.content || ''} onChange={(v) => setTermsData({...termsData, content: v})} rows={10} />
              <Button className="w-full mt-4" onClick={handleSaveTerms}>{t('settings.SettingsPage.saveTermsTemplate')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isPkgDescModalOpen} onClose={() => setIsPkgDescModalOpen(false)} title={t('settings.SettingsPage.editPackageDescription')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.templateName')} value={pkgDescData.name || ''} onChange={(v) => setPkgDescData({...pkgDescData, name: v})} />
              <TextArea label={t('settings.SettingsPage.descriptionContent')} value={pkgDescData.description || ''} onChange={(v) => setPkgDescData({...pkgDescData, description: v})} rows={8} />
              <Button className="w-full mt-4" onClick={handleSavePkgDesc}>{t('settings.SettingsPage.savePackageDescription')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isTaxModalOpen} onClose={() => setIsTaxModalOpen(false)} title={t('settings.SettingsPage.editTaxRegion')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.regionName')} value={taxData.name || ''} onChange={(v) => setTaxData({...taxData, name: v})} />
              <div className="grid grid-cols-2 gap-4">
                  <NumberInput label={t('settings.SettingsPage.salesTaxRate')} value={taxData.salesTaxRate} onChange={(v) => setTaxData({...taxData, salesTaxRate: v})} step={0.001} />
                  <NumberInput label={t('settings.SettingsPage.serviceTaxRate')} value={taxData.serviceTaxRate} onChange={(v) => setTaxData({...taxData, serviceTaxRate: v})} step={0.001} />
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">{t('settings.SettingsPage.zipCodesLabel')}</label>
                  <input
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 text-sm font-medium text-gray-900 dark:text-white"
                    placeholder={t('settings.SettingsPage.zipCodesPlaceholder')}
                    value={zipCodesString}
                    onChange={(e) => setZipCodesString(e.target.value)}
                  />
              </div>
              <Button className="w-full mt-4" onClick={handleSaveTaxRegion}>{t('settings.SettingsPage.saveRegion')}</Button>
          </div>
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title={editingCategoryOldName ? t('settings.SettingsPage.editGroup') : t('settings.SettingsPage.addRateGroup')}>
          <div className="space-y-6">
              <TextInput label={t('settings.SettingsPage.categoryName')} value={newCategoryName} onChange={setNewCategoryName} placeholder={t('settings.SettingsPage.categoryNamePlaceholder')} />
              <Button className="w-full mt-4" onClick={handleSaveCategory}>{editingCategoryOldName ? t('settings.SettingsPage.updateGroup') : t('settings.SettingsPage.createGroup')}</Button>
          </div>
      </Modal>

      <AddEmployeeModal 
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSave={handleSaveEmployee}
        onDelete={props.onDeleteEmployee}
        employeeToEdit={employeeToEdit}
        initialTab={employeeModalTab}
      />

      <AddMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onSave={handleSaveMaterial}
        defaultValues={materialToEdit}
        mode={materialMode}
      />
    </>
  );
};
