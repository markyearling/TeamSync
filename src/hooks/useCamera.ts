import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export const useCamera = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async (): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to web file input
      return null;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Attempting to take photo with Camera.getPhoto');
      
      // Check if camera permission is granted
      if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
        const { camera } = await Camera.checkPermissions();
        console.log('Camera permission status:', camera);
        
        if (camera !== 'granted') {
          console.log('Requesting camera permission');
          const permissionResult = await Camera.requestPermissions();
          console.log('Camera permission request result:', permissionResult);
          
          if (permissionResult.camera !== 'granted') {
            throw new Error('Camera permission not granted');
          }
        }
      }
      
      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera, // Specifically use the camera
        width: 300,
        height: 300,
        correctOrientation: true
      });

      console.log('Photo taken successfully:', photo.dataUrl ? 'Has dataUrl' : 'No dataUrl');
      return photo.dataUrl || null;
    } catch (error) {
      console.error('Error taking photo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error taking photo';
      setError(errorMessage);
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
    setError(null);
    
    try {
      console.log('Attempting to select photo from gallery');
      
      // Check if photos permission is granted
      if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
        const { photos } = await Camera.checkPermissions();
        console.log('Photos permission status:', photos);
        
        if (photos !== 'granted') {
          console.log('Requesting photos permission');
          const permissionResult = await Camera.requestPermissions({
            permissions: ['photos']
          });
          console.log('Photos permission request result:', permissionResult);
          
          if (permissionResult.photos !== 'granted') {
            throw new Error('Photos permission not granted');
          }
        }
      }
      
      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos, // Specifically use the photo library
        width: 300,
        height: 300,
        correctOrientation: true
      });

      console.log('Photo selected successfully:', photo.dataUrl ? 'Has dataUrl' : 'No dataUrl');
      return photo.dataUrl || null;
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error selecting photo';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    takePhoto,
    selectFromGallery,
    isLoading,
    error
  };
};