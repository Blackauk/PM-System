import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { ListPageTable } from '../../../components/common/ListPageTable';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { FilterSection } from '../../../components/common/FilterSection';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { FilterButton } from '../../../components/common/FilterButton';
import { StatCard } from '../../../components/common/StatCard';
import { WildcardGrid } from '../../../components/common/WildcardGrid';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { CheckboxOptionRow } from '../../../components/common/CheckboxOptionRow';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { Select } from '../../../components/common/Select';
import { SearchableMultiSelect } from '../../../components/common/SearchableMultiSelect';
import { DatePicker } from '../../../components/common/DatePicker';
import { Calendar, AlertCircle, CheckCircle, Pause, Play, MoreVertical, Eye, Edit, Copy, Trash2, RefreshCw, Edit3, X, Check } from 'lucide-react';
import { showToast } from '../../../components/common/Toast';
import { formatDateUK } from '../../../lib/formatters';
import { mockSites } from '../../assets/services';
import { getAllSchedules, getSchedules, deleteSchedule, updateSchedule, type InspectionScheduleFilter } from '../services/inspectionScheduleService';
import { seedInspectionSchedules } from '../services/seedData';
import type { InspectionSchedule, CalendarPattern, InspectionScheduleAssignment } from '../types/inspectionSchedule';
import { mockUsers } from '../../reports/services/mockUsers';

type WildcardFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'DUE_NEXT_7_DAYS' | 'OVERDUE' | 'NON_COMPLIANT';

