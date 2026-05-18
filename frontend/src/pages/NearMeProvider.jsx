import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, CheckCircle, MessageCircle, Calendar, Briefcase, Award, ChevronLeft, Clock, Heart, Share2 } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import StarRating from '../components/nearme/StarRating';
import { MOCK_PROVIDERS } from '../lib/nearMeData';

import gallery1 from '../images/dodong1.jpg';
import gallery2 from '../images/dodong2.jpg';
import gallery3 from '../images/dodong5.jpg';
import gallery4 from '../images/dodong4.jpg';


const GALLERY_IMGS = [
  gallery1,
  gallery2,
  gallery3,
  gallery4
]

const REVIEWS = [
  { name: 'Jasmine O.', rating: 5, date: 'May 2026', text: 'Excellent work! Fixed the leak quickly and professionally. Highly recommend!', avatar: 'https://media.base44.com/images/public/6a0b0e088a75428ee5031e7a/708290ce6_generated_image.png' },
  { name: 'Rafael G.', rating: 5, date: 'Apr 2026', text: 'Very reliable and affordable. Will definitely hire again.', avatar: 'https://media.base44.com/images/public/6a0b0e088a75428ee5031e7a/829e9a8a3_generated_image.png' },
  { name: 'Carla M.', rating: 4, date: 'Apr 2026', text: 'Good service, arrived on time. Clean work with no mess left behind.', avatar: 'https://media.base44.com/images/public/6a0b0e088a75428ee5031e7a/708290ce6_generated_image.png' },
];

