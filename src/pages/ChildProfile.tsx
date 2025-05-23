import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddEventModal from '../components/events/AddEventModal';
import EventModal from '../components/events/EventModal';
import { Filter, Calendar, LayoutList, Plus, Share2, MapPin, Clock, Pencil, Trash2, AlertTriangle, X, Upload, Users } from 'lucide-react';
import { useProfiles } from '../context/ProfilesContext';
import { Child, Event } from '../types';
import { supabase } from '../lib/supabase';
import TeamMapping from '../components/teams/TeamMapping';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import AgendaView from '../components/calendar/AgendaView';

const ChildProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProfile, deleteProfile, updateProfile } = useProfiles();
  const [child, setChild] = useState<Child | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeamMapping, setShowTeamMapping] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState('month');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    color: '#3B82F6',
    notes: ''
  });

  const colorOptions = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Rose', value: '#F43F5E' }
  ];

  const availableSports = [
    { name: 'Soccer', color: '#10B981' },
    { name: 'Baseball', color: '#F59E0B' },
    { name: 'Basketball', color: '#EF4444' },
    { name: 'Swimming', color: '#3B82F6' },
    { name: 'Tennis', color: '#8B5CF6' },
    { name: 'Volleyball', color: '#EC4899' },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      if (id) {
        try {
          const profile = await getProfile(id);
          setChild(profile);
          setFormData({
            name: profile.name,
            age: profile.age.toString(),
            color: profile.color,
            notes: profile.notes || ''
          });
          setSelectedSports(profile.sports.map(sport => sport.name));
          setPhotoPreview(profile.photo_url || null);

          // Fetch events for this profile
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('profile_id', id)
            .order('start_time', { ascending: true });

          if (eventError) throw eventError;

          const formattedEvents = eventData.map(event => ({
            ...event,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            child: profile,
            platformIcon: Calendar
          }));

          setEvents(formattedEvents);
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [id, getProfile]);

  const handleEventAdded = () => {
    window.location.reload();
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    try {
      if (id) {
        await deleteProfile(id);
        navigate('/profiles');
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !child) return;

    try {
      let photoUrl = child.photo_url;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      await updateProfile(id, {
        name: formData.name,
        age: parseInt(formData.age),
        color: formData.color,
        notes: formData.notes,
        photo_url: photoUrl,
        sports: selectedSports.map(sport => {
          const sportData = availableSports.find(s => s.name === sport);
          return {
            name: sport,
            color: sportData?.color || '#000000'
          };
        })
      });

      // Refresh the profile data
      const updatedProfile = await getProfile(id);
      setChild(updatedProfile);
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const renderCalendarView = () => {
    switch (view) {
      case 'month':
        return <MonthView currentDate={currentDate} events={events} />;
      case 'week':
        return <WeekView currentDate={currentDate} events={events} />;
      case 'day':
        return <DayView currentDate={currentDate} events={events} />;
      case 'agenda':
        return <AgendaView currentDate={currentDate} events={events} />;
      default:
        return <MonthView currentDate={currentDate} events={events} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Profile not found</p>
      </div>
    );
  }

  const upcomingEvents = events
    .filter(event => event.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center">
              {child.photo_url ? (
                <img 
                  src={child.photo_url} 
                  alt={child.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center text-white text-3xl font-bold"
                  style={{ backgroundColor: child.color }}
                >
                  {child.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{child.name}</h1>
              <div className="flex items-center mt-2 space-x-2">
                {child.sports.map((sport, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ 
                      backgroundColor: sport.color + '20',
                      color: sport.color
                    }}
                  >
                    {sport.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTeamMapping(true)}
              className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Map teams"
            >
              <Users className="h-5 w-5" />
            </button>
            <button
              onClick={handleEdit}
              className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Edit profile"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Delete profile"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Upcoming Events</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents.map((event) => (
            <div 
              key={event.id} 
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: event.color }}
                    ></span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{event.sport}</span>
                  </div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mt-1">{event.title}</h3>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4 mr-1" />
                      {event.startTime.toLocaleString()} - {event.endTime.toLocaleTimeString()}
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="h-4 w-4 mr-1" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Share functionality
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {upcomingEvents.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">No upcoming events</p>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </button>
              <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-1 flex">
                <button
                  onClick={() => setView('month')}
                  className={`p-1 rounded ${
                    view === 'month' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title="Month view"
                >
                  <Calendar className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setView('agenda')}
                  className={`p-1 rounded ${
                    view === 'agenda' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title="List view"
                >
                  <LayoutList className="h-5 w-5" />
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowAddEventModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Event
            </button>
          </div>
        </div>
        
        <div className="h-[600px] overflow-auto">
          {renderCalendarView()}
        </div>
      </div>

      {/* Modals */}
      {showAddEventModal && (
        <AddEventModal
          profileId={child.id}
          onClose={() => setShowAddEventModal(false)}
          onEventAdded={handleEventAdded}
          sports={child.sports}
        />
      )}

      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-center text-gray-900 dark:text-white mb-2">Delete Profile</h3>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete {child.name}'s profile? This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <form onSubmit={handleEditSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Profile</h3>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="h-32 w-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                        {photoPreview ? (
                          <img 
                            src={photoPreview} 
                            alt="Preview" 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      <label
                        htmlFor="photo"
                        className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <Plus className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        <input 
                          type="file" 
                          id="photo" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                      Click to upload photo
                    </p>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter child's name"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        required
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Age
                      </label>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        value={formData.age}
                        onChange={handleInputChange}
                        min="1"
                        max="18"
                        placeholder="Enter age"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        required
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Profile Color
                      </label>
                      <div className="relative mt-1">
                        <select
                          id="color"
                          name="color"
                          value={formData.color}
                          onChange={handleInputChange}
                          className="block w-full pl-8 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
                        >
                          {colorOptions.map(color => (
                            <option key={color.value} value={color.value} className="flex items-center">
                              {color.name}
                            </option>
                          ))}
                        </select>
                        <div 
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full pointer-events-none"
                          style={{ backgroundColor: formData.color }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sports & Activities
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableSports.map((sport) => (
                      <label
                        key={sport.name}
                        className={`flex items-center p-3 rounded-lg border dark:border-gray-600 cursor-pointer transition-colors ${
                          selectedSports.includes(sport.name)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50'
                            : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedSports.includes(sport.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSports([...selectedSports, sport.name]);
                            } else {
                              setSelectedSports(selectedSports.filter((s) => s !== sport.name));
                            }
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: sport.color }}
                        ></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{sport.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Additional Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Enter any important information about your child..."
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeamMapping && (
        <TeamMapping
          profileId={child.id}
          onClose={() => setShowTeamMapping(false)}
        />
      )}
    </div>
  );
};

export default ChildProfile;