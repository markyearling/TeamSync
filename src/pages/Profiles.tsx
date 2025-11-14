import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Upload, ShieldCheck, Eye, Users, ChevronRight } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';
import { availableSports, getSportDetails } from '../utils/sports';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';

const Profiles: React.FC = () => {
  const navigate = useNavigate();
  const { profiles, friendsProfiles, addProfile, loading, error } = useProfiles();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
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

  // Combine all profiles (own and friends' with admin access)
  const allProfiles = [
    ...profiles.map(p => ({ ...p, isOwnProfile: true })),
    ...friendsProfiles.map(p => ({ ...p, isOwnProfile: false }))
  ];

  const handlePhotoChange = (fileOrBlob: File | Blob | string) => {
    if (fileOrBlob instanceof Blob) {
      setPhotoFile(fileOrBlob);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(fileOrBlob);
    } else if (typeof fileOrBlob === 'string') {
      setPhotoPreview(fileOrBlob);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let photoUrl = null;
      if (photoFile) {
        const fileExt = photoFile instanceof File ? photoFile.name.split('.').pop() : 'jpg';
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, photoFile, {
            contentType: photoFile instanceof Blob ? 'image/jpeg' : undefined,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      await addProfile({
        name: formData.name,
        date_of_birth: formData.date_of_birth || null,
        color: formData.color,
        notes: formData.notes,
        photo_url: photoUrl,
        sports: selectedSports.map(sport => {
          const sportData = getSportDetails(sport);
          return {
            name: sport,
            color: sportData.color
          };
        }),
        eventCount: 0,
        isOwnProfile: true
      });

      setShowAddForm(false);
      setFormData({
        name: '',
        date_of_birth: '',
        color: '#3B82F6',
        notes: ''
      });
      setSelectedSports([]);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      console.error('Failed to add profile:', err);
    }
  };

  const handleViewProfile = (childId: string) => {
    navigate(`/profiles/${childId}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 dark:text-red-400">
        <p>Error loading profiles: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profiles</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Profile
        </button>
      </div>

      {/* Combined Children Profiles */}
      {allProfiles.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Your Profiles {friendsProfiles.length > 0 && `& Administrator Access (${friendsProfiles.length})`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allProfiles.map(child => (
              <div
                key={child.id}
                onClick={() => handleViewProfile(child.id)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-4">
                  {/* Photo and Access Icon */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center shadow-sm">
                        {child.photo_url ? (
                          <img
                            src={child.photo_url}
                            alt={child.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full flex items-center justify-center text-white text-2xl font-bold"
                            style={{ backgroundColor: child.color }}
                          >
                            {child.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Access Role Icon */}
                    {!child.isOwnProfile && (
                      <div className="flex-shrink-0" title={child.accessRole === 'administrator' ? 'Administrator' : child.accessRole === 'viewer' ? 'Viewer' : 'Friend'}>
                        {child.accessRole === 'administrator' ? (
                          <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                            <ShieldCheck className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                        ) : child.accessRole === 'viewer' ? (
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                            <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        ) : (
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                            <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Name and Owner */}
                  <div className="mb-3">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {child.name}
                    </h3>
                    {!child.isOwnProfile && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {child.ownerName}'s profile
                      </p>
                    )}
                  </div>

                  {/* Sports Badges */}
                  {child.sports.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {child.sports.slice(0, 3).map((sport, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 rounded-md text-xs font-medium"
                          style={{
                            backgroundColor: sport.color + '15',
                            color: sport.color
                          }}
                        >
                          {sport.name}
                        </span>
                      ))}
                      {child.sports.length > 3 && (
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          +{child.sports.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Event Count and Arrow */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{child.eventCount} events this week</span>
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {allProfiles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-600 mb-4">
            <Plus className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No profiles yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Get started by adding your first child's profile or connect with friends who have granted you administrator access
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
          >
            Add Your First Child
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Profile</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0">
                    <ProfilePhotoUpload
                      currentPhotoUrl={photoPreview}
                      onPhotoChange={handlePhotoChange}
                    />
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
                        placeholder="Enter profile's name"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        required
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        id="date_of_birth"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleInputChange}
                        placeholder="Select date of birth"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        autoComplete="off"
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Optional - used to calculate age and add birthday reminders
                      </p>
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
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                        <FontAwesomeIcon 
                          icon={sport.icon} 
                          className="h-3 w-3 mr-1"
                          style={{ color: sport.color }}
                        />
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
                    placeholder="Enter any important information about your profile..."
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  Add Child
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profiles;