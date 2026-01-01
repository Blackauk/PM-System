import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { Badge } from './Badge';
import { Button } from './Button';

export interface AssetOption {
  id: string;
  label: string;
  typeCode?: string;
  make?: string;
  model?: string;
  siteName?: string;
}

interface SearchableMultiSelectAssetPickerProps {
  assets: AssetOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  allowMultiple?: boolean; // If false, behaves as single-select
  disabled?: boolean;
  className?: string;
}

export function SearchableMultiSelectAssetPicker({
  assets,
  selected,
  onChange,
  placeholder = 'Search and select assets...',
  label,
  error,
  required = false,
  allowMultiple = true,
  disabled = false,
  className = '',
}: SearchableMultiSelectAssetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter assets based on search
  const filteredAssets = useMemo(() => {
    if (!debouncedSearch.trim()) return assets;

    const searchLower = debouncedSearch.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.id.toLowerCase().includes(searchLower) ||
        asset.label.toLowerCase().includes(searchLower) ||
        asset.typeCode?.toLowerCase().includes(searchLower) ||
        asset.make?.toLowerCase().includes(searchLower) ||
        asset.model?.toLowerCase().includes(searchLower) ||
        asset.siteName?.toLowerCase().includes(searchLower)
    );
  }, [assets, debouncedSearch]);

  // Get selected asset objects
  const selectedAssets = useMemo(() => {
    return assets.filter((asset) => selected.includes(asset.id));
  }, [assets, selected]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle toggle
  const handleToggle = useCallback(
    (assetId: string) => {
      if (allowMultiple) {
        if (selected.includes(assetId)) {
          onChange(selected.filter((id) => id !== assetId));
        } else {
          onChange([...selected, assetId]);
        }
      } else {
        // Single select
        onChange(selected.includes(assetId) ? [] : [assetId]);
        setIsOpen(false);
        setSearch('');
      }
    },
    [selected, onChange, allowMultiple]
  );

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selected.length === filteredAssets.length && filteredAssets.length > 0) {
      // Deselect all filtered
      onChange(selected.filter((id) => !filteredAssets.some((a) => a.id === id)));
    } else {
      // Select all filtered (preserve other selections)
      const newSelected = [...selected];
      filteredAssets.forEach((asset) => {
        if (!newSelected.includes(asset.id)) {
          newSelected.push(asset.id);
        }
      });
      onChange(newSelected);
    }
  }, [selected, filteredAssets, onChange]);

  // Handle remove chip
  const handleRemoveChip = useCallback(
    (assetId: string) => {
      onChange(selected.filter((id) => id !== assetId));
    },
    [selected, onChange]
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const allFilteredSelected =
    filteredAssets.length > 0 && filteredAssets.every((asset) => selected.includes(asset.id));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}

      {/* Input/Trigger */}
      <div
        className={`relative min-h-[40px] border rounded-lg bg-white cursor-text ${
          error
            ? 'border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200'
            : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-60' : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {selectedAssets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 p-2">
            {selectedAssets.map((asset) => (
              <Badge
                key={asset.id}
                variant="info"
                size="sm"
                className="flex items-center gap-1 pr-1"
              >
                <span className="truncate max-w-[120px]">{asset.id}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveChip(asset.id);
                    }}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
            {allowMultiple && selectedAssets.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Clear All
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center px-3 py-2 text-gray-500 text-sm">
            {placeholder}
          </div>
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search by ID, type, make, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Select All / Clear All */}
            {allowMultiple && filteredAssets.length > 0 && (
              <div className="px-2 py-1.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-gray-600 hover:text-gray-700"
                  >
                    Clear All ({selected.length})
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto max-h-64 pr-1">
              {filteredAssets.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No assets found
                </div>
              ) : (
                <div className="py-1">
                  {filteredAssets.map((asset) => {
                    const isSelected = selected.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggle(asset.id)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{asset.id}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {[asset.typeCode, asset.make, asset.model, asset.siteName]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {selected.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                {selected.length} asset{selected.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}


