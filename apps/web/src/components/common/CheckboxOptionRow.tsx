import { Checkbox } from './Checkbox';

interface CheckboxOptionRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count?: number;
  className?: string;
}

/**
 * A single-line checkbox option row for filter panels.
 * Ensures checkbox and label are always on one line with proper truncation.
 */
export function CheckboxOptionRow({
  checked,
  onChange,
  label,
  count,
  className = '',
}: CheckboxOptionRowProps) {
  return (
    <label
      className={`flex items-center gap-2.5 px-2 py-2 rounded cursor-pointer text-sm min-h-[40px] hover:bg-gray-50 transition-colors ${className}`}
      title={label} // Show full label on hover
    >
      <div className="flex-shrink-0">
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      <span className="flex-1 min-w-0 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </span>
      {count !== undefined && (
        <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </label>
  );
}


