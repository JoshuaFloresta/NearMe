import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FileText, Home, IdCard, ImagePlus, Save, ShieldCheck, Upload, X } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import NearMeNav from '../components/nearme/NearMeNav';
import NearMeFooter from '../components/nearme/NearMeFooter';
import { apiRequest } from '../lib/api';
import {
  PROVIDER_REVIEW_PATH,
  getStoredNearMeUser,
  mergeStoredNearMeUser,
} from '../lib/providerAccess';

const documentSlots = [
  { key: 'frontId', label: 'Front ID', hint: 'Clear photo of the front side' },
  { key: 'backId', label: 'Back ID', hint: 'Clear photo of the back side' },
  { key: 'selfie', label: 'Selfie', hint: 'Face camera with your ID visible' },
];
const MAX_KYC_IMAGE_BYTES = 900 * 1024;
const MAX_KYC_IMAGE_DATA_URL_LENGTH = 1_250_000;

export default function NearMeProviderKyc() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [user, setUser] = useState(() => getStoredNearMeUser());
  const [saving, setSaving] = useState(false);
  const [cameraSlot, setCameraSlot] = useState('');
  const [stream, setStream] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    idType: 'PhilHealth ID',
    idNumber: '',
    address: '',
    documents: {
      frontId: null,
      backId: null,
      selfie: null,
    },
  });

  useEffect(() => {
    const storedUser = getStoredNearMeUser();

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => () => {
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const setDocument = (slot, document) => {
    setForm((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [slot]: document,
      },
    }));
  };

  const handleDocumentUpload = (slot, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are accepted');
      return;
    }

    if (file.size > MAX_KYC_IMAGE_BYTES) {
      toast.error(`${file.name} is over 900 KB. Smaller photos keep verification uploads reliable.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDocument(slot, {
        slot,
        label: documentSlots.find((item) => item.key === slot)?.label || slot,
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
        source: 'upload',
      });
    };
    reader.onerror = () => toast.error('Could not read image');
    reader.readAsDataURL(file);
  };

  const openCamera = async (slot) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera is not supported by this browser');
      return;
    }

    try {
      stream?.getTracks().forEach((track) => track.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: slot === 'selfie' ? 'user' : 'environment' },
        audio: false,
      });

      setCameraSlot(slot);
      setStream(mediaStream);
    } catch {
      toast.error('Camera access was blocked or unavailable');
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraSlot('');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !cameraSlot) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    const slotConfig = documentSlots.find((item) => item.key === cameraSlot);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (dataUrl.length > MAX_KYC_IMAGE_DATA_URL_LENGTH) {
      toast.error('Captured photo is too large. Please try again with a simpler background or upload a smaller photo.');
      return;
    }

    setDocument(cameraSlot, {
      slot: cameraSlot,
      label: slotConfig?.label || cameraSlot,
      name: `${cameraSlot}-${Date.now()}.jpg`,
      type: 'image/jpeg',
      dataUrl,
      source: 'camera',
      capturedAt: new Date().toISOString(),
    });

    closeCamera();
  };

  const documentsForSubmission = () => documentSlots.map((slot) => form.documents[slot.key]).filter(Boolean);
  const hasAllDocuments = documentSlots.every((slot) => form.documents[slot.key]?.dataUrl);

  const submitKyc = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim() || !form.idType || !form.idNumber.trim() || !form.address.trim()) {
      toast.error('Complete all KYC fields');
      return;
    }

    if (!hasAllDocuments) {
      toast.error('Upload or capture Front ID, Back ID, and Selfie');
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest('/api/provider-kyc', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          fullName: form.fullName,
          idType: form.idType,
          idNumber: form.idNumber,
          address: form.address,
          documents: documentsForSubmission(),
        }),
      });

      const nextUser = mergeStoredNearMeUser({
        providerStatus: response.user?.providerStatus || 'kyc_submitted',
        kycSubmittedAt: response.user?.kycSubmittedAt || new Date().toISOString(),
      });
      setUser(nextUser);
      toast.success('KYC submitted. Your application is now under review.');
      navigate(PROVIDER_REVIEW_PATH);
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="border-b-4 border-bauhaus-ink pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-bauhaus-yellow border-2 border-bauhaus-ink font-bold text-[10px] uppercase tracking-wider text-bauhaus-ink">
            <ShieldCheck className="h-3.5 w-3.5" />
            Provider Verification
          </div>
          <h1 className="mt-3 font-black text-2xl sm:text-3xl uppercase tracking-tighter text-bauhaus-ink">KYC Submission</h1>
          <p className="mt-1 font-medium text-sm text-bauhaus-ink/50">Submit your identity details and required verification photos for admin review.</p>
        </div>

        <form onSubmit={submitKyc} className="mt-8 bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-6 sm:p-8 space-y-6">
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
            <div className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/60 mb-2">Required Verification Photos</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentSlots.map((slot) => {
                const document = form.documents[slot.key];
                return (
                  <div key={slot.key} className="border-2 border-bauhaus-ink bg-bauhaus-canvas p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{slot.label}</div>
                        <div className="font-medium text-xs text-bauhaus-ink/50">{slot.hint}</div>
                      </div>
                      {document && (
                        <button type="button" onClick={() => setDocument(slot.key, null)} className="p-1 bg-bauhaus-red text-white border-2 border-bauhaus-ink">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 aspect-[4/3] border-2 border-bauhaus-ink bg-white flex items-center justify-center overflow-hidden">
                      {document?.dataUrl ? (
                        <img src={document.dataUrl} alt={slot.label} className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-9 w-9 text-bauhaus-ink/25" />
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider cursor-pointer hover:bg-bauhaus-yellow">
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                        <input type="file" accept="image/*" onChange={(e) => handleDocumentUpload(slot.key, e)} className="sr-only" />
                      </label>
                      <button type="button" onClick={() => openCamera(slot.key)} className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-bauhaus-blue text-white border-2 border-bauhaus-ink font-black text-[10px] uppercase tracking-wider">
                        <Camera className="h-3.5 w-3.5" />
                        Camera
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 px-6 py-4 bg-bauhaus-red text-white font-bold uppercase text-sm tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Submitting...' : 'Submit KYC'}
            </button>
          </div>
        </form>
      </main>

      {cameraSlot && (
        <div className="fixed inset-0 z-[80] bg-bauhaus-ink/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-4 border-bauhaus-ink bg-bauhaus-canvas">
              <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">
                Capture {documentSlots.find((slot) => slot.key === cameraSlot)?.label}
              </div>
              <button type="button" onClick={closeCamera} className="p-2 bg-bauhaus-red text-white border-2 border-bauhaus-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video bg-bauhaus-ink border-2 border-bauhaus-ink object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={closeCamera} className="px-4 py-3 bg-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">Cancel</button>
                <button type="button" onClick={capturePhoto} className="inline-flex items-center gap-2 px-5 py-3 bg-bauhaus-red text-white border-2 border-bauhaus-ink font-black text-xs uppercase tracking-wider">
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NearMeFooter />
      <Toaster position="top-center" />
    </div>
  );
}
