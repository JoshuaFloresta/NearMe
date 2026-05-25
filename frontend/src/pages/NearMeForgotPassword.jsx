import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, KeyRound, Mail, MapPin } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { APP_NAME } from '../lib/nearMeData';
import { apiRequest } from '../lib/api';

const steps = {
  request: 'request',
  verify: 'verify',
  reset: 'reset',
  complete: 'complete',
};

export default function NearMeForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(steps.request);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValidEmail = () => {
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error('Enter a valid email address.');
      return false;
    }
    return true;
  };

  const requestCode = async (event) => {
    event?.preventDefault();
    if (!isValidEmail()) return;
    setLoading(true);
    try {
      const response = await apiRequest('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), purpose: 'password_reset' }),
      });
      setDevOtp(response.devOtp || '');
      setOtp('');
      setStep(steps.verify);
      toast.success(response.devOtp ? 'Use the development reset code shown below.' : 'If the account exists, a reset code has been sent.');
    } catch (error) {
      toast.error(error.message || 'Could not send a reset code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (!otp.trim()) {
      toast.error('Enter the verification code.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), purpose: 'password_reset' }),
      });
      setResetToken(response.resetToken || '');
      setStep(steps.reset);
      toast.success('Code confirmed. Set your new password.');
    } catch (error) {
      toast.error(error.message || 'Could not verify the reset code.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), resetToken, password }),
      });
      setStep(steps.complete);
      toast.success('Your password has been reset.');
    } catch (error) {
      toast.error(error.message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  const content = {
    [steps.request]: {
      title: 'Reset Password',
      description: 'Enter your email address to receive a password reset code.',
    },
    [steps.verify]: {
      title: 'Verify Code',
      description: `Enter the password reset code for ${email.trim()}.`,
    },
    [steps.reset]: {
      title: 'New Password',
      description: 'Choose a new password for your Near Me account.',
    },
    [steps.complete]: {
      title: 'Password Updated',
      description: 'Your password has been reset successfully.',
    },
  }[step];

  return (
    <div className="min-h-screen bg-bauhaus-canvas flex flex-col font-outfit">
      <div className="bg-white border-b-4 border-bauhaus-ink px-4 py-4">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center">
            <MapPin className="h-4 w-4 text-white" strokeWidth={3} />
          </div>
          <span className="font-black text-lg uppercase tracking-tighter text-bauhaus-ink">{APP_NAME}</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-4 inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55 hover:text-bauhaus-red">
            <ChevronLeft className="h-4 w-4" /> Back to Login
          </Link>
          <div className="relative overflow-hidden bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-8">
            <div className="absolute right-0 top-0 h-3 w-full bg-[linear-gradient(90deg,#d02020_0_38%,#1649bf_38%_68%,#f0c020_68%)]" />
            <div className="mt-3 flex h-12 w-12 items-center justify-center border-2 border-bauhaus-ink bg-bauhaus-yellow">
              <KeyRound className="h-6 w-6 text-bauhaus-ink" />
            </div>
            <h1 className="mt-4 font-black text-2xl uppercase tracking-tighter text-bauhaus-ink">{content.title}</h1>
            <p className="mt-1 font-medium text-sm text-bauhaus-ink/55">{content.description}</p>

            {step === steps.request && (
              <form onSubmit={requestCode} className="mt-6 space-y-4">
                <label className="block">
                  <span className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Email Address</span>
                  <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue">
                    <div className="flex items-center px-3 bg-bauhaus-canvas"><Mail className="h-4 w-4 text-bauhaus-ink/45" /></div>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="juan@email.com" className="flex-1 bg-bauhaus-canvas px-2 py-3 font-medium text-sm outline-none" required />
                  </div>
                </label>
                <button disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-bold uppercase text-sm tracking-wider disabled:opacity-60">
                  {loading ? 'Sending...' : 'Send Reset Code'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {step === steps.verify && (
              <form onSubmit={verifyCode} className="mt-6 space-y-4">
                {devOtp && (
                  <div className="border-2 border-bauhaus-ink bg-bauhaus-yellow p-4">
                    <div className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60">Development Reset Code</div>
                    <div className="mt-1 font-black text-3xl tracking-[0.35em] text-bauhaus-ink">{devOtp}</div>
                  </div>
                )}
                <label className="block">
                  <span className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Verification Code</span>
                  <input value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={6} placeholder="Enter 6-digit code" className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm text-center tracking-[0.4em] outline-none focus:border-bauhaus-blue" required />
                </label>
                <button disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-blue text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-bold uppercase text-sm tracking-wider disabled:opacity-60">
                  {loading ? 'Verifying...' : 'Verify Code'} <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" disabled={loading} onClick={requestCode} className="w-full font-bold text-xs uppercase tracking-wider text-bauhaus-blue hover:underline disabled:opacity-50">Send a new code</button>
              </form>
            )}

            {step === steps.reset && (
              <form onSubmit={resetPassword} className="mt-6 space-y-4">
                {[
                  { label: 'New Password', value: password, setter: setPassword },
                  { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword },
                ].map((field) => (
                  <label key={field.label} className="block">
                    <span className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">{field.label}</span>
                    <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue">
                      <input type={showPassword ? 'text' : 'password'} value={field.value} onChange={(event) => field.setter(event.target.value)} placeholder="At least 8 characters" className="flex-1 bg-bauhaus-canvas px-4 py-3 font-medium text-sm outline-none" required />
                      <button type="button" onClick={() => setShowPassword((current) => !current)} className="px-3 bg-bauhaus-canvas">
                        {showPassword ? <EyeOff className="h-4 w-4 text-bauhaus-ink/45" /> : <Eye className="h-4 w-4 text-bauhaus-ink/45" />}
                      </button>
                    </div>
                  </label>
                ))}
                <button disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-bold uppercase text-sm tracking-wider disabled:opacity-60">
                  {loading ? 'Saving...' : 'Set New Password'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            {step === steps.complete && (
              <div className="mt-6">
                <div className="flex items-start gap-3 border-2 border-bauhaus-ink bg-bauhaus-yellow p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-bauhaus-blue" />
                  <p className="font-medium text-sm text-bauhaus-ink/75">Use your new password the next time you log in.</p>
                </div>
                <button type="button" onClick={() => navigate('/login')} className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-blue text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-bold uppercase text-sm tracking-wider">
                  Return to Login <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
