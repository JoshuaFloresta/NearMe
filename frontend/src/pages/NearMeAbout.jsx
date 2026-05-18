import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Target, Eye, Heart, Users, MapPin, ShieldCheck, Star, CheckCircle } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';

const TEAM = [
  { name: 'Joshua Floresta', role: 'Project Manager', avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYAHveTyLBNxVUmK39QVULDHNvh68UNKU7oA&s', bio: 'Strongest Ayasib in the town.' },
  { name: 'Dane Maquio', role: 'Back-End Developer', avatar: 'data:image/jpeg;base64,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', bio: 'lorem ipsum dolor sit amet consectetur adipiscing elit. ' },
  { name: 'Dwayne Abrasaldo', role: ' UI/UX Designer', avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9gLPphT-nRoobZzrCJbk7-5SPGmPvvL_nug&s', bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { name: 'Yeshua Silva', role: 'Front-End Developer', avatar: 'https://preview.redd.it/whats-the-origin-of-this-cat-image-and-what-does-it-mean-v0-k5v48axtppqc1.jpeg?auto=webp&s=a955611a714e73cdbb55f68b0211b07e80e75bc7', bio: 'hilippines. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' },
  { name: 'Kyle Andrew Ombao', role: 'Quality Assurance Lead', avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHwIqmz6FA40L36_7I0JjiWMh-5BJrmyIpoA&s', bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },

];

const WHY = [
  { icon: ShieldCheck, title: 'Verified Providers', desc: 'Every provider undergoes ID check, background verification, and skills assessment before joining.', color: 'bg-bauhaus-red' },
  { icon: Star, title: 'Trusted Reviews', desc: 'Real reviews from real customers. Our rating system ensures accountability and quality.', color: 'bg-bauhaus-blue' },
  { icon: MapPin, title: 'Truly Local', desc: 'Built for Filipinos. We know Metro Manila\'s barangays, traffic, and local service needs.', color: 'bg-bauhaus-yellow' },
  { icon: Heart, title: 'Fair for Workers', desc: 'Service providers keep 85% of every booking. We believe in fair, dignified work.', color: 'bg-bauhaus-red' },
];

export default function NearMeAbout() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      {/* Hero */}
      <section className="bg-bauhaus-blue border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-6 right-6 w-32 h-32 rounded-full bg-white/5 hidden lg:block" />
        <div className="absolute bottom-6 left-6 w-20 h-20 rotate-45 bg-bauhaus-yellow/10 hidden lg:block" />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-1 bg-bauhaus-yellow" />
            <span className="font-bold uppercase text-xs tracking-widest text-white/50">About Us</span>
          </div>
          <h1 className="font-black text-4xl sm:text-6xl lg:text-7xl uppercase tracking-tighter text-white leading-[0.9]">
            Connecting<br /><span className="text-bauhaus-yellow">Communities</span>
          </h1>
          <p className="mt-6 font-medium text-base sm:text-xl text-white/70 max-w-2xl leading-relaxed">
            Near Me is the Philippines' most trusted local service marketplace — built to empower everyday Filipinos to find quality help and earn a dignified living.
          </p>
          <Link
            to="/browse"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-bauhaus-yellow text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-lg transition-all duration-200 hover:bg-bauhaus-yellow/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Find Services <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-bauhaus-canvas border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-bauhaus-red border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg p-6 md:p-8 relative">
              <div className="absolute top-3 right-3 w-3 h-3 bg-bauhaus-yellow" />
              <div className="w-10 h-10 bg-white border-2 border-bauhaus-ink flex items-center justify-center mb-4">
                <Target className="h-5 w-5 text-bauhaus-red" />
              </div>
              <h3 className="font-black text-2xl uppercase tracking-tighter text-white mb-3">Our Mission</h3>
              <p className="font-medium text-sm text-white/80 leading-relaxed">
              To empower every Filipino household with easy access to reliable local services, while creating dignified economic opportunities for service providers across the nation.
              </p>
            </div>
            <div className="bg-bauhaus-ink border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg p-6 md:p-8 relative">
              <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-bauhaus-blue" />
              <div className="w-10 h-10 bg-bauhaus-yellow border-2 border-bauhaus-ink flex items-center justify-center mb-4">
                <Eye className="h-5 w-5 text-bauhaus-ink" />
              </div>
              <h3 className="font-black text-2xl uppercase tracking-tighter text-white mb-3">Our Vision</h3>
              <p className="font-medium text-sm text-white/70 leading-relaxed">
              To become the Philippines' most trusted digital ecosystem for local labor, fostering a community where every Filipino skill is valued and every household need is met with a single click, powered by smart technology and community trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-bauhaus-yellow border-b-4 border-bauhaus-ink">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x divide-bauhaus-ink">
            {[
              { value: '12,000+', label: 'Happy Customers' },
              { value: '3,200+', label: 'Verified Providers' },
              { value: '50,000+', label: 'Jobs Completed' },
              { value: '78 Cities', label: 'Nationwide' },
            ].map((s, i) => (
              <div key={i} className="px-6 py-10 text-center">
                <div className="font-black text-3xl lg:text-4xl uppercase tracking-tighter text-bauhaus-ink">{s.value}</div>
                <div className="font-bold text-xs uppercase tracking-widest text-bauhaus-ink/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="bg-white border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-blue" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">Why Us</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9] mb-12">
            Why Choose<br /><span className="text-bauhaus-red">Near Me?</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY.map((w, i) => (
              <div key={i} className="relative bg-bauhaus-canvas border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm hover:-translate-y-1 transition-all duration-200 p-6">
                <div className={`absolute top-3 right-3 w-3 h-3 ${['bg-bauhaus-blue', 'bg-bauhaus-yellow', 'bg-bauhaus-red', 'bg-bauhaus-blue'][i]}`} />
                <div className={`w-10 h-10 ${w.color} border-2 border-bauhaus-ink flex items-center justify-center mb-4`}>
                  <w.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-2">{w.title}</h3>
                <p className="font-medium text-sm text-bauhaus-ink/60 leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-bauhaus-canvas border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-red" />
            <span className="font-bold uppercase text-xs tracking-widest text-bauhaus-ink/50">People</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9] mb-12">
            Meet the<br /><span className="text-bauhaus-blue">Team</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 lg:gap-8">
            {TEAM.map((member, i) => {
              const colors = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];
              return (
                <div key={i} className="relative bg-white border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg hover:-translate-y-1 transition-all duration-200 p-6 text-center">
                  <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${colors[i]}`} />
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-20 h-20 object-cover border-4 border-bauhaus-ink mx-auto mb-4"
                  />
                  <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{member.name}</div>
                  <div className={`font-bold text-xs uppercase tracking-wider mt-1 ${['text-bauhaus-red', 'text-bauhaus-blue', 'text-bauhaus-yellow','text-bauhaus-red', 'text-bauhaus-blue'][i]}`}>{member.role}</div>
                  <p className="mt-3 font-medium text-xs text-bauhaus-ink/60 leading-relaxed">{member.bio}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Community Impact */}
      <section className="bg-bauhaus-red border-b-4 border-bauhaus-ink py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-8 right-8 w-40 h-40 rounded-full bg-white/5 hidden lg:block" />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-1 bg-bauhaus-yellow" />
            <span className="font-bold uppercase text-xs tracking-widest text-white/50">Impact</span>
          </div>
          <h2 className="font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter text-white leading-[0.9] mb-6">
            Community<br /><span className="text-bauhaus-yellow">Impact</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              'Over ₱120 million in earnings distributed to local service workers since 2024.',
              'Partnered with TESDA for skills verification of trade workers.',
              'Supporting micro-entrepreneurs in underserved communities across 78 cities.',
              '98.4% of providers report higher income compared to traditional job-finding methods.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 border-2 border-white/20 p-4">
                <CheckCircle className="h-5 w-5 text-bauhaus-yellow shrink-0 mt-0.5" />
                <span className="font-medium text-sm text-white/90 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-bauhaus-yellow border-b-4 border-bauhaus-ink py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-black text-3xl sm:text-4xl uppercase tracking-tighter text-bauhaus-ink leading-[0.9]">
            Ready to Join<br />Near Me?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-bauhaus-ink text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-lg transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              Get Started <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/browse" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-bauhaus-ink font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              Browse Services
            </Link>
          </div>
        </div>
      </section>
      <NearMeFooter />
    </div>
  );
}