
import React, { useState } from 'react';
import { Paintbrush, ArrowRight, Lock, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface AuthViewProps {
  onLogin: () => void;
}

export const AuthView = ({ onLogin }: AuthViewProps) => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('demo@estimatemaster.com');
  const [password, setPassword] = useState('password');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (isForgotPassword) {
        // Mock forgot password process
        setTimeout(() => {
            setIsLoading(false);
            setIsEmailSent(true);
        }, 1500);
        return;
    }

    // Simulate auth
    setTimeout(() => {
        setIsLoading(false);
        onLogin();
    }, 1200);
  };

  const resetFlow = () => {
      setIsForgotPassword(false);
      setIsEmailSent(false);
      setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        {/* Logo / Brand Header */}
        <div className="max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-[2rem] mb-6 shadow-lg">
                    <Paintbrush className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-white text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-2 font-heading">
                    Estimate <span className="text-primary-400">Master</span>
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">{t('auth.AuthView.professionalEstimatingSuite')}</p>
            </div>

            <div className="bg-white rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden">
                <div className="p-8 md:p-12">
                    {isEmailSent ? (
                        <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 font-heading">{t('auth.AuthView.checkYourInbox')}</h2>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
                                    {t('auth.AuthView.resetLinkSentPre')}<span className="text-slate-900 font-bold">{email}</span>{t('auth.AuthView.resetLinkSentPost')}
                                </p>
                            </div>
                            <div className="pt-4">
                                <Button onClick={resetFlow} variant="secondary" className="w-full h-14 font-bold border-gray-200">
                                    <ArrowLeft className="w-4 h-4 mr-2" /> {t('auth.AuthView.backToLogin')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-black text-slate-900 font-heading mb-2">
                                    {isForgotPassword ? t('auth.AuthView.resetPassword') : (isLogin ? t('auth.AuthView.welcomeBack') : t('auth.AuthView.createAccount'))}
                                </h2>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                    {isForgotPassword
                                        ? t('auth.AuthView.enterEmailForRecovery')
                                        : (isLogin ? t('auth.AuthView.securelySignIn') : t('auth.AuthView.registerToStart'))}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-focus-within:bg-primary-50 transition-colors">
                                            <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-primary-600" />
                                        </div>
                                        <input 
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('auth.AuthView.emailAddress')}
                                            className="w-full pl-16 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                                            required
                                        />
                                    </div>
                                    
                                    {!isForgotPassword && (
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-focus-within:bg-primary-50 transition-colors">
                                                <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-primary-600" />
                                            </div>
                                            <input 
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t('auth.AuthView.password')}
                                                className="w-full pl-16 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 transition-all font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {(isLogin && !isForgotPassword) && (
                                    <div className="flex justify-end">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsForgotPassword(true)}
                                            className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 hover:underline transition-all"
                                        >
                                            {t('auth.AuthView.forgotPassword')}
                                        </button>
                                    </div>
                                )}

                                <Button 
                                    disabled={isLoading}
                                    className="w-full h-16 text-lg font-black bg-primary-600 hover:bg-primary-700 border-none group shadow-lg shadow-primary-600/20 active:scale-[0.98] transition-all"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            {isForgotPassword ? t('auth.AuthView.sendResetLink') : (isLogin ? t('auth.AuthView.signIn') : t('auth.AuthView.signUp'))}
                                            <ArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>

                                {isForgotPassword && (
                                    <button 
                                        type="button"
                                        onClick={() => setIsForgotPassword(false)}
                                        className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> {t('auth.AuthView.backToLogin')}
                                    </button>
                                )}
                            </form>

                            {!isForgotPassword && (
                                <div className="mt-10 text-center">
                                    <button 
                                        onClick={() => setIsLogin(!isLogin)}
                                        className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 mx-auto"
                                    >
                                        {isLogin ? t('auth.AuthView.noAccountSignUp') : t('auth.AuthView.alreadyHaveAccountSignIn')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            <p className="text-center mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                {t('auth.AuthView.copyright')}
            </p>
        </div>
    </div>
  );
};
