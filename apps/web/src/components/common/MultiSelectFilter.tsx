import { useState, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Checkbox } from './Checkbox';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
  placeholder?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  searchable = false,
  placeholder = 'Search...',
}: MultiSelectFilterProps) {
  const [search, setSearch] = useState('');

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === filteredOptions.length) {
      onChange([]);
    } else {
      onChange(filteredOptions.map((opt) => opt.value));
    }
  };

  return (
    <div className="space-y-2">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="max-h-48 overflow-y-auto space-y-1">
        {filteredOptions.length > 1 && (
          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm">
            <Checkbox
              checked={selected.length === filteredOptions.length && filteredOptions.length > 0}
              onChange={handleSelectAll}
            />
            <span className="font-medium text-gray-700">Select All</span>
          </label>
        )}

        {filteredOptions.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                isSelected
                  ? 'bg-white border border-blue-500 hover:bg-blue-50'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggle(option.value)}
              />
              <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                {option.label}
              </span>
            </label>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="text-sm text-gray-500 px-2 py-4 text-center">No options found</div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {selected.length} selected
          </div>
        </div>
      )}
    </div>
  );
}
