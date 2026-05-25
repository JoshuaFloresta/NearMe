import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Wallet, Star } from 'lucide-react';
import { toast } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import StarRating from '../components/nearme/StarRating';
import { PaymentPortalSkeleton } from '../components/nearme/PageSkeletons';
import { apiRequest } from '../lib/api';
import { getStoredNearMeUser } from '../lib/providerAccess';

export default function NearMePayNow() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [user] = useState(() => getStoredNearMeUser());
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [cashlessStarted, setCashlessStarted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const jobs = await apiRequest('/api/v1/jobs');
        const matched = (Array.isArray(jobs) ? jobs : []).find((item) => String(item._id) === String(jobId));
        if (!matched) throw new Error('Job not found');
        setJob(matched);
      } catch (error) {
        toast.error(error.message || 'Could not load payment details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId]);

  useEffect(() => {
    const activeJobId = localStorage.getItem('nearme_active_cashless_job_id');
    if (activeJobId && String(activeJobId) === String(jobId)) {
      setCashlessStarted(true);
    }
  }, [jobId]);

  useEffect(() => {
    if (String(job?.status || '') !== 'Completed') return;
    localStorage.removeItem('nearme_active_cashless_job_id');
    setCashlessStarted(false);
    navigate('/my-orders');
  }, [job?.status, navigate]);

  useEffect(() => {
    if (!job?._id) return undefined;
    if (!cashlessStarted) return undefined;
    let mounted = true;
    const timer = setInterval(async () => {
      try {
        const jobs = await apiRequest('/api/v1/jobs');
        const matched = (Array.isArray(jobs) ? jobs : []).find((item) => String(item._id) === String(job._id));
        if (!mounted || !matched) return;
        setJob(matched);
        if (String(matched.status || '') === 'Completed') {
          setCashlessStarted(false);
          toast.success('Payment received. Job is now completed.');
        }
      } catch {
        // silent background poll
      }
    }, 6000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [cashlessStarted, job?._id]);

  if (!user) return <Navigate to="/login" replace />;

  const submitPayment = async () => {
    if (!job) return;
    setSubmitting(true);
    try {
      if (paymentMethod === 'cash') {
        await apiRequest(`/api/v1/jobs/${job._id}/payment/cash-confirm`, {
          method: 'PATCH',
          body: JSON.stringify({
            confirmedAmount: job.financials?.grossPrice || 0,
            providerConfirm: true,
            clientConfirm: true,
          }),
        });
        toast.success('Cash payment confirmed');
      } else {
        const checkout = await apiRequest(`/api/v1/jobs/${job._id}/payment/cashless-checkout`, {
          method: 'POST',
        });
        const checkoutUrl = String(checkout?.checkoutUrl || '').trim();
        if (!checkoutUrl) {
          throw new Error('Cashless checkout URL not available');
        }
        const newTab = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        if (!newTab) {
          toast.error('Popup blocked. Please allow popups for this site to continue cashless payment in a new tab.');
          return;
        }
        setCashlessStarted(true);
        localStorage.setItem('nearme_active_cashless_job_id', String(job._id));
        localStorage.setItem('nearme_active_cashless_started_at', String(Date.now()));
        toast.success('Payment page opened in a new tab. Return here after payment.');
        navigate('/my-orders?cashless=processing');
        return;
      }
      const refreshed = await apiRequest('/api/v1/jobs');
      const matched = (Array.isArray(refreshed) ? refreshed : []).find((item) => String(item._id) === String(job._id));
      if (matched) setJob(matched);
    } catch (error) {
      toast.error(error.message || 'Could not submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!job) return;
    if (rating < 1) {
      toast.error('Please select a star rating before submitting.');
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      toast.error('Comment must be 10 to 500 characters.');
      return;
    }
    setReviewSubmitting(true);
    try {
      await apiRequest(`/api/v1/jobs/${job._id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: trimmed }),
      });
      toast.success('Review submitted');
    } catch (error) {
      toast.error(error.message || 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link to="/messages" className="font-black text-xs uppercase tracking-wider text-bauhaus-ink/60 hover:text-bauhaus-red">Back to Messages</Link>
        </div>

        {loading && <PaymentPortalSkeleton />}
        {!loading && job && (
          <div className="space-y-5">
            <section className="border-4 border-bauhaus-ink bg-white p-5">
              <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">Pay Now</div>
              <div className="mt-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/55">Job {job.jobNumber || String(job._id).slice(-8)}</div>
              <div className="mt-4 font-black text-2xl text-bauhaus-red">PHP {Number(job.financials?.grossPrice || 0).toLocaleString('en-PH')}</div>
            </section>

            {job.status === 'Pending Payment' && (
              <section className="border-4 border-bauhaus-ink bg-white p-5">
                <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Payment Method</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPaymentMethod('cash')} className={`p-4 border-2 border-bauhaus-ink text-left ${paymentMethod === 'cash' ? 'bg-bauhaus-yellow' : 'bg-white'}`}>
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider"><Wallet className="h-4 w-4" /> Cash Payment</div>
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('cashless')} className={`p-4 border-2 border-bauhaus-ink text-left ${paymentMethod === 'cashless' ? 'bg-bauhaus-yellow' : 'bg-white'}`}>
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider"><CreditCard className="h-4 w-4" /> Cashless Payment</div>
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="mt-4 border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 font-bold text-sm text-bauhaus-ink">
                    Please hand the exact amount to the provider. The provider will confirm receipt on their device.
                  </div>
                )}

                {paymentMethod === 'cashless' && (
                  <div className="mt-4 space-y-3">
                    <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 font-bold text-sm text-bauhaus-ink">
                      Payment opens in a new tab, so you stay in the app. After payment, return to My Orders and wait a few seconds while payment syncs.
                    </div>
                    {cashlessStarted && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiRequest(`/api/v1/jobs/${job._id}/payment/cashless-sync`, {
                              method: 'POST',
                            }).catch(() => null);
                            const refreshed = await apiRequest('/api/v1/jobs');
                            const updated = (Array.isArray(refreshed) ? refreshed : []).find((item) => String(item._id) === String(job._id));
                            if (!updated) throw new Error('Job not found');
                            setJob(updated);
                            if (String(updated.status || '').toLowerCase() === 'completed') {
                              setCashlessStarted(false);
                              localStorage.removeItem('nearme_active_cashless_job_id');
                              toast.success('Payment synced successfully');
                              navigate('/my-orders');
                              return;
                            }
                            toast.message('Payment is still syncing. Please wait a bit then refresh again.');
                          } catch (error) {
                            toast.error(error.message || 'Could not refresh payment status');
                          }
                        }}
                        className="px-4 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider"
                      >
                        Refresh Payment Status
                      </button>
                    )}
                  </div>
                )}

                <button type="button" onClick={submitPayment} disabled={submitting} className="mt-4 w-full px-4 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                  {submitting ? 'Submitting...' : paymentMethod === 'cashless' ? 'Proceed to Cashless Payment' : 'Submit Payment'}
                </button>
              </section>
            )}

            {job.status === 'Completed' && (
              <section className="border-4 border-bauhaus-ink bg-white p-5">
                <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">Leave a Review</div>
                <div className="mt-2">
                  <button type="button" onClick={() => setRating((current) => (current % 5) + 1)} className={`inline-flex items-center gap-2 px-3 py-2 border-2 border-bauhaus-ink ${rating < 1 ? 'bg-white' : 'bg-bauhaus-yellow'}`}>
                    <Star className="h-4 w-4" />
                    <span className="font-black text-xs uppercase tracking-wider">Tap to rate: {rating || 0}/5</span>
                  </button>
                  <div className="mt-2"><StarRating rating={rating} size="md" showNumber={false} /></div>
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Write your feedback (10-500 characters)" className="mt-3 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-medium text-sm outline-none resize-none" />
                <button type="button" onClick={submitReview} disabled={reviewSubmitting} className="mt-3 w-full px-4 py-3 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </section>
            )}
          </div>
        )}
      </main>
      <NearMeFooter />
    </div>
  );
}