export function InspectionSchedulesListPage() {
  const navigate = useNavigate();
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<InspectionScheduleFilter>(() => {
    const saved = localStorage.getItem('inspection-schedules-filters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [tempFilters, setTempFilters] = useState<InspectionScheduleFilter>(filters);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [wildcardFilter, setWildcardFilter] = useState<WildcardFilter>('ALL');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});
  
  // Bulk Edit Mode
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [editedSchedules, setEditedSchedules] = useState<Record<string, Partial<InspectionSchedule>>>({});
  const [bulkEditErrors, setBulkEditErrors] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<string, InspectionSchedule>>({});
  const [bulkForm, setBulkForm] = useState<Partial<InspectionSchedule>>({});

  // Persist filters
  useEffect(() => {
    localStorage.setItem('inspection-schedules-filters', JSON.stringify(filters));
  }, [filters]);

  // Seed schedules on mount if empty (non-blocking, delayed)
  useEffect(() => {
    // Delay seeding to avoid blocking initial render
    const timeoutId = setTimeout(() => {
      try {
        const schedules = getAllSchedules();
        if (schedules.length === 0) {
          seedInspectionSchedules().catch(err => {
            console.error('Error seeding schedules:', err);
          });
        }
      } catch (err) {
        console.error('Error checking schedules:', err);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Get all schedules - refresh when needed
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const allSchedules = useMemo(() => getAllSchedules(), [scheduleRefreshKey]);
  
  // Filter schedules
  const filteredSchedules = useMemo(() => {
    let schedules = getSchedules({
      ...filters,
      search: search || undefined,
    });

    // Apply wildcard filter
    if (wildcardFilter !== 'ALL') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      switch (wildcardFilter) {
        case 'ACTIVE':
          schedules = schedules.filter(s => s.status === 'Active');
          break;
        case 'PAUSED':
          schedules = schedules.filter(s => s.status === 'Paused');
          break;
        case 'DUE_NEXT_7_DAYS':
          schedules = schedules.filter(s => {
            if (!s.nextDueDate) return false;
            const dueDate = new Date(s.nextDueDate);
            return dueDate >= today && dueDate <= nextWeek && s.status === 'Active';
          });
          break;
        case 'OVERDUE':
          schedules = schedules.filter(s => {
            if (!s.nextDueDate) return false;
            const dueDate = new Date(s.nextDueDate);
            return dueDate < today && s.status === 'Active';
          });
          break;
        case 'NON_COMPLIANT':
          schedules = schedules.filter(s => {
            if (s.category !== 'Statutory') return false;
            if (!s.nextDueDate) return true; // Statutory without due date is non-compliant
            const dueDate = new Date(s.nextDueDate);
            return dueDate < today && s.status === 'Active';
          });
          break;
      }
    }

    return schedules;
  }, [filters, search, wildcardFilter]);

  // Calculate summary
  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      total: allSchedules.length,
      active: allSchedules.filter(s => s.status === 'Active').length,
      paused: allSchedules.filter(s => s.status === 'Paused').length,
      dueNext7Days: allSchedules.filter(s => {
        if (!s.nextDueDate || s.status !== 'Active') return false;
        const dueDate = new Date(s.nextDueDate);
        return dueDate >= today && dueDate <= nextWeek;
      }).length,
      overdue: allSchedules.filter(s => {
        if (!s.nextDueDate || s.status !== 'Active') return false;
        const dueDate = new Date(s.nextDueDate);
        return dueDate < today;
      }).length,
      nonCompliant: allSchedules.filter(s => {
        if (s.category !== 'Statutory') return false;
        if (!s.nextDueDate) return s.status === 'Active';
        const dueDate = new Date(s.nextDueDate);
        return dueDate < today && s.status === 'Active';
      }).length,
    };
  }, [allSchedules]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status && (Array.isArray(filters.status) ? filters.status.length > 0 : true)) count++;
    if (filters.category && (Array.isArray(filters.category) ? filters.category.length > 0 : true)) count++;
    if (filters.priority && (Array.isArray(filters.priority) ? filters.priority.length > 0 : true)) count++;
    if (filters.frequencyType && (Array.isArray(filters.frequencyType) ? filters.frequencyType.length > 0 : true)) count++;
    if (filters.siteId && (Array.isArray(filters.siteId) ? filters.siteId.length > 0 : true)) count++;
    if (filters.scopeType && (Array.isArray(filters.scopeType) ? filters.scopeType.length > 0 : true)) count++;
    if (filters.assignedToId && (Array.isArray(filters.assignedToId) ? filters.assignedToId.length > 0 : true)) count++;
    if (filters.nextDueDateFrom) count++;
    if (filters.nextDueDateTo) count++;
    if (filters.overdueOnly) count++;
    return count;
  }, [filters]);

  const handleFilterChange = (groupId: string, value: string | string[] | undefined) => {
    setTempFilters((prev) => {
      const newFilters = { ...prev };
      if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
        delete newFilters[groupId as keyof InspectionScheduleFilter];
      } else {
        newFilters[groupId as keyof InspectionScheduleFilter] = value as any;
      }
      return newFilters;
    });
  };

  const handleMultiSelectChange = (groupId: string, selected: string[]) => {
    handleFilterChange(groupId, selected.length > 0 ? selected : undefined);
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setShowFilterPanel(false);
  };

  const handleResetFilters = () => {
    const emptyFilters: InspectionScheduleFilter = {};
    setTempFilters(emptyFilters);
    setFilters(emptyFilters);
  };

  const handlePauseResume = (schedule: InspectionSchedule) => {
    const newStatus = schedule.status === 'Active' ? 'Paused' : 'Active';
    updateSchedule(schedule.id, { status: newStatus });
    showToast(`Schedule ${newStatus === 'Paused' ? 'paused' : 'resumed'}`, 'success');
    setOpenMenuId(null);
  };

  const handleGenerateNow = (schedule: InspectionSchedule) => {
    // TODO: Implement schedule generation
    showToast('Schedule generation triggered', 'success');
    setOpenMenuId(null);
  };

  const handleDelete = (schedule: InspectionSchedule) => {
    if (window.confirm(`Are you sure you want to delete schedule "${schedule.name}"?`)) {
      deleteSchedule(schedule.id);
      showToast('Schedule deleted', 'success');
      setOpenMenuId(null);
    }
  };

  // Bulk Edit Handlers
  const handleToggleBulkEdit = () => {
    if (isBulkEditMode) {
      // Exiting bulk edit mode - discard changes
      setSelectedScheduleIds([]);
      setEditedSchedules({});
      setBulkEditErrors({});
      setOriginalSnapshot({});
      setBulkForm({});
    } else {
      // Entering bulk edit mode - create snapshot
      const snapshot: Record<string, InspectionSchedule> = {};
      filteredSchedules.forEach(schedule => {
        snapshot[schedule.id] = { ...schedule };
      });
      setOriginalSnapshot(snapshot);
    }
    setIsBulkEditMode(!isBulkEditMode);
  };


  const handleBulkEditChange = useCallback((scheduleId: string, field: keyof InspectionSchedule, value: any) => {
    setEditedSchedules(prev => ({
      ...prev,
      [scheduleId]: {
        ...prev[scheduleId],
        [field]: value,
      },
    }));
    // Clear error for this field
    setBulkEditErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[scheduleId]) {
        const scheduleErrors = { ...newErrors[scheduleId] };
        delete scheduleErrors[field];
        if (Object.keys(scheduleErrors).length === 0) {
          delete newErrors[scheduleId];
        } else {
          newErrors[scheduleId] = scheduleErrors;
        }
      }
      return newErrors;
    });
  }, []);

  const handleBulkFormChange = (field: keyof InspectionSchedule, value: any) => {
    // Only update bulkForm if value is not empty/undefined
    if (value === '' || value === undefined) {
      setBulkForm(prev => {
        const newForm = { ...prev };
        delete newForm[field as keyof typeof newForm];
        return newForm;
      });
      // Clear the field from all selected schedules
      selectedScheduleIds.forEach(scheduleId => {
        setEditedSchedules(prev => {
          const newEdited = { ...prev };
          if (newEdited[scheduleId]) {
            const scheduleEdits = { ...newEdited[scheduleId] };
            delete scheduleEdits[field as keyof typeof scheduleEdits];
            if (Object.keys(scheduleEdits).length === 0) {
              delete newEdited[scheduleId];
            } else {
              newEdited[scheduleId] = scheduleEdits;
            }
          }
          return newEdited;
        });
      });
    } else {
      setBulkForm(prev => ({
        ...prev,
        [field]: value,
      }));
      // Apply to all selected schedules
      selectedScheduleIds.forEach(scheduleId => {
        handleBulkEditChange(scheduleId, field, value);
      });
    }
  };

  const validateBulkEdit = (): boolean => {
    const errors: Record<string, Record<string, string>> = {};
    let hasErrors = false;

    selectedScheduleIds.forEach(scheduleId => {
      const edited = editedSchedules[scheduleId];
      if (!edited) return;

      const scheduleErrors: Record<string, string> = {};

      // Validate category
      if (edited.category && !['Statutory', 'Safety', 'Operational'].includes(edited.category)) {
        scheduleErrors.category = 'Invalid category';
        hasErrors = true;
      }

      // Validate priority
      if (edited.priority && !['Critical', 'High', 'Normal'].includes(edited.priority)) {
        scheduleErrors.priority = 'Invalid priority';
        hasErrors = true;
      }

      // Validate status
      if (edited.status && !['Active', 'Paused'].includes(edited.status)) {
        scheduleErrors.status = 'Invalid status';
        hasErrors = true;
      }

      // Validate numeric fields
      if (edited.gracePeriodDays !== undefined && (edited.gracePeriodDays < 0 || isNaN(edited.gracePeriodDays))) {
        scheduleErrors.gracePeriodDays = 'Must be a positive number';
        hasErrors = true;
      }

      if (edited.generateAheadDays !== undefined && (edited.generateAheadDays < 0 || isNaN(edited.generateAheadDays))) {
        scheduleErrors.generateAheadDays = 'Must be a positive number';
        hasErrors = true;
      }

      if (edited.notifications?.beforeDueHours !== undefined && edited.notifications.beforeDueHours !== null) {
        if (edited.notifications.beforeDueHours < 0 || isNaN(edited.notifications.beforeDueHours)) {
          scheduleErrors['notifications.beforeDueHours'] = 'Must be a positive number';
          hasErrors = true;
        }
      }

      // Validate date
      if (edited.startDate && isNaN(Date.parse(edited.startDate))) {
        scheduleErrors.startDate = 'Invalid date';
        hasErrors = true;
      }

      if (Object.keys(scheduleErrors).length > 0) {
        errors[scheduleId] = scheduleErrors;
      }
    });

    setBulkEditErrors(errors);
    return !hasErrors;
  };

  const handleApplyBulkEdit = async () => {
    if (selectedScheduleIds.length === 0) {
      showToast('No schedules selected', 'error');
      return;
    }

    // Check if there are any changes
    const hasChanges = selectedScheduleIds.some(id => {
      const edited = editedSchedules[id];
      return edited && Object.keys(edited).length > 0;
    });

    if (!hasChanges) {
      showToast('No changes to apply', 'error');
      return;
    }

    if (!validateBulkEdit()) {
      showToast('Please fix validation errors before saving', 'error');
      return;
    }

    setIsSaving(true);
    const results: { success: string[]; failed: Array<{ id: string; error: string }> } = {
      success: [],
      failed: [],
    };

    try {
      // Process updates sequentially with progress
      for (let i = 0; i < selectedScheduleIds.length; i++) {
        const scheduleId = selectedScheduleIds[i];
        const edited = editedSchedules[scheduleId];
        
        if (!edited || Object.keys(edited).length === 0) {
          continue; // Skip if no changes
        }

        try {
          // Handle nested notifications object
          const updateData: Partial<InspectionSchedule> = { ...edited };
          if (edited.notifications) {
            const originalSchedule = filteredSchedules.find(s => s.id === scheduleId);
            if (originalSchedule) {
              updateData.notifications = {
                ...originalSchedule.notifications,
                ...edited.notifications,
              };
            }
          }

          updateSchedule(scheduleId, updateData);
          results.success.push(scheduleId);
        } catch (error) {
          results.failed.push({
            id: scheduleId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Show results
      if (results.failed.length === 0) {
        showToast(`Successfully updated ${results.success.length} schedule(s)`, 'success');
        setSelectedScheduleIds([]);
        setEditedSchedules({});
        setBulkEditErrors({});
        setBulkForm({});
        setOriginalSnapshot({});
        setIsBulkEditMode(false);
        // Refresh schedules to show updated data
        setScheduleRefreshKey(prev => prev + 1);
      } else {
        const failedIds = results.failed.map(f => f.id).join(', ');
        showToast(
          `Updated ${results.success.length} schedule(s). Failed: ${failedIds}`,
          'error'
        );
        // Show detailed errors in console for debugging
        console.error('Bulk edit failures:', results.failed);
      }
    } catch (error) {
      showToast('Error applying bulk edits', 'error');
      console.error('Bulk edit error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardBulkEdit = () => {
    // Restore from snapshot - clear all edits
    setSelectedScheduleIds([]);
    setEditedSchedules({});
    setBulkEditErrors({});
    setBulkForm({});
    setOriginalSnapshot({});
    setIsBulkEditMode(false);
    // Force re-render by triggering a state update
    // The schedules will reload from getAllSchedules() on next render
  };

  const getFrequencyDisplay = (schedule: InspectionSchedule): string => {
    if (schedule.frequencyType === 'Calendar' && schedule.calendarRule) {
      const { pattern, daysOfWeek, dayOfMonth, nthWeekday, timeOfDay } = schedule.calendarRule;
      if (pattern === 'Daily') return `Daily${timeOfDay ? ` at ${timeOfDay}` : ''}`;
      if (pattern === 'Weekly' && daysOfWeek) {
        return `Weekly (${daysOfWeek.join(', ')})${timeOfDay ? ` at ${timeOfDay}` : ''}`;
      }
      if (pattern === 'Monthly') {
        if (nthWeekday) {
          return `Monthly (${nthWeekday.nth} ${nthWeekday.weekday})${timeOfDay ? ` at ${timeOfDay}` : ''}`;
        }
        if (dayOfMonth) {
          return `Monthly (day ${dayOfMonth})${timeOfDay ? ` at ${timeOfDay}` : ''}`;
        }
        return `Monthly${timeOfDay ? ` at ${timeOfDay}` : ''}`;
      }
      if (pattern === 'Yearly') return `Yearly${timeOfDay ? ` at ${timeOfDay}` : ''}`;
      return pattern;
    }
    if (schedule.frequencyType === 'Usage' && schedule.usageRule) {
      return `Every ${schedule.usageRule.intervalHours} hours`;
    }
    if (schedule.frequencyType === 'Event' && schedule.eventRule) {
      return `On ${schedule.eventRule.trigger}`;
    }
    return schedule.frequencyType;
  };

  const getScopeDisplay = (schedule: InspectionSchedule): string => {
    if (schedule.scopeType === 'Assets' && schedule.scopeAssetIds.length > 0) {
      return `${schedule.scopeAssetIds.length} asset(s)`;
    }
    if (schedule.scopeType === 'AssetGroup' && schedule.scopeAssetGroupId) {
      return 'Asset Group';
    }
    if (schedule.scopeType === 'Site' && schedule.siteId) {
      return schedule.siteName || 'Site';
    }
    if (schedule.scopeType === 'Location' && schedule.locationIds && schedule.locationIds.length > 0) {
      return `${schedule.locationIds.length} location(s)`;
    }
    return schedule.scopeType;
  };

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Schedule ID',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isBulkEditMode) {
              navigate(`/schedules/inspections/${row.id}`);
            }
          }}
          className="font-mono font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          {row.id}
        </button>
      ),
    },
    {
      key: 'templateName',
      label: 'Template / Checklist',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => (
        <div>
          <div className="font-medium">{row.templateName || 'Unknown Template'}</div>
          <div className="text-xs text-gray-500">{row.name}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.category;
        const currentValue = editedValue !== undefined ? editedValue : row.category;
        const error = bulkEditErrors[row.id]?.category;

        if (isSelected) {
          return (
            <div className="min-w-[120px]">
              <Select
                value={currentValue}
                onChange={(e) => {
                  e.stopPropagation();
                  handleBulkEditChange(row.id, 'category', e.target.value as InspectionSchedule['category']);
                }}
                onClick={(e) => e.stopPropagation()}
                options={[
                  { value: 'Statutory', label: 'Statutory' },
                  { value: 'Safety', label: 'Safety' },
                  { value: 'Operational', label: 'Operational' },
                ]}
                className="text-sm"
                error={error}
              />
            </div>
          );
        }

        const variants: Record<InspectionSchedule['category'], 'default' | 'warning' | 'error'> = {
          Statutory: 'error',
          Safety: 'warning',
          Operational: 'default',
        };
        return <Badge variant={variants[row.category]}>{row.category}</Badge>;
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.priority;
        const currentValue = editedValue !== undefined ? editedValue : row.priority;
        const error = bulkEditErrors[row.id]?.priority;

        if (isSelected) {
          return (
            <div className="min-w-[100px]">
              <Select
                value={currentValue}
                onChange={(e) => {
                  e.stopPropagation();
                  handleBulkEditChange(row.id, 'priority', e.target.value as InspectionSchedule['priority']);
                }}
                onClick={(e) => e.stopPropagation()}
                options={[
                  { value: 'Critical', label: 'Critical' },
                  { value: 'High', label: 'High' },
                  { value: 'Normal', label: 'Normal' },
                ]}
                className="text-sm"
                error={error}
              />
            </div>
          );
        }

        const priorityColors: Record<InspectionSchedule['priority'], string> = {
          Critical: 'text-red-600',
          High: 'text-orange-600',
          Normal: 'text-gray-600',
        };
        return <span className={`text-sm font-medium ${priorityColors[row.priority]}`}>{row.priority}</span>;
      },
    },
    {
      key: 'frequencyType',
      label: 'Frequency / Rule',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => (
        <div className="text-sm">{getFrequencyDisplay(row)}</div>
      ),
    },
    {
      key: 'scopeType',
      label: 'Scope',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => (
        <div className="text-sm">{getScopeDisplay(row)}</div>
      ),
    },
    {
      key: 'startDate',
      label: 'Start Date',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.startDate;
        const currentValue = editedValue !== undefined ? editedValue : row.startDate;
        const error = bulkEditErrors[row.id]?.startDate;

        if (isSelected) {
          return (
            <div className="min-w-[140px]">
              <DatePicker
                value={currentValue || ''}
                onChange={(value) => {
                  handleBulkEditChange(row.id, 'startDate', value);
                }}
                className="text-sm"
                error={error}
              />
            </div>
          );
        }

        return (
          <span className="text-sm">{row.startDate ? formatDateUK(row.startDate) : '—'}</span>
        );
      },
    },
    {
      key: 'nextDueDate',
      label: 'Next Due',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => (
        row.nextDueDate ? (
          <div>
            <div className="text-sm">{formatDateUK(row.nextDueDate)}</div>
            {new Date(row.nextDueDate) < new Date() && row.status === 'Active' && (
              <div className="text-xs text-red-600">Overdue</div>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      ),
    },
    {
      key: 'assignment',
      label: 'Assigned To',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.assignment;
        const currentValue = editedValue !== undefined ? editedValue : row.assignment;
        const error = bulkEditErrors[row.id]?.assignment;

        if (isSelected) {
          // Get unique assignments from all schedules for dropdown
          const allAssignments = filteredSchedules
            .map(s => s.assignment)
            .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
          
          return (
            <div className="min-w-[150px]">
              <Select
                value={currentValue.id}
                onChange={(e) => {
                  e.stopPropagation();
                  const selectedAssignment = allAssignments.find(a => a.id === e.target.value) || currentValue;
                  handleBulkEditChange(row.id, 'assignment', selectedAssignment);
                }}
                onClick={(e) => e.stopPropagation()}
                options={allAssignments.map(a => ({
                  value: a.id,
                  label: a.name,
                }))}
                className="text-sm"
                error={error}
              />
            </div>
          );
        }

        return <span className="text-sm">{row.assignment.name || 'Unassigned'}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.status;
        const currentValue = editedValue !== undefined ? editedValue : row.status;
        const error = bulkEditErrors[row.id]?.status;

        if (isSelected) {
          return (
            <div className="min-w-[100px]">
              <Select
                value={currentValue}
                onChange={(e) => {
                  e.stopPropagation();
                  handleBulkEditChange(row.id, 'status', e.target.value as InspectionSchedule['status']);
                }}
                onClick={(e) => e.stopPropagation()}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Paused', label: 'Paused' },
                ]}
                className="text-sm"
                error={error}
              />
            </div>
          );
        }

        return (
          <Badge variant={row.status === 'Active' ? 'success' : 'default'}>
            {row.status}
          </Badge>
        );
      },
    },
    {
      key: 'autoCreate',
      label: 'Auto-Create',
      sortable: false,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        // Auto-Create is always true for schedules, but we can show it as editable
        // For now, we'll use a simple Yes/No toggle
        if (isSelected) {
          // Since autoCreate isn't in the type, we'll use a workaround
          // We can add a custom field or use notifications.onCreate as a proxy
          // For simplicity, let's just show a checkbox for now
          return (
            <div className="min-w-[80px]">
              <Select
                value="Yes"
                onChange={(e) => {
                  e.stopPropagation();
                  // Auto-create is always enabled in the current model
                  // This is a placeholder for future enhancement
                }}
                onClick={(e) => e.stopPropagation()}
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
                className="text-sm"
              />
            </div>
          );
        }
        return <Badge variant="info">Yes</Badge>;
      },
    },
    {
      key: 'notifyBeforeDue',
      label: 'Notify Before Due',
      sortable: false,
      render: (_: any, row: InspectionSchedule) => {
        const isSelected = isBulkEditMode && selectedScheduleIds.includes(row.id);
        const editedValue = editedSchedules[row.id]?.notifications?.beforeDueHours;
        const currentValue = editedValue !== undefined ? editedValue : row.notifications.beforeDueHours;
        const error = bulkEditErrors[row.id]?.['notifications.beforeDueHours'];

        if (isSelected) {
          return (
            <div className="min-w-[120px]">
              <Input
                type="number"
                value={currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
                onChange={(e) => {
                  e.stopPropagation();
                  const value = e.target.value === '' ? null : Number(e.target.value);
                  handleBulkEditChange(row.id, 'notifications', {
                    ...row.notifications,
                    beforeDueHours: value,
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-sm"
                min="0"
                error={error}
                placeholder="Hours"
              />
            </div>
          );
        }

        return (
          <span className="text-sm">
            {row.notifications.beforeDueHours !== null && row.notifications.beforeDueHours !== undefined
              ? `${row.notifications.beforeDueHours} hours`
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: InspectionSchedule) => {
        if (!menuRefs.current[row.id]) {
          menuRefs.current[row.id] = { current: null };
        }
        const menuRef = menuRefs.current[row.id];

        const menuItems = [
          {
            label: 'View',
            icon: Eye,
            onClick: () => {
              navigate(`/schedules/inspections/${row.id}`);
              setOpenMenuId(null);
            },
          },
          {
            label: 'Edit',
            icon: Edit,
            onClick: () => {
              navigate(`/schedules/inspections/${row.id}/edit`);
              setOpenMenuId(null);
            },
          },
          {
            label: row.status === 'Active' ? 'Pause' : 'Resume',
            icon: row.status === 'Active' ? Pause : Play,
            onClick: () => handlePauseResume(row),
          },
          {
            label: 'Generate Now',
            icon: RefreshCw,
            onClick: () => handleGenerateNow(row),
          },
          {
            label: 'Duplicate',
            icon: Copy,
            onClick: () => {
              // TODO: Implement duplicate
              showToast('Duplicate functionality coming soon', 'info');
              setOpenMenuId(null);
            },
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => handleDelete(row),
            className: 'text-red-600',
          },
        ];

        return (
          <div className="relative">
            <button
              ref={(el) => {
                if (menuRef.current) {
                  menuRef.current = el;
                } else {
                  menuRef.current = el;
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === row.id ? null : row.id);
              }}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {openMenuId === row.id && (
              <DropdownMenu
                isOpen={true}
                onClose={() => setOpenMenuId(null)}
                items={menuItems}
                anchorRef={menuRef as React.RefObject<HTMLElement>}
              />
            )}
          </div>
        );
      },
    },
  ], [navigate, openMenuId, isBulkEditMode, selectedScheduleIds, editedSchedules, bulkEditErrors, handleBulkEditChange, filteredSchedules]);

  const showingText = useMemo(() => {
    const start = 1;
    const end = filteredSchedules.length;
    const total = allSchedules.length;
    return `Showing ${start}–${end} of ${total} schedule${total !== 1 ? 's' : ''}`;
  }, [filteredSchedules.length, allSchedules.length]);

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
      {/* Wildcards */}
      <WildcardGrid>
        <StatCard
          title="Total Schedules"
          value={summary.total}
          icon={Calendar}
          accentColor="blue"
          onClick={() => setWildcardFilter('ALL')}
          className={wildcardFilter === 'ALL' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
        <StatCard
          title="Active"
          value={summary.active}
          icon={CheckCircle}
          accentColor="green"
          onClick={() => setWildcardFilter(wildcardFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={wildcardFilter === 'ACTIVE' ? 'ring-2 ring-green-500 bg-green-50' : ''}
        />
        <StatCard
          title="Paused"
          value={summary.paused}
          icon={Pause}
          accentColor="gray"
          onClick={() => setWildcardFilter(wildcardFilter === 'PAUSED' ? 'ALL' : 'PAUSED')}
          className={wildcardFilter === 'PAUSED' ? 'ring-2 ring-gray-500 bg-gray-50' : ''}
        />
        <StatCard
          title="Due Next 7 Days"
          value={summary.dueNext7Days}
          icon={Calendar}
          accentColor="blue"
          onClick={() => setWildcardFilter(wildcardFilter === 'DUE_NEXT_7_DAYS' ? 'ALL' : 'DUE_NEXT_7_DAYS')}
          className={wildcardFilter === 'DUE_NEXT_7_DAYS' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
        <StatCard
          title="Overdue"
          value={summary.overdue}
          icon={AlertCircle}
          accentColor="red"
          onClick={() => setWildcardFilter(wildcardFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={wildcardFilter === 'OVERDUE' ? 'ring-2 ring-red-500 bg-red-50' : ''}
        />
        <StatCard
          title="Non-Compliant"
          value={summary.nonCompliant}
          icon={AlertCircle}
          accentColor="red"
          onClick={() => setWildcardFilter(wildcardFilter === 'NON_COMPLIANT' ? 'ALL' : 'NON_COMPLIANT')}
          className={wildcardFilter === 'NON_COMPLIANT' ? 'ring-2 ring-red-500 bg-red-50' : ''}
        />
      </WildcardGrid>

      {/* Bulk Changes Panel */}
      {isBulkEditMode && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Bulk Changes</h3>
              <span className="text-xs text-gray-500">
                {selectedScheduleIds.length > 0 
                  ? `Apply to ${selectedScheduleIds.length} selected schedule(s)`
                  : 'Select schedules to apply changes'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <Select
                  value={bulkForm.status || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    handleBulkFormChange('status', value);
                  }}
                  options={[
                    { value: '', label: '— No change —' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Paused', label: 'Paused' },
                  ]}
                  className="text-sm"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <Select
                  value={bulkForm.priority || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    handleBulkFormChange('priority', value);
                  }}
                  options={[
                    { value: '', label: '— No change —' },
                    { value: 'Critical', label: 'Critical' },
                    { value: 'High', label: 'High' },
                    { value: 'Normal', label: 'Normal' },
                  ]}
                  className="text-sm"
                />
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <Select
                  value={bulkForm.assignment?.id || ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      handleBulkFormChange('assignment', undefined);
                      return;
                    }
                    // Find assignment from all schedules
                    const allAssignments = filteredSchedules
                      .map(s => s.assignment)
                      .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
                    const selectedAssignment = allAssignments.find(a => a.id === e.target.value);
                    if (selectedAssignment) {
                      handleBulkFormChange('assignment', selectedAssignment);
                    }
                  }}
                  options={[
                    { value: '', label: '— No change —' },
                    ...filteredSchedules
                      .map(s => s.assignment)
                      .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)
                      .map(a => ({ value: a.id, label: a.name })),
                  ]}
                  className="text-sm"
                />
              </div>

              {/* Notify Before Due (hours) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notify Before Due (hours)
                </label>
                <Input
                  type="number"
                  value={bulkForm.notifications?.beforeDueHours !== undefined && bulkForm.notifications.beforeDueHours !== null
                    ? String(bulkForm.notifications.beforeDueHours) 
                    : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : Number(e.target.value);
                    handleBulkFormChange('notifications', {
                      ...bulkForm.notifications,
                      beforeDueHours: value !== undefined ? value : null,
                    });
                  }}
                  placeholder="— No change —"
                  className="text-sm"
                  min="0"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <ListPageTable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by schedule ID, template, asset, site, owner…"
        onFilterClick={() => {
          setTempFilters(filters);
          setShowFilterPanel(true);
        }}
        activeFilterCount={activeFilterCount}
        filterButtonRef={filterButtonRef}
        columns={columns}
        data={filteredSchedules}
        onRowClick={(row) => {
          if (!isBulkEditMode) {
            navigate(`/schedules/inspections/${row.id}`);
          }
        }}
        showingText={showingText}
        headerActions={
          <div className="flex items-center gap-2">
            {isBulkEditMode && (
              <>
                <div className="text-sm text-gray-600 mr-2">
                  {selectedScheduleIds.length} selected
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyBulkEdit}
                  disabled={isSaving || selectedScheduleIds.length === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardBulkEdit}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Discard
                </Button>
              </>
            )}
            <Button
              variant={isBulkEditMode ? "outline" : "primary"}
              size="sm"
              onClick={handleToggleBulkEdit}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {isBulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit'}
            </Button>
            {!isBulkEditMode && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/schedules/inspections/new')}
              >
                New Schedule
              </Button>
            )}
          </div>
        }
        selectable={isBulkEditMode}
        selectedIds={selectedScheduleIds}
        onSelectionChange={(ids) => {
          setSelectedScheduleIds(ids);
          // Clean up edited data for deselected schedules
          const deselectedIds = selectedScheduleIds.filter(id => !ids.includes(id));
          if (deselectedIds.length > 0) {
            const newEdited = { ...editedSchedules };
            const newErrors = { ...bulkEditErrors };
            deselectedIds.forEach(id => {
              delete newEdited[id];
              delete newErrors[id];
            });
            setEditedSchedules(newEdited);
            setBulkEditErrors(newErrors);
          }
        }}
        getRowId={(row) => row.id}
        getRowClassName={(row) => {
          if (isBulkEditMode && selectedScheduleIds.includes(row.id)) {
            return 'bg-blue-50 hover:bg-blue-100';
          }
          return '';
        }}
        emptyMessage="No inspection schedules found"
      />

      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        title="Inspection Schedule Filters"
      >
        <FilterSection title="Status">
          <MultiSelectFilter
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Paused', label: 'Paused' },
            ]}
            selected={Array.isArray(tempFilters.status) ? tempFilters.status : tempFilters.status ? [tempFilters.status] : []}
            onChange={(selected) => handleMultiSelectChange('status', selected)}
          />
        </FilterSection>

        <FilterSection title="Category">
          <MultiSelectFilter
            options={[
              { value: 'Statutory', label: 'Statutory' },
              { value: 'Safety', label: 'Safety' },
              { value: 'Operational', label: 'Operational' },
            ]}
            selected={Array.isArray(tempFilters.category) ? tempFilters.category : tempFilters.category ? [tempFilters.category] : []}
            onChange={(selected) => handleMultiSelectChange('category', selected)}
          />
        </FilterSection>

        <FilterSection title="Priority">
          <MultiSelectFilter
            options={[
              { value: 'Critical', label: 'Critical' },
              { value: 'High', label: 'High' },
              { value: 'Normal', label: 'Normal' },
            ]}
            selected={Array.isArray(tempFilters.priority) ? tempFilters.priority : tempFilters.priority ? [tempFilters.priority] : []}
            onChange={(selected) => handleMultiSelectChange('priority', selected)}
          />
        </FilterSection>

        <FilterSection title="Frequency Type">
          <MultiSelectFilter
            options={[
              { value: 'Calendar', label: 'Calendar' },
              { value: 'Usage', label: 'Usage' },
              { value: 'Event', label: 'Event' },
            ]}
            selected={Array.isArray(tempFilters.frequencyType) ? tempFilters.frequencyType : tempFilters.frequencyType ? [tempFilters.frequencyType] : []}
            onChange={(selected) => handleMultiSelectChange('frequencyType', selected)}
          />
        </FilterSection>

        <FilterSection title="Site">
          <MultiSelectFilter
            options={mockSites.map(site => ({ value: site.id, label: site.name }))}
            selected={Array.isArray(tempFilters.siteId) ? tempFilters.siteId : tempFilters.siteId ? [tempFilters.siteId] : []}
            onChange={(selected) => handleMultiSelectChange('siteId', selected)}
          />
        </FilterSection>

        <FilterSection title="Scope Type">
          <MultiSelectFilter
            options={[
              { value: 'Assets', label: 'Assets' },
              { value: 'AssetGroup', label: 'Asset Group' },
              { value: 'Site', label: 'Site' },
              { value: 'Location', label: 'Location' },
            ]}
            selected={Array.isArray(tempFilters.scopeType) ? tempFilters.scopeType : tempFilters.scopeType ? [tempFilters.scopeType] : []}
            onChange={(selected) => handleMultiSelectChange('scopeType', selected)}
          />
        </FilterSection>

        <FilterSection title="Overdue Only">
          <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm hover:bg-gray-50">
            <input
              type="checkbox"
              checked={tempFilters.overdueOnly || false}
              onChange={(e) => handleFilterChange('overdueOnly', e.target.checked ? true : undefined)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show only overdue schedules</span>
          </label>
        </FilterSection>
      </FilterPanel>
      </div>
    </ErrorBoundary>
  );
}

