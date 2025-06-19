import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export const useCamera = () => {
  const [isLoading, setIsLoading] = useState(false);

  const takePhoto = async (): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to web file input
      return null;
    }

    setIsLoading(true);
    try {
      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Allows user to choose camera or gallery
        width: 300,
        height: 300
      });

      return photo.dataUrl || null;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const selectFromGallery = async (): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    setIsLoading(true);
    try {
      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 300,
        height: 300
      });

      return photo.dataUrl || null;
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    takePhoto,
    selectFromGallery,
    isLoading
  };
};