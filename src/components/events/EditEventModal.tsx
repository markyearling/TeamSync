import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Autocomplete } from '@react-google-maps/api';
import { Event } from '../../types';

interface EditEventModalProps {
  event: Event;
  onClose: () => void;
  onEventUpdated: () => void;
  mapsLoaded: boolean;
  mapsLoadError: Error | undefined;
  userTimezone?: string;
}

const EditEventModal: React.FC<EditEventModalProps> = ({ 
  event, 
  onClose, 
  onEventUpdated, 
  mapsLoaded, 
  mapsLoadError,
  userTimezone = 'UTC'
}) => {
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || '',
    date: event.startTime.toISOString().split('T')[0],
    time: event.startTime.toTimeString().slice(0, 5),
    duration: Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60000).toString(),
    location: event.location || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const onPlaceSelected = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.formatted_address) {
      setFormData(prev => ({
        ...prev,
        location: place.formatted_address
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(formData.duration) * 60000);

      const { error: updateError } = await supabase
        .from('events')
        .update({
          title: formData.title,
          description: formData.description,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          location: formData.location
        })
        .eq('id', event.id);

      if (updateError) throw updateError;

      onEventUpdated();
    } catch (err) {
      console.error('Failed to update event:', err);
      setError('Failed to update event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <CalendarIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Event</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Event Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Time
                </label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Duration (minutes)
              </label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Location
              </label>
              {mapsLoaded && !mapsLoadError ? (
                <Autocomplete
                  onLoad={autocomplete => {
                    autocompleteRef.current = autocomplete;
                  }}
                  onPlaceChanged={onPlaceSelected}
                  options={{ types: ['establishment', 'geocode'] }}
                >
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Start typing to search locations..."
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={mapsLoadError ? "Maps unavailable - enter location manually" : "Loading places search..."}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={!mapsLoadError && !mapsLoaded}
                />
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Timezone:</strong> All times will be saved in your preferred timezone ({userTimezone}).
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEventModal;