import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, MapPin, Bell, User, Settings, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navLinks = [
  { label: 'Find Services', href: '/browse' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'About', href: '/about' },
];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('nearme_user'));
  } catch {
    return null;
  }
};

export default function NearMeNav({ user: userProp, onLogout }) {
  const [open, setOpen] = useState(false);
  const [storedUser, setStoredUser] = useState(() => userProp || getStoredUser());
  const location = useLocation();
  const navigate = useNavigate();
  const user = userProp || storedUser;

  useEffect(() => {
    const syncUser = () => setStoredUser(getStoredUser());

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('nearme:user-updated', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('nearme:user-updated', syncUser);
    };
  }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem('nearme_user');
    setStoredUser(null);
    setOpen(false);
    onLogout?.();
    window.dispatchEvent(new Event('nearme:user-updated'));
    navigate('/');
  };

  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                      <span className="w-7 h-7 border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center overflow-hidden">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name || 'Profile'} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-black text-[10px] text-bauhaus-ink">{initials}</span>
                        )}
                      </span>
                      <span className="font-bold text-xs uppercase tracking-wider max-w-28 truncate">{user.name || 'Profile'}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-2 border-bauhaus-ink bg-white p-1 shadow-bauhaus-sm rounded-none">
                    <DropdownMenuLabel className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">
                      {user.name || 'My Account'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-bauhaus-ink/20" />
                    <DropdownMenuItem asChild className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider focus:bg-bauhaus-canvas">
                      <Link to="/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {user.role === 'provider' && (
                      <DropdownMenuItem asChild className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider focus:bg-bauhaus-canvas">
                        <Link to="/provider-kyc" className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          Provider KYC
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-none font-bold text-xs uppercase tracking-wider text-bauhaus-red focus:bg-bauhaus-canvas focus:text-bauhaus-red">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
          {user ? (
            <div className="p-4 space-y-3">
              <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              {user.role === 'provider' && (
                <Link to="/provider-kyc" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                  <ShieldCheck className="h-4 w-4" />
                  Provider KYC
                </Link>
              )}
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-3 p-4">
              <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas transition-colors">
                Log In
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
