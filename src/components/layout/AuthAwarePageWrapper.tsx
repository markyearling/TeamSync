import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import Layout from './Layout';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

interface AuthAwarePageWrapperProps {
  children: React.ReactNode;
  showBackToHome?: boolean;
}

const AuthAwarePageWrapper: React.FC<AuthAwarePageWrapperProps> = ({ 
  children, 
  showBackToHome = true 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (user) {
    // User is logged in - show full app layout with sidebar and header
    return (
      <Layout>
        {children}
      </Layout>
    );
  }

  // User is not logged in - show public header only
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PublicHeader showBackToHome={showBackToHome} />
      <main>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
};

export default AuthAwarePageWrapper;