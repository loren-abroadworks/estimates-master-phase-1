
import React from 'react';
import { User, Mail, Phone, Camera, Lock, Save, Moon, Sun, Languages } from 'lucide-react';
import { Card, TextInput, Button, InputGroup, Toggle, PhoneInput, Select } from '../UI';
import { GlobalSettings, Language } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

interface ProfileSettingsViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const ProfileSettingsView = ({ settings, setSettings, isDarkMode, onToggleDarkMode }: ProfileSettingsViewProps) => {
  const profile = settings.userProfile;
  const { t } = useTranslation();
  const langOptions = [
    { label: t('common.english'), value: 'en' },
    { label: t('common.spanish'), value: 'es' },
  ];

  const updateProfile = (field: string, value: string) => {
    setSettings({
      ...settings,
      userProfile: {
        ...profile,
        [field]: value
      }
    });
  };

  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.ProfileSettingsView.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">{t('settings.ProfileSettingsView.subtitle')}</p>
      </div>

      <div className="space-y-8">

        {/* Language Settings */}
        <Card className="p-8 border-0 shadow-lg bg-white dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary-500" /> {t('settings.language.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label={t('settings.language.appLabel')}>
                    <Select
                        ariaLabel="App Language"
                        value={settings.appLanguage}
                        onChange={(v) => setSettings({ ...settings, appLanguage: v as Language })}
                        options={langOptions}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.language.appHelp')}</p>
                </InputGroup>
                <InputGroup label={t('settings.language.clientLabel')}>
                    <Select
                        ariaLabel="Client Document Language"
                        value={settings.clientLanguage}
                        onChange={(v) => setSettings({ ...settings, clientLanguage: v as Language })}
                        options={langOptions}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.language.clientHelp')}</p>
                </InputGroup>
            </div>
        </Card>

        {/* Appearance Settings - New Section */}
        <Card className="p-8 border-0 shadow-lg bg-white dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                {isDarkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />} {t('settings.ProfileSettingsView.appearance')}
            </h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                <div>
                    <div className="font-bold text-gray-900 dark:text-white">{t('settings.ProfileSettingsView.darkMode')}</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.ProfileSettingsView.darkModeHelp')}</p>
                </div>
                <Toggle
                    checked={!!isDarkMode}
                    onChange={() => onToggleDarkMode && onToggleDarkMode()}
                    label={isDarkMode ? t('settings.ProfileSettingsView.on') : t('settings.ProfileSettingsView.off')}
                />
            </div>
        </Card>

        {/* Photo Section */}
        <Card className="p-8 border-0 shadow-lg flex flex-col md:flex-row items-center gap-10 bg-white dark:bg-gray-800">
           <div className="relative group cursor-pointer">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-50 dark:border-gray-700 shadow-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {profile.photo ? (
                      <img src={profile.photo} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                      <User className="w-12 h-12 text-gray-300 dark:text-gray-500" />
                  )}
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center text-white">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('settings.ProfileSettingsView.change')}</span>
              </div>
           </div>
           <div className="flex-1 text-center md:text-left">
               <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{profile.firstName} {profile.lastName}</h3>
               <p className="text-gray-500 dark:text-gray-400 mb-6">{t('settings.ProfileSettingsView.photoNote')}</p>
               <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <Button size="sm" variant="secondary">{t('settings.ProfileSettingsView.uploadNew')}</Button>
                    <Button size="sm" variant="ghost" className="text-red-500">{t('settings.ProfileSettingsView.removePhoto')}</Button>
               </div>
           </div>
        </Card>

        {/* Personal Details */}
        <Card className="p-8 border-0 shadow-lg space-y-6 bg-white dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-2">{t('settings.ProfileSettingsView.personalDetails')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                    label={t('settings.ProfileSettingsView.firstName')}
                    value={profile.firstName}
                    onChange={(v) => updateProfile('firstName', v)}
                />
                <TextInput
                    label={t('settings.ProfileSettingsView.lastName')}
                    value={profile.lastName}
                    onChange={(v) => updateProfile('lastName', v)}
                />
                <TextInput
                    label={t('settings.ProfileSettingsView.emailAddress')}
                    value={profile.email}
                    onChange={(v) => updateProfile('email', v)}
                    type="email"
                />
                <PhoneInput
                    label={t('settings.ProfileSettingsView.phoneNumber')}
                    value={profile.phone}
                    onChange={(v) => updateProfile('phone', v)}
                />
            </div>
            <div className="pt-4 flex justify-end">
                <Button className="shadow-lg shadow-primary-500/20 px-8">
                    <Save className="w-4 h-4 mr-2" /> {t('settings.ProfileSettingsView.saveProfile')}
                </Button>
            </div>
        </Card>

        {/* Security */}
        <Card className="p-8 border-0 shadow-lg bg-white dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" /> {t('settings.ProfileSettingsView.security')}
            </h3>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div>
                    <div className="font-bold text-gray-900 dark:text-white">{t('settings.ProfileSettingsView.changePassword')}</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.ProfileSettingsView.lastChanged')}</p>
                </div>
                <Button variant="secondary" className="bg-white dark:bg-gray-800">{t('settings.ProfileSettingsView.updatePassword')}</Button>
            </div>
        </Card>
      </div>
    </div>
  );
};