export default function NearMeProvider() {
  const { id } = useParams();
  const provider = MOCK_PROVIDERS.find((p) => p.id === parseInt(id)) || MOCK_PROVIDERS[0];
  const [activeTab, setActiveTab] = useState('about');
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [hireNote, setHireNote] = useState('');

  const cornerColors = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];
  const headerColor = ['bg-bauhaus-blue', 'bg-bauhaus-red', 'bg-bauhaus-ink'];
  const colorIndex = provider.id % 3;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      {/* Back link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link to="/browse" className="inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/50 hover:text-bauhaus-red transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Browse
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main profile */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile card */}
            <div className="relative bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg overflow-hidden">
              {/* Color header */}
              <div className={`h-24 sm:h-32 ${headerColor[colorIndex]} relative`}>
                <div className="absolute inset-0 bauhaus-dots-light opacity-10" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button className="p-2 bg-white/20 border-2 border-white/40 hover:bg-white/30 transition-colors">
                    <Heart className="h-4 w-4 text-white" />
                  </button>
                  <button className="p-2 bg-white/20 border-2 border-white/40 hover:bg-white/30 transition-colors">
                    <Share2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-12">
                  <div className="relative">
                    <img
                      src={provider.avatar}
                      alt={provider.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover border-4 border-bauhaus-ink bg-white"
                    />
                    {provider.verified && (
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-bauhaus-blue border-2 border-white rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-black text-xl sm:text-2xl uppercase tracking-tighter text-bauhaus-ink">{provider.name}</h1>
                      {provider.verified && (
                        <span className="px-2 py-0.5 bg-bauhaus-blue text-white font-bold text-[9px] uppercase tracking-wider border border-bauhaus-ink">Verified</span>
                      )}
                    </div>
                    <div className="font-bold text-sm uppercase tracking-wider text-bauhaus-red mt-0.5">{provider.service}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={provider.rating} size="md" />
                      <span className="font-medium text-xs text-bauhaus-ink/50">({provider.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t-2 border-bauhaus-ink/10">
                  {[
                    { label: 'Jobs Done', value: provider.jobs, color: 'text-bauhaus-blue' },
                    { label: 'Rating', value: `${provider.rating}★`, color: 'text-bauhaus-yellow' },
                    { label: 'Rate', value: `₱${provider.rate}`, color: 'text-bauhaus-red' },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className={`font-black text-xl ${s.color}`}>{s.value}</div>
                      <div className="font-bold text-[9px] uppercase tracking-widest text-bauhaus-ink/40 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b-4 border-bauhaus-ink flex">
              {['about', 'gallery', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 sm:px-8 py-3 font-black text-xs uppercase tracking-wider transition-all duration-200 ${activeTab === tab ? 'bg-bauhaus-red text-white border-r-2 border-bauhaus-ink' : 'bg-white text-bauhaus-ink hover:bg-bauhaus-canvas border-r-2 border-bauhaus-ink'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="bg-white border-2 border-bauhaus-ink p-5">
                  <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-2">About</h3>
                  <p className="font-medium text-sm text-bauhaus-ink/70 leading-relaxed">{provider.bio}</p>
                </div>
                <div className="bg-white border-2 border-bauhaus-ink p-5">
                  <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-3">Service Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.tags?.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-bauhaus-canvas border-2 border-bauhaus-ink font-bold text-xs uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: MapPin, label: 'Service Area', value: provider.location },
                    { icon: Clock, label: 'Availability', value: provider.available ? 'Available Now' : 'Currently Busy' },
                    { icon: Award, label: 'Certifications', value: 'TESDA Certified' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-bauhaus-canvas border-2 border-bauhaus-ink p-4 flex items-start gap-3">
                      <div className="w-8 h-8 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
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
                {GALLERY_IMGS.map((img, i) => (
                  <div key={i} className="border-2 md:border-4 border-bauhaus-ink overflow-hidden aspect-video hover:-translate-y-1 transition-all duration-200 shadow-bauhaus-sm">
                    <img src={img} alt={`Work sample ${i + 1}`} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {REVIEWS.map((rev, i) => (
                  <div key={i} className="bg-white border-2 border-bauhaus-ink p-5">
                    <div className="flex items-start gap-3">
                      <img src={rev.avatar} alt={rev.name} className="w-10 h-10 object-cover border-2 border-bauhaus-ink shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{rev.name}</div>
                          <div className="font-medium text-xs text-bauhaus-ink/40">{rev.date}</div>
                        </div>
                        <StarRating rating={rev.rating} size="sm" showNumber={false} />
                        <p className="mt-2 font-medium text-sm text-bauhaus-ink/70 leading-relaxed">{rev.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — Hire */}
          <div className="lg:col-span-1 space-y-5">
            {/* Rate card */}
            <div className="relative bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6">
              <div className={`absolute top-3 right-3 w-3 h-3 ${cornerColors[colorIndex]}`} />
              <div className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/40 mb-1">Service Rate</div>
              <div className="font-black text-4xl text-bauhaus-red">
                ₱{provider.rate}<span className="text-base text-bauhaus-ink/40 font-medium">/hr</span>
              </div>
              <p className="font-medium text-xs text-bauhaus-ink/50 mt-1">Materials charged separately if needed</p>

              <div className={`mt-4 flex items-center gap-2 px-3 py-2 border-2 border-bauhaus-ink ${provider.available ? 'bg-bauhaus-yellow' : 'bg-bauhaus-canvas'}`}>
                <div className={`w-2 h-2 rounded-full ${provider.available ? 'bg-bauhaus-ink' : 'bg-bauhaus-ink/30'}`} />
                <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink">
                  {provider.available ? 'Available Now' : 'Currently Busy'}
                </span>
              </div>

              <div className="space-y-3 mt-5">
                <button
                  onClick={() => setShowHireModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <Briefcase className="h-4 w-4" /> Hire Now
                </button>
                <Link
                  to={`/messages?provider=${provider.id}`}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-[2px_2px_0px_0px_black] transition-all duration-200 hover:bg-bauhaus-canvas active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <MessageCircle className="h-4 w-4" /> Message
                </Link>
              </div>
            </div>

            {/* Info */}
            <div className="bg-bauhaus-blue border-4 border-bauhaus-ink p-5 text-white">
              <div className="font-black text-sm uppercase tracking-tight mb-3">Quick Info</div>
              {[
                { icon: MapPin, text: `${provider.distance} km away · ${provider.location}` },
                { icon: Briefcase, text: `${provider.jobs} jobs completed` },
                { icon: Calendar, text: 'Joined Near Me in 2024' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-bauhaus-yellow shrink-0" />
                  <span className="font-medium text-sm text-white/70">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
          <div className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg w-full max-w-md p-8 relative">
            <div className="absolute top-3 right-3 w-3 h-3 bg-bauhaus-red" />
            <h2 className="font-black text-xl uppercase tracking-tighter text-bauhaus-ink mb-1">Hire {provider.name}</h2>
            <p className="font-medium text-sm text-bauhaus-ink/50 mb-6">{provider.service} · ₱{provider.rate}/hr</p>
            <div className="space-y-4">
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Preferred Date & Time</label>
                <input
                  type="datetime-local"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue"
                />
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Address</label>
                <input
                  placeholder="e.g. 15 Rizal St., Brgy. Sta. Cruz, QC"
                  className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue"
                />
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Job Description</label>
                <textarea
                  value={hireNote}
                  onChange={(e) => setHireNote(e.target.value)}
                  rows={3}
                  placeholder="Describe what you need done..."
                  className="w-full px-4 py-3 bg-bauhaus-canvas border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-3 bg-white text-bauhaus-ink font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowHireModal(false); alert('Booking request sent! The provider will be notified.'); }}
                className="flex-1 px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      <NearMeFooter />
    </div>
  );
}