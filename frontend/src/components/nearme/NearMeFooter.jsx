import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Facebook, Twitter, Instagram } from 'lucide-react';

export default function NearMeFooter() {
  return (
    <footer className="bg-bauhaus-ink text-white border-t-4 border-bauhaus-ink py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-bauhaus-red border-2 border-white/30 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
              <span className="font-black text-xl uppercase tracking-tighter">Near Me</span>
            </div>
            <p className="font-bold text-xs uppercase tracking-widest text-bauhaus-yellow mb-4">Reliable Help, Made Easy</p>
            <p className="font-medium text-sm text-white/50 leading-relaxed">
              Connecting Filipinos with trusted local service providers across Metro Manila and beyond.
            </p>
            <div className="flex gap-3 mt-5">
              {[Facebook, Twitter, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 border-2 border-white/20 flex items-center justify-center hover:border-bauhaus-yellow hover:text-bauhaus-yellow transition-colors duration-200">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-4">Services</h4>
            <ul className="space-y-2">
              {['Plumbing', 'Electrical', 'House Cleaning', 'Mechanic', 'Carpentry', 'Delivery'].map((s) => (
                <li key={s}>
                  <Link to="/browse" className="font-medium text-sm text-white/50 hover:text-bauhaus-yellow transition-colors">{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2">
              {[
                { label: 'About Us', to: '/about' },
                { label: 'How It Works', to: '/#how-it-works' },
                { label: 'Become a Provider', to: '/signup' },
                { label: 'Login', to: '/login' },
                { label: 'Admin Portal', to: '/admin' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="font-medium text-sm text-white/50 hover:text-bauhaus-yellow transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-bauhaus-red mt-0.5 shrink-0" />
                <span className="font-medium text-sm text-white/50">BLDG A, Room 402, Fairview Regalado, Quezon City, Metro Manila 1121</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-bauhaus-red shrink-0" />
                <span className="font-medium text-sm text-white/50">+63 2 8888-NEAR (6327)</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-bauhaus-red shrink-0" />
                <span className="font-medium text-sm text-white/50">hello@nearme.ph</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t-2 border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-medium text-xs text-white/30 uppercase tracking-wider">© 2026 Near Me Philippines. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="font-medium text-xs text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">Privacy</a>
            <a href="#" className="font-medium text-xs text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}