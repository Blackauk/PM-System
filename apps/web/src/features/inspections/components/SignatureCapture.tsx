import { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';

interface SignatureCaptureProps {
  value?: {
    signatureData?: string;
    signatureName?: string;
    signatureTimestamp?: string;
  };
  onChange: (data: {
    signatureData: string;
    signatureName: string;
    signatureTimestamp: string;
  }) => void;
  required?: boolean;
  error?: string;
}

export function SignatureCapture({ value, onChange, required, error }: SignatureCaptureProps) {
  const [signatureName, setSignatureName] = useState(value?.signatureName || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [useTypedSignature, setUseTypedSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(!!value?.signatureData);

  // Check if device is mobile/tablet
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;

  useEffect(() => {
    if (value?.signatureData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = value.signatureData;
      }
    }
  }, [value?.signatureData]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (useTypedSignature) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || useTypedSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange({
      signatureData: '',
      signatureName: signatureName,
      signatureTimestamp: '',
    });
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setHasSignature(dataUrl !== canvas.toDataURL('image/png', 0.01)); // Check if canvas has content
    
    if (signatureName.trim()) {
      onChange({
        signatureData: dataUrl,
        signatureName: signatureName.trim(),
        signatureTimestamp: new Date().toISOString(),
      });
    }
  };

  const handleTypedSignature = () => {
    if (signatureName.trim()) {
      // For typed signatures, we'll create a simple text-based representation
      // In a real app, you might want to render this as styled text
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = '24px Arial';
          ctx.fillStyle = '#000';
          ctx.textAlign = 'center';
          ctx.fillText(signatureName.trim(), canvas.width / 2, canvas.height / 2);
        }
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      setHasSignature(true);
      onChange({
        signatureData: dataUrl,
        signatureName: signatureName.trim(),
        signatureTimestamp: new Date().toISOString(),
      });
    }
  };

  // On mobile, prefer canvas; on desktop, allow typed fallback
  const shouldShowTypedOption = !isMobile;

  return (
    <div className="space-y-3">
      <Input
        label="Signer Name"
        value={signatureName}
        onChange={(e) => {
          setSignatureName(e.target.value);
          if (useTypedSignature && e.target.value.trim()) {
            handleTypedSignature();
          }
        }}
        placeholder="Enter your full name"
        required={required}
        error={error && !signatureName ? error : undefined}
      />

      {shouldShowTypedOption && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-typed-sig"
            checked={useTypedSignature}
            onChange={(e) => {
              setUseTypedSignature(e.target.checked);
              if (e.target.checked) {
                clearSignature();
              }
            }}
          />
          <label htmlFor="use-typed-sig" className="text-sm text-gray-700 cursor-pointer">
            Use typed signature (desktop fallback)
          </label>
        </div>
      )}

      {!useTypedSignature && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {isMobile ? 'Draw signature (touch)' : 'Draw signature (click and drag)'}
          </label>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full h-48 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ touchAction: 'none' }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearSignature}
            >
              Clear
            </Button>
            {!isMobile && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUseTypedSignature(true)}
              >
                Switch to Typed
              </Button>
            )}
          </div>
        </div>
      )}

      {useTypedSignature && (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={handleTypedSignature}
            disabled={!signatureName.trim()}
          >
            Confirm Typed Signature
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setUseTypedSignature(false);
              clearSignature();
            }}
          >
            Switch to Drawing
          </Button>
        </div>
      )}

      {hasSignature && value?.signatureData && (
        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
          <div className="text-xs text-gray-600">
            Signature captured
            {value.signatureTimestamp && (
              <span className="ml-2">
                at {new Date(value.signatureTimestamp).toLocaleString()}
              </span>
            )}
          </div>
          {value.signatureData && (
            <img
              src={value.signatureData}
              alt="Signature preview"
              className="mt-2 max-w-full h-20 object-contain border border-gray-300 rounded"
            />
          )}
        </div>
      )}

      {error && signatureName && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}


