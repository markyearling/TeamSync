import React, { useState } from 'react';
import { HelpCircle, Mail } from 'lucide-react';
import SupportModal from '../components/SupportModal';

const Help: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <HelpCircle className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help & Support</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Find answers to common questions or contact our support team.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">About FamSink</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          FamSink is your ultimate family sports schedule management app, designed to simplify the chaotic world of youth sports. We help parents effortlessly organize, track, and share their children's activities, ensuring no game or practice is ever missed.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Our mission is to bring peace of mind to busy families by centralizing schedules, facilitating communication, and integrating with popular sports platforms like TeamSnap, SportsEngine, and Playmetrics.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          FamSink is proudly based out of Grafton, WI.
        </p>

        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Support Issues</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          If you encounter any issues or have questions that aren't covered in our FAQs, please don't hesitate to reach out to our support team.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Mail className="h-5 w-5 mr-2" />
          Contact Support
        </button>
      </div>

      {isModalOpen && (
        <SupportModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};

export default Help;