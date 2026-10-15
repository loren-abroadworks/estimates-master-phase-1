
import React from 'react';
import { Modal, Button } from '../UI';
import { MapPin, Calendar, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface JobData {
  id: string;
  jobId: string;
  title: string;
  address: string;
  status: string;
  stageIndex: number;
  created: string;
  amount: number;
  statusColor: string;
}

interface LocationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: { address: string; city: string; state: string; zip: string; } | null;
  jobs: JobData[];
  onViewJob?: (id: string) => void;
}

export const LocationDetailsModal = ({ isOpen, onClose, property, jobs, onViewJob }: LocationDetailsModalProps) => {
  const { t } = useTranslation();
  if (!property) return null;

  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.LocationDetailsModal.title')}>
      <div className="space-y-6">
        {/* Map Section */}
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-64 bg-gray-100 dark:bg-gray-800 relative">
            <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src={mapUrl}
                className="absolute inset-0 w-full h-full grayscale-[50%] dark:invert-[.85]"
                title={t('modals.LocationDetailsModal.propertyMap')}
            ></iframe>
        </div>

        <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {t('modals.LocationDetailsModal.propertyAddress')}
            </h4>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="font-bold text-gray-900 dark:text-white text-lg">{property.address}</div>
                <div className="text-gray-600 dark:text-gray-400">{property.city}, {property.state} {property.zip}</div>
            </div>
        </div>

        <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {t('modals.LocationDetailsModal.jobHistory')}
            </h4>
            <div className="space-y-3">
                {jobs.length > 0 ? (
                    jobs.map(job => (
                        <div key={job.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-500 transition-all group">
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white">{job.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{job.created} • <span className={`font-medium ${job.status === 'Paid' || job.status === 'Completed' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>{job.status}</span></div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-gray-900 dark:text-white">${job.amount.toLocaleString()}</div>
                                {onViewJob && (
                                    <button 
                                        onClick={() => onViewJob(job.id)}
                                        className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        {t('modals.LocationDetailsModal.view')} <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-500 text-sm">
                        {t('modals.LocationDetailsModal.noJobs')}
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>{t('modals.LocationDetailsModal.close')}</Button>
        </div>
      </div>
    </Modal>
  );
};
