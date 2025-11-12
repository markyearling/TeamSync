import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, AlertCircle, RefreshCw, Share2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ShareCalendarModalProps {
  onClose: () => void;
}

const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({ onClose }) => {
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchOrCreateCalendarToken();
  }, []);

  const fetchOrCreateCalendarToken = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        return;
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('calendar_feed_tokens')
        .select('token')
        .eq('user_id', user.id)
        .maybeSingle();

      let token: string;

      if (tokenError) {
        throw tokenError;
      }

      if (tokenData?.token) {
        token = tokenData.token;
      } else {
        const { data: newTokenData, error: createError } = await supabase
          .from('calendar_feed_tokens')
          .insert({ user_id: user.id })
          .select('token')
          .single();

        if (createError) {
          throw createError;
        }

        token = newTokenData.token;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const feedUrl = `${supabaseUrl}/functions/v1/generate-calendar-feed?token=${token}`;
      setCalendarUrl(feedUrl);
    } catch (err) {
      console.error('Error fetching calendar token:', err);
      setError('Failed to generate calendar feed URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Regenerating the calendar URL will invalidate the old URL. Any calendars subscribed to the old URL will stop working. Continue?')) {
      return;
    }

    try {
      setRegenerating(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        return;
      }

      await supabase
        .from('calendar_feed_tokens')
        .delete()
        .eq('user_id', user.id);

      await fetchOrCreateCalendarToken();
    } catch (err) {
      console.error('Error regenerating token:', err);
      setError('Failed to regenerate calendar URL');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Share2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Share Your Calendar
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Subscribe to your FamSink calendar in any calendar app that supports ICS feeds.
                  This is a one-way sync - changes made in other apps won't affect your FamSink calendar.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Important
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 ml-6 list-disc">
                    <li>Keep this URL private - anyone with it can view your calendar</li>
                    <li>Events update automatically when synced by your calendar app</li>
                    <li>Regenerate the URL if you believe it has been compromised</li>
                  </ul>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Calendar Feed URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={calendarUrl}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={handleCopyToClipboard}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  How to Add to Your Calendar
                </h3>
                <div className="space-y-4">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
                      Google Calendar
                    </h4>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-8 list-decimal">
                      <li>Open Google Calendar on your computer</li>
                      <li>Click the + next to "Other calendars"</li>
                      <li>Select "From URL"</li>
                      <li>Paste the calendar URL and click "Add calendar"</li>
                    </ol>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">2</span>
                      Apple Calendar
                    </h4>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-8 list-decimal">
                      <li>Open Calendar on your Mac</li>
                      <li>Go to File → New Calendar Subscription</li>
                      <li>Paste the calendar URL and click Subscribe</li>
                      <li>Choose update frequency and click OK</li>
                    </ol>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">3</span>
                      Outlook
                    </h4>
                    <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-8 list-decimal">
                      <li>Open Outlook and go to Calendar</li>
                      <li>Click "Add calendar" → "Subscribe from web"</li>
                      <li>Paste the calendar URL</li>
                      <li>Name your calendar and click Import</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleRegenerateToken}
                  disabled={regenerating}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                  <span>{regenerating ? 'Regenerating...' : 'Regenerate URL'}</span>
                </button>

                <a
                  href="https://support.google.com/calendar/answer/37100"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <span>Need help?</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareCalendarModal;
