import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, CheckCircle, MessageCircle, Calendar, Briefcase, Award, ChevronLeft, Clock, Heart, Share2 } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import StarRating from '../components/nearme/StarRating';
import BookServiceModal from '../components/nearme/BookServiceModal';
import { apiRequest, getStoredToken } from '../lib/api';
import { getStoredNearMeUser } from '../lib/providerAccess';

const emptyProvider = {
  id: 0,
  _id: '',
  name: 'Provider',
  avatar: '',
  service: 'Service',
  serviceId: 'other',
  rating: 0,
  reviews: 0,
  jobs: 0,
  rate: 0,
  distance: 0,
  location: '',
  serviceArea: '',
  verified: false,
  available: false,
  bio: '',
  tags: [],
  certifications: [],
  gallery: [],
  joinedYear: '',
};

const providerKey = (provider) => provider.id || provider._id || 0;
const normalizeCategory = (value = '') => String(value).toLowerCase().trim();
const favoritesStorageKey = 'nearme_favorite_providers';

const formatReviewDate = (review) => {
  const date = new Date(review.createdAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const getFavoriteIds = () => {
  try {
    const raw = localStorage.getItem(favoritesStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setFavoriteIds = (ids) => {
  localStorage.setItem(favoritesStorageKey, JSON.stringify(ids));
};

export default function NearMeProvider() {
  const { id } = useParams();
  const currentUser = getStoredNearMeUser();
  const [provider, setProvider] = useState(emptyProvider);
  const [reviews, setReviews] = useState([]);
  const [providerFixedServices, setProviderFixedServices] = useState([]);
  const [customPackages, setCustomPackages] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [activeTab, setActiveTab] = useState('about');
  const [showBookModal, setShowBookModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, text: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const currentUserId = String(currentUser?.id || '').trim();
  const currentUserRole = String(currentUser?.role || '').trim().toLowerCase();
  const canCurrentUserReview = Boolean(currentUserId) && ['client', 'customer', 'user'].includes(currentUserRole);

  useEffect(() => {
    Promise.all([
      apiRequest(`/api/providers/${id}`),
      apiRequest(`/api/providers/${id}/reviews`).catch(() => []),
      apiRequest(`/api/v1/providers/${encodeURIComponent(id)}/offers`).catch(() => ({ fixedServices: [], customBundles: [] })),
      apiRequest('/api/v1/services').catch(() => []),
    ])
      .then(([providerData, reviewData, offersData, servicesData]) => {
        const mergedProvider = { ...emptyProvider, ...providerData };
        setProvider(mergedProvider);
        setReviews(Array.isArray(reviewData) ? reviewData : []);
        setProviderFixedServices(Array.isArray(offersData?.fixedServices) ? offersData.fixedServices : []);
        setCustomPackages(Array.isArray(offersData?.customBundles) ? offersData.customBundles : []);
        setServiceCatalog(Array.isArray(servicesData) ? servicesData : []);

        const favorites = getFavoriteIds();
        const key = String(providerKey(mergedProvider));
        setIsFavorite(favorites.includes(key));
      })
      .catch(() => {
        setProvider(emptyProvider);
        setReviews([]);
        setProviderFixedServices([]);
        setCustomPackages([]);
        setServiceCatalog([]);
        setIsFavorite(false);
      });
  }, [id]);

  const fixedServices = useMemo(() => {
    if (providerFixedServices.length > 0) {
      return providerFixedServices.map((service) => ({
        id: service._id || service.title,
        label: service.title || 'Service',
        category: service.category || provider.serviceId || 'other',
        description: service.description || 'Fixed price service',
        price: Number(service.price || 0),
        durationHours: Number(service.durationHours || 0),
        durationMinutes: Number(service.durationMinutes || 0),
      }));
    }
    const matched = serviceCatalog.find((item) => item.id === provider.serviceId);
    return [{
      id: matched?.id || provider.serviceId || 'other',
      label: matched?.label || provider.service || 'General Service',
      category: matched?.id || provider.serviceId || 'other',
      description: 'Standard base-rate service',
      price: Number(provider.startingRate ?? provider.rate ?? 0),
    }];
  }, [providerFixedServices, serviceCatalog, provider.serviceId, provider.service, provider.startingRate, provider.rate]);
  const displayedStartingRate = useMemo(() => {
    const fixedPrices = providerFixedServices
      .map((service) => Number(service?.price || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (fixedPrices.length > 0) return Math.min(...fixedPrices);
    const fromProvider = Number(provider.startingRate ?? provider.rate ?? 0);
    return Number.isFinite(fromProvider) ? fromProvider : 0;
  }, [providerFixedServices, provider.startingRate, provider.rate]);

  const affiliatedCategories = useMemo(() => {
    const values = new Map();
    const baseService = serviceCatalog.find((item) => item.id === provider.serviceId);
    if (provider.serviceId) values.set(normalizeCategory(provider.serviceId), baseService?.label || provider.service || 'Primary Service');
    providerFixedServices.forEach((service) => {
      if (!service.category) return;
      values.set(normalizeCategory(service.category), service.category);
    });
    customPackages.forEach((pack) => {
      if (!pack.serviceId) return;
      const info = serviceCatalog.find((item) => item.id === pack.serviceId);
      values.set(normalizeCategory(pack.serviceId), info?.label || pack.serviceId);
    });
    if (values.size === 0) values.set('other', 'Other');
    return Array.from(values.entries()).map(([value, label]) => ({ value, label }));
  }, [serviceCatalog, provider.serviceId, provider.service, providerFixedServices, customPackages]);

  const toggleFavorite = () => {
    const key = String(providerKey(provider));
    const current = getFavoriteIds();
    if (current.includes(key)) {
      const next = current.filter((item) => item !== key);
      setFavoriteIds(next);
      setIsFavorite(false);
      alert('Removed from favorites.');
      return;
    }
    const next = [...new Set([...current, key])];
    setFavoriteIds(next);
    setIsFavorite(true);
    alert('Added to favorites.');
  };

  const shareProvider = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: provider.name || 'NearMe Provider',
      text: `Check out ${provider.name} on NearMe`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Provider link copied to clipboard.');
      } else {
        window.prompt('Copy this link:', shareUrl);
      }
    } catch {
      // user cancelled share; no error needed
    }
  };

  const sendInquiryRequest = async (payload) => {
    if (!currentUser || !getStoredToken()) {
      alert('Please log in before contacting a provider.');
      return;
    }
    if (currentUser.role === 'provider' && currentUser.providerStatus !== 'approved') {
      alert('Your provider account is not approved yet. You cannot hire other providers at this time.');
      return;
    }

    const conversation = await apiRequest('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ providerId: providerKey(provider), status: 'Inquiry' }),
    });

    const inquiryCard = {
      inquiryId: `inq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'inquiry_card',
      serviceSelection: payload.serviceSelection || null,
      serviceCategory: payload.serviceCategory,
      bookingDate: payload.bookingDate,
      bookingTime: payload.bookingTime,
      address: payload.address,
      notes: payload.notes || '',
      dynamicFields: payload.dynamicFields || {},
    };

    await apiRequest(`/api/conversations/${conversation._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: `INQUIRY_CARD::${JSON.stringify(inquiryCard)}` }),
    });
    alert('Inquiry sent. Continue in Messages.');
  };

  const submitReview = async () => {
    if (!canCurrentUserReview) {
      alert('Only client accounts can leave provider reviews.');
      return;
    }
    const rating = Number(reviewForm.rating || 0);
    const text = reviewForm.text.trim();
    if (rating < 1) {
      alert('Please select a star rating before submitting.');
      return;
    }
    if (text.length < 10 || text.length > 500) {
      alert('Review text must be 10 to 500 characters.');
      return;
    }
    setReviewSubmitting(true);
    try {
      const response = await apiRequest(`/api/providers/${providerKey(provider)}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, text }),
      });
      const savedReview = response?.review || response;
      const created = Boolean(response?.created);
      setReviews((current) => {
        const filtered = current.filter((item) => String(item?.customerUserId || '') !== currentUserId);
        return [savedReview, ...filtered];
      });
      if (response?.provider) {
        setProvider((current) => ({
          ...current,
          reviews: Number(response.provider.reviews ?? current.reviews ?? 0),
          rating: Number(response.provider.rating ?? current.rating ?? 0),
        }));
      }
      setReviewForm({
        rating: Number(savedReview?.rating || rating),
        text: String(savedReview?.text || text),
      });
      alert(created ? 'Review submitted. You can edit it anytime.' : 'Review updated.');
    } catch (error) {
      alert(error.message || 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };
  const existingClientReview = useMemo(() => (
    reviews.find((review) => String(review?.customerUserId || '') === currentUserId) || null
  ), [reviews, currentUserId]);

  useEffect(() => {
    if (!existingClientReview) return;
    setReviewForm({
      rating: Number(existingClientReview.rating || 0),
      text: String(existingClientReview.text || ''),
    });
  }, [existingClientReview]);

  const cornerColors = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];
  const headerColor = ['bg-bauhaus-blue', 'bg-bauhaus-red', 'bg-bauhaus-ink'];
  const colorIndex = Number(providerKey(provider)) % 3;
  const galleryImages = Array.isArray(provider.gallery) ? provider.gallery.filter(Boolean) : [];
  const certifications = Array.isArray(provider.certifications) ? provider.certifications : [];
  const hiringLockedForCurrentUser = currentUser?.role === 'provider' && currentUser?.providerStatus !== 'approved';

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link to="/browse" className="inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/50 hover:text-bauhaus-red transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Browse
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg overflow-hidden">
              <div className={`h-24 sm:h-32 ${headerColor[colorIndex]} relative`}>
                <div className="absolute inset-0 bauhaus-dots-light opacity-10" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button type="button" onClick={toggleFavorite} className={`p-2 border-2 border-white/40 transition-colors ${isFavorite ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
                    <Heart className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" onClick={shareProvider} className="p-2 bg-white/20 border-2 border-white/40 hover:bg-white/30 transition-colors">
                    <Share2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-12">
                  <div className="relative">
                    {provider.avatar ? (
                      <img src={provider.avatar} alt={provider.name} className="w-20 h-20 sm:w-24 sm:h-24 object-cover border-4 border-bauhaus-ink bg-white" />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center font-black text-xl uppercase">
                        {(provider.name || 'P').slice(0, 2)}
                      </div>
                    )}
                    {provider.verified && (
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-bauhaus-blue border-2 border-white rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-black text-xl sm:text-2xl uppercase tracking-tighter text-bauhaus-ink">{provider.name}</h1>
                      {provider.verified && <span className="px-2 py-0.5 bg-bauhaus-blue text-white font-bold text-[9px] uppercase tracking-wider border border-bauhaus-ink">Verified</span>}
                    </div>
                    <div className="font-bold text-sm uppercase tracking-wider text-bauhaus-red mt-0.5">{provider.service}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={provider.rating} size="md" />
                      <span className="font-medium text-xs text-bauhaus-ink/50">({provider.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t-2 border-bauhaus-ink/10">
                  {[{ label: 'Jobs Done', value: provider.jobs, color: 'text-bauhaus-blue' }, { label: 'Rating', value: `${provider.rating}★`, color: 'text-bauhaus-yellow' }, { label: 'Starts At', value: `PHP ${displayedStartingRate.toLocaleString('en-PH')}`, color: 'text-bauhaus-red' }].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className={`font-black text-xl ${s.color}`}>{s.value}</div>
                      <div className="font-bold text-[9px] uppercase tracking-widest text-bauhaus-ink/40 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b-4 border-bauhaus-ink flex">
              {['about', 'gallery', 'reviews'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 sm:px-8 py-3 font-black text-xs uppercase tracking-wider transition-all duration-200 ${activeTab === tab ? 'bg-bauhaus-red text-white border-r-2 border-bauhaus-ink' : 'bg-white text-bauhaus-ink hover:bg-bauhaus-canvas border-r-2 border-bauhaus-ink'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="bg-white border-2 border-bauhaus-ink p-5">
                  <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-2">About</h3>
                  <p className="font-medium text-sm text-bauhaus-ink/70 leading-relaxed">{provider.bio || 'This provider has not added an about section yet.'}</p>
                </div>
                <div className="bg-white border-2 border-bauhaus-ink p-5">
                  <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-3">Service Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {(provider.tags || []).map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-bauhaus-canvas border-2 border-bauhaus-ink font-bold text-xs uppercase tracking-wider">{tag}</span>
                    ))}
                    {(provider.tags || []).length === 0 && <span className="font-medium text-sm text-bauhaus-ink/50">No service tags yet.</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[{ icon: MapPin, label: 'Service Area', value: provider.serviceArea || provider.location || 'Not set' }, { icon: Clock, label: 'Availability', value: provider.available ? 'Available Now' : 'Currently Busy' }, { icon: Award, label: 'Certifications', value: certifications.length ? certifications.join(', ') : 'Not listed' }].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-bauhaus-canvas border-2 border-bauhaus-ink p-4 flex items-start gap-3">
                      <div className="w-8 h-8 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-white" /></div>
                      <div>
                        <div className="font-bold text-[9px] uppercase tracking-widest text-bauhaus-ink/40">{label}</div>
                        <div className="font-black text-xs text-bauhaus-ink mt-0.5">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'gallery' && (
              <div className="grid grid-cols-2 gap-4">
                {galleryImages.map((img, i) => (
                  <div key={i} className="border-2 md:border-4 border-bauhaus-ink overflow-hidden aspect-video hover:-translate-y-1 transition-all duration-200 shadow-bauhaus-sm">
                    <img src={img} alt={`Work sample ${i + 1}`} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300" />
                  </div>
                ))}
                {galleryImages.length === 0 && <div className="col-span-2 border-2 border-dashed border-bauhaus-ink bg-white p-8 text-center font-black text-sm uppercase tracking-tight text-bauhaus-ink/45">No gallery photos yet</div>}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {canCurrentUserReview ? (
                  <div className="bg-white border-2 border-bauhaus-ink p-5">
                    <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{existingClientReview ? 'Edit Your Review' : 'Add Review'}</div>
                    <div className="mt-1 font-medium text-xs text-bauhaus-ink/60">One review per client. You can update your review anytime.</div>
                    <div className="mt-3 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setReviewForm((current) => ({ ...current, rating: star }))} className={`px-2 py-1 border-2 border-bauhaus-ink font-black text-xs ${reviewForm.rating >= star ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-white text-bauhaus-ink/50'}`}>
                          {star}★
                        </button>
                      ))}
                    </div>
                    <textarea value={reviewForm.text} onChange={(e) => setReviewForm((current) => ({ ...current, text: e.target.value }))} rows={3} placeholder="Write your review (10-500 characters)" className="mt-3 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-medium text-sm outline-none resize-none" />
                    <button type="button" onClick={submitReview} disabled={reviewSubmitting} className="mt-3 px-4 py-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider disabled:opacity-60">
                      {reviewSubmitting ? 'Saving...' : (existingClientReview ? 'Update Review' : 'Submit Review')}
                    </button>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-bauhaus-ink p-5 font-medium text-sm text-bauhaus-ink/70">
                    Sign in with a client account to leave a review.
                  </div>
                )}

                {reviews.map((rev, i) => (
                  <div key={rev._id || i} className="bg-white border-2 border-bauhaus-ink p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 object-cover border-2 border-bauhaus-ink shrink-0 bg-bauhaus-canvas flex items-center justify-center font-black text-xs uppercase">
                        {(rev.name || 'U').slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{rev.name || 'Customer'}</div>
                          <div className="font-medium text-xs text-bauhaus-ink/40">{formatReviewDate(rev)}</div>
                        </div>
                        <StarRating rating={rev.rating} size="sm" showNumber={false} />
                        <p className="mt-2 font-medium text-sm text-bauhaus-ink/70 leading-relaxed">{rev.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && <div className="bg-white border-2 border-dashed border-bauhaus-ink p-8 text-center font-black text-sm uppercase tracking-tight text-bauhaus-ink/45">No reviews yet</div>}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-5">
            <div className="relative bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6">
              <div className={`absolute top-3 right-3 w-3 h-3 ${cornerColors[colorIndex]}`} />
              <div className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/40 mb-1">Service Starting Price</div>
              <div className="font-black text-4xl text-bauhaus-red">
                PHP {displayedStartingRate.toLocaleString('en-PH')}<span className="text-base text-bauhaus-ink/40 font-medium"> start</span>
              </div>
              <p className="font-medium text-xs text-bauhaus-ink/50 mt-1">Materials charged separately if needed</p>

              <div className={`mt-4 flex items-center gap-2 px-3 py-2 border-2 border-bauhaus-ink ${provider.available ? 'bg-bauhaus-yellow' : 'bg-bauhaus-canvas'}`}>
                <div className={`w-2 h-2 rounded-full ${provider.available ? 'bg-bauhaus-ink' : 'bg-bauhaus-ink/30'}`} />
                <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink">{provider.available ? 'Available Now' : 'Currently Busy'}</span>
              </div>

              <div className="space-y-3 mt-5">
                <button
                  onClick={() => {
                    if (hiringLockedForCurrentUser) {
                      alert('Your provider account is not approved yet. You cannot hire other providers at this time.');
                      return;
                    }
                    setShowBookModal(true);
                  }}
                  disabled={hiringLockedForCurrentUser}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Briefcase className="h-4 w-4" /> Book Service
                </button>
                {hiringLockedForCurrentUser && (
                  <div className="px-3 py-2 border-2 border-bauhaus-ink bg-bauhaus-canvas font-bold text-[11px] text-bauhaus-ink/70">
                    Hiring is disabled until your provider KYC is approved.
                  </div>
                )}
                <Link to={`/messages?provider=${providerKey(provider)}`} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-[2px_2px_0px_0px_black] transition-all duration-200 hover:bg-bauhaus-canvas active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <MessageCircle className="h-4 w-4" /> Message
                </Link>
              </div>
            </div>

            <div className="bg-bauhaus-blue border-4 border-bauhaus-ink p-5 text-white">
              <div className="font-black text-sm uppercase tracking-tight mb-3">Quick Info</div>
              {[{ icon: MapPin, text: `${provider.distance || 0} km away - ${provider.location || 'Location not set'}` }, { icon: Briefcase, text: `${provider.jobs} jobs completed` }, { icon: Calendar, text: `Joined Near Me${provider.joinedYear ? ` in ${provider.joinedYear}` : ''}` }].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-bauhaus-yellow shrink-0" />
                  <span className="font-medium text-sm text-white/70">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BookServiceModal
        open={showBookModal}
        onClose={() => setShowBookModal(false)}
        fixedServices={fixedServices}
        customBundles={customPackages}
        affiliatedCategories={affiliatedCategories}
        providerName={provider.name || 'Provider'}
        onSubmit={sendInquiryRequest}
      />
      <NearMeFooter />
    </div>
  );
}

