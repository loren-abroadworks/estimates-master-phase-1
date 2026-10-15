
import React from 'react';
import {
  Ruler, Calculator, TrendingUp, BookOpen,
  Gauge, Droplets, ShieldCheck,
  Layers, ArrowRight, Zap, Target, Activity,
  ChevronRight, Box, UserCheck, Microscope, CheckCircle2
} from 'lucide-react';
import { Badge, Card } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const MethodologyView = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white custom-scrollbar selection:bg-primary-100 selection:text-primary-900 pb-32 animate-in fade-in duration-500">
      
      {/* --- HERO SECTION --- */}
      <section className="relative py-24 px-6 overflow-hidden border-b border-gray-100">
          {/* Background elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-primary-50/30 -skew-x-12 transform translate-x-1/2" />
          
          <div className="max-w-7xl mx-auto relative z-10">
              <div className="flex flex-col lg:flex-row gap-16 items-center">
                  <div className="lg:w-1/2 space-y-8">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-xl">
                          <BookOpen className="w-5 h-5 text-primary-400" />
                          <span className="text-xs font-black uppercase tracking-[0.2em]">{t('views.MethodologyView.standardEms')}</span>
                      </div>
                      <h1 className="text-4xl md:text-7xl font-black text-gray-900 font-heading tracking-tighter leading-[0.95]">
                        {t('views.MethodologyView.heroHeading')} <span className="text-primary-600">{t('views.MethodologyView.heroHeadingHighlight')}</span>
                      </h1>
                      <p className="text-gray-500 text-lg md:text-2xl leading-relaxed font-medium max-w-xl">
                        {t('views.MethodologyView.heroDesc')}
                      </p>
                      <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-xs font-bold text-gray-700">{t('views.MethodologyView.fullyBurdenedLabor')}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-xs font-bold text-gray-700">{t('views.MethodologyView.recursiveMaterialOptimization')}</span>
                          </div>
                      </div>
                  </div>
                  
                  {/* Abstract Visual */}
                  <div className="lg:w-1/2">
                      <div className="relative">
                          <div className="absolute -inset-4 bg-primary-500/10 blur-3xl rounded-full" />
                          <div className="relative bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-gray-100">
                              <div className="space-y-8">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{t('views.MethodologyView.logicFlow')}</span>
                                      <Activity className="w-5 h-5 text-gray-300" />
                                  </div>
                                  <div className="space-y-6">
                                      {/* Steps */}
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold">01</div>
                                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-primary-600 w-full" />
                                          </div>
                                          <span className="text-xs font-bold text-gray-900">{t('views.MethodologyView.stepMeasure')}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold">02</div>
                                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-primary-600 w-3/4" />
                                          </div>
                                          <span className="text-xs font-bold text-gray-900">{t('views.MethodologyView.stepCalculate')}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold">03</div>
                                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-primary-600 w-1/2" />
                                          </div>
                                          <span className="text-xs font-bold text-gray-900">{t('views.MethodologyView.stepOptimize')}</span>
                                      </div>
                                  </div>
                                  <div className="pt-6 border-t border-gray-100">
                                      <div className="text-center">
                                          <div className="text-4xl font-black text-gray-900 tracking-tighter">$7,242.15</div>
                                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{t('views.MethodologyView.verifiedEstimateTotal')}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* --- CORE PILLARS SECTION --- */}
      <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    {
                        id: '6.4.1',
                        title: t('views.MethodologyView.pillar1Title'),
                        icon: Ruler,
                        color: 'blue',
                        desc: t('views.MethodologyView.pillar1Desc'),
                        details: [t('views.MethodologyView.pillar1Detail1'), t('views.MethodologyView.pillar1Detail2'), t('views.MethodologyView.pillar1Detail3')]
                    },
                    {
                        id: '6.4.2',
                        title: t('views.MethodologyView.pillar2Title'),
                        icon: Gauge,
                        color: 'amber',
                        desc: t('views.MethodologyView.pillar2Desc'),
                        details: [t('views.MethodologyView.pillar2Detail1'), t('views.MethodologyView.pillar2Detail2'), t('views.MethodologyView.pillar2Detail3')]
                    },
                    {
                        id: '6.4.3',
                        title: t('views.MethodologyView.pillar3Title'),
                        icon: Droplets,
                        color: 'emerald',
                        desc: t('views.MethodologyView.pillar3Desc'),
                        details: [t('views.MethodologyView.pillar3Detail1'), t('views.MethodologyView.pillar3Detail2'), t('views.MethodologyView.pillar3Detail3')]
                    },
                    {
                        id: '6.4.4',
                        title: t('views.MethodologyView.pillar4Title'),
                        icon: Calculator,
                        color: 'primary',
                        desc: t('views.MethodologyView.pillar4Desc'),
                        details: [t('views.MethodologyView.pillar4Detail1'), t('views.MethodologyView.pillar4Detail2'), t('views.MethodologyView.pillar4Detail3')]
                    }
                ].map((rule) => (
                    <div key={rule.id} className="p-10 border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] bg-white group flex flex-col h-full relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-all group-hover:scale-150 ${
                             rule.color === 'blue' ? 'bg-blue-600' :
                             rule.color === 'amber' ? 'bg-amber-600' :
                             rule.color === 'emerald' ? 'bg-emerald-600' : 'bg-primary-600'
                        }`} />
                        
                        <div className="flex items-center justify-between mb-8">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform ${
                                rule.color === 'blue' ? 'text-blue-600 bg-blue-50 border-blue-100' :
                                rule.color === 'amber' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                rule.color === 'emerald' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                'text-primary-600 bg-primary-50 border-primary-100'
                            }`}>
                                <rule.icon className="w-8 h-8" />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">{t('views.MethodologyView.sectionLabel', { id: rule.id })}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-4 font-heading tracking-tight leading-tight">{rule.title}</h3>
                        <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8 flex-1">
                            {rule.desc}
                        </p>
                        <div className="space-y-2">
                            {rule.details.map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    <div className={`w-1 h-1 rounded-full ${
                                        rule.color === 'blue' ? 'bg-blue-400' :
                                        rule.color === 'amber' ? 'bg-amber-400' :
                                        rule.color === 'emerald' ? 'bg-emerald-400' : 'bg-primary-400'
                                    }`} />
                                    {detail}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
              </div>
          </div>
      </section>

      {/* --- DEEP DIVE: LABOR CALCULUS --- */}
      <section className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: '60px 60px' }} />
          <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                  <div className="space-y-10">
                      <div className="space-y-6 text-center lg:text-left">
                          <div className="inline-flex items-center gap-2 text-primary-400 bg-primary-400/10 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-primary-400/20">
                             <TrendingUp className="w-4 h-4" /> {t('views.MethodologyView.component644')}
                          </div>
                          <h2 className="text-4xl md:text-7xl font-black font-heading tracking-tighter leading-none">
                            {t('views.MethodologyView.laborBurdenTitle')}
                          </h2>
                          <p className="text-slate-400 text-lg md:text-xl leading-relaxed font-medium">
                            {t('views.MethodologyView.laborBurdenDesc')}
                          </p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10">
                              <Zap className="w-6 h-6 text-primary-500 mb-4" />
                              <h4 className="font-bold text-white mb-2">{t('views.MethodologyView.netZeroLeakage')}</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">{t('views.MethodologyView.netZeroLeakageDesc')}</p>
                          </div>
                          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10">
                              <Microscope className="w-6 h-6 text-indigo-500 mb-4" />
                              <h4 className="font-bold text-white mb-2">{t('views.MethodologyView.granularBurden')}</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">{t('views.MethodologyView.granularBurdenDesc')}</p>
                          </div>
                      </div>
                  </div>

                  {/* Visual Calculation */}
                  <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-tr from-primary-500 to-indigo-500 rounded-[4rem] opacity-30 blur-2xl animate-pulse" />
                      <div className="bg-white rounded-[3.5rem] p-10 md:p-16 text-slate-900 shadow-2xl relative overflow-hidden ring-1 ring-black/[0.03]">
                          <div className="relative z-10 space-y-12">
                              <div className="text-center">
                                  <span className="text-primary-600 font-black text-[11px] uppercase tracking-[0.4em] block mb-4">{t('views.MethodologyView.logicDemonstration')}</span>
                                  <h3 className="text-3xl md:text-4xl font-black font-heading tracking-tighter leading-none">{t('views.MethodologyView.trueHourlyCost')}</h3>
                              </div>
                              <div className="space-y-6">
                                  <div className="flex justify-between items-end border-b border-gray-100 pb-5">
                                      <div className="space-y-1">
                                          <span className="text-gray-400 font-black text-[10px] uppercase tracking-widest block">{t('views.MethodologyView.variableA')}</span>
                                          <span className="text-gray-700 font-bold text-lg">{t('views.MethodologyView.avgNetHourlyPay')}</span>
                                      </div>
                                      <span className="font-black text-3xl text-gray-900 tracking-tight">$25.00</span>
                                  </div>
                                  <div className="flex justify-between items-end border-b border-gray-100 pb-5">
                                      <div className="space-y-1">
                                          <span className="text-gray-400 font-black text-[10px] uppercase tracking-widest block">{t('views.MethodologyView.variableB')}</span>
                                          <span className="text-gray-700 font-bold text-lg">{t('views.MethodologyView.payrollTaxes')}</span>
                                      </div>
                                      <span className="font-black text-3xl text-primary-600 tracking-tight">+23.75%</span>
                                  </div>
                                  <div className="flex justify-between items-end pt-4">
                                      <div className="space-y-1">
                                          <span className="text-gray-900 font-black text-xl uppercase tracking-[0.2em] block leading-none underline decoration-primary-500 decoration-4">{t('views.MethodologyView.totalCost')}</span>
                                          <span className="text-gray-400 font-medium text-[10px] uppercase">{t('views.MethodologyView.perProductionHour')}</span>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-7xl font-black text-gray-900 tracking-tighter">$30.94</div>
                                      </div>
                                  </div>
                              </div>
                              <div className="bg-gray-50 p-4 rounded-2xl text-center">
                                  <p className="text-xs text-gray-500 font-medium leading-relaxed italic">
                                      {t('views.MethodologyView.trueHourlyCostQuote')}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* --- MATERIAL OPTIMIZATION SECTION --- */}
      <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
                  <div className="max-w-2xl">
                      <div className="text-[10px] font-black text-primary-600 tracking-[0.4em] uppercase mb-4">{t('views.MethodologyView.recursiveSolvers')}</div>
                      <h2 className="text-4xl md:text-6xl font-black text-gray-900 font-heading tracking-tighter leading-none mb-6">
                          {t('views.MethodologyView.intelligentProcurement')}
                      </h2>
                      <p className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed">
                          {t('views.MethodologyView.intelligentProcurementDesc')}
                      </p>
                  </div>
                  <Badge color="primary" className="h-12 px-6 text-sm">{t('views.MethodologyView.eliminateWaste')}</Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Dark Card */}
                  <Card className="p-10 border-0 shadow-2xl bg-slate-900 text-white rounded-[3rem]">
                      <h4 className="text-xs font-black text-primary-400 uppercase tracking-widest mb-8">{t('views.MethodologyView.sampleCalculation')}</h4>
                      <div className="space-y-10">
                          <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-lg font-medium">{t('views.MethodologyView.totalVolumeRequired')}</span>
                              <span className="text-3xl font-black">6.4 Gallons</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-8">
                              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                  <div className="text-[10px] font-black text-slate-500 uppercase mb-4">{t('views.MethodologyView.traditionalMethod')}</div>
                                  <div className="text-2xl font-black text-white">7 x 1-Gal</div>
                                  <div className="text-sm text-slate-400 mt-2">$315.00</div>
                              </div>
                              <div className="p-6 bg-primary-600/10 rounded-2xl border border-primary-500/30 ring-2 ring-primary-500/20">
                                  <div className="text-[10px] font-black text-primary-400 uppercase mb-4">{t('views.MethodologyView.emsOptimizer')}</div>
                                  <div className="text-2xl font-black text-white">1x5G + 2x1G</div>
                                  <div className="text-sm text-primary-400 mt-2">$265.00</div>
                              </div>
                          </div>

                          <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                              <span className="text-xl font-bold text-emerald-400">{t('views.MethodologyView.totalSavingsDetected')}</span>
                              <span className="text-4xl font-black">$50.00 <span className="text-lg opacity-50">(15.8%)</span></span>
                          </div>
                      </div>
                  </Card>

                  <div className="flex flex-col justify-center gap-10">
                      {[
                          { title: t('views.MethodologyView.matItem1Title'), icon: Box, desc: t('views.MethodologyView.matItem1Desc') },
                          { title: t('views.MethodologyView.matItem2Title'), icon: Layers, desc: t('views.MethodologyView.matItem2Desc') },
                          { title: t('views.MethodologyView.matItem3Title'), icon: Droplets, desc: t('views.MethodologyView.matItem3Desc') }
                      ].map((item, i) => (
                          <div key={i} className="flex gap-6 items-start group">
                              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                  <item.icon className="w-6 h-6 text-gray-400 group-hover:text-primary-600" />
                              </div>
                              <div>
                                  <h4 className="text-xl font-black text-gray-900 mb-2">{item.title}</h4>
                                  <p className="text-gray-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </section>

      {/* --- CALL TO ACTION --- */}
      <section className="max-w-7xl mx-auto px-6">
          <div className="bg-primary-600 rounded-[3.5rem] p-12 md:p-24 text-white text-center relative overflow-hidden shadow-2xl shadow-primary-500/40">
              <div className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1562663474-6cbb3eaa4d14?q=80&w=2070&auto=format&fit=crop)' }} />
              <div className="relative z-10 space-y-10">
                  <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none">{t('views.MethodologyView.ctaHeading')}</h2>
                  <p className="text-primary-100 text-lg md:text-2xl max-w-2xl mx-auto font-medium">
                      {t('views.MethodologyView.ctaDesc')}
                  </p>
                  <div className="flex flex-wrap justify-center gap-6">
                      <button className="px-10 py-5 bg-white text-primary-700 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-primary-50 transition-all shadow-xl active:scale-95">
                          {t('views.MethodologyView.viewDocumentation')}
                      </button>
                      <button className="px-10 py-5 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95">
                          {t('views.MethodologyView.contactImplementationTeam')}
                      </button>
                  </div>
              </div>
          </div>
      </section>
    </div>
  );
};
