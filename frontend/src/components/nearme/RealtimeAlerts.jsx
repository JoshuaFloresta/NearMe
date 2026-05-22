import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';

export default function RealtimeAlerts() {
  useEffect(() => {
    const socket = getSocket();

    const handlers = {
      'booking:created': () => toast.info('New booking request created'),
      'booking:status-updated': (booking) => toast.info(`Booking status: ${booking.status}`),
      'payment:mock-gcash-paid': () => toast.success('Mock GCash payment received'),
      'message:new': () => toast.info('New message received'),
      'kyc:submitted': () => toast.info('Provider KYC submitted'),
      'kyc:reviewed': (kyc) => toast.info(`KYC ${kyc.status}`),
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
