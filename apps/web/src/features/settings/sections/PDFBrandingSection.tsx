import { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Checkbox } from '../../../components/common/Checkbox';
import { showToast } from '../../../components/common/Toast';
import { Upload } from 'lucide-react';

interface PDFBrandingSettings {
  showBanner: boolean;
  bannerLayout: 'three-column' | 'single-column';
  bannerLeft: {
    image?: string; // base64 or URL
    text?: string;
  };
  bannerCenter: {
    image?: string;
    text?: string;
  };
  bannerRight: {
    image?: string;
    text?: string;
  };
  bannerSingle: {
    image?: string;
    text?: string;
  };
}

const defaultSettings: PDFBrandingSettings = {
  showBanner: true,
  bannerLayout: 'three-column',
  bannerLeft: {},
  bannerCenter: {},
  bannerRight: {},
  bannerSingle: {},
};

export function PDFBrandingSection() {
  const [settings, setSettings] = useState<PDFBrandingSettings>(defaultSettings);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pdf-branding-settings');
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to load PDF branding settings:', e);
      }
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('pdf-branding-settings', JSON.stringify(settings));
      showToast('PDF branding settings saved', 'success');
    } catch (e) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleImageUpload = (slot: 'bannerLeft' | 'bannerCenter' | 'bannerRight' | 'bannerSingle') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSettings((prev) => ({
          ...prev,
          [slot]: {
            ...prev[slot],
            image: base64,
          },
        }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleRemoveImage = (slot: 'bannerLeft' | 'bannerCenter' | 'bannerRight' | 'bannerSingle') => {
    setSettings((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        image: undefined,
      },
    }));
  };

  const renderBannerSlot = (
    slot: 'bannerLeft' | 'bannerCenter' | 'bannerRight' | 'bannerSingle',
    label: string
  ) => {
    const slotData = settings[slot];
    const hasImage = !!slotData.image;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {hasImage ? (
          <div className="relative">
            <img
              src={slotData.image}
              alt={label}
              className="w-full h-24 object-contain border border-gray-300 rounded bg-gray-50"
            />
            <button
              onClick={() => handleRemoveImage(slot)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded p-1 text-xs hover:bg-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleImageUpload(slot)}
            className="w-full h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center gap-2 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm">Upload Image</span>
          </button>
        )}
        <Input
          type="text"
          placeholder="Or enter text (used if no image)"
          value={slotData.text || ''}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              [slot]: {
                ...prev[slot],
                text: e.target.value,
              },
            }))
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">PDF Branding</h2>
              <p className="text-sm text-gray-500 mt-1">
                Configure the banner and branding for inspection report PDFs
              </p>
            </div>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>

          <div className="space-y-6">
            {/* Show Banner Toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={settings.showBanner}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, showBanner: e.target.checked }))
                }
              />
              <label className="text-sm font-medium text-gray-700">Show banner on PDFs</label>
            </div>

            {settings.showBanner && (
              <>
                {/* Banner Layout */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Layout
                  </label>
                  <Select
                    options={[
                      { value: 'three-column', label: 'Three-column' },
                      { value: 'single-column', label: 'Single-column' },
                    ]}
                    value={settings.bannerLayout}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        bannerLayout: e.target.value as 'three-column' | 'single-column',
                      }))
                    }
                  />
                </div>

                {/* Banner Slots */}
                {settings.bannerLayout === 'three-column' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderBannerSlot('bannerLeft', 'Left Column')}
                    {renderBannerSlot('bannerCenter', 'Center Column')}
                    {renderBannerSlot('bannerRight', 'Right Column')}
                  </div>
                ) : (
                  <div>{renderBannerSlot('bannerSingle', 'Banner')}</div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Export function to get settings (for PDF generator)
export function getPDFBrandingSettings(): PDFBrandingSettings {
  const saved = localStorage.getItem('pdf-branding-settings');
  if (saved) {
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load PDF branding settings:', e);
    }
  }
  return defaultSettings;
}

