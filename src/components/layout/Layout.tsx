import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu } from 'lucide-react';
import { useCapacitor } from '../../hooks/useCapacitor';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { isNative } = useCapacitor();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Check if the current page is the ListView on native to apply a special layout
  const isNativeListView = isNative && location.pathname.startsWith('/lists/');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" 
          onClick={toggleSidebar}
        ></div>
        <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white dark:bg-gray-800 shadow-xl">
          <Sidebar onClose={toggleSidebar} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-50 lg:flex-shrink-0">
        <div className="flex h-full flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Sidebar onClose={() => {}} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col w-full overflow-hidden">
        {!isNativeListView && (
          <Header>
            <button
              type="button"
              className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
              onClick={toggleSidebar}
            >
              <Menu size={24} />
            </button>
          </Header>
        )}
        <main className={`flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 ${isNativeListView ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
          <div className={isNativeListView ? 'h-full' : ""}>
            {children}
          </div>
          
          {/* Footer - now inside main content area so it only shows when scrolled to bottom */}
          {!isNativeListView && (
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 mt-8">
              <div className="container mx-auto max-w-7xl">
                <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="mb-2 sm:mb-0">
                    © 2025 FamSink. All rights reserved.
                  </div>
                  <div className="flex space-x-4">
                    <Link 
                      to="/privacy" 
                      className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Privacy Policy
                    </Link>
                    <Link 
                      to="/help" 
                      className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Help & Support
                    </Link>
                  </div>
                </div>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;