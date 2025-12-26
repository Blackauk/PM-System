import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">{children}</table>
    </div>
  );
}

interface TableHeaderProps {
  children: ReactNode;
}

export function TableHeader({ children }: TableHeaderProps) {
  return <thead className="bg-gray-50">{children}</thead>;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TableRow({ children, className = '', onClick, onMouseEnter, onMouseLeave }: TableRowProps) {
  return (
    <tr
      className={`border-b border-gray-200 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </tr>
  );
}

interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableHeaderCell({ children, className = '', ...props }: TableHeaderCellProps) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </th>
  );
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({ children, className = '', ...props }: TableCellProps) {
  return <td className={`px-6 py-4 text-sm text-gray-900 ${className}`} {...props}>{children}</td>;
}
