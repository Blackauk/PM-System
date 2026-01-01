import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SortableTable } from '../../../components/common/SortableTable';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getAllSchedules,
  deleteSchedule,
  updateSchedule,
} from '../db/schedulingRepository';
import { runScheduleNow } from '../services/schedulingService';
import type { InspectionSchedule } from '../types/scheduling';
import { Calendar, Plus, MoreVertical, Play, Pause, Edit, Trash2, Copy, Eye } from 'lucide-react';
import { formatDateUK } from '../../../lib/formatters';
import { CreateEditScheduleModal } from '../components/CreateEditScheduleModal';

export function InspectionSchedulesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InspectionSchedule | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});

  // Check permissions
  const canCreate = user?.role === 'Admin' || user?.role === 'Manager';
  const canEdit = (schedule: InspectionSchedule) => {
    if (user?.role === 'Admin') return true;
    if (user?.role === 'Manager') {
      return schedule.createdBy === user.id || schedule.siteId === user.siteIds?.[0];
    }
    return false;
  };
  const canDelete = (schedule: InspectionSchedule) => {
    return user?.role === 'Admin' || (user?.role === 'Manager' && schedule.createdBy === user.id);
  };

  // Load schedules
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const allSchedules = await getAllSchedules();
      // Filter by permissions
      const filtered = allSchedules.filter((schedule) => {
        if (user?.role === 'Admin') return true;
        if (user?.role === 'Manager') {
          return schedule.createdBy === user.id || schedule.siteId === user.siteIds?.[0];
        }
        if (user?.role === 'Supervisor') {
          return schedule.siteId === user.siteIds?.[0];
        }
        return false;
      });
      setSchedules(filtered);
    } catch (error: any) {
      showToast(error.message || 'Failed to load schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schedule: InspectionSchedule) => {
    if (!confirm(`Are you sure you want to delete "${schedule.name}"?`)) {
      return;
    }

    try {
      await deleteSchedule(schedule.id);
      showToast('Schedule deleted successfully', 'success');
      loadSchedules();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete schedule', 'error');
    }
  };

  const handleToggleStatus = async (schedule: InspectionSchedule) => {
    try {
      await updateSchedule(schedule.id, {
        status: schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      });
      showToast(
        schedule.status === 'ACTIVE' ? 'Schedule paused' : 'Schedule resumed',
        'success'
      );
      loadSchedules();
    } catch (error: any) {
      showToast(error.message || 'Failed to update schedule', 'error');
    }
  };

  const handleRunNow = async (schedule: InspectionSchedule) => {
    setRunningScheduleId(schedule.id);
    try {
      const result = await runScheduleNow(schedule.id);
      showToast(
        `Generated ${result.generated} inspection${result.generated !== 1 ? 's' : ''}`,
        'success'
      );
      if (result.errors.length > 0) {
        showToast(`Some errors occurred: ${result.errors.join(', ')}`, 'warning');
      }
      loadSchedules();
    } catch (error: any) {
      showToast(error.message || 'Failed to run schedule', 'error');
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleEdit = (schedule: InspectionSchedule) => {
    setEditingSchedule(schedule);
    setShowCreateModal(true);
  };

  const handleDuplicate = async (schedule: InspectionSchedule) => {
    setEditingSchedule({
      ...schedule,
      id: '', // Will be generated
      scheduleCode: '', // Will be generated
      name: `${schedule.name} (Copy)`,
      createdAt: '',
      updatedAt: '',
    });
    setShowCreateModal(true);
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setShowCreateModal(true);
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingSchedule(null);
    loadSchedules();
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingSchedule(null);
  };

  // Format scope display
  const formatScope = (schedule: InspectionSchedule): string => {
    switch (schedule.scope) {
      case 'ALL_ASSETS':
        return 'All Assets';
      case 'ASSET_IDS':
        return `${schedule.assetIds?.length || 0} Selected Assets`;
      case 'ASSET_TYPE':
        return schedule.assetTypeCode || 'Asset Type';
      case 'TAGS':
        return schedule.tags?.length ? `${schedule.tags.length} Tags` : 'Tags';
      default:
        return schedule.scope;
    }
  };

  // Format frequency rule display
  const formatFrequencyRule = (schedule: InspectionSchedule): string => {
    switch (schedule.frequencyMode) {
      case 'FIXED_TIME':
        if (schedule.fixedTime) {
          const { intervalUnit, intervalValue, timeOfDay } = schedule.fixedTime;
          return `Every ${intervalValue} ${intervalUnit.toLowerCase()}${intervalUnit === 'WEEK' && schedule.fixedTime.daysOfWeek ? ` (${schedule.fixedTime.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')})` : ''} at ${timeOfDay}`;
        }
        return 'Fixed Time';
      case 'ROLLING_AFTER_COMPLETION':
        if (schedule.rolling) {
          return `${schedule.rolling.afterCompletionValue} ${schedule.rolling.afterCompletionUnit.toLowerCase()} after completion`;
        }
        return 'Rolling';
      case 'USAGE_BASED':
        if (schedule.usageBased) {
          return `${schedule.usageBased.thresholdValue} ${schedule.usageBased.meterType.toLowerCase()}`;
        }
        return 'Usage Based';
      case 'EVENT_DRIVEN':
        if (schedule.eventDriven) {
          return `${schedule.eventDriven.triggers.length} trigger${schedule.eventDriven.triggers.length !== 1 ? 's' : ''}`;
        }
        return 'Event Driven';
      default:
        return schedule.frequencyMode;
    }
  };

  // Table columns
  const columns = useMemo(
    () => [
      {
        key: 'scheduleCode',
        label: 'Schedule ID',
        sortable: true,
        render: (_: any, row: InspectionSchedule) => (
          <span className="font-mono font-medium text-gray-900">{row.scheduleCode}</span>
        ),
      },
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        render: (_: any, row: InspectionSchedule) => (
          <span className="font-medium text-gray-900">{row.name}</span>
        ),
      },
      {
        key: 'siteName',
        label: 'Site',
        sortable: true,
        render: (_: any, row: InspectionSchedule) => (
          <span className="text-sm text-gray-600">{row.siteName || row.siteId}</span>
        ),
      },
      {
        key: 'scope',
        label: 'Scope',
        sortable: false,
        render: (_: any, row: InspectionSchedule) => (
          <span className="text-sm text-gray-600">{formatScope(row)}</span>
        ),
      },
      {
        key: 'templateName',
        label: 'Template',
        sortable: false,
        render: (_: any, row: InspectionSchedule) => (
          <span className="text-sm text-gray-600">{row.templateName || row.templateId}</span>
        ),
      },
      {
        key: 'frequencyRule',
        label: 'Rule',
        sortable: false,
        render: (_: any, row: InspectionSchedule) => (
          <span className="text-sm text-gray-600">{formatFrequencyRule(row)}</span>
        ),
      },
      {
        key: 'nextRunAt',
        label: 'Next Run',
        sortable: true,
        render: (_: any, row: InspectionSchedule) => (
          <span className="text-sm text-gray-600">
            {row.nextRunAt ? formatDateUK(row.nextRunAt) : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (_: any, row: InspectionSchedule) => (
          <Badge variant={row.status === 'ACTIVE' ? 'success' : 'warning'}>
            {row.status}
          </Badge>
        ),
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
              label: 'Run Now',
              icon: Play,
              onClick: () => handleRunNow(row),
              disabled: runningScheduleId === row.id,
            },
            ...(canEdit(row)
              ? [
                  {
                    label: 'Edit',
                    icon: Edit,
                    onClick: () => handleEdit(row),
                  },
                  {
                    label: row.status === 'ACTIVE' ? 'Pause' : 'Resume',
                    icon: row.status === 'ACTIVE' ? Pause : Play,
                    onClick: () => handleToggleStatus(row),
                  },
                  {
                    label: 'Duplicate',
                    icon: Copy,
                    onClick: () => handleDuplicate(row),
                  },
                ]
              : []),
            ...(canDelete(row)
              ? [
                  {
                    label: 'Delete',
                    icon: Trash2,
                    onClick: () => handleDelete(row),
                  },
                ]
              : []),
          ];

          return (
            <div className="relative">
              <button
                ref={(el) => {
                  if (menuRef) menuRef.current = el;
                }}
                onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                disabled={runningScheduleId === row.id}
                className="p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuRef && (
                <DropdownMenu
                  isOpen={openMenuId === row.id}
                  onClose={() => setOpenMenuId(null)}
                  anchorRef={menuRef as React.RefObject<HTMLElement>}
                  items={menuItems}
                  width="w-48"
                />
              )}
            </div>
          );
        },
      },
    ],
    [runningScheduleId, openMenuId, canEdit, canDelete]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inspection Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatically generate inspections based on rules and triggers
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Schedule
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <div className="p-6 text-center py-8 text-gray-500">Loading schedules...</div>
        </Card>
      ) : schedules.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a schedule to automatically generate inspections.
            </p>
            {canCreate && (
              <Button variant="primary" onClick={handleCreate}>
                Create Schedule
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <SortableTable columns={columns} data={schedules} />
        </Card>
      )}

      {/* Create/Edit Modal */}
      <CreateEditScheduleModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        schedule={editingSchedule || undefined}
      />
    </div>
  );
}

