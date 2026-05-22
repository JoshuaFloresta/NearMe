import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Home, IdCard, Save, ShieldCheck, Upload } from 'lucide-react';
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

export default function NearMeProviderKyc() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    idType: 'PhilHealth ID',
    idNumber: '',
    address: '',
    documents: [],
  });

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      navigate('/login');
      return;
    }

    if (storedUser.role !== 'provider') {
      navigate('/');
      toast.error('Provider account required');
      return;
    }

    setUser(storedUser);
    setForm((prev) => ({
      ...prev,
      fullName: storedUser.name || '',
    }));
  }, [navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files || []);

    const filePromises = files.slice(0, 4).map((file) => new Promise((resolve) => {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.error('Only image or PDF files are accepted');
        resolve(null);
        return;
      }

      if (file.size > 1024 * 1024) {
        toast.error(`${file.name} is over 1 MB`);
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          dataUrl: reader.result,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }));

    const nextDocuments = (await Promise.all(filePromises)).filter(Boolean);
    setForm((prev) => ({ ...prev, documents: [...prev.documents, ...nextDocuments].slice(0, 4) }));
  };

  const submitKyc = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim() || !form.idType || !form.idNumber.trim() || !form.address.trim()) {
      toast.error('Complete all KYC fields');
      return;
    }

    setSaving(true);

    try {
      await apiRequest('/api/provider-kyc', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          fullName: form.fullName,
          idType: form.idType,
          idNumber: form.idNumber,
          address: form.address,
          documents: form.documents,
        }),
      });

      toast.success('KYC submitted for admin review');
    } catch (error) {
      toast.error(error.message || 'Could not submit KYC');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit">
      <NearMeNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="border-b-4 border-bauhaus-ink pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink">
            <ShieldCheck className="h-3.5 w-3.5" />
            Provider Verification
          </div>
          <h1 className="mt-3 font-black text-2xl sm:text-3xl uppercase tracking-tighter text-bauhaus-ink">KYC Submission</h1>
          <p className="mt-1 font-medium text-sm text-bauhaus-ink/50">Submit your identity details for manual admin review.</p>
        </div>

        <form onSubmit={submitKyc} className="mt-8 bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Legal Full Name</label>
              <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue">
                <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                  <FileText className="h-4 w-4 text-bauhaus-ink/50" />
                </span>
                <input name="fullName" value={form.fullName} onChange={handleChange} className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
              </div>
            </div>

            <div>
              <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">ID Type</label>
              <select name="idType" value={form.idType} onChange={handleChange} className="w-full px-4 py-3 bg-white border-2 border-bauhaus-ink font-bold text-sm outline-none focus:border-bauhaus-blue">
                <option>PhilHealth ID</option>
                <option>Driver's License</option>
                <option>Passport</option>
                <option>UMID</option>
                <option>National ID</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">ID Number</label>
              <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue">
                <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                  <IdCard className="h-4 w-4 text-bauhaus-ink/50" />
                </span>
                <input name="idNumber" value={form.idNumber} onChange={handleChange} className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
              </div>
            </div>

            <div>
              <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Address</label>
              <div className="flex border-2 border-bauhaus-ink focus-within:border-bauhaus-blue">
                <span className="px-3 py-3 bg-bauhaus-canvas border-r-2 border-bauhaus-ink">
                  <Home className="h-4 w-4 text-bauhaus-ink/50" />
                </span>
                <input name="address" value={form.address} onChange={handleChange} className="w-full px-3 py-3 bg-white font-medium text-sm outline-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 block mb-1">Documents</label>
            <label className="flex flex-col items-center justify-center gap-2 min-h-32 border-2 border-dashed border-bauhaus-ink bg-bauhaus-canvas cursor-pointer hover:bg-white transition-colors">
              <Upload className="h-6 w-6 text-bauhaus-ink/50" />
              <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/60">Upload ID, certificate, or proof of address</span>
              <input type="file" multiple accept="image/*,application/pdf" onChange={handleDocumentUpload} className="sr-only" />
            </label>
            {form.documents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.documents.map((doc) => (
                  <span key={doc.name} className="px-3 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-bold text-[10px] uppercase tracking-wider">
                    {doc.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Submitting...' : 'Submit KYC'}
            </button>
          </div>
        </form>
      </main>

      <NearMeFooter />
      <Toaster position="top-center" />
    </div>
  );
}
