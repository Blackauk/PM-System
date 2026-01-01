import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/common/Card';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SortableTable } from '../../../components/common/SortableTable';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { FilterSection } from '../../../components/common/FilterSection';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { FilterButton } from '../../../components/common/FilterButton';
import { getChecklists } from '../services';
import type { Checklist } from '../types';

export function ChecklistsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ category?: string[]; isActive?: boolean }>({});
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempFilters, setTempFilters] = useState<{ category?: string[]; isActive?: boolean }>({});

  const checklists = getChecklists();

  const filteredChecklists = useMemo(() => {
    let filtered = [...checklists];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.category?.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.category && filters.category.length > 0) {
      filtered = filtered.filter((c) => c.category && filters.category!.includes(c.category));
    }

    if (filters.isActive !== undefined) {
      filtered = filtered.filter((c) => c.isActive === filters.isActive);
    }

    return filtered;
  }, [checklists, search, filters]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Checklist Name',
        sortable: true,
        render: (_: any, row: Checklist) => (
          <button
            onClick={() => navigate(`/inspections/checklists/${row.id}`)}
            className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-left"
          >
            {row.name}
          </button>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (_: any, row: Checklist) => <span>{row.category || '—'}</span>,
      },
      {
        key: 'items',
        label: 'Items',
        sortable: false,
        render: (_: any, row: Checklist) => (
          <span className="text-sm text-gray-600">{row.items.length} items</span>
        ),
      },
      {
        key: 'isActive',
        label: 'Status',
        sortable: true,
        render: (_: any, row: Checklist) => (
          <Badge variant={row.isActive ? 'success' : 'default'} size="sm">
            {row.isActive ? 'Active' : 'Archived'}
          </Badge>
        ),
      },
    ],
    [navigate]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category && filters.category.length > 0) count++;
    if (filters.isActive !== undefined) count++;
    return count;
  }, [filters]);

  const categories = useMemo(() => {
    const cats = new Set(checklists.map((c) => c.category).filter(Boolean));
    return Array.from(cats).map((cat) => ({ value: cat!, label: cat! }));
  }, [checklists]);

  return (
    <div className="p-6 space-y-6">
      {/* Command Bar */}
      <div className="flex items-center justify-end">
        <Button onClick={() => navigate('/inspections/checklists/new')}>+ New Checklist</Button>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, category, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div ref={filterButtonRef}>
              <FilterButton
                onClick={() => {
                  setTempFilters(filters);
                  setShowFilterPanel(true);
                }}
                activeFilterCount={activeFilterCount}
              />
            </div>
          </div>

          {filteredChecklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No checklists found</div>
          ) : (
            <SortableTable columns={columns} data={filteredChecklists} />
          )}
        </div>
      </Card>

    </div>
  );
}






