import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Lists from './pages/Lists';
import ListView from './pages/ListView';
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
import EditChildProfile from './pages/EditChildProfile';
import NotFound from './pages/NotFound';
import LandingPage from './pages/LandingPage';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import MobileApps from './pages/MobileApps';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';
import Onboarding from './pages/auth/Onboarding';
import TestEmail from './pages/TestEmail';
import Help from './pages/Help';
import PrivacyPolicy from './pages/PrivacyPolicy';
import MobileOptimizations from './components/mobile/MobileOptimizations';
import AuthAwarePageWrapper from './components/layout/AuthAwarePageWrapper';
import { AppProvider } from './context/AppContext';
import { ModalProvider } from './context/ModalContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProfilesProvider } from './context/ProfilesContext';
import { PageRefreshProvider } from './context/PageRefreshContext';
import { useAuth } from './hooks/useAuth';
import { useCapacitor } from './hooks/useCapacitor';
import { useScheduledNotifications } from './hooks/useScheduledNotifications';
import { usePushNotifications } from './hooks/usePushNotifications';
import { supabase, testConnection } from './lib/supabase';
import { App as CapacitorApp } from '@capacitor/app';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
  </div>
);

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

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
  const navigate = useNavigate();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Enhanced logging for protected route decisions
  useEffect(() => {
    console.log('[ProtectedRoute] Route evaluation:', {
      path: location.pathname,
      hasUser: !!user,
      userId: user?.id || 'No user',
      loading,
      isAuthRoute: location.pathname.includes('/auth/reset-password') || location.pathname.includes('/auth/callback'),
      timestamp: new Date().toISOString()
    });
  }, [user, loading, location.pathname]);

  // Check onboarding status for dashboard and protected routes
  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      if (!user || loading) {
        if (mounted) setCheckingOnboarding(false);
        return;
      }

      // Skip onboarding check for auth routes
      const isAuthRoute = location.pathname.includes('/auth/reset-password') ||
                          location.pathname.includes('/auth/callback') ||
                          location.pathname.includes('/auth/onboarding');

      if (isAuthRoute) {
        if (mounted) setCheckingOnboarding(false);
        return;
      }

      // Add a small delay to allow database updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!mounted) return;

      try {
        const { data: settings, error } = await supabase
          .from('user_settings')
          .select('full_name, timezone')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error('[ProtectedRoute] Error fetching onboarding status:', error);
          setCheckingOnboarding(false);
          return;
        }

        if (!settings?.full_name || !settings?.timezone) {
          console.log('[ProtectedRoute] User has not completed onboarding, redirecting');
          console.log('[ProtectedRoute] Settings:', settings);
          navigate('/auth/onboarding', { replace: true });
        } else {
          console.log('[ProtectedRoute] User has completed onboarding');
          setCheckingOnboarding(false);
        }
      } catch (error) {
        console.error('[ProtectedRoute] Error checking onboarding:', error);
        if (mounted) setCheckingOnboarding(false);
      }
    };

    checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [user, loading, location.pathname, navigate]);

  // Log the current path and authentication state
  console.log(`[ProtectedRoute] Path: ${location.pathname}, User: ${user ? 'Authenticated' : 'Not authenticated'}, Loading: ${loading}`);

  // Special case for reset password, auth callback, and onboarding routes
  const isAuthRoute = location.pathname.includes('/auth/reset-password') ||
                      location.pathname.includes('/auth/callback') ||
                      location.pathname.includes('/auth/onboarding');

  if (isAuthRoute) {
    console.log(`[ProtectedRoute] Auth route detected (${location.pathname}), bypassing protection`);
    return <>{children}</>;
  }

  if (loading || checkingOnboarding) {
    console.log('[ProtectedRoute] Still loading, showing spinner');
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to sign in');
    console.log('[ProtectedRoute] Redirect details:', {
      from: location.pathname,
      to: '/auth/signin',
      reason: 'No authenticated user found'
    });
    return <Navigate to="/auth/signin" replace />;
  }

  console.log('[ProtectedRoute] User authenticated, rendering protected content');
  return <>{children}</>;
};

interface AppContentProps {
  fcmToken: string | null;
  fcmRegistered: boolean;
}

