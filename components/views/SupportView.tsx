
import React, { useState } from 'react';
import {
  Search, Play, BookOpen, MessageSquare, Mail,
  ChevronDown, Video, FileText, HelpCircle, Zap, Send, CheckCircle2, Phone,
  MonitorPlay, Calculator, Book, ArrowRight
} from 'lucide-react';
import { Card, Button, SearchInput, TextInput, TextArea, Badge } from '../UI';
import { VideoPlayerModal } from '../modals/VideoPlayerModal';
import { Typography, Spacing } from '../../theme/designSystem';
import { useTranslation } from '@/i18n/LanguageContext';

interface SupportViewProps {
  onNavigate?: (screen: string) => void;
}

const VIDEOS = [
    { id: 'v1', title: 'Getting Started Guide', duration: '5:20', category: 'Basics', thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=400' },
    { id: 'v2', title: 'Building Complex Estimates', duration: '12:45', category: 'Advanced', thumbnail: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400' },
    { id: 'v3', title: 'Managing Crew Schedules', duration: '8:10', category: 'Operations', thumbnail: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=400' },
    { id: 'v4', title: 'Invoicing & Payments', duration: '6:30', category: 'Finance', thumbnail: 'https://images.unsplash.com/photo-1554224154-260327c00c42?auto=format&fit=crop&q=80&w=400' },
];

const FAQS = [
    {
        category: 'Estimates',
        items: [
            'How do I add a new labor rate?',
            'Can I duplicate an existing estimate?',
            'How to apply a global markup?',
            'Exporting estimates to PDF'
        ]
    },
    {
        category: 'Billing',
        items: [
            'Connecting your Stripe account',
            'Processing refunds',
            'Setting up recurring invoices',
            'Viewing transaction history'
        ]
    },
    {
        category: 'Account',
        items: [
            'Changing your password',
            'Adding team members',
            'Updating company logo',
            'Notification settings'
        ]
    }
];

export const SupportView = ({ onNavigate }: SupportViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'kb' | 'video'>('kb');
  const [selectedVideo, setSelectedVideo] = useState<{id: string, title: string} | null>(null);
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [isSent, setIsSent] = useState(false);

  const handleSendSupport = () => {
      if (!contactForm.subject || !contactForm.message) return;
      setIsSent(true);
      // Reset after delay
      setTimeout(() => {
          setIsSent(false);
          setContactForm({ subject: '', message: '' });
      }, 3000);
  };

  // Filter Logic
  const filteredVideos = VIDEOS.filter(v => 
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFAQs = FAQS.map(cat => ({
    ...cat,
    items: cat.items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(cat => cat.items.length > 0);

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8 pb-32 animate-in fade-in duration-500`}>
      
      <VideoPlayerModal 
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        title={selectedVideo?.title || t('views.SupportView.videoTutorial')}
      />

      {/* Prominent Search Section */}
      <div className="max-w-3xl mx-auto text-center mb-10 pt-4">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white font-heading mb-6 tracking-tight">{t('views.SupportView.howCanWeHelp')}</h1>
          <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                  type="text"
                  className="block w-full pl-14 pr-6 py-5 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-500 transition-all text-lg font-medium shadow-xl shadow-gray-200/40 dark:shadow-none outline-none"
                  placeholder={t('views.SupportView.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT CONTENT (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
              
              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-1 mb-6">
                  <button 
                    onClick={() => setActiveTab('kb')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'kb' ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                  >
                      <BookOpen className="w-4 h-4" /> {t('views.SupportView.knowledgeBase')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('video')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'video' ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                  >
                      <MonitorPlay className="w-4 h-4" /> {t('views.SupportView.videoTutorials')}
                  </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                 {activeTab === 'video' && (
                    <section className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('views.SupportView.videoTutorials')}</h3>
                            {searchTerm && <Badge color="gray">{t('views.SupportView.found', { count: filteredVideos.length })}</Badge>}
                        </div>
                        
                        {filteredVideos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {filteredVideos.map(video => (
                                    <div 
                                        key={video.id} 
                                        onClick={() => setSelectedVideo(video)}
                                        className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-500/50 transition-all flex flex-col"
                                    >
                                        <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
                                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center pl-1 shadow-lg group-hover:scale-110 transition-transform">
                                                    <Play className="w-5 h-5 text-gray-900 fill-current" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                                                {video.duration}
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1">{video.category}</div>
                                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{video.title}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 italic p-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <Video className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                {t('views.SupportView.noVideosMatch')}
                            </div>
                        )}
                    </section>
                 )}

                 {activeTab === 'kb' && (
                    <section className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                        
                        {filteredFAQs.length > 0 ? (
                            <div className="flex flex-col gap-6">
                                {filteredFAQs.map(category => (
                                    <div key={category.category} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:border-primary-200 dark:hover:border-primary-500/50 transition-all group/card">
                                        <div className="px-6 py-5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{category.category}</h4>
                                        </div>
                                        <div className="divide-y divide-gray-50 dark:divide-gray-700">
                                            {category.items.map((item, idx) => (
                                                <details key={idx} className="group/item px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors open:bg-gray-50/50 dark:open:bg-gray-700/30">
                                                    <summary className="list-none flex justify-between items-start gap-4 font-medium text-gray-700 dark:text-gray-200 group-hover/item:text-gray-900 dark:group-hover/item:text-white outline-none">
                                                        <span className="text-sm leading-relaxed">{item}</span>
                                                        <div className="mt-0.5 text-gray-400 dark:text-gray-500 group-open/item:rotate-180 transition-transform duration-200">
                                                            <ChevronDown className="w-5 h-5" />
                                                        </div>
                                                    </summary>
                                                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed pl-0 animate-in slide-in-from-top-1 fade-in duration-200">
                                                        To {item.toLowerCase().replace('how do i ', '').replace('?', '')}, navigate to the relevant section in the sidebar. For detailed steps, please refer to our full documentation guide or contact support if you need specific account assistance.
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 italic p-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                {t('views.SupportView.noArticlesMatch')}
                            </div>
                        )}
                    </section>
                 )}
              </div>
          </div>

          {/* RIGHT COLUMN (4 cols) - Contact Form */}
          <div className="lg:col-span-4">
              <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-xl sticky top-24 bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                      <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                          <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.SupportView.contactSupport')}</h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('views.SupportView.replyTime')}</p>
                      </div>
                  </div>
                  
                  {isSent ? (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-8 text-center animate-in fade-in zoom-in">
                          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mx-auto mb-4 shadow-sm">
                              <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <h3 className="font-bold text-green-900 dark:text-green-100 mb-2 text-lg">{t('views.SupportView.messageSent')}</h3>
                          <p className="text-sm text-green-700 dark:text-green-300">{t('views.SupportView.messageSentDetail')}</p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-6 w-full"
                            onClick={() => { setIsSent(false); setContactForm({subject: '', message: ''}); }}
                          >
                              {t('views.SupportView.sendAnother')}
                          </Button>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <TextInput
                              label={t('views.SupportView.subject')}
                              placeholder={t('views.SupportView.subjectPlaceholder')}
                              value={contactForm.subject}
                              onChange={(v) => setContactForm({...contactForm, subject: v})}
                          />
                          <div>
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block">{t('views.SupportView.message')}</label>
                              <TextArea
                                  placeholder={t('views.SupportView.messagePlaceholder')}
                                  value={contactForm.message}
                                  onChange={(v) => setContactForm({...contactForm, message: v})}
                                  rows={6}
                              />
                          </div>

                          <Button 
                              onClick={handleSendSupport} 
                              disabled={!contactForm.subject || !contactForm.message}
                              className="w-full justify-center shadow-lg shadow-primary-500/20 h-12 text-base"
                          >
                              <Send className="w-4 h-4 mr-2" /> {t('views.SupportView.sendRequest')}
                          </Button>
                      </div>
                  )}
                  
                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">{t('views.SupportView.directLines')}</h4>
                      <div className="space-y-3">
                          <a href="tel:5551234567" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                              <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">(555) 123-4567</span>
                          </a>
                          <a href="mailto:support@estimatemaster.com" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                              <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">support@estimatemaster.com</span>
                          </a>
                      </div>
                  </div>
              </Card>
          </div>

      </div>
    </div>
  );
};
