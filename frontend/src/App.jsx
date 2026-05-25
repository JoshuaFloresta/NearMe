import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import NearMeLanding from '@/pages/NearMeLanding';
import NearMeAbout from '@/pages/NearMeAbout';
import NearMeAuth from '@/pages/NearMeAuth';
import NearMeBrowse from '@/pages/NearMeBrowse';
import NearMeProvider from '@/pages/NearMeProvider';
import NearMeMessages from '@/pages/NearMeMessages';
import NearMeSettings from '@/pages/NearMeSettings';
import NearMeClientChatHistory from '@/pages/NearMeClientChatHistory';
import NearMeMyOrders from '@/pages/NearMeMyOrders';
import NearMeProviderKyc from '@/pages/NearMeProviderKyc';
import NearMeProviderReview from '@/pages/NearMeProviderReview';
import NearMeProviderDashboard from '@/pages/NearMeProviderDashboard';
import NearMePayNow from '@/pages/NearMePayNow';
import NearMeAdminDashboard from '@/pages/NearMeAdminDashboard';
import RealtimeAlerts from '@/components/nearme/RealtimeAlerts';
import ProviderAccessGate from '@/components/nearme/ProviderAccessGate';
// Add page imports here

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <RealtimeAlerts />
        <ProviderAccessGate>
          <Routes>
            <Route path="/" element={<NearMeLanding />} />
            <Route path="/about" element={<NearMeAbout />} />
            <Route path="/login" element={<NearMeAuth />} />
            <Route path="/signup" element={<NearMeAuth />} />
            <Route path="/browse" element={<NearMeBrowse />} />
            <Route path="/provider/:id" element={<NearMeProvider />} />
            <Route path="/messages" element={<NearMeMessages />} />
            <Route path="/settings" element={<NearMeSettings />} />
            <Route path="/chat-history" element={<NearMeClientChatHistory />} />
            <Route path="/my-orders" element={<NearMeMyOrders />} />
            <Route path="/provider-kyc" element={<NearMeProviderKyc />} />
            <Route path="/provider-review" element={<NearMeProviderReview />} />
            <Route path="/provider-dashboard" element={<NearMeProviderDashboard />} />
            <Route path="/provider-dashboard/calendar" element={<NearMeProviderDashboard focusSection="calendar" />} />
            <Route path="/provider-dashboard/bookings" element={<NearMeProviderDashboard focusSection="bookings" />} />
            <Route path="/provider-dashboard/chat-history" element={<NearMeProviderDashboard focusSection="chat-history" />} />
            <Route path="/provider-dashboard/pricing" element={<NearMeProviderDashboard focusSection="pricing" />} />
            <Route path="/provider-dashboard/reviews" element={<NearMeProviderDashboard focusSection="reviews" />} />
            <Route path="/provider-dashboard/settings" element={<NearMeProviderDashboard focusSection="settings" />} />
            <Route path="/pay/:jobId" element={<NearMePayNow />} />
            <Route path="/admin" element={<NearMeAdminDashboard />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </ProviderAccessGate>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
