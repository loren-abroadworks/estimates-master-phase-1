
import React, { useState, useRef } from 'react';
import { Building2, MapPin, Globe, Mail, Phone, Palette, Image as ImageIcon, Check, Hash, Save, Upload, X, Edit2 } from 'lucide-react';
import { Card, TextInput, Button, InputGroup, Toggle, Badge, PhoneInput } from '../UI';
import { GlobalSettings, BusinessProfile } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface BusinessSettingsViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const BRAND_PRESETS = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0f172a'
];

export const BusinessSettingsView = ({ settings, setSettings }: BusinessSettingsViewProps) => {
  const { t } = useTranslation();
  const profile = settings.businessProfile;
  const primaryFileInputRef = useRef<HTMLInputElement>(null);
  const invertedFileInputRef = useRef<HTMLInputElement>(null);

  const updateProfile = (field: keyof BusinessProfile, value: string) => {
    setSettings({
      ...settings,
      businessProfile: {
        ...profile,
        [field]: value
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'logoInvertedUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile(field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (field: 'logoUrl' | 'logoInvertedUrl') => {
    updateProfile(field, '');
  };

  const LogoBox = ({ 
    label, 
    value, 
    field, 
    onUpload, 
    onRemove, 
    isDark = false,
    fileInputRef,
    description
  }: { 
    label: string, 
    value?: string, 
    field: 'logoUrl' | 'logoInvertedUrl',
    onUpload: () => void,
    onRemove: () => void,
    isDark?: boolean,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    description: string
  }) => {
    const { t } = useTranslation();
    return (
    <div className="space-y-4">
      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">{label}</label>
      <div 
        className={`
          aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center group relative overflow-hidden transition-all duration-300
          ${isDark 
            ? 'bg-slate-900 border-slate-700 hover:border-slate-500' 
            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-white dark:hover:bg-gray-800'}
          ${value ? 'border-solid border-gray-100 dark:border-gray-700 shadow-inner' : ''}
        `}
      >
        {value ? (
          <>
            <img src={value} className="max-w-full max-h-full object-contain p-8 animate-in fade-in zoom-in-95 duration-500" alt={label} />
            <div className={`absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm ${isDark ? 'bg-slate-900/60' : 'bg-white/60 dark:bg-black/60'}`}>
              <Button size="sm" variant="secondary" onClick={onUpload} className="shadow-lg">
                <Edit2 className="w-3.5 h-3.5 mr-2" /> {t('settings.BusinessSettingsView.replace')}
              </Button>
              <button 
                onClick={onRemove}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center p-6 flex flex-col items-center gap-3 cursor-pointer h-full w-full justify-center" onClick={onUpload}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${isDark ? 'bg-slate-800 text-slate-500 group-hover:text-primary-400' : 'bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 shadow-sm'}`}>
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <span className={`text-[11px] font-black uppercase tracking-widest block ${isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>{t('settings.BusinessSettingsView.uploadLabel', { label })}</span>
              <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-600' : 'text-gray-400 dark:text-gray-500'}`}>{description}</span>
            </div>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={(e) => handleFileChange(e, field)} 
        />
      </div>
    </div>
    );
  };

  return (
    <div className="p-4 md:p-12 max-w-5xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.BusinessSettingsView.businessProfile')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">{t('settings.BusinessSettingsView.manageIdentity')}</p>
      </div>

      <div className="space-y-8">
        {/* Basic Identity */}
        <Card className="p-8 border-0 shadow-lg space-y-8 bg-white dark:bg-gray-800">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500" /> {t('settings.BusinessSettingsView.companyInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <TextInput
                            label={t('settings.BusinessSettingsView.legalBusinessName')}
                            value={profile.name}
                            onChange={(v) => updateProfile('name', v)}
                        />
                    </div>
                    <div className="md:col-span-2">
                         <TextInput
                            label={t('settings.BusinessSettingsView.streetAddress')}
                            value={profile.address}
                            onChange={(v) => updateProfile('address', v)}
                        />
                    </div>
                    <TextInput label={t('settings.BusinessSettingsView.city')} value={profile.city} onChange={(v) => updateProfile('city', v)} />
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput label={t('settings.BusinessSettingsView.state')} value={profile.state} onChange={(v) => updateProfile('state', v)} />
                        <TextInput label={t('settings.BusinessSettingsView.zip')} value={profile.zip} onChange={(v) => updateProfile('zip', v)} />
                    </div>
                    <PhoneInput label={t('settings.BusinessSettingsView.businessPhone')} value={profile.phone} onChange={(v) => updateProfile('phone', v)} />
                    <TextInput label={t('settings.BusinessSettingsView.primaryContactEmail')} value={profile.email} onChange={(v) => updateProfile('email', v)} />
                    <TextInput label={t('settings.BusinessSettingsView.websiteUrl')} placeholder={t('settings.BusinessSettingsView.websitePlaceholder')} value={profile.website} onChange={(v) => updateProfile('website', v)} />
                    <TextInput label={t('settings.BusinessSettingsView.licenseNumber')} value={profile.licenseNumber} onChange={(v) => updateProfile('licenseNumber', v)} />
                </div>
            </div>
            <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-gray-700">
                <Button className="shadow-lg shadow-primary-500/20 px-8">
                    <Save className="w-4 h-4 mr-2" /> {t('settings.BusinessSettingsView.saveBusinessInfo')}
                </Button>
            </div>
        </Card>

        {/* Branding Section */}
        <Card className="p-8 border-0 shadow-lg bg-white dark:bg-gray-800 overflow-visible">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-8 flex items-center gap-2">
                <Palette className="w-5 h-5 text-gray-400 dark:text-gray-500" /> {t('settings.BusinessSettingsView.visualIdentity')}
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Logo Management */}
                <div className="space-y-8">
                    <LogoBox
                      label={t('settings.BusinessSettingsView.primaryLogo')}
                      value={profile.logoUrl}
                      field="logoUrl"
                      onUpload={() => primaryFileInputRef.current?.click()}
                      onRemove={() => removeLogo('logoUrl')}
                      fileInputRef={primaryFileInputRef}
                      description={t('settings.BusinessSettingsView.primaryLogoDescription')}
                    />

                    <LogoBox
                      label={t('settings.BusinessSettingsView.invertedLogo')}
                      value={profile.logoInvertedUrl}
                      field="logoInvertedUrl"
                      onUpload={() => invertedFileInputRef.current?.click()}
                      onRemove={() => removeLogo('logoInvertedUrl')}
                      isDark
                      fileInputRef={invertedFileInputRef}
                      description={t('settings.BusinessSettingsView.invertedLogoDescription')}
                    />
                </div>

                {/* Color Scheme */}
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 block">{t('settings.BusinessSettingsView.brandPrimaryColor')}</label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-6">
                            {BRAND_PRESETS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateProfile('primaryColor', color)}
                                    className={`aspect-square rounded-xl border-4 transition-all flex items-center justify-center ${profile.primaryColor?.toLowerCase() === color.toLowerCase() ? 'border-gray-900 dark:border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                >
                                    {profile.primaryColor?.toLowerCase() === color.toLowerCase() && <Check className="w-4 h-4 text-white drop-shadow-sm" />}
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                             <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">{t('settings.BusinessSettingsView.customHexCode')}</label>
                             <div className="flex items-center gap-3">
                                 <div className="w-12 h-12 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700" style={{ backgroundColor: profile.primaryColor }}></div>
                                 <div className="flex-1 relative">
                                     <Hash className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                                     <TextInput
                                        className="pl-9 font-mono font-bold"
                                        value={profile.primaryColor}
                                        onChange={(v) => updateProfile('primaryColor', v)}
                                     />
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="p-6 bg-primary-50/50 dark:bg-primary-900/20 rounded-2xl border border-primary-100/50 dark:border-primary-800/50 mt-4">
                        <div className="flex items-center gap-3 mb-3">
                            <Badge color="primary">{t('settings.BusinessSettingsView.preview')}</Badge>
                            <span className="text-xs font-bold text-primary-800 dark:text-primary-300 uppercase tracking-wide">{t('settings.BusinessSettingsView.brandApplication')}</span>
                        </div>
                        <div className="space-y-3">
                            <div className="h-10 rounded-xl w-full flex items-center justify-center text-white font-bold text-sm shadow-sm transition-colors" style={{ backgroundColor: profile.primaryColor }}>
                                {t('settings.BusinessSettingsView.sampleButton')}
                            </div>
                            <div className="flex gap-2">
                                <div className="h-6 w-6 rounded-md shadow-sm" style={{ backgroundColor: profile.primaryColor }}></div>
                                <div className="h-6 w-full bg-white dark:bg-gray-700 rounded-md border border-gray-100 dark:border-gray-600"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-10 flex justify-end">
                <Button className="shadow-lg shadow-primary-500/20 px-8 py-4 text-lg">
                    <Save className="w-5 h-5 mr-2" /> {t('settings.BusinessSettingsView.applyBranding')}
                </Button>
            </div>
        </Card>
      </div>
    </div>
  );
};
