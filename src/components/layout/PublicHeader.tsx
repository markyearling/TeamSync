import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface PublicHeaderProps {
  showBackToHome?: boolean;
}

const PublicHeader: React.FC<PublicHeaderProps> = ({ showBackToHome = true }) => {
  const location = useLocation();
  const isSignInPage = location.pathname === '/auth/signin';

  return (
    <header className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[env(safe-area-inset-top)]">
        <div className="flex justify-between items-center py-4 h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <img
                src="/famsink-new-logo.png"
                alt="FamSink Logo"
                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
              />
              <Link to="/" className="ml-3 text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center h-8">
                FamSink
              </Link>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </Link>
              <Link to="/mobileapps" className="text-gray-600 hover:text-gray-900 transition-colors">
                Mobile Apps
              </Link>
            </nav>
          </div>
          {!isSignInPage && (
            <Link
              to="/auth/signin"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;