import React, { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Clock, MailCheck, ShieldCheck, AlertTriangle, ChevronLeft } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import {
  PROVIDER_DASHBOARD_PATH,
  PROVIDER_KYC_PATH,
  getStoredNearMeUser,
  isProviderUnderReview,
  needsProviderKyc,
} from '../lib/providerAccess';

export default function NearMeProviderReview() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredNearMeUser());

  useEffect(() => {
    const syncUser = () => setUser(getStoredNearMeUser());
    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'provider' && user.providerStatus === 'approved') return <Navigate to={PROVIDER_DASHBOARD_PATH} replace />;
  if (user.role !== 'provider') return <Navigate to="/" replace />;
  const rejectedKyc = ['rejected', 'resubmission_required'].includes(String(user.providerStatus || '').toLowerCase());
  if (!isProviderUnderReview(user) && !rejectedKyc && needsProviderKyc(user)) return <Navigate to={PROVIDER_KYC_PATH} replace />;
  if (!isProviderUnderReview(user) && !rejectedKyc) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit flex flex-col">
      <NearMeNav />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6 sm:p-8 relative">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider hover:bg-bauhaus-canvas"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="absolute top-4 right-4 w-4 h-4 bg-bauhaus-yellow border-2 border-bauhaus-ink" />
          {rejectedKyc ? (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5" />
              KYC Rejected
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              Application Under Review
            </div>
          )}

          {rejectedKyc ? (
            <>
              <h1 className="mt-5 font-black text-2xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink">
                KYC was rejected
              </h1>
              <p className="mt-3 font-medium text-sm sm:text-base text-bauhaus-ink/60 leading-relaxed">
                KYC is denied. Please review your documents and try to resubmit another one again to continue with your provider application.
              </p>
              <p className="mt-2 font-medium text-sm sm:text-base text-bauhaus-ink/60 leading-relaxed">
                If you need more help, try contacting <a href="mailto:hello@nearme.ph" className="font-black text-bauhaus-red underline">hello@nearme.ph</a>.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-5 font-black text-2xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink">
                Your provider application is still under review
              </h1>
              <p className="mt-3 font-medium text-sm sm:text-base text-bauhaus-ink/60 leading-relaxed">
                Thanks for submitting your verification. Our admin team is reviewing your application and documents. Please wait up to 3 to 5 days for approval.
              </p>
            </>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-bauhaus-red shrink-0" />
              <div>
                <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Review Window</div>
                <div className="mt-1 font-medium text-sm text-bauhaus-ink/60">Usually completed within 3 to 5 days.</div>
              </div>
            </div>
            <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 flex items-start gap-3">
              <MailCheck className="h-5 w-5 text-bauhaus-blue shrink-0" />
              <div>
                <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Next Login</div>
                <div className="mt-1 font-medium text-sm text-bauhaus-ink/60">Once approved, login will open your provider dashboard.</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {rejectedKyc ? (
              <Link to={PROVIDER_KYC_PATH} className="inline-flex justify-center px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-black text-xs uppercase tracking-wider">
                Resubmit KYC
              </Link>
            ) : (
              <Link to="/" className="inline-flex justify-center px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink shadow-bauhaus-sm font-black text-xs uppercase tracking-wider">
                Back Home
              </Link>
            )}
          </div>
        </section>
      </main>

      <NearMeFooter />
    </div>
  );
}
