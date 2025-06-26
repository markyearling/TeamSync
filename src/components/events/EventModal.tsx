import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Clock, Calendar, User, Share2, Mail, Send, Edit } from 'lucide-react';
import { Event } from '../../types';
import { GoogleMap } from '@react-google-maps/api';
import { supabase } from '../../lib/supabase';
import EditEventModal from './EditEventModal';
import { DateTime } from 'luxon';

interface EventModalProps {
  event: Event;
  onClose: () => void;
  mapsLoaded: boolean;
  mapsLoadError: Error | undefined;
  userTimezone?: string;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, mapsLoaded, mapsLoadError, userTimezone = 'UTC' }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodingAttempted, setGeocodingAttempted] = useState(false);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Check if user can edit this event
  useEffect(() => {
    const checkEditPermissions = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // Check if this is the user's own event
        if (event.isOwnEvent) {
          setCanEdit(true);
          return;
        }

        // Check if user has administrator access to the event owner
        const { data: friendship, error: friendshipError } = await supabase
          .from('friendships')
          .select('role')
          .eq('friend_id', user.id)
          .eq('user_id', event.child.user_id || '')
          .eq('role', 'administrator')
          .maybeSingle();

        if (!friendshipError && friendship) {
          setCanEdit(true);
        }
      } catch (error) {
        console.error('Error checking edit permissions:', error);
      }
    };

    checkEditPermissions();
  }, [event]);

  // Geocode the location to get coordinates for the map
  useEffect(() => {
    if (mapsLoaded && !mapsLoadError && event.location && !geocodingAttempted) {
      const geocoder = new google.maps.Geocoder();
      
      // Use a try-catch block to handle potential geocoding errors
      try {
        geocoder.geocode({ address: event.location }, (results, status) => {
          setGeocodingAttempted(true);
          if (status === 'OK' && results && results[0] && results[0].geometry) {
            const { lat, lng } = results[0].geometry.location;
            setMapCenter({ lat: lat(), lng: lng() });
          } else {
            // mapCenter remains null, which will trigger the "not found" message
          }
        });
      } catch (error) {
        setGeocodingAttempted(true);
      }
    }
  }, [mapsLoaded, mapsLoadError, event.location, geocodingAttempted]);

  // Add marker when map center and map ref are available
  useEffect(() => {
    if (mapRef && mapCenter && mapsLoaded && !mapsLoadError) {
      try {
        // Check if the advanced marker API is available
        if (window.google?.maps?.marker) {
          // Create an advanced marker element
          const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
            position: mapCenter,
            map: mapRef
          });

          // Clean up on unmount
          return () => {
            if (advancedMarker) {
              advancedMarker.map = null;
            }
          };
        } else {
          // Fallback to standard marker if advanced marker is not available
          const marker = new google.maps.Marker({
            position: mapCenter,
            map: mapRef
          });

          // Clean up on unmount
          return () => {
            if (marker) {
              marker.setMap(null);
            }
          };
        }
      } catch (error) {
        console.error('Error creating marker:', error);
      }
    }
  }, [mapRef, mapCenter, mapsLoaded, mapsLoadError]);

  const handleMapLoad = (map: google.maps.Map) => {
    setMapRef(map);
    
    // Force map to redraw after a short delay
    setTimeout(() => {
      if (map && mapCenter) {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(mapCenter);
      }
    }, 100);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail) return;

    setIsSharing(true);
    setShareError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch('/api/share-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          event,
          recipientEmail: shareEmail,
          senderEmail: user.email
        })
      });

      if (!response.ok) throw new Error('Failed to share event');

      setShowShareModal(false);
      setShareEmail('');
    } catch (error) {
      setShareError('Failed to share event. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleEventUpdated = () => {
    setShowEditModal(false);
    // Refresh the page to show updated event data
    window.location.reload();
  };

  // Format date and time with user's timezone
  const formatDate = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString({
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const ShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Share Event</h3>
          <button
            onClick={() => setShowShareModal(false)}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleShare} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Recipient Email
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                id="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="block w-full pl-10 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
                autoComplete="off"
              />
            </div>
          </div>

          {shareError && (
            <p className="text-sm text-red-600 dark:text-red-400">{shareError}</p>
          )}

          <button
            type="submit"
            disabled={isSharing || !shareEmail}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Share Event
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: event.child.color }}
              ></span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{event.title}</h3>
            </div>
            <div className="flex items-center space-x-2">
              {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Edit event"
                >
                  <Edit className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Calendar className="h-5 w-5 mr-3" />
                <span>
                  {formatDate(event.startTime)}
                </span>
              </div>

              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Clock className="h-5 w-5 mr-3" />
                <span>
                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                </span>
              </div>

              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <User className="h-5 w-5 mr-3" />
                <span>{event.child.name}</span>
              </div>

              {event.location && (
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <MapPin className="h-5 w-5 mr-3" />
                    <span>{event.location}</span>
                  </div>
                  
                  {mapsLoaded && !mapsLoadError && (
                    <div 
                      ref={mapContainerRef}
                      className="h-64 w-full rounded-lg overflow-hidden"
                    >
                      {mapCenter ? (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="h-full w-full"
                        >
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={mapCenter}
                            zoom={15}
                            options={{
                              disableDefaultUI: false,
                              zoomControl: true,
                              streetViewControl: true,
                              mapTypeControl: true,
                              fullscreenControl: true,
                              mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onLoad={handleMapLoad}
                          >
                            {/* Marker is added via useEffect when mapRef and mapCenter are available */}
                          </GoogleMap>
                        </div>
                      ) : !geocodingAttempted ? (
                        <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-2"></div>
                            <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <div className="flex flex-col items-center text-center p-4">
                            <MapPin className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Location not found on map</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                              {event.location}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {mapsLoadError && (
                    <div className="h-64 w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-4">
                      <p className="text-red-500 dark:text-red-400 mb-2">Error loading map: {mapsLoadError.message}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {event.location}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {event.description && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-600 dark:text-gray-300">{event.description}</p>
                </div>
              )}
            </div>

            <div 
              className="flex items-center space-x-2 text-sm"
              style={{ color: event.platformColor }}
            >
              <event.platformIcon className="h-4 w-4" />
              <span>Synced from {event.platform}</span>
            </div>
          </div>
        </div>

        {showShareModal && <ShareModal />}
      </div>

      {showEditModal && (
        <EditEventModal 
          event={event} 
          onClose={() => setShowEditModal(false)}
          onEventUpdated={handleEventUpdated}
          mapsLoaded={mapsLoaded}
          mapsLoadError={mapsLoadError}
          userTimezone={userTimezone}
        />
      )}
    </>
  );
};

export default EventModal;