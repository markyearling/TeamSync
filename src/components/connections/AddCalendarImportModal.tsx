import { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../context/ProfilesContext';

interface AddCalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCalendarImportModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCalendarImportModalProps) {
  const { profiles } = useProfiles();
  const [calendarName, setCalendarName] = useState('');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [previewEvents, setPreviewEvents] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setCalendarName('');
      setCalendarUrl('');
      setSelectedProfileId(profiles[0]?.id || '');
      setValidationStatus('idle');
      setValidationMessage('');
      setPreviewEvents(0);
    }
  }, [isOpen, profiles]);

  const validateCalendarUrl = async () => {
    if (!calendarUrl.trim()) {
      setValidationStatus('error');
      setValidationMessage('Please enter a calendar URL');
      return;
    }

    setIsValidating(true);
    setValidationStatus('idle');
    setValidationMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-calendar-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ calendar_url: calendarUrl.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setValidationStatus('success');
        setValidationMessage(result.message);
        setPreviewEvents(result.event_count);

        if (result.calendar_name && !calendarName.trim()) {
          setCalendarName(result.calendar_name);
        }
      } else {
        setValidationStatus('error');
        setValidationMessage(result.error || 'Failed to validate calendar URL');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationStatus('error');
      setValidationMessage(error.message || 'Failed to validate calendar URL');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!calendarName.trim() || !calendarUrl.trim() || !selectedProfileId) {
      alert('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('calendar_imports')
        .insert({
          user_id: user.id,
          profile_id: selectedProfileId,
          calendar_name: calendarName.trim(),
          calendar_url: calendarUrl.trim(),
          sync_status: 'pending',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const syncResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-external-calendar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ calendar_import_id: data.id }),
        }
      );

      if (!syncResponse.ok) {
        console.error('Initial sync failed, but calendar import was created');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding calendar import:', error);
      alert('Failed to add calendar import. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Add Calendar Import</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calendar Name
            </label>
            <input
              type="text"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              placeholder="e.g., Soccer Practice Schedule"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calendar URL (ICS Feed)
            </label>
            <input
              type="url"
              value={calendarUrl}
              onChange={(e) => {
                setCalendarUrl(e.target.value);
                setValidationStatus('idle');
                setValidationMessage('');
              }}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={validateCalendarUrl}
              disabled={isValidating || !calendarUrl.trim()}
              className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Test Calendar URL'
              )}
            </button>

            {validationStatus === 'success' && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">{validationMessage}</p>
              </div>
            )}

            {validationStatus === 'error' && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{validationMessage}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Profile
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to get your calendar URL:</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div>
                <strong>Google Calendar:</strong>
                <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                  <li>Open Google Calendar on a computer</li>
                  <li>Go to Settings and select the calendar you want to share</li>
                  <li>Scroll to "Integrate calendar" section</li>
                  <li>Copy the "Secret address in iCal format" URL</li>
                </ol>
              </div>
              <div className="mt-3">
                <strong>Apple Calendar:</strong>
                <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                  <li>Open iCloud.com and go to Calendar</li>
                  <li>Click the share icon next to your calendar</li>
                  <li>Enable "Public Calendar" and copy the URL</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !calendarName.trim() || !calendarUrl.trim() || !selectedProfileId}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Calendar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
