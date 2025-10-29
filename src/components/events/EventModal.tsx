import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Clock, Calendar, User, Share2, Mail, Send, FileEdit as Edit, MessageCircle } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Event } from '../../types';
import { GoogleMap } from '@react-google-maps/api';
import { supabase } from '../../lib/supabase';
import EditEventModal from './EditEventModal';
import EventMessagesModal from './EventMessagesModal';
import ShareModal from './ShareModal';
import { DateTime } from 'luxon';
import { useCapacitor } from '../../hooks/useCapacitor';
import ModalPortal from '../ModalPortal';

interface EventModalProps {
  event: Event;
  onClose: () => void;
  mapsLoaded: boolean;
  mapsLoadError: Error | undefined;
  userTimezone?: string;
  onEventUpdated?: () => void;
  shouldOpenMessages?: boolean;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose, mapsLoaded, mapsLoadError, userTimezone = 'UTC', onEventUpdated, shouldOpenMessages = false }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodingAttempted, setGeocodingAttempted] = useState(false);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isNative } = useCapacitor();

  const handleEventUpdated = () => {
    if (onEventUpdated) {
      onEventUpdated();
    }
    onClose(); // Close the modal after updating
  };

  // Open messages modal if shouldOpenMessages is true
  useEffect(() => {
    if (shouldOpenMessages) {
      setShowMessagesModal(true);
    }
  }, [shouldOpenMessages]);

  // Helper function to format date
  const formatDate = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString(DateTime.DATE_FULL);
  };

  // Helper function to format time
  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).setZone(userTimezone).toLocaleString(DateTime.TIME_SIMPLE);
  };

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

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only close if edit modal, messages modal, and share modal are not open
      if (!showEditModal && !showMessagesModal && !showShareModal && modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, showEditModal, showMessagesModal, showShareModal]);

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

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    // Prevent the click from closing the modal
    if (e.domEvent) {
      e.domEvent.stopPropagation();
    }

    // Get the clicked coordinates
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      // Construct Google Maps URL
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

      // Open in a new tab
      window.open(mapsUrl, '_blank');
    }
  };


  // Determine modal styling based on whether we're on mobile or desktop
  const modalContainerClasses = isNative
    ? "fixed inset-0 bg-white dark:bg-gray-800"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center";

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-800 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col";

  return (
    <ModalPortal>
      <div
        className={modalContainerClasses}
        style={isNative ? {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        } : undefined}
      >
        <div
          ref={modalRef}
          className={modalContentClasses}
          onClick={(e) => e.stopPropagation()}
        >
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
                  setShowMessagesModal(true);
                }}
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="View messages"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
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

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
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
                    <span className="mr-3">{event.child.name}</span>
                    {event.sportIcon && (
                      <FontAwesomeIcon
                        icon={event.sportIcon}
                        className="h-5 w-5 mr-2"
                        style={{ color: event.color }}
                      />
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{ color: event.color }}
                    >
                      {event.sport}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-4">
                  {event.child.photo_url ? (
                    <img
                      src={event.child.photo_url}
                      alt={event.child.name}
                      className="h-24 w-24 rounded-full object-cover border-2"
                      style={{ borderColor: event.child.color }}
                    />
                  ) : (
                    <div
                      className="h-24 w-24 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-600 border-2"
                      style={{ borderColor: event.child.color }}
                    >
                      <User className="h-12 w-12 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {event.location && (
                <div className="space-y-2">
                  {event.location_name ? (
                    <>
                      <div className="flex items-center text-gray-600 dark:text-gray-300">
                        <MapPin className="h-5 w-5 mr-3" />
                        <span>{event.location_name}</span>
                      </div>
                      <div className="flex items-center ml-8 text-sm text-gray-500 dark:text-gray-400">
                        <span>{event.location}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <MapPin className="h-5 w-5 mr-3" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {mapsLoaded && !mapsLoadError ? (
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
                            onLoad={handleMapLoad}
                            onClick={handleMapClick}
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
                            ) : mapsLoadError ? (
                    <div className="h-64 w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-4">
                      <p className="text-red-500 dark:text-red-400 mb-2">Error loading map: {mapsLoadError.message}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {event.location}
                      </p>
                                </div>
                                    ) : null}

                  {/* Get Directions Button */}
                  <div className="mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const encodedLocation = encodeURIComponent(event.location);
                        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;
                        window.open(directionsUrl, '_blank');
                      }}
                      className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
                    >
                      <MapPin className="h-5 w-5 mr-2" />
                      Get Directions
                    </button>
                  </div>
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
              {(() => {
                const PlatformIcon = event.platformIcon;
                return <PlatformIcon className="h-4 w-4" />;
              })()}
              <span>Synced from {event.platform}</span>
            </div>
          </div>
        </div>

        {showShareModal && (
          <ShareModal
            event={event}
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        )}
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

      {showMessagesModal && (
        <EventMessagesModal 
          event={event} 
          onClose={() => setShowMessagesModal(false)}
        />
      )}
    </ModalPortal>
  );
};

export default EventModal;
