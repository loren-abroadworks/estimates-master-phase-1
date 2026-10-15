
import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Briefcase, Calendar, MapPin, DollarSign,
  ChevronRight, CheckCircle2, Clock, PlayCircle, AlertCircle
} from 'lucide-react';
import { Button, SearchInput, Badge } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { Job, JobStage } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface JobsDashboardViewProps {
  jobs: Job[];
  onViewJob: (id: string) => void;
}

export const JobsDashboardView = ({ jobs, onViewJob }: JobsDashboardViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('All Active');

  const filteredJobs = useMemo(() => {
      let result = jobs.filter(job => 
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        job.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (stageFilter !== 'All Active') {
          if (stageFilter === 'Completed') {
              result = result.filter(j => j.stage === 'Completed');
          } else if (stageFilter === 'Unscheduled') {
              result = result.filter(j => !j.startDate);
          } else {
              result = result.filter(j => j.stage === stageFilter);
          }
      } else {
          // All Active excludes Completed
          result = result.filter(j => j.stage !== 'Completed');
      }

      return result;
  }, [searchTerm, stageFilter, jobs]);

  const getStageColor = (stage: JobStage) => {
      switch(stage) {
          case 'Confirmed': return 'gray';
          case 'Scheduled': return 'blue';
          case 'In Production': return 'purple';
          case 'Ready for Inspection': return 'amber';
          case 'Completed': return 'green';
          default: return 'gray';
      }
  };

  const getStageIcon = (stage: JobStage) => {
      switch(stage) {
          case 'Scheduled': return <Calendar className="w-3 h-3 mr-1" />;
          case 'In Production': return <PlayCircle className="w-3 h-3 mr-1" />;
          case 'Completed': return <CheckCircle2 className="w-3 h-3 mr-1" />;
          default: return null;
      }
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.JobsDashboardView.jobManagement')}</h1>
          <p className={Typography.lead}>{t('views.JobsDashboardView.missionControl')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
          <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.JobsDashboardView.searchPlaceholder')}
              className="w-full md:max-w-md"
          />
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
              {['All Active', 'Unscheduled', 'Confirmed', 'Scheduled', 'In Production', 'Ready for Inspection', 'Completed'].map(stage => (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                        stageFilter === stage 
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                      {stage}
                  </button>
              ))}
          </div>
      </div>

      {/* List */}
      <div className="space-y-4">
          {filteredJobs.map(job => {
              // Determine display status based on schedule
              const isUnscheduled = !job.startDate;
              const displayStage = isUnscheduled ? 'Unscheduled' : job.stage;
              const displayColor = isUnscheduled ? 'gray' : getStageColor(job.stage);

              return (
              <div 
                key={job.id} 
                onClick={() => onViewJob(job.id)}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
              >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                      
                      {/* Identity */}
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-100 dark:border-gray-600">{job.jobNumber}</span>
                              <Badge color={displayColor as any} className="flex items-center">
                                  {isUnscheduled ? <AlertCircle className="w-3 h-3 mr-1" /> : getStageIcon(job.stage)} 
                                  {displayStage}
                              </Badge>
                          </div>
                          <h3 className="font-bold text-xl text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors mb-1">{job.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" /> {job.address}
                          </div>
                      </div>

                      {/* Schedule Info */}
                      <div className="lg:border-l lg:border-r border-gray-100 dark:border-gray-700 lg:px-8 min-w-[200px]">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('views.JobsDashboardView.scheduleLabel')}</div>
                          {job.startDate ? (
                              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                                  <Calendar className="w-4 h-4 text-blue-500" />
                                  <span>{new Date(job.startDate).toLocaleDateString()}</span>
                                  {job.endDate && (
                                      <>
                                        <span className="text-gray-300">-</span>
                                        <span>{new Date(job.endDate).toLocaleDateString()}</span>
                                      </>
                                  )}
                              </div>
                          ) : (
                              <span className="text-sm text-gray-400 italic">{t('views.JobsDashboardView.notScheduled')}</span>
                          )}
                      </div>

                      {/* Actions Arrow */}
                      <div className="hidden lg:flex items-center justify-center w-12">
                          <ChevronRight className="w-6 h-6 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
                      </div>
                  </div>
              </div>
          )})}
          
          {filteredJobs.length === 0 && (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                      <Briefcase className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('views.JobsDashboardView.noJobsFound')}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{t('views.JobsDashboardView.noJobsMatchCriteria')}</p>
              </div>
          )}
      </div>
    </div>
  );
};
