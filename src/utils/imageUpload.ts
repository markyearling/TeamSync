import { supabase } from '../lib/supabase';

interface UploadImageResult {
  url: string | null;
  error: string | null;
}

export const compressImage = async (
  dataUrl: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export const uploadEventMessageImage = async (
  dataUrl: string,
  eventId: string,
  messageId: string
): Promise<UploadImageResult> => {
  try {
    const compressedDataUrl = await compressImage(dataUrl);
    const blob = dataUrlToBlob(compressedDataUrl);

    const fileExtension = 'jpg';
    const fileName = `${Date.now()}.${fileExtension}`;
    const filePath = `${eventId}/${messageId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-message-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from('event-message-images')
      .getPublicUrl(uploadData.path);

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to upload image'
    };
  }
};

export const uploadEventMessageImageFromFile = async (
  file: File,
  eventId: string,
  messageId: string
): Promise<UploadImageResult> => {
  try {
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: 'Image size must be less than 5MB' };
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { url: null, error: 'Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed' };
    }

    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const result = await uploadEventMessageImage(dataUrl, eventId, messageId);
        resolve(result);
      };
      reader.onerror = () => {
        resolve({ url: null, error: 'Failed to read image file' });
      };
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Error processing image file:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to process image'
    };
  }
};

export const deleteEventMessageImage = async (imageUrl: string): Promise<boolean> => {
  try {
    const urlParts = imageUrl.split('/event-message-images/');
    if (urlParts.length < 2) {
      console.error('Invalid image URL format');
      return false;
    }

    const filePath = urlParts[1].split('?')[0];

    const { error } = await supabase.storage
      .from('event-message-images')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteEventMessageImage:', error);
    return false;
  }
};
