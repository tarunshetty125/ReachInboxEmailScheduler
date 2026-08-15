import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { EmailDetail } from './components/email/EmailDetail';
import { EmailList } from './components/email/EmailList';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ComposePage } from './pages/ComposePage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';

export function App(): JSX.Element {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}><Route path="/scheduled" element={<EmailList type="scheduled" />} /><Route path="/sent" element={<EmailList type="sent" />} /></Route><Route path="/email/:id" element={<ProtectedRoute><EmailDetail /></ProtectedRoute>} /><Route path="/compose" element={<ProtectedRoute><ComposePage /></ProtectedRoute>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
