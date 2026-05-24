import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';

const SUBJECTS = ['Math', 'Science', 'English', 'Filipino', 'Programming', 'Other'];
const GRADE_LEVELS = ['Elementary', 'Junior High', 'Senior High', 'College', 'Adult'];
const PROPERTY_CONDITIONS = ['Light', 'Moderate', 'Heavy'];

const todayDateString = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeCategory = (value = '') => String(value).toLowerCase().trim();

export default function BookServiceModal({
  open,
  onClose,
  fixedServices,
  customBundles,
  affiliatedCategories,
  providerName,
  onSubmit,
}) {
  const [step, setStep] = useState('select');
  const [selectedService, setSelectedService] = useState(null);
  const [form, setForm] = useState({
    category: '',
    bookingDate: '',
    bookingTime: '',
    address: '',
    notes: '',
    subject: '',
    gradeLevel: '',
    studentCount: '',
    roomCount: '',
    propertyCondition: '',
  });
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const minDate = todayDateString();
  const normalizedCategory = normalizeCategory(form.category || selectedService?.category || '');

  const errors = useMemo(() => {
    const e = {};
    if (!form.category) e.category = 'Please select a category.';
    if (!form.bookingDate) e.bookingDate = 'Booking date is required.';
    if (!form.bookingTime) e.bookingTime = 'Booking time is required.';
    if (!form.address.trim()) e.address = 'Address is required.';

    if (form.bookingDate) {
      const selected = new Date(`${form.bookingDate}T00:00:00`);
      const today = new Date(`${todayDateString()}T00:00:00`);
      if (selected < today) e.bookingDate = 'Booking date cannot be in the past.';
    }

    if (form.bookingDate && form.bookingTime) {
      const target = new Date(`${form.bookingDate}T${form.bookingTime}:00`);
      const nowPlus2h = new Date(Date.now() + 2 * 60 * 60 * 1000);
      if (form.bookingDate === todayDateString() && target <= nowPlus2h) {
        e.bookingTime = `Please select a time later than ${nowPlus2h.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      }
    }

    if (normalizedCategory === 'tutoring') {
      if (!form.subject) e.subject = 'Subject is required.';
      if (!form.gradeLevel) e.gradeLevel = 'Grade level is required.';
      if (!toPositiveInt(form.studentCount)) e.studentCount = 'Student count must be a positive integer.';
    }

    if (normalizedCategory === 'cleaning') {
      if (!toPositiveInt(form.roomCount)) e.roomCount = 'Room count must be a positive integer.';
      if (!form.propertyCondition) e.propertyCondition = 'Property condition is required.';
    }

    return e;
  }, [form, normalizedCategory]);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const chooseService = (service, type) => {
    setSelectedService({ ...service, type, category: service.category || service.id || service.serviceId || '' });
    setForm((current) => ({ ...current, category: service.category || service.id || service.serviceId || '' }));
    setStep('form');
  };

  const chooseNoMatch = () => {
    setSelectedService({ type: 'custom', title: 'Custom Request', category: affiliatedCategories[0]?.value || '' });
    setForm((current) => ({ ...current, category: affiliatedCategories[0]?.value || '' }));
    setStep('form');
  };

  const handleSubmit = async () => {
    setTouched({
      category: true,
      bookingDate: true,
      bookingTime: true,
      address: true,
      subject: true,
      gradeLevel: true,
      studentCount: true,
      roomCount: true,
      propertyCondition: true,
    });
    if (Object.keys(errors).length > 0) return;

    const dynamicFields = {};
    if (normalizedCategory === 'tutoring') {
      dynamicFields.subject = form.subject;
      dynamicFields.gradeLevel = form.gradeLevel;
      dynamicFields.studentCount = Number(form.studentCount);
    }
    if (normalizedCategory === 'cleaning') {
      dynamicFields.roomCount = Number(form.roomCount);
      dynamicFields.propertyCondition = form.propertyCondition;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        serviceCategory: form.category,
        bookingDate: form.bookingDate,
        bookingTime: form.bookingTime,
        address: form.address.trim(),
        notes: form.notes.trim(),
        serviceSelection: selectedService,
        dynamicFields,
      });
      onClose();
      setStep('select');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-bauhaus-ink/70 flex items-center justify-center px-4">
      <div className="bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg w-full max-w-3xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 border-2 border-bauhaus-ink bg-white text-bauhaus-ink hover:bg-bauhaus-canvas"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-black text-xl uppercase tracking-tighter text-bauhaus-ink">Book Service</h2>
        <p className="font-medium text-sm text-bauhaus-ink/55 mt-1">Create a structured request for {providerName}.</p>
        {step === 'select' && (
          <p className="mt-2 font-medium text-xs text-bauhaus-ink/65">
            not seeing what you need?{' '}
            <button
              type="button"
              onClick={chooseNoMatch}
              className="font-semibold text-bauhaus-red underline underline-offset-2 hover:text-bauhaus-ink"
            >
              Click here
            </button>
          </p>
        )}

        {step === 'select' && (
          <div className="mt-5 space-y-4">
            <div className="border-2 border-bauhaus-ink p-4">
              <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Fixed Rate Services</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {fixedServices.map((service) => (
                  <button key={service.id || service.label} type="button" onClick={() => chooseService(service, 'fixed')} className="w-full text-left border-2 border-bauhaus-ink bg-white p-3 hover:bg-bauhaus-canvas transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex px-2 py-0.5 bg-bauhaus-yellow border border-bauhaus-ink font-black text-[9px] uppercase tracking-wider text-bauhaus-ink">Fixed</div>
                        <div className="mt-1 font-black text-xs uppercase text-bauhaus-ink">{service.label || service.name}</div>
                        <div className="font-medium text-[11px] text-bauhaus-ink/60">{service.description || '1-hour standard service'}</div>
                      </div>
                      <div className="font-black text-sm text-bauhaus-red">PHP {Number(service.price || service.hourly_rate || 0).toLocaleString('en-PH')}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-2 border-bauhaus-ink p-4">
              <div className="font-black text-xs uppercase tracking-wider text-bauhaus-ink">Custom Bundles / Plans</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {customBundles.map((bundle) => (
                  <button key={bundle._id || bundle.title} type="button" onClick={() => chooseService({ ...bundle, category: bundle.serviceId }, 'bundle')} className="w-full text-left border-2 border-bauhaus-ink bg-white p-3 hover:bg-bauhaus-canvas transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex px-2 py-0.5 bg-bauhaus-blue border border-bauhaus-ink font-black text-[9px] uppercase tracking-wider text-white">Bundle</div>
                        <div className="mt-1 font-black text-xs uppercase text-bauhaus-ink">{bundle.title}</div>
                        <div className="font-medium text-[11px] text-bauhaus-ink/60">{bundle.description || 'Custom bundle plan'}</div>
                      </div>
                      <div className="font-black text-sm text-bauhaus-red">PHP {Number(bundle.priceFixed || 0).toLocaleString('en-PH')}</div>
                    </div>
                  </button>
                ))}
                {customBundles.length === 0 && (
                  <div className="border-2 border-dashed border-bauhaus-ink bg-white p-3 text-center font-bold text-xs text-bauhaus-ink/50">
                    No bundle plans available.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {step === 'form' && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Category</span>
              <select value={form.category} onChange={(e) => setField('category', e.target.value)} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none">
                {affiliatedCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              {touched.category && errors.category && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.category}</div>}
            </label>

            <label className="block">
              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Booking Date</span>
              <input type="date" min={minDate} value={form.bookingDate} onChange={(e) => setField('bookingDate', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, bookingDate: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
              {touched.bookingDate && errors.bookingDate && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.bookingDate}</div>}
            </label>
            <label className="block">
              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Booking Time</span>
              <input type="time" value={form.bookingTime} onChange={(e) => setField('bookingTime', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, bookingTime: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
              {touched.bookingTime && errors.bookingTime && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.bookingTime}</div>}
            </label>

            {normalizedCategory === 'tutoring' && (
              <>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Subject</span>
                  <select value={form.subject} onChange={(e) => setField('subject', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, subject: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none">
                    <option value="">Select Subject</option>
                    {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                  {touched.subject && errors.subject && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.subject}</div>}
                </label>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Grade Level</span>
                  <select value={form.gradeLevel} onChange={(e) => setField('gradeLevel', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, gradeLevel: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none">
                    <option value="">Select Grade Level</option>
                    {GRADE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  {touched.gradeLevel && errors.gradeLevel && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.gradeLevel}</div>}
                </label>
                <label className="block sm:col-span-2">
                  <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Student Count</span>
                  <input type="number" min="1" value={form.studentCount} onChange={(e) => setField('studentCount', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, studentCount: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                  {touched.studentCount && errors.studentCount && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.studentCount}</div>}
                </label>
              </>
            )}

            {normalizedCategory === 'cleaning' && (
              <>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Room Count</span>
                  <input type="number" min="1" value={form.roomCount} onChange={(e) => setField('roomCount', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, roomCount: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
                  {touched.roomCount && errors.roomCount && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.roomCount}</div>}
                </label>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Property Condition</span>
                  <select value={form.propertyCondition} onChange={(e) => setField('propertyCondition', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, propertyCondition: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none">
                    <option value="">Select Condition</option>
                    {PROPERTY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
                  </select>
                  {touched.propertyCondition && errors.propertyCondition && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.propertyCondition}</div>}
                </label>
              </>
            )}

            <label className="block sm:col-span-2">
              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Service Address</span>
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} onBlur={() => setTouched((current) => ({ ...current, address: true }))} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-bold text-sm outline-none" />
              {touched.address && errors.address && <div className="mt-1 text-xs font-bold text-bauhaus-red">{errors.address}</div>}
            </label>
            <label className="block sm:col-span-2">
              <span className="font-black text-[10px] uppercase tracking-wider text-bauhaus-ink/55">Notes</span>
              <textarea rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} className="mt-1 w-full px-3 py-3 border-2 border-bauhaus-ink bg-white font-medium text-sm outline-none resize-none" />
            </label>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {step !== 'select' && (
            <button type="button" onClick={() => setStep('select')} className="flex-1 px-4 py-3 bg-white text-bauhaus-ink font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink hover:bg-bauhaus-canvas">
              Back
            </button>
          )}
          {step === 'form' && (
            <button type="button" onClick={handleSubmit} disabled={Object.keys(errors).length > 0 || submitting} className="flex-1 px-4 py-3 bg-bauhaus-red text-white font-bold uppercase text-xs tracking-wider border-2 border-bauhaus-ink shadow-bauhaus-sm disabled:opacity-60">
              {submitting ? 'Sending...' : 'Send Inquiry'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
