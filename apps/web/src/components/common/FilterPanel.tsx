import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function FilterPanel({
  isOpen,
  onClose,
  onApply,
  onReset,
  title = 'Filters',
  children,
  className = '',
}: FilterPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - dimmed background (optional, non-blocking) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-20 z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${className}`}
      >
        <Card className="h-full rounded-none border-0 shadow-none flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 pr-4">
            {children}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 p-6 border-t border-gray-200 bg-gray-50">
            <Button variant="outline" onClick={onReset} className="flex-1">
              Reset
            </Button>
            <Button variant="primary" onClick={onApply} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
