import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface FilterSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function FilterSection({ 
  title, 
  children, 
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggle: controlledToggle,
}: FilterSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  
  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const handleToggle = controlledToggle || (() => setInternalExpanded(!internalExpanded));

  return (
    <div className="border-b border-app last:border-0 pb-4 last:pb-0">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between py-2.5 text-sm font-semibold text-app hover:text-muted transition-colors"
      >
        <span>{title}</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-icon flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-icon flex-shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div className="pt-3 pl-1">
          {children}
        </div>
      )}
    </div>
  );
}

