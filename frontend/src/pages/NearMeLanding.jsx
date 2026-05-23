import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, ArrowRight, Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import StarRating from '../components/nearme/StarRating';
import { SERVICES, MOCK_PROVIDERS, TESTIMONIALS } from '../lib/nearMeData';
import heroImage from '../images/hero.png';

const HERO_IMG = heroImage;

const FAQ = [
  { q: 'How does Near Me work?', a: 'Simply search for the service you need, browse verified providers near your location, view their profiles and rates, then hire directly through the platform. It\'s that simple!' },
  { q: 'Are service providers verified?', a: 'Yes! All providers go through ID verification, background checks, and skill assessment before being listed on Near Me. Look for the blue verified badge on profiles.' },
  { q: 'What payment methods are accepted?', a: 'We accept GCash, Maya, online banking, credit/debit cards, and cash on completion. Payment is held securely until the job is done.' },
  { q: 'What if I\'m not satisfied with the service?', a: 'We offer a satisfaction guarantee. If you\'re not happy with the service, contact our support team within 24 hours and we\'ll resolve it — including a full refund if warranted.' },
  { q: 'Can I become a service provider?', a: 'Absolutely! Sign up as a provider, complete verification, set your rates and availability, and start accepting jobs in your area.' },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-2 md:border-4 border-bauhaus-ink transition-all duration-200 ${open ? 'shadow-none' : 'shadow-bauhaus-sm'}`}>
      <button
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-200 ${open ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink hover:bg-bauhaus-canvas'}`}
        onClick={() => setOpen(!open)}
      >
        <span className="font-bold text-sm uppercase tracking-tight pr-4">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0" />
          : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <div className="bg-yellow-50 border-t-2 md:border-t-4 border-bauhaus-ink px-5 py-4">
          <p className="font-medium text-sm text-bauhaus-ink/80 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function NearMeLanding() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      {/* ── HERO ─────────────────────────── */}
      <section className="bg-bauhaus-canvas border-b-4 border-bauhaus-ink overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[75vh]">
            {/* Left */}
            <div className="flex flex-col justify-center px-6 sm:px-8 lg:px-12 py-12 lg:py-20 relative">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-bauhaus-red border-2 border-bauhaus-ink" />
                <div className="w-3 h-3 bg-bauhaus-blue border-2 border-bauhaus-ink" />
                <div className="w-3 h-3 rotate-45 bg-bauhaus-yellow border-2 border-bauhaus-ink" />
                <span className="ml-1 font-bold uppercase text-[10px] tracking-widest text-bauhaus-ink/50">
                  Metro Manila & Beyond
                </span>
              </div>

              <h1 className="font-black text-4xl sm:text-5xl lg:text-7xl uppercase tracking-tighter leading-[0.9] text-bauhaus-ink">
                Finding
                <br />
                <span className="text-bauhaus-red">Reliable  Help</span>
                <br />
                <span className="text-bauhaus-blue">Made Easy</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg font-medium text-bauhaus-ink/60 max-w-md leading-relaxed">
                Hire trusted plumbers, electricians, cleaners, mechanics, and more — right in your area.
              </p>

              {/* Search bar */}
              <div className="mt-7 flex flex-col sm:flex-row gap-0 border-4 border-bauhaus-ink shadow-bauhaus-lg bg-white max-w-lg">
                <div className="flex-1 flex items-center px-4 py-3 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-ink">
                  <Search className="h-4 w-4 text-bauhaus-ink/40 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What service do you need?"
                    className="flex-1 bg-transparent outline-none font-medium text-sm text-bauhaus-ink placeholder:text-bauhaus-ink/30"
                  />
                </div>
                <Link
                  to={`/browse${searchQuery ? `?q=${searchQuery}` : ''}`}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider hover:bg-bauhaus-red/90 transition-colors active:bg-bauhaus-red/80"
                >
                  <MapPin className="h-4 w-4" />
                  Find Now
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {['Plumbing', 'Cleaning', 'Electrical', 'Mechanic'].map((tag) => (
                  <Link
                    key={tag}
                    to={`/browse?q=${tag}`}
                    className="px-3 py-1 bg-white border-2 border-bauhaus-ink text-xs font-bold uppercase tracking-wider hover:bg-bauhaus-yellow transition-colors duration-200 shadow-[2px_2px_0px_0px_#121212]"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right — hero image */}
            <div className="relative bg-bauhaus-blue border-t-4 lg:border-t-0 lg:border-l-4 border-bauhaus-ink overflow-hidden min-h-[340px]">
              <img
                src={HERO_IMG}
                alt="Filipino neighborhood"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <div className="bg-bauhaus-yellow border-4 border-bauhaus-ink shadow-bauhaus-lg inline-block px-5 py-4 max-w-xs">
                  <div className="font-black text-2xl text-bauhaus-ink">10,000+</div>
                  <div className="font-bold text-xs uppercase tracking-widest text-bauhaus-ink/70 mt-0.5">
                    Verified Providers Nationwide
                  </div>
                </div>
              </div>
              {/* decorative */}
              <div className="absolute top-6 right-6 w-20 h-20 rounded-full border-4 border-white/30" />
              <div className="absolute bottom-24 right-10 w-12 h-12 rotate-45 border-4 border-white/20" />
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────── */}
      <section className="bg-bauhaus-yellow border-b-4 border-bauhaus-ink">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-ink">
            {[
              { icon: Shield, label: 'Fully Verified Providers', sub: 'ID & background checked' },
              { icon: Star, label: 'Top Rated Services', sub: 'Average 4.8★ rating' },
              { icon: Clock, label: 'Fast Response', sub: 'Providers near you now' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-4 px-6 sm:px-8 py-6">
                <div className="w-10 h-10 bg-bauhaus-ink border-2 border-bauhaus-ink flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-bauhaus-yellow" />
                </div>
                <div>
                  <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{label}</div>
                  <div className="font-medium text-xs text-bauhaus-ink/60 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POPULAR SERVICES ─────────────── */}
      <section className="bg-bauhaus-canvas border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-red" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">Browse</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9]">
              Popular<br /><span className="text-bauhaus-blue">Services</span>
            </h2>
            <Link to="/browse" className="inline-flex items-center gap-2 font-bold uppercase text-xs tracking-wider text-bauhaus-red hover:underline">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {SERVICES.slice(0, 10).map((svc, i) => (
              <Link
                key={svc.id}
                to={`/browse?service=${svc.id}`}
                className="group flex flex-col items-center gap-3 p-4 bg-white border-2 border-bauhaus-ink shadow-[3px_3px_0px_0px_#121212] hover:-translate-y-1 transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <div className={`w-12 h-12 ${svc.color} border-2 border-bauhaus-ink flex items-center justify-center text-xl`}>
                  {svc.icon}
                </div>
                <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink text-center leading-tight">
                  {svc.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PROVIDERS ───────────── */}
      <section className="bg-white border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-blue" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">Top Rated</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9]">
              Featured<br /><span className="text-bauhaus-red">Providers</span>
            </h2>
            <Link to="/browse" className="inline-flex items-center gap-2 font-bold uppercase text-xs tracking-wider text-bauhaus-blue hover:underline">
              Browse Map <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {MOCK_PROVIDERS.slice(0, 3).map((p) => {
              const colors = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];
              const color = colors[p.id % 3];
              return (
                <Link
                  key={p.id}
                  to={`/provider/${p.id}`}
                  className="group relative bg-bauhaus-canvas border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg hover:-translate-y-1 transition-all duration-200 block"
                >
                  <div className={`absolute top-3 right-3 w-3 h-3 ${color}`} />
                  <div className="flex items-center gap-4 p-5">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-16 h-16 object-cover border-2 border-bauhaus-ink shrink-0 grayscale group-hover:grayscale-0 transition-all duration-300"
                    />
                    <div>
                      <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{p.name}</div>
                      <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-red">{p.service}</div>
                      <StarRating rating={p.rating} size="sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-5 pb-5">
                    <span className="font-medium text-xs text-bauhaus-ink/50">{p.jobs} jobs · {p.location}</span>
                    <span className="font-black text-sm text-bauhaus-ink">₱{p.rate}/hr</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────── */}
      <section id="how-it-works" className="bg-bauhaus-blue border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-white/5 hidden lg:block" />
        <div className="absolute bottom-8 left-8 w-20 h-20 rotate-45 bg-bauhaus-yellow/10 hidden lg:block" />

        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-yellow" />
            <span className="font-bold uppercase text-xs tracking-widest text-white/50">Process</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-white leading-[0.9] mb-12 lg:mb-16">
            How It<br /><span className="text-bauhaus-yellow">Works</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { n: '01', title: 'Search', desc: 'Enter what you need and your location in Metro Manila.', shape: 'circle', color: 'bg-bauhaus-red' },
              { n: '02', title: 'Browse', desc: 'View verified providers on the map with ratings and prices.', shape: 'square', color: 'bg-bauhaus-yellow' },
              { n: '03', title: 'Hire', desc: 'Send a job request or message the provider directly.', shape: 'circle', color: 'bg-bauhaus-red' },
              { n: '04', title: 'Done', desc: 'Provider arrives, job completed, pay securely through the app.', shape: 'square', color: 'bg-bauhaus-yellow' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center relative">
                <div className={`w-16 h-16 ${step.shape === 'circle' ? 'rounded-full' : ''} ${step.color} border-4 border-bauhaus-ink shadow-bauhaus-sm flex items-center justify-center font-black text-lg text-bauhaus-ink`}>
                  {step.n}
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[4px] bg-white/30" />
                )}
                <h3 className="mt-5 font-black text-xl uppercase tracking-tight text-white">{step.title}</h3>
                <p className="mt-2 font-medium text-sm text-white/60 leading-relaxed max-w-[200px]">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-12">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 px-10 py-4 bg-bauhaus-yellow text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-lg transition-all duration-200 hover:bg-bauhaus-yellow/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Find Services Now <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────── */}
      <section className="bg-bauhaus-canvas border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-red" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">Reviews</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9] mb-12">
            What Customers<br /><span className="text-bauhaus-blue">Are Saying</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {TESTIMONIALS.map((t, i) => {
              const accents = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];
              return (
                <div key={i} className="relative bg-white border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg p-6 hover:-translate-y-1 transition-all duration-200">
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${accents[i]}`} />
                  <StarRating rating={t.rating} size="sm" showNumber={false} />
                  <p className="mt-3 font-medium text-sm text-bauhaus-ink/70 leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-3 mt-5 pt-4 border-t-2 border-bauhaus-ink/10">
                    <img src={t.avatar} alt={t.name} className="w-10 h-10 object-cover border-2 border-bauhaus-ink" />
                    <div>
                      <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">{t.name}</div>
                      <div className="font-medium text-[10px] uppercase tracking-widest text-bauhaus-ink/40">{t.location} · {t.service}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────── */}
      <section className="bg-white border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-yellow" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">FAQ</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9] mb-10">
            Frequently Asked<br /><span className="text-bauhaus-red">Questions</span>
          </h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => <FAQItem key={i} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────── */}
      <section className="bg-bauhaus-red border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-white/10 hidden lg:block" />
        <div className="absolute -top-12 -left-12 w-36 h-36 rotate-45 bg-bauhaus-yellow/20 hidden lg:block" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="font-black text-3xl sm:text-5xl lg:text-6xl uppercase tracking-tighter text-white leading-[0.9]">
            Ready to Get<br />Things Done?
          </h2>
          <p className="mt-5 font-medium text-base sm:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            Join thousands of Filipinos who use Near Me to find reliable help in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-bauhaus-red font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-lg transition-all duration-200 hover:bg-bauhaus-canvas active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Find Help Now <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-bauhaus-yellow text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-yellow/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Become a Provider
            </Link>
          </div>
        </div>
      </section>

      <NearMeFooter />
    </div>
  );
}
