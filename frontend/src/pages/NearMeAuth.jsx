import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Eye, EyeOff, User, Wrench, ArrowRight, CheckCircle } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { APP_NAME } from '../lib/nearMeData';
import { apiRequest } from '../lib/api';
import {
  PROVIDER_DASHBOARD_PATH,
  PROVIDER_KYC_PATH,
  PROVIDER_REVIEW_PATH,
  isAdminUser,
  isProviderUnderReview,
  needsProviderKyc,
} from '../lib/providerAccess';

export default function NearMeAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === '/login';

  const [role, setRole] = useState('customer');
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ fname: '', lname: '', email: '', phone: '', password: '', otp: '' });
  const [otpPreview, setOtpPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validateForm = () => {
    if (!form.email.trim()) {
      toast.error('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Invalid email format');
      return false;
    }

    if (!form.password) {
      toast.error('Password is required');
      return false;
    }

    if (!isLogin) {
      if (!form.fname.trim() || !form.lname.trim()) {
        toast.error('First name and last name are required');
        return false;
      }

      if (!form.phone.trim()) {
        toast.error('Phone number is required');
        return false;
      }

      if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) {
        toast.error('Phone number must be 10 digits');
        return false;
      }

      if (form.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return false;
      }
    }

    return true;
  };

  const completeSignup = async () => {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        fname: form.fname,
        lname: form.lname,
        name: [form.fname, form.lname].filter(Boolean).join(' ').trim(),
        email: form.email,
        phone: form.phone,
        password: form.password,
        role,
      }),
    });

    localStorage.setItem('nearme_user', JSON.stringify(data.user));
    if (data.token) localStorage.setItem('nearme_token', data.token);
    window.dispatchEvent(new Event('nearme:user-updated'));
    toast.success('Account created successfully!');
    navigate(role === 'provider' ? PROVIDER_KYC_PATH : '/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const data = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });

        localStorage.setItem('nearme_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('nearme_token', data.token);
        window.dispatchEvent(new Event('nearme:user-updated'));
        toast.success('Login successful!');
        if (data.user?.role === 'provider') {
          if (needsProviderKyc(data.user)) {
            navigate(PROVIDER_KYC_PATH);
          } else if (isProviderUnderReview(data.user)) {
            navigate(PROVIDER_REVIEW_PATH);
          } else {
            navigate(PROVIDER_DASHBOARD_PATH);
          }
        } else if (isAdminUser(data.user)) {
          navigate('/admin');
        } else {
          navigate('/');
        }
        return;
      }

      if (step === 1) {
        const otpResponse = await apiRequest('/api/auth/otp/send', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, phone: form.phone, purpose: 'signup' }),
        });

        setOtpPreview(otpResponse.devOtp || '');
        setStep(2);
        toast.success(otpResponse.devOtp ? 'OTP sent. Use the development code shown on screen.' : 'OTP sent.');
        return;
      }

      await apiRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, phone: form.phone, otp: form.otp, purpose: 'signup' }),
      });

      await completeSignup();
    } catch (err) {
      const errorMsg = err.message || 'Something went wrong';

      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-8 relative">
            <div className="absolute top-3 right-3 w-4 h-4 bg-bauhaus-red" />
            <div className="absolute top-3 right-10 w-4 h-4 bg-bauhaus-blue" />
            <div className="absolute top-3 right-[68px] w-4 h-4 bg-bauhaus-yellow" />

            <h1 className="font-black text-2xl uppercase tracking-tighter text-bauhaus-ink mt-4">
              {isLogin ? 'Welcome Back' : step === 2 ? 'Verify OTP' : 'Create Account'}
            </h1>
            <p className="font-medium text-sm text-bauhaus-ink/50 mt-1">
              {isLogin
                ? 'Sign in to your Near Me account'
                : step === 2
                ? `Enter the code sent to ${form.email}`
                : 'Join thousands of Filipinos using Near Me'}
            </p>

            {!isLogin && step === 1 && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                {[
                  { value: 'customer', icon: User, label: 'Customer', sub: 'Looking for help' },
                  { value: 'provider', icon: Wrench, label: 'Provider', sub: 'Offering services' },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex flex-col items-center gap-2 p-4 border-2 transition-all duration-200 ${
                      role === r.value
                        ? 'border-bauhaus-ink bg-bauhaus-red text-white shadow-bauhaus-sm'
                        : 'border-bauhaus-ink/30 bg-bauhaus-canvas hover:border-bauhaus-ink text-bauhaus-ink'
                    }`}
                  >
                    <r.icon className="h-6 w-6" />
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider">{r.label}</div>
                      <div className={`text-[10px] font-medium ${role === r.value ? 'text-white/70' : 'text-bauhaus-ink/50'}`}>{r.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {!isLogin && step === 2 ? (
                <>
                  <div className="p-4 bg-bauhaus-yellow border-2 border-bauhaus-ink">
                    <div className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60">Development OTP</div>
                    <div className="font-black text-3xl tracking-[0.35em] text-bauhaus-ink mt-1">{otpPreview || '------'}</div>
                  </div>
                  <div>
                    <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Verification Code</label>
                    <input
                      name="otp"
                      value={form.otp}
                      onChange={handleChange}
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      required
                      className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm text-center tracking-[0.4em] outline-none focus:border-bauhaus-blue transition-colors"
                    />
                  </div>
                  <button type="button" onClick={() => setStep(1)} className="font-bold text-xs uppercase tracking-wider text-bauhaus-blue hover:underline">
                    Change signup details
                  </button>
                </>
              ) : (
                <>
              {!isLogin && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="fname" className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">First Name</label>
                    <input
                      id="fname"
                      name="fname"
                      value={form.fname}
                      onChange={handleChange}
                      placeholder="Juan"
                      required
                      className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                    />
                  </div>

                  <div className="flex-1">
                    <label htmlFor="lname" className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Last Name</label>
                    <input
                      id="lname"
                      name="lname"
                      value={form.lname}
                      onChange={handleChange}
                      placeholder="Cruz"
                      required
                      className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="juan@email.com"
                  required
                  className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Phone Number</label>
                  <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue transition-colors">
                    <div className="px-3 py-3 bg-bauhaus-yellow border-r-2 border-bauhaus-ink font-bold text-xs">PH +63</div>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="9XX XXX XXXX"
                      className="flex-1 px-3 py-3 bg-bauhaus-canvas font-medium text-sm outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Password</label>
                <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue transition-colors">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="********"
                    required
                    className="flex-1 px-4 py-3 bg-bauhaus-canvas font-medium text-sm outline-none"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="px-3 py-3 hover:bg-bauhaus-canvas transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4 text-bauhaus-ink/40" /> : <Eye className="h-4 w-4 text-bauhaus-ink/40" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="text-right">
                  <Link to="/forgot-password" className="font-bold text-xs uppercase tracking-wider text-bauhaus-blue hover:underline">
                    Forgot Password?
                  </Link>
                </div>
              )}
                </>
              )}

              {error && <p className="font-medium text-xs text-bauhaus-red">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Please Wait...' : isLogin ? 'Log In' : step === 2 ? 'Verify & Create Account' : 'Send OTP'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[2px] bg-bauhaus-ink/10" />
              <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/30">or</span>
              <div className="flex-1 h-[2px] bg-bauhaus-ink/10" />
            </div>

            <p className="text-center font-medium text-sm text-bauhaus-ink/60">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Link
                to={isLogin ? '/signup' : '/login'}
                className="font-bold text-bauhaus-red hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </Link>
            </p>

            {!isLogin && role === 'provider' && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-bauhaus-blue/10 border-2 border-bauhaus-blue/30">
                <CheckCircle className="h-4 w-4 text-bauhaus-blue shrink-0 mt-0.5" />
                <p className="font-medium text-xs text-bauhaus-blue leading-relaxed">
                  As a provider, you will submit KYC after signup. Your application then stays under review for 3 to 5 days, and your dashboard unlocks after approval.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
