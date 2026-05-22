import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Save, User, Mail, Phone, ChevronLeft } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest } from '../lib/api';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('nearme_user'));
  } catch {
    return null;
  }
};

export default function NearMeSettings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fname: '',
    lname: '',
    email: '',
    phone: '',
    avatar: '',
  });

  useEffect(() => {
    const user = getStoredUser();

    if (!user) {
      navigate('/login');
      return;
    }

    setCurrentUser(user);
    setForm({
      fname: user.fname || user.name?.split(' ')[0] || '',
      lname: user.lname || user.name?.split(' ').slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
    });
  }, [navigate]);

  const displayName = useMemo(
    () => [form.fname, form.lname].filter(Boolean).join(' ').trim() || currentUser?.name || 'My Profile',
    [currentUser?.name, form.fname, form.lname]
  );

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error('Please choose an image under 1 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    if (!form.fname.trim() || !form.lname.trim()) {
      toast.error('First name and last name are required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Enter a valid email address');
      return false;
    }

    if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) {
      toast.error('Phone number must be 10 digits');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    const payload = {
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      name: [form.fname, form.lname].filter(Boolean).join(' ').trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      avatar: form.avatar,
    };

    try {
      let updatedUser = {
        ...currentUser,
        ...payload,
      };

      if (currentUser?.id) {
        const response = await apiRequest(`/api/auth/users/${currentUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        updatedUser = response.user;
      }

      localStorage.setItem('nearme_user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      window.dispatchEvent(new Event('nearme:user-updated'));
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-ink/50 hover:text-bauhaus-red transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back Home
        </Link>

        <div className="mt-5 border-b-4 border-bauhaus-ink pb-4">
          <h1 className="font-black text-2xl sm:text-3xl uppercase tracking-tighter text-bauhaus-ink">Settings</h1>
          <p className="mt-1 font-medium text-sm text-bauhaus-ink/50">Manage your account details and profile image.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <section className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6 h-fit">
            <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-4">Profile Image</div>
            <div className="flex flex-col items-center text-center">
              <div className="w-36 h-36 border-4 border-bauhaus-ink bg-bauhaus-yellow overflow-hidden flex items-center justify-center">
                {form.avatar ? (
                  <img src={form.avatar} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-black text-4xl text-bauhaus-ink">{initials || 'U'}</span>
                )}
              </div>
              <label className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-bauhaus-ink font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-[2px_2px_0px_0px_black] cursor-pointer hover:bg-bauhaus-canvas transition-colors">
                <Camera className="h-4 w-4" />
                Change Image
                <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
              </label>
            </div>
          </section>

          <section className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6 sm:p-8">
            <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink mb-5">Account Info</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">First Name</label>
                <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue transition-colors">
                  <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                    <User className="h-4 w-4 text-bauhaus-ink/50" />
                  </span>
                  <input name="fname" value={form.fname} onChange={handleChange} className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Last Name</label>
                <input name="lname" value={form.lname} onChange={handleChange} className="w-full px-4 py-3 bg-white border-2 border-bauhaus-ink font-medium text-sm outline-none focus:border-bauhaus-blue transition-colors" />
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Email Address</label>
                <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue transition-colors">
                  <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                    <Mail className="h-4 w-4 text-bauhaus-ink/50" />
                  </span>
                  <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Phone Number</label>
                <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue transition-colors">
                  <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                    <Phone className="h-4 w-4 text-bauhaus-ink/50" />
                  </span>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="9XX XXX XXXX" className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm transition-all duration-200 hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </section>
        </form>
      </main>

      <NearMeFooter />
      <Toaster position="top-center" />
    </div>
  );
}
