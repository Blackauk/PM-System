import { useState, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { CheckboxOptionRow } from './CheckboxOptionRow';

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

      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
        {filteredOptions.length > 1 && (
          <div className="mb-2 pb-2 border-b border-gray-200">
            <CheckboxOptionRow
              checked={selected.length === filteredOptions.length && filteredOptions.length > 0}
              onChange={handleSelectAll}
              label="Select All"
              className="font-medium"
            />
          </div>
        )}

        {filteredOptions.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <CheckboxOptionRow
              key={option.value}
              checked={isSelected}
              onChange={() => handleToggle(option.value)}
              label={option.label}
              className={
                isSelected
                  ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100 font-medium'
                  : 'border border-transparent'
              }
            />
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
