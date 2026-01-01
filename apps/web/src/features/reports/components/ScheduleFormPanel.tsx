import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card } from '../../../components/common/Card';

interface ScheduleFormPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
}

export function ScheduleFormPanel({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = '',
}: ScheduleFormPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[700px] bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
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
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>

          {/* Footer */}
          {footer}
        </Card>
      </div>
    </>
  );
}


