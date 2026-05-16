import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AssessorDashboard from './pages/AssessorDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import PublicRequest from './pages/PublicRequest';
import ProfileSetup from './pages/ProfileSetup';
import KeysPage from './pages/KeysPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { AnimatePresence } from 'motion/react';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 font-medium text-slate-500">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (profile && !profile.warName && window.location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" />;
  }

  if (requiredRole && profile?.role !== requiredRole && !['director', 'subdirector', 'coordinator'].includes(profile?.role || '')) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {!isLoginPage && user && <Sidebar />}
      
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!isLoginPage && user && <Header />}
        
        <div className={`flex-1 ${isLoginPage ? '' : 'p-8'}`}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route 
                path="/keys" 
                element={
                  <ProtectedRoute>
                    <KeysPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/public-request" 
                element={
                  <ProtectedRoute>
                    <PublicRequest />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile-setup" 
                element={
                  <ProtectedRoute>
                    <ProfileSetup />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/assessor" 
                element={
                  <ProtectedRoute requiredRole="assessor">
                    <AssessorDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/director" 
                element={
                  <ProtectedRoute requiredRole="director">
                    <DirectorDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    {profile?.role === 'assessor' 
                      ? <Navigate to="/assessor" /> 
                      : (['director', 'subdirector', 'coordinator'].includes(profile?.role || '') 
                        ? <Navigate to="/director" /> 
                        : <Navigate to="/public-request" />)}
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
