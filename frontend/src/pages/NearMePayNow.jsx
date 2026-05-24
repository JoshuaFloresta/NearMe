import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CreditCard, ImagePlus, Wallet, Star } from 'lucide-react';
import { toast } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import StarRating from '../components/nearme/StarRating';
import { PaymentPortalSkeleton } from '../components/nearme/PageSkeletons';
import { apiRequest, uploadImage } from '../lib/api';
import { getStoredNearMeUser } from '../lib/providerAccess';

const isValidImage = (file) => ['image/jpeg', 'image/png'].includes(file?.type || '');

export default function NearMePayNow() {
  const { jobId } = useParams();
  const [user] = useState(() => getStoredNearMeUser());
  const [job, setJob] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
        if (matched.providerObjectId) {
          const profile = await apiRequest(`/api/providers/${matched.providerObjectId}`).catch(() => null);
          setProvider(profile);
        }
      } catch (error) {
        toast.error(error.message || 'Could not load payment details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId]);

  const proofError = useMemo(() => {
    if (!proofFile) return 'Attach a payment screenshot.';
    if (!isValidImage(proofFile)) return 'File must be JPEG or PNG.';
    if (proofFile.size > 5 * 1024 * 1024) return 'File must be 5MB or smaller.';
    return '';
  }, [proofFile]);

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
        if (proofError) {
          toast.error(proofError);
          setSubmitting(false);
          return;
        }
        const proofUrl = await uploadImage(proofFile, 'payment-proof');
        await apiRequest(`/api/v1/jobs/${job._id}/payment/qr-proof`, {
          method: 'POST',
          body: JSON.stringify({
            proofUrl,
            declaredAmount: job.financials?.grossPrice || 0,
          }),
        });
        toast.success('Payment proof submitted for verification');
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
                  <button type="button" onClick={() => setPaymentMethod('qr')} className={`p-4 border-2 border-bauhaus-ink text-left ${paymentMethod === 'qr' ? 'bg-bauhaus-yellow' : 'bg-white'}`}>
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider"><CreditCard className="h-4 w-4" /> QR Code Payment</div>
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="mt-4 border-2 border-bauhaus-ink bg-bauhaus-canvas p-4 font-bold text-sm text-bauhaus-ink">
                    Please hand the exact amount to the provider. The provider will confirm receipt on their device.
                  </div>
                )}

                {paymentMethod === 'qr' && (
                  <div className="mt-4 space-y-3">
                    <div className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                      <div className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Provider QR</div>
                      {provider?.paymentQrUrl ? (
                        <img src={provider.paymentQrUrl} alt="Provider QR" className="mt-2 w-full max-w-sm border-2 border-bauhaus-ink bg-white" />
                      ) : (
                        <div className="mt-2 font-bold text-xs text-bauhaus-ink/60">Provider QR image not set.</div>
                      )}
                    </div>
                    <label className="block border-2 border-dashed border-bauhaus-ink bg-white p-5 cursor-pointer hover:bg-bauhaus-canvas">
                      <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-bauhaus-ink"><ImagePlus className="h-4 w-4" /> Upload Payment Screenshot (JPEG/PNG, max 5MB)</div>
                      <input type="file" accept="image/jpeg,image/png" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="sr-only" />
                      <div className="mt-2 font-bold text-xs text-bauhaus-ink/60">{proofFile ? proofFile.name : 'No file selected'}</div>
                      {proofFile && proofError && <div className="mt-1 text-xs font-black text-bauhaus-red">{proofError}</div>}
                    </label>
                  </div>
                )}

                <button type="button" onClick={submitPayment} disabled={submitting || (paymentMethod === 'qr' && Boolean(proofError))} className="mt-4 w-full px-4 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider disabled:opacity-60">
                  {submitting ? 'Submitting...' : 'Submit Payment'}
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
