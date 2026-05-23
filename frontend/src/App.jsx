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
import NearMeProviderKyc from '@/pages/NearMeProviderKyc';
import NearMeProviderReview from '@/pages/NearMeProviderReview';
import NearMeProviderDashboard from '@/pages/NearMeProviderDashboard';
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
            <Route path="/provider-kyc" element={<NearMeProviderKyc />} />
            <Route path="/provider-review" element={<NearMeProviderReview />} />
            <Route path="/provider-dashboard" element={<NearMeProviderDashboard />} />
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
