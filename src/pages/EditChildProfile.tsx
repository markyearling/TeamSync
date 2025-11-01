import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Plus } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useProfiles } from '../context/ProfilesContext';
import { Child } from '../types';
import { supabase } from '../lib/supabase';
import { availableSports, getSportDetails } from '../utils/sports';
import { useCapacitor } from '../hooks/useCapacitor';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import ImageCropModal from '../components/ImageCropModal';

const EditChildProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProfile, updateProfile } = useProfiles();
  const { isNative } = useCapacitor();
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (id) {
        try {
          const profile = await getProfile(id);
          setChild(profile);
          setFormData({
            name: profile.name,
            date_of_birth: profile.date_of_birth || '',
            color: profile.color,
            notes: profile.notes || ''
          });
          setSelectedSports(profile.sports.map(sport => sport.name));
          setPhotoPreview(profile.photo_url || null);
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [id, getProfile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob);
    const previewUrl = URL.createObjectURL(blob);
    setPhotoPreview(previewUrl);
    setShowCropModal(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!id || !child) return;

    setSaving(true);

    try {
      if (isNative) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }

      let photoUrl = child.photo_url;
      if (croppedBlob) {
        const fileExt = 'jpg';
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, croppedBlob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
      }

      await updateProfile(id, {
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
        })
      });

      if (isNative) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }

      navigate(`/profiles/${id}`);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/profiles/${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Profile not found</p>
      </div>
    );
  }

  const isFriendProfile = !child.isOwnProfile;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6 mr-1" />
            <span className="font-medium">Cancel</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Profile
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 py-6 space-y-6">
          {isFriendProfile && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Editing {child.ownerName}'s child profile
              </p>
            </div>
          )}

          <div className="flex justify-center">
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
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter child's name"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              id="date_of_birth"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Optional - used to calculate age and add birthday reminders
            </p>
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile Color
            </label>
            <div className="relative">
              <select
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                {colorOptions.map(color => (
                  <option key={color.value} value={color.value}>
                    {color.name}
                  </option>
                ))}
              </select>
              <div
                className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full pointer-events-none border-2 border-white dark:border-gray-600"
                style={{ backgroundColor: formData.color }}
              ></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Sports & Activities
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableSports.map((sport) => (
                <label
                  key={sport.name}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSports.includes(sport.name)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700'
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
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: sport.color }}
                  ></span>
                  <FontAwesomeIcon
                    icon={sport.icon}
                    className="h-3 w-3 mr-1 flex-shrink-0"
                    style={{ color: sport.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{sport.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              placeholder="Enter any important information about your child..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>
        </div>
      </div>

      {showCropModal && imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
};

export default EditChildProfile;
