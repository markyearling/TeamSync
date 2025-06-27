import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Connections from './pages/Connections';
import TeamSnapConnection from './pages/connections/TeamSnapConnection';
import TeamSnapCallback from './pages/connections/TeamSnapCallback';
import Playmetrics from './pages/connections/Playmetrics';
import SportsEngineConnection from './pages/connections/SportsEngineConnection';
import GameChangerConnection from './pages/connections/GameChangerConnection';
import Profiles from './pages/Profiles';
import Friends from './pages/Friends';
import Settings from './pages/Settings';
import ChildProfile from './pages/ChildProfile';
import NotFound from './pages/NotFound';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';
import MobileOptimizations from './components/mobile/MobileOptimizations';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProfilesProvider } from './context/ProfilesContext';
import { useAuth } from './hooks/useAuth';
import { useCapacitor } from './hooks/useCapacitor';
import { supabase, testConnection } from './lib/supabase';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
  </div>
);

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMessage(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Log the current path and authentication state
  console.log(`[ProtectedRoute] Path: ${location.pathname}, User: ${user ? 'Authenticated' : 'Not authenticated'}, Loading: ${loading}`);

  // Special case for reset password and auth callback routes
  const isAuthRoute = location.pathname.includes('/auth/reset-password') || 
                      location.pathname.includes('/auth/callback');
  
  if (isAuthRoute) {
    console.log(`[ProtectedRoute] Auth route detected (${location.pathname}), bypassing protection`);
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to sign in');
    return <Navigate to="/auth/signin" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { isNative } = useCapacitor();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const isConnected = await testConnection();
        if (!isConnected) {
          throw new Error('Failed to connect to the backend services');
        }
        
        setInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize application');
      }
    };

    initializeApp();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Connection Error</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/auth/signin" element={<SignIn />} />
      <Route path="/auth/signup" element={<SignUp />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/connections/teamsnap/callback" element={<TeamSnapCallback />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="connections" element={<Connections />} />
        <Route path="connections/teamsnap" element={<TeamSnapConnection />} />
        <Route path="connections/playmetrics" element={<Playmetrics />} />
        <Route path="connections/sportsengine" element={<SportsEngineConnection />} />
        <Route path="connections/gamechanger" element={<GameChangerConnection />} />
        <Route path="profiles" element={<Profiles />} />
        <Route path="profiles/:id" element={<ChildProfile />} />
        <Route path="friends" element={<Friends />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen min-w-full bg-gray-50 dark:bg-gray-900">
        <Router>
          <ThemeProvider>
            <AppProvider>
              <ProfilesProvider>
                <MobileOptimizations>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AppContent />
                  </Suspense>
                </MobileOptimizations>
              </ProfilesProvider>
            </AppProvider>
          </ThemeProvider>
        </Router>
      </div>
    </ErrorBoundary>
  );
}