import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Upload } from 'lucide-react';
import { useProfiles } from '../context/ProfilesContext';
import { supabase } from '../lib/supabase';

const Profiles: React.FC = () => {
  const navigate = useNavigate();
  const { profiles, addProfile, loading, error } = useProfiles();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let photoUrl = null;
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

      await addProfile({
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
        }),
        eventCount: 0
      });

      setShowAddForm(false);
      setFormData({
        name: '',
        age: '',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>Error loading profiles: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Children Profiles</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Child
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map(child => (
          <div key={child.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center">
                  {child.photo_url ? (
                    <img 
                      src={child.photo_url} 
                      alt={child.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: child.color }}
                    >
                      {child.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{child.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Age: {child.age}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sports</h4>
                  <div className="flex flex-wrap gap-2">
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

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity Summary</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>{child.eventCount} events this week</p>
                  </div>
                </div>

                <button
                  onClick={() => handleViewProfile(child.id)}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  View Profile
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Child</h3>
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
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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