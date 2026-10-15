import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, TextInput, TextArea, Select, InputGroup, Button } from '../../UI';
import { useTranslation } from '@/i18n/LanguageContext';
import type { PackageDescriptionTemplate } from '../../../types';

interface PackageModalProps {
  isOpen: boolean;
  mode: 'add' | 'rename';
  packages: { id: string; name: string; description?: string }[];
  activeId: string;
  initialName?: string;
  initialDescription?: string;
  descriptionTemplates: PackageDescriptionTemplate[];
  onClose: () => void;
  onSubmit: (name: string, description: string, sourceId?: string) => void;
  onSaveTemplate: (name: string, description: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen, mode, packages, activeId, initialName, initialDescription,
  descriptionTemplates, onClose, onSubmit, onSaveTemplate, onDeleteTemplate,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [pickedId, setPickedId] = useState('');

  // Reset fields whenever the modal opens. In add mode, default "Start from" to the
  // active package and seed the description from it; in rename mode, seed from initialDescription.
  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setError(null);
      setSavingTemplate(false);
      setTemplateName('');
      setPickedId('');
      if (mode === 'add') {
        setSourceId(activeId || '');
        setDescription(packages.find(p => p.id === activeId)?.description || '');
      } else {
        setSourceId('');
        setDescription(initialDescription || '');
      }
    }
  }, [isOpen, initialName, initialDescription, mode, activeId, packages]);

  const title = mode === 'add' ? t('packageModal.addTitle') : t('packageModal.renameTitle');
  const submitLabel = mode === 'add' ? t('packageModal.create') : t('packageModal.save');

  const sourceOptions = [
    { label: t('packageModal.blank'), value: '' },
    ...packages.map(p => ({ label: p.name, value: p.id })),
  ];

  const templateOptions = [
    { label: t('packageModal.chooseTemplate'), value: '' },
    ...descriptionTemplates.map(tpl => ({ label: tpl.name, value: tpl.id })),
  ];

  const handleNameChange = (val: string) => {
    setName(val);
    if (error) setError(null);
  };

  const handleSourceChange = (val: string) => {
    setSourceId(val);
    if (mode === 'add') setDescription(packages.find(p => p.id === val)?.description || '');
  };

  const handlePickTemplate = (id: string) => {
    setPickedId(id);
    const tpl = descriptionTemplates.find(x => x.id === id);
    if (tpl) setDescription(tpl.description);
  };

  const handleDeletePicked = () => {
    if (!pickedId) return;
    onDeleteTemplate(pickedId);
    setPickedId('');
  };

  const handleSaveTemplate = () => {
    const tn = templateName.trim();
    if (!tn || !description.trim()) return;
    onSaveTemplate(tn, description);
    setSavingTemplate(false);
    setTemplateName('');
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('packageModal.nameRequired'));
      return;
    }
    onSubmit(trimmed, description, sourceId || undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-6">
        <div>
          <TextInput
            label={t('packageModal.nameLabel')}
            ariaLabel="Package name"
            placeholder={t('packageModal.namePlaceholder')}
            value={name}
            onChange={handleNameChange}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>

        <div>
          <TextArea
            label={t('packageModal.descriptionLabel')}
            ariaLabel="Description"
            placeholder={t('packageModal.descriptionPlaceholder')}
            value={description}
            onChange={setDescription}
            rows={4}
          />
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <Select
                ariaLabel="Use template"
                value={pickedId}
                onChange={handlePickTemplate}
                options={templateOptions}
              />
            </div>
            {pickedId && (
              <button
                type="button"
                onClick={handleDeletePicked}
                aria-label="Delete template"
                title={t('packageModal.deleteTemplate')}
                className="shrink-0 p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {savingTemplate ? (
            <div className="mt-3 space-y-2">
              <TextInput
                label={t('packageModal.templateNameLabel')}
                ariaLabel="Template name"
                placeholder={t('packageModal.templateNamePlaceholder')}
                value={templateName}
                onChange={setTemplateName}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setSavingTemplate(false); setTemplateName(''); }}>
                  {t('packageModal.cancelTemplate')}
                </Button>
                <Button onClick={handleSaveTemplate}>{t('packageModal.saveTemplate')}</Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setSavingTemplate(true)}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {t('packageModal.saveAsTemplate')}
              </button>
            </div>
          )}
        </div>

        {mode === 'add' && packages.length > 0 && (
          <InputGroup label={t('packageModal.startFrom')}>
            <Select
              ariaLabel="Start from"
              value={sourceId}
              onChange={handleSourceChange}
              options={sourceOptions}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('packageModal.startFromHelp')}</p>
          </InputGroup>
        )}

        <Button className="w-full justify-center" onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </Modal>
  );
};
