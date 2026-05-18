import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Eye, EyeOff, User, Wrench, ArrowRight, CheckCircle } from 'lucide-react';
import { APP_NAME } from '../lib/nearMeData';

export default function NearMeAuth() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  const [role, setRole] = useState('customer');
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP (signup)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', otp: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLogin && step === 1) { setStep(2); return; }
    // TODO: connect to backend
    alert(isLogin ? 'Login submitted!' : 'Registration submitted!');
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas flex flex-col font-outfit">
      {/* Minimal header */}
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
          {/* Card */}
          <div className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-8 relative">
            {/* Corner decoration */}
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
                ? `Enter the 6-digit code sent to ${form.phone || form.email}`
                : 'Join thousands of Filipinos using Near Me'}
            </p>

            {/* Role selector (signup only) */}
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {step === 2 ? (
                <>
                  <div className="text-center py-6">
                    <div className="font-bold text-5xl text-bauhaus-ink tracking-[0.5em] font-mono">● ● ● ● ● ●</div>
                  </div>
                  <input
                    name="otp"
                    value={form.otp}
                    onChange={handleChange}
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm text-center tracking-[0.5em] font-mono outline-none focus:border-bauhaus-blue"
                  />
                  <p className="text-center font-medium text-xs text-bauhaus-ink/50">
                    Didn't receive it?{' '}
                    <button type="button" className="font-bold text-bauhaus-red hover:underline">Resend OTP</button>
                  </p>
                </>
              ) : (
                <>
                  {!isLogin && (
                    <div>
                      <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Full Name</label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Juan dela Cruz"
                        required
                        className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors"
                      />
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
                        <div className="px-3 py-3 bg-bauhaus-yellow border-r-2 border-bauhaus-ink font-bold text-xs">🇵🇭 +63</div>
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
                        placeholder="••••••••"
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

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none mt-2"
              >
                {isLogin ? 'Log In' : step === 2 ? 'Verify & Create Account' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Divider */}
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

            {/* Provider signup note */}
            {!isLogin && role === 'provider' && step === 1 && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-bauhaus-blue/10 border-2 border-bauhaus-blue/30">
                <CheckCircle className="h-4 w-4 text-bauhaus-blue shrink-0 mt-0.5" />
                <p className="font-medium text-xs text-bauhaus-blue leading-relaxed">
                  As a provider, you'll undergo ID verification before your profile goes live. You can start adding your services right after registration.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}