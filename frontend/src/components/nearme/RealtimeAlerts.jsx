import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { getStoredNearMeUser } from '@/lib/providerAccess';

export default function RealtimeAlerts() {
  useEffect(() => {
    const socket = getSocket();
    const currentUser = getStoredNearMeUser();
    const currentUserId = String(currentUser?.id || currentUser?._id || '');
    const currentRole = String(currentUser?.role || '').toLowerCase();
    const isAdmin = currentRole === 'admin';
    const isParticipant = (payload = {}) => {
      const providerUserId = String(payload?.providerUserId || '');
      const clientUserId = String(payload?.clientUserId || '');
      return providerUserId === currentUserId || clientUserId === currentUserId;
    };

    const handlers = {
      'booking:created': () => toast.info('New booking request created'),
      'booking:status-updated': (booking) => toast.info(`Booking status: ${booking.status}`),
      'message:new': (message) => {
        const senderId = String(message?.senderId || '');
        if (senderId && senderId !== currentUserId) toast.info('New message received');
      },
      'kyc:submitted': () => { if (isAdmin) toast.info('Provider KYC submitted'); },
      'kyc:reviewed': (kyc) => toast.info(`KYC ${kyc.status}`),
      'job:created': (job) => { if (isParticipant(job) || isAdmin) toast.info('New job inquiry created'); },
      'job:accepted': (job) => { if (isParticipant(job) || isAdmin) toast.info('Job has been accepted'); },
      'job:started': (job) => { if (isParticipant(job) || isAdmin) toast.info('Job is now in progress'); },
      'job:pending-payment': (job) => { if (isParticipant(job) || isAdmin) toast.info('Job is now pending payment'); },
      'job:payment-verification-pending': (job) => { if (isAdmin || String(job?.providerUserId || '') === currentUserId) toast.info('Payment proof uploaded. Waiting for admin verification'); },
      'job:verification-rejected': (job) => { if (isParticipant(job) || isAdmin) toast.error('Payment verification rejected'); },
      'job:completed': (job) => { if (isParticipant(job) || isAdmin) toast.success('Job completed successfully'); },
      'job:disputed': (job) => { if (isParticipant(job) || isAdmin) toast.error('A dispute has been opened for a job'); },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);

  return null;
}
