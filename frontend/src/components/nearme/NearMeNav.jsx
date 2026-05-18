import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MapPin, Bell, User } from 'lucide-react';

const navLinks = [
  { label: 'Find Services', href: '/browse' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About', href: '/about' },
];

export default function NearMeNav({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="bg-white border-b-4 border-bauhaus-ink sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-bauhaus-red border-2 border-bauhaus-ink flex items-center justify-center shadow-bauhaus-sm transition-all duration-200 group-hover:-translate-y-0.5">
              <MapPin className="h-4 w-4 text-white" strokeWidth={3} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-lg uppercase tracking-tighter text-bauhaus-ink">Near Me</span>
              <span className="font-bold text-[9px] uppercase tracking-widest text-bauhaus-red">Reliable Help, Made Easy</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-4 py-2 font-bold uppercase text-xs tracking-wider transition-colors duration-200 ${
                  location.pathname === link.href ? 'text-bauhaus-red' : 'text-bauhaus-ink hover:text-bauhaus-red'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button className="p-2 border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-bauhaus-red rounded-full text-white text-[9px] font-black flex items-center justify-center">3</span>
                </button>
                <Link to="/profile" className="flex items-center gap-2 px-4 py-2 border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                  <User className="h-4 w-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">{user.name}</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-all duration-200 active:translate-x-[1px] active:translate-y-[1px]">
                  Log In
                </Link>
                <Link to="/signup" className="px-5 py-2 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 border-2 border-bauhaus-ink shadow-bauhaus-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t-4 border-bauhaus-ink bg-white">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-4 font-bold uppercase text-sm tracking-wider text-bauhaus-ink border-b-2 border-bauhaus-ink hover:bg-bauhaus-yellow/20 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3 p-4">
            <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
              Log In
            </Link>
            <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm">
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}