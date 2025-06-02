import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu } from 'lucide-react';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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
      <div className="hidden lg:flex lg:w-64 lg:flex-shrink-0">
        <div className="flex h-full flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Sidebar onClose={() => {}} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col w-full overflow-hidden">
        <Header>
          <button
            type="button"
            className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu size={24} />
          </button>
        </Header>
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
          <div className="container mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;