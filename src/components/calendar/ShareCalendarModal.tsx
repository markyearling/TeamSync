import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, AlertCircle, RefreshCw, Share2, ExternalLink, TestTube, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCapacitor } from '../../hooks/useCapacitor';

interface ShareCalendarModalProps {
  onClose: () => void;
}

const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({ onClose }) => {
  const { isNative, isIOS } = useCapacitor();
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [httpsUrl, setHttpsUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showHttpsUrl, setShowHttpsUrl] = useState(false);

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
      const httpsBaseUrl = `${supabaseUrl}/functions/v1/generate-calendar-feed?token=${token}`;
      const webcalUrl = httpsBaseUrl.replace('https://', 'webcal://');

      setHttpsUrl(httpsBaseUrl);
      setCalendarUrl(webcalUrl);
    } catch (err) {
      console.error('Error fetching calendar token:', err);
      setError('Failed to generate calendar feed URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (url?: string) => {
    try {
      await navigator.clipboard.writeText(url || calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTestFeed = () => {
    window.open(httpsUrl, '_blank');
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

  if (isNative) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-800 z-[9999] flex flex-col">
        <div className={`bg-blue-600 dark:bg-blue-700 ${isIOS ? 'safe-area-top' : ''}`}>
          <div className="flex items-center p-4 border-b border-blue-700 dark:border-blue-800">
            <button
              onClick={onClose}
              className="mr-3 p-2 -ml-2 text-white hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2 flex-1">
              <Share2 className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">
                Share Your Calendar
              </h2>
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto ${isIOS ? 'safe-area-bottom' : ''}`}>
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
                      <li>Google Calendar may take up to 24 hours for initial sync, then updates every few hours</li>
                      <li>Apple Calendar typically updates every 15-60 minutes</li>
                      <li>Outlook refresh intervals vary by account type</li>
                      <li>Regenerate the URL if you believe it has been compromised</li>
                    </ul>
                  </div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Calendar Feed URL (webcal://)
                  </label>
                  <div className="flex flex-col space-y-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value={calendarUrl}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => handleCopyToClipboard()}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-5 w-5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex flex-col space-y-2 mb-3">
                    <button
                      onClick={() => setShowHttpsUrl(!showHttpsUrl)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
                    >
                      {showHttpsUrl ? 'Hide' : 'Show'} HTTPS URL (for testing)
                    </button>
                    <button
                      onClick={handleTestFeed}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Test feed in browser"
                    >
                      <TestTube className="h-5 w-5" />
                      <span>Test Feed</span>
                    </button>
                  </div>
                  {showHttpsUrl && (
                    <div className="flex flex-col space-y-2">
                      <input
                        type="text"
                        readOnly
                        value={httpsUrl}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        onClick={() => handleCopyToClipboard(httpsUrl)}
                        className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors"
                        title="Copy HTTPS URL"
                      >
                        <Copy className="h-5 w-5" />
                        <span>Copy HTTPS URL</span>
                      </button>
                    </div>
                  )}
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
                        <li>Paste the webcal:// URL and click "Add calendar"</li>
                        <li>Note: Initial sync may take several hours</li>
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
                        <li>Paste the webcal:// URL and click Subscribe</li>
                        <li>Set auto-refresh to "Every 15 minutes" for best results</li>
                        <li>Click OK to complete</li>
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
                        <li>Paste the webcal:// URL</li>
                        <li>Name your calendar and click Import</li>
                        <li>Updates sync based on your Outlook account type</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleRegenerateToken}
                    disabled={regenerating}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-5 w-5 ${regenerating ? 'animate-spin' : ''}`} />
                    <span>{regenerating ? 'Regenerating...' : 'Regenerate URL'}</span>
                  </button>

                  <a
                    href="https://support.google.com/calendar/answer/37100"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors"
                  >
                    <span>Need help?</span>
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                    <li>Google Calendar may take up to 24 hours for initial sync, then updates every few hours</li>
                    <li>Apple Calendar typically updates every 15-60 minutes</li>
                    <li>Outlook refresh intervals vary by account type</li>
                    <li>Regenerate the URL if you believe it has been compromised</li>
                  </ul>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Calendar Feed URL (webcal://)
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    readOnly
                    value={calendarUrl}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => handleCopyToClipboard()}
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
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setShowHttpsUrl(!showHttpsUrl)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {showHttpsUrl ? 'Hide' : 'Show'} HTTPS URL (for testing)
                  </button>
                  <button
                    onClick={handleTestFeed}
                    className="flex items-center space-x-2 px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    title="Test feed in browser"
                  >
                    <TestTube className="h-4 w-4" />
                    <span>Test Feed</span>
                  </button>
                </div>
                {showHttpsUrl && (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={httpsUrl}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => handleCopyToClipboard(httpsUrl)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                      title="Copy HTTPS URL"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </button>
                  </div>
                )}
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
                      <li>Paste the webcal:// URL and click "Add calendar"</li>
                      <li>Note: Initial sync may take several hours</li>
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
                      <li>Paste the webcal:// URL and click Subscribe</li>
                      <li>Set auto-refresh to "Every 15 minutes" for best results</li>
                      <li>Click OK to complete</li>
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
                      <li>Paste the webcal:// URL</li>
                      <li>Name your calendar and click Import</li>
                      <li>Updates sync based on your Outlook account type</li>
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
