import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Clock, Calendar, User, Share2, Mail, Send, FileEdit as Edit, MessageCircle, AlertCircle, Trash2, Repeat, Download } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Event } from '../../types';
import { GoogleMap } from '@react-google-maps/api';
import { supabase } from '../../lib/supabase';
import EditEventModal from './EditEventModal';
import EventMessagesModal from './EventMessagesModal';
import ShareModal from './ShareModal';
import RecurringEventActionModal from './RecurringEventActionModal';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecurringActionModal, setShowRecurringActionModal] = useState(false);
  const [recurringEventCount, setRecurringEventCount] = useState(0);
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
    onClose();
  };

  const handleDelete = async () => {
    if (event.is_recurring && event.recurring_group_id) {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('recurring_group_id', event.recurring_group_id)
        .gte('start_time', event.startTime.toISOString());

      setRecurringEventCount(count || 0);
      setShowRecurringActionModal(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = async (applyToAll: boolean): Promise<void> => {
    try {
      console.log('[EventModal] confirmDelete called with applyToAll:', applyToAll);
      console.log('[EventModal] Event details:', {
        id: event.id,
        recurring_group_id: event.recurring_group_id,
        is_recurring: event.is_recurring,
        startTime: event.startTime.toISOString()
      });

      if (applyToAll && event.recurring_group_id) {
        console.log('[EventModal] Deleting all events in series with recurring_group_id:', event.recurring_group_id);
        console.log('[EventModal] Filtering events >= start_time:', event.startTime.toISOString());

        const { data: eventsToDelete, error: fetchError } = await supabase
          .from('events')
          .select('id, title, start_time')
          .eq('recurring_group_id', event.recurring_group_id)
          .gte('start_time', event.startTime.toISOString());

        if (fetchError) {
          console.error('[EventModal] Error fetching events to delete:', fetchError);
          throw fetchError;
        }

        console.log('[EventModal] Found', eventsToDelete?.length || 0, 'events to delete:', eventsToDelete);

        if (!eventsToDelete || eventsToDelete.length === 0) {
          throw new Error('No events found to delete in recurring series');
        }

        const { error: deleteError, count } = await supabase
          .from('events')
          .delete({ count: 'exact' })
          .eq('recurring_group_id', event.recurring_group_id)
          .gte('start_time', event.startTime.toISOString());

        if (deleteError) {
          console.error('[EventModal] Error deleting events:', deleteError);
          throw deleteError;
        }

        console.log('[EventModal] Successfully deleted', count, 'events');
      } else {
        console.log('[EventModal] Deleting single event with id:', event.id);
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', event.id);

        if (deleteError) {
          console.error('[EventModal] Error deleting single event:', deleteError);
          throw deleteError;
        }

        console.log('[EventModal] Successfully deleted single event');
      }

      console.log('[EventModal] Delete operation completed successfully');

      setShowRecurringActionModal(false);

      if (onEventUpdated) {
        onEventUpdated();
      }
      onClose();
    } catch (err) {
      console.error('[EventModal] Failed to delete event:', err);

      setShowRecurringActionModal(false);

      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event. Please try again.';
      alert(errorMessage);

      throw err;
    }
  };

  const confirmSingleDelete = async () => {
    try {
      console.log('[EventModal] confirmSingleDelete called for event:', {
        id: event.id,
        profile_id: event.profile_id,
        title: event.title,
        child: event.child,
        isOwnEvent: event.isOwnEvent,
        user_id: event.child.user_id
      });

      const { data: { user } } = await supabase.auth.getUser();
      console.log('[EventModal] Current user:', user?.id);

      const { data, error, count } = await supabase
        .from('events')
        .delete({ count: 'exact' })
        .eq('id', event.id)
        .select();

      console.log('[EventModal] Delete result:', { data, error, count });

      if (error) {
        console.error('[EventModal] Delete error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('[EventModal] No event was deleted. This might indicate an RLS policy issue.');
        throw new Error('Event was not deleted. You may not have permission to delete this event.');
      }

      console.log('[EventModal] Successfully deleted event');
      setShowDeleteConfirm(false);

      if (onEventUpdated) {
        onEventUpdated();
      }
      onClose();
    } catch (err) {
      console.error('[EventModal] Failed to delete event:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event. Please try again.';
      alert(errorMessage);
      setShowDeleteConfirm(false);
    }
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
        // Calendar imported events are read-only
        if (event.calendar_import_id || event.is_read_only) {
          setCanEdit(false);
          return;
        }

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
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // Only close if no child modals are open
      if (!showEditModal && !showMessagesModal && !showShareModal && !showDeleteConfirm && !showRecurringActionModal && modalRef.current && !modalRef.current.contains(e.target as Node)) {
        // Add a small delay to ensure button clicks are processed first
        setTimeout(() => {
          onClose();
        }, 10);
      }
    };

    // Use touchend instead of mousedown for better mobile compatibility
    const eventType = isNative ? 'touchend' : 'mousedown';
    document.addEventListener(eventType, handleClickOutside);
    return () => {
      document.removeEventListener(eventType, handleClickOutside);
    };
  }, [onClose, showEditModal, showMessagesModal, showShareModal, showDeleteConfirm, showRecurringActionModal, isNative]);

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
          bottom: 0,
          zIndex: 200
        } : { zIndex: 200 }}
      >
        <div
          ref={modalRef}
          className={modalContentClasses}
          onClick={(e) => e.stopPropagation()}
          style={{ zIndex: 201 }}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center relative" style={{ zIndex: 202 }}>
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: event.child.color }}
              ></span>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {event.is_cancelled && (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-xs font-bold rounded flex items-center gap-1 flex-shrink-0">
                    <AlertCircle className="h-3 w-3" />
                    CANCELLED
                  </span>
                )}
                <h3 className={`text-xl font-semibold text-gray-900 dark:text-white min-w-0 ${event.is_cancelled ? 'line-through' : ''}`}>
                  {event.title}
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2" style={{ position: 'relative', zIndex: 203 }}>
              {canEdit && (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowEditModal(true);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowEditModal(true);
                    }}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 active:text-blue-500 dark:text-gray-500 dark:active:text-blue-400 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    title="Edit event"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 active:text-red-500 dark:text-gray-500 dark:active:text-red-400 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    title="Delete event"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMessagesModal(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMessagesModal(true);
                }}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 active:text-blue-500 dark:text-gray-500 dark:active:text-blue-400 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                title="View messages"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 active:text-gray-500 dark:text-gray-500 dark:active:text-gray-200 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 active:text-gray-500 dark:text-gray-500 dark:active:text-gray-200 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
                  <div className={`flex items-center text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>
                    <Calendar className="h-5 w-5 mr-3" />
                    <span>
                      {formatDate(event.startTime)}
                    </span>
                  </div>

                  <div className={`flex items-center text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>
                    <Clock className="h-5 w-5 mr-3" />
                    <span>
                      {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </span>
                  </div>

                  <div className={`flex items-center text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>
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

                  {event.is_recurring && (
                    <div className="flex items-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                      <Repeat className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">Recurring Event</span>
                    </div>
                  )}

                  {event.calendar_name && (
                    <div className="flex items-center text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-3 py-2 rounded-lg">
                      <Download className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">Synced from {event.calendar_name}</span>
                    </div>
                  )}
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
                      <div className={`flex items-center text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>
                        <MapPin className="h-5 w-5 mr-3" />
                        <span>{event.location_name}</span>
                      </div>
                      <div className={`flex items-center ml-8 text-sm text-gray-500 dark:text-gray-400 ${event.is_cancelled ? 'line-through' : ''}`}>
                        <span>{event.location}</span>
                      </div>
                    </>
                  ) : (
                    <div className={`flex items-center text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>
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
                  <p className={`text-gray-600 dark:text-gray-300 ${event.is_cancelled ? 'line-through' : ''}`}>{event.description}</p>
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

      {showRecurringActionModal && (
        <RecurringEventActionModal
          isOpen={showRecurringActionModal}
          onClose={() => setShowRecurringActionModal(false)}
          onConfirm={confirmDelete}
          actionType="delete"
          eventCount={recurringEventCount}
        />
      )}

      {showDeleteConfirm && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[220]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Delete Event</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmSingleDelete();
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </ModalPortal>
  );
};

export default EventModal;