const AppContent: React.FC<AppContentProps> = ({ fcmToken, fcmRegistered }) => {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isNative } = useCapacitor();
  const { isInitialized: notificationsInitialized } = useScheduledNotifications(fcmToken, fcmRegistered);

  useEffect(() => {
    const initializeConnection = async () => {
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

    initializeConnection();
  }, []);

  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = CapacitorApp.addListener('appUrlOpen', (data: any) => {
      console.log('[Deep Link] App opened with URL:', data.url);

      const url = new URL(data.url);
      const pathname = url.pathname;
      const search = url.search;

      console.log('[Deep Link] Pathname:', pathname);
      console.log('[Deep Link] Search params:', search);

      if (pathname.includes('/connections/teamsnap/callback')) {
        console.log('[Deep Link] TeamSnap OAuth callback detected');
        navigate(`/connections/teamsnap/callback${search}`, { replace: true });
      } else if (pathname.includes('/connections/callback')) {
        console.log('[Deep Link] SportsEngine OAuth callback detected');
        navigate(`/connections/callback${search}`, { replace: true });
      } else if (pathname.includes('/auth/callback')) {
        console.log('[Deep Link] Auth callback detected');
        navigate(`/auth/callback${search}`, { replace: true });
      } else {
        console.log('[Deep Link] Navigating to:', pathname + search);
        navigate(pathname + search, { replace: true });
      }
    });

    return () => {
      handleAppUrlOpen.remove();
    };
  }, [isNative, navigate]);

  // Redirect authenticated users from landing page to dashboard
  useEffect(() => {
    if (!loading && user && location.pathname === '/') {
      console.log('[App] Authenticated user on landing page, redirecting to dashboard');
      console.log('[App] Redirect details:', {
        userId: user.id,
        currentPath: location.pathname,
        redirectingTo: '/dashboard',
        timestamp: new Date().toISOString()
      });
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  // Check for password reset tokens in URL
  useEffect(() => {
    // Only run this check on the root path
    if (location.pathname !== '/') {
      return;
    }

    console.log('[App] Checking for password reset tokens on root path');

    // Check URL search params for tokens
    const searchParams = new URLSearchParams(location.search);
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');

    // Check URL hash for tokens (Supabase sometimes puts them here)
    let hashAccessToken, hashRefreshToken, hashType;
    if (location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      hashAccessToken = hashParams.get('access_token');
      hashRefreshToken = hashParams.get('refresh_token');
      hashType = hashParams.get('type');
    }

    // If we have tokens in either place and this is a recovery flow
    if ((type === 'recovery' && accessToken && refreshToken) || 
        (hashType === 'recovery' && hashAccessToken && hashRefreshToken)) {
      
      console.log('[App] Password reset tokens detected on root path, redirecting to reset password page');
      
      // Use the tokens from wherever they were found
      const finalAccessToken = accessToken || hashAccessToken;
      const finalRefreshToken = refreshToken || hashRefreshToken;
      
      // Redirect to reset password page with tokens
      navigate(`/auth/reset-password?access_token=${finalAccessToken}&refresh_token=${finalRefreshToken}`, { replace: true });
    }
  }, [location, navigate]);

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
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={
        <AuthAwarePageWrapper showBackToHome={false}>
          <Features />
        </AuthAwarePageWrapper>
      } />
      <Route path="/pricing" element={
        <AuthAwarePageWrapper showBackToHome={false}>
          <Pricing />
        </AuthAwarePageWrapper>
      } />
      <Route path="/mobileapps" element={
        <AuthAwarePageWrapper showBackToHome={false}>
          <MobileApps />
        </AuthAwarePageWrapper>
      } />
      <Route path="/privacy" element={
        <AuthAwarePageWrapper showBackToHome={false}>
          <PrivacyPolicy />
        </AuthAwarePageWrapper>
      } />
      <Route path="/help" element={
        <AuthAwarePageWrapper showBackToHome={false}>
          <Help />
        </AuthAwarePageWrapper>
      } />
      
      {/* Auth routes */}
      <Route path="/auth/signin" element={<SignIn />} />
      <Route path="/auth/signup" element={<SignUp />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/onboarding" element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } />
      
      {/* Special routes */}
      <Route path="/test-email" element={<TestEmail />} />
      <Route path="/connections/teamsnap/callback" element={<TeamSnapCallback />} />
      
      {/* Protected app routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <Layout>
            <Calendar />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/lists" element={
        <ProtectedRoute>
          <Layout>
            <Lists />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/lists/:listId" element={
        <ProtectedRoute>
          <Layout>
            <ListView />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/connections" element={
        <ProtectedRoute>
          <Layout>
            <Connections />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/connections/teamsnap" element={
        <ProtectedRoute>
          <Layout>
            <TeamSnapConnection />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/connections/playmetrics" element={
        <ProtectedRoute>
          <Layout>
            <Playmetrics />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/connections/sportsengine" element={
        <ProtectedRoute>
          <Layout>
            <SportsEngineConnection />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/connections/gamechanger" element={
        <ProtectedRoute>
          <Layout>
            <GameChangerConnection />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/profiles" element={
        <ProtectedRoute>
          <Layout>
            <Profiles />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/profiles/:id" element={
        <ProtectedRoute>
          <Layout>
            <ChildProfile />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/profiles/:id/edit" element={
        <ProtectedRoute>
          <EditChildProfile />
        </ProtectedRoute>
      } />
      <Route path="/friends" element={
        <ProtectedRoute>
          <Layout>
            <Friends />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default function App() {
  const { isNative } = useCapacitor();
  const { user, loading } = useAuth();
  const { token: fcmToken, isRegistered: fcmRegistered } = usePushNotifications(user, loading);

  // Log FCM token status for debugging
  useEffect(() => {
    console.log('=== FCM Token Status ===');
    console.log('FCM Token:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'Not available');
    console.log('FCM Registered:', fcmRegistered);
    console.log('Is Native:', isNative);
    console.log('User:', user ? 'Present' : 'Not present');
    console.log('Auth Loading:', loading);
  }, [fcmToken, fcmRegistered, isNative]);
  return (
    <ErrorBoundary>
      <div className="min-h-screen min-w-full bg-gray-50 dark:bg-gray-900">
        <Router>
          <ThemeProvider>
            <AppProvider>
              <ModalProvider>
                <ProfilesProvider>
                  <PageRefreshProvider>
                    <MobileOptimizations>
                      <Suspense fallback={<LoadingSpinner />}>
                        <AppContent fcmToken={fcmToken} fcmRegistered={fcmRegistered} />
                      </Suspense>
                    </MobileOptimizations>
                  </PageRefreshProvider>
                </ProfilesProvider>
              </ModalProvider>
            </AppProvider>
          </ThemeProvider>
        </Router>
      </div>
    </ErrorBoundary>
  );
}
