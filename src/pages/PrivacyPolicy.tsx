import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700">
            <Link 
             to="/dashboard" 
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
              onClick={() => {
                console.log('[PrivacyPolicy] Back to Dashboard clicked:', {
                  from: window.location.pathname,
                  to: '/dashboard',
                  timestamp: new Date().toISOString()
                });
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
             Back to Dashboard
            </Link>
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  Last updated: January 2025
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 prose prose-gray dark:prose-invert max-w-none">
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  FamSink ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our sports schedule management application and related services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Information We Collect</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Personal Information</h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
                      We may collect the following personal information:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                      <li>Name and contact information (email address, phone number)</li>
                      <li>Profile photos and images</li>
                      <li>Children's names, ages, and sports activities</li>
                      <li>Schedule and event information</li>
                      <li>Location data for events and activities</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Usage Information</h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
                      We automatically collect certain information about your use of our services:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                      <li>Device information and identifiers</li>
                      <li>Usage patterns and preferences</li>
                      <li>Log data and analytics</li>
                      <li>IP address and location data</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">How We Use Your Information</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  We use the information we collect to:
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                  <li>Provide and maintain our sports schedule management services</li>
                  <li>Sync and display sports schedules from connected platforms</li>
                  <li>Enable communication between family members and friends</li>
                  <li>Send notifications about schedule changes and events</li>
                  <li>Improve our services and develop new features</li>
                  <li>Ensure the security and integrity of our platform</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Information Sharing</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  We do not sell, trade, or otherwise transfer your personal information to third parties except in the following circumstances:
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                  <li>With your explicit consent</li>
                  <li>With friends and family members you've granted access to your schedules</li>
                  <li>With connected sports platforms (TeamSnap, SportsEngine, etc.) as necessary to sync data</li>
                  <li>With service providers who assist in operating our platform</li>
                  <li>When required by law or to protect our rights and safety</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Data Security</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure data transmission, and regular security assessments.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Rights</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                  <li>Access and review your personal information</li>
                  <li>Correct inaccurate or incomplete information</li>
                  <li>Delete your account and associated data</li>
                  <li>Restrict or object to certain processing activities</li>
                  <li>Export your data in a portable format</li>
                  <li>Withdraw consent where processing is based on consent</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Children's Privacy</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Our service is designed for parents and guardians to manage their children's sports schedules. We do not knowingly collect personal information directly from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Third-Party Services</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Our application integrates with third-party sports platforms and services. These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of these third-party services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Data Retention</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy. When you delete your account, we will delete your personal information within a reasonable timeframe, except where retention is required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Changes to This Policy</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact Us</h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>Email:</strong> privacy@famsink.com<br />
                    <strong>Address:</strong> FamSink<br />
                    Grafton, WI<br />
                    United States
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;