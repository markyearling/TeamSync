import React, { useState, useCallback, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCw } from 'lucide-react';
import { useCapacitor } from '../hooks/useCapacitor';

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onClose: () => void;
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  onCropComplete,
  onClose
}) => {
  const { isNative } = useCapacitor();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropSize = Math.min(width, height) * 0.9;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;

    setCrop({
      unit: 'px',
      width: cropSize,
      height: cropSize,
      x,
      y
    });
  }, []);

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    if (!completedCrop || !imgRef.current) {
      return null;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const outputSize = 1024;
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.imageSmoothingQuality = 'high';

    const sourceX = completedCrop.x * scaleX;
    const sourceY = completedCrop.y * scaleY;
    const sourceWidth = completedCrop.width * scaleX;
    const sourceHeight = completedCrop.height * scaleY;

    if (rotation !== 0) {
      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-outputSize / 2, -outputSize / 2);
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputSize,
      outputSize
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.92
      );
    });
  }, [completedCrop, rotation]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        onCropComplete(croppedBlob);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="p-2 text-white hover:bg-gray-800 rounded-lg disabled:opacity-50"
        >
          <X className="h-6 w-6" />
        </button>
        <h3 className="text-lg font-semibold text-white">Crop Photo</h3>
        <button
          onClick={handleSave}
          disabled={isProcessing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Check className="h-5 w-5 mr-1" />
              {isNative ? 'Save' : 'Apply'}
            </>
          )}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="relative max-w-full max-h-full">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
            className="max-w-full max-h-[70vh]"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease'
              }}
            />
          </ReactCrop>
        </div>
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-700">
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleRotate}
            disabled={isProcessing}
            className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            <RotateCw className="h-5 w-5 mr-2" />
            Rotate
          </button>
        </div>
        <p className="text-center text-sm text-gray-400 mt-3">
          {isNative ? 'Pinch to zoom, drag to adjust position' : 'Drag to adjust crop area'}
        </p>
      </div>
    </div>
  );
};

export default ImageCropModal;
