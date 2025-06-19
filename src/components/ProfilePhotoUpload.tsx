import React, { useRef, useState, useEffect } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useCapacitor } from '../hooks/useCapacitor';
import MobilePhotoUpload from './mobile/MobilePhotoUpload';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (file: File | string) => void;
}

const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({ currentPhotoUrl, onPhotoChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentPhotoUrl || undefined);
  const { isNative } = useCapacitor();

  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || undefined);
  }, [currentPhotoUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      onPhotoChange(file);
    }
  };

  const handleMobilePhotoChange = (fileOrDataUrl: File | string) => {
    if (typeof fileOrDataUrl === 'string') {
      setPreviewUrl(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
    onPhotoChange(fileOrDataUrl);
  };

  // Use mobile component for native apps
  if (isNative) {
    return (
      <MobilePhotoUpload 
        currentPhotoUrl={previewUrl}
        onPhotoChange={handleMobilePhotoChange}
      />
    );
  }

  // Web version
  return (
    <div className="relative">
      <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {previewUrl ? (
          <img
            src={previewUrl}
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
        <Plus className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        <input
          ref={fileInputRef}
          id="photo-upload"
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </label>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        Click to upload photo
      </p>
    </div>
  );
};

export default ProfilePhotoUpload;