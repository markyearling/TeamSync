import React, { useState } from 'react';
import { Camera, Upload, Image } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useCapacitor } from '../../hooks/useCapacitor';

interface MobilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (file: File | string) => void;
}

const MobilePhotoUpload: React.FC<MobilePhotoUploadProps> = ({ 
  currentPhotoUrl, 
  onPhotoChange 
}) => {
  const { takePhoto, selectFromGallery, isLoading } = useCamera();
  const { isNative } = useCapacitor();
  const [showOptions, setShowOptions] = useState(false);

  const handleTakePhoto = async () => {
    const photoDataUrl = await takePhoto();
    if (photoDataUrl) {
      onPhotoChange(photoDataUrl);
    }
    setShowOptions(false);
  };

  const handleSelectFromGallery = async () => {
    const photoDataUrl = await selectFromGallery();
    if (photoDataUrl) {
      onPhotoChange(photoDataUrl);
    }
    setShowOptions(false);
  };

  const handleWebUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onPhotoChange(file);
    }
  };

  if (!isNative) {
    // Web fallback
    return (
      <div className="relative">
        <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
              <Upload className="h-8 w-8" />
            </div>
          )}
        </div>
        <label
          htmlFor="photo-upload"
          className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          <Camera className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          <input
            id="photo-upload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleWebUpload}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {currentPhotoUrl ? (
          <img
            src={typeof currentPhotoUrl === 'string' && currentPhotoUrl.startsWith('data:') 
              ? currentPhotoUrl 
              : currentPhotoUrl}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <Upload className="h-8 w-8" />
          </div>
        )}
      </div>
      
      <button
        onClick={() => setShowOptions(true)}
        disabled={isLoading}
        className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-2 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
        ) : (
          <Camera className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {showOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center">
              Choose Photo
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={handleTakePhoto}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Camera className="h-5 w-5 mr-2" />
                Take Photo
              </button>
              
              <button
                onClick={handleSelectFromGallery}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Image className="h-5 w-5 mr-2" />
                Choose from Gallery
              </button>
              
              <button
                onClick={() => setShowOptions(false)}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePhotoUpload;