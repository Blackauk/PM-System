import { useState, useEffect, useRef } from 'react';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SortableTable } from '../../../components/common/SortableTable';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getSchedules,
  deleteSchedule,
  toggleScheduleActive,
  sendScheduleNow,
} from '../services/scheduledReportsService';
import type { ScheduledReport } from '../types/scheduledReportsV2';
import { Edit, Trash2, Play, Pause, PlayCircle, MoreVertical, Calendar, Mail } from 'lucide-react';
import { formatDateUK } from '../../../lib/formatters';
import { CreateEditScheduleForm } from './CreateEditScheduleForm';

interface ScheduledReportsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduledReportsSidebar({ isOpen, onClose }: ScheduledReportsSidebarProps) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});

  // Check permissions
  const canCreate = user?.role === 'Admin' || user?.role === 'Manager';
  const canEdit = (schedule: ScheduledReport) => {
    if (user?.role === 'Admin') return true;
    if (user?.role === 'Manager') {
      // Managers can edit schedules they created or for their sites
      return schedule.createdBy === user.id || schedule.siteId === user.siteIds?.[0];
    }
    return false;
  };
  const canDelete = (schedule: ScheduledReport) => {
    return user?.role === 'Admin' || (user?.role === 'Manager' && schedule.createdBy === user.id);
  };

  // Load schedules
  useEffect(() => {
    if (isOpen) {
      loadSchedules();
    }
  }, [isOpen]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const allSchedules = await getSchedules();
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

  const handleDelete = async (schedule: ScheduledReport) => {
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

  const handleToggleActive = async (schedule: ScheduledReport) => {
    try {
      await toggleScheduleActive(schedule.id);
      showToast(
        schedule.isActive ? 'Schedule paused' : 'Schedule resumed',
        'success'
      );
      loadSchedules();
    } catch (error: any) {
      showToast(error.message || 'Failed to update schedule', 'error');
    }
  };

  const handleSendNow = async (schedule: ScheduledReport) => {
    setRunningScheduleId(schedule.id);
    try {
      await sendScheduleNow(schedule.id);
      showToast('Report sent successfully', 'success');
      loadSchedules();
    } catch (error: any) {
      showToast(error.message || 'Failed to send report', 'error');
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleEdit = (schedule: ScheduledReport) => {
    setEditingSchedule(schedule);
    setShowCreateForm(true);
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setShowCreateForm(true);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingSchedule(null);
    loadSchedules();
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    setEditingSchedule(null);
  };

  // Format recipients display
  const formatRecipients = (schedule: ScheduledReport): string => {
    const count = schedule.recipients.length;
    return `${count} recipient${count !== 1 ? 's' : ''}`;
  };

  // Format modules display
  const formatModules = (schedule: ScheduledReport): string => {
    if (schedule.modules === 'All') return 'All';
    return schedule.modules.join(', ');
  };

  // Format frequency display
  const formatFrequency = (schedule: ScheduledReport): string => {
    switch (schedule.frequencyType) {
      case 'Daily':
        return `Daily at ${schedule.timeOfDay}`;
      case 'Weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[schedule.dayOfWeek ?? 1];
        return `${dayName} at ${schedule.timeOfDay}`;
      case 'Monthly':
        return `Day ${schedule.dayOfMonth} at ${schedule.timeOfDay}`;
      case 'Custom':
        return `Custom at ${schedule.timeOfDay}`;
      default:
        return schedule.frequencyType;
    }
  };

  // Table columns
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'reportView',
      label: 'Report View',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <Badge variant="info">{row.reportView}</Badge>
      ),
    },
    {
      key: 'modules',
      label: 'Modules',
      sortable: false,
      render: (_: any, row: ScheduledReport) => (
        <span className="text-sm text-gray-600">{formatModules(row)}</span>
      ),
    },
    {
      key: 'frequency',
      label: 'Frequency',
      sortable: false,
      render: (_: any, row: ScheduledReport) => (
        <span className="text-sm text-gray-600">{formatFrequency(row)}</span>
      ),
    },
    {
      key: 'recipients',
      label: 'Recipients',
      sortable: false,
      render: (_: any, row: ScheduledReport) => (
        <span className="text-sm text-gray-600">{formatRecipients(row)}</span>
      ),
    },
    {
      key: 'format',
      label: 'Format',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <Badge variant="default">{row.format}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <Badge variant={row.isActive ? 'success' : 'warning'}>
          {row.isActive ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      key: 'lastSentAt',
      label: 'Last Sent',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <span className="text-sm text-gray-600">
          {row.lastSentAt ? formatDateUK(row.lastSentAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'nextSendAt',
      label: 'Next Send',
      sortable: true,
      render: (_: any, row: ScheduledReport) => (
        <span className="text-sm font-medium text-gray-900">
          {formatDateUK(row.nextSendAt)}
        </span>
      ),
    },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        render: (_: any, row: ScheduledReport) => {
          const menuItems = [
            {
              label: 'Send Now',
              icon: Play,
              onClick: () => handleSendNow(row),
            },
            ...(canEdit(row)
              ? [
                  {
                    label: 'Edit',
                    icon: Edit,
                    onClick: () => handleEdit(row),
                  },
                  {
                    label: row.isActive ? 'Pause' : 'Resume',
                    icon: row.isActive ? Pause : PlayCircle,
                    onClick: () => handleToggleActive(row),
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

          if (!menuRefs.current[row.id]) {
            menuRefs.current[row.id] = { current: null };
          }
          const buttonRef = menuRefs.current[row.id];

          return (
            <div className="relative">
              <button
                ref={(el) => {
                  if (buttonRef) buttonRef.current = el;
                }}
                onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                disabled={runningScheduleId === row.id}
                className="p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <DropdownMenu
                isOpen={openMenuId === row.id}
                onClose={() => setOpenMenuId(null)}
                anchorRef={buttonRef as React.RefObject<HTMLElement>}
                items={menuItems}
                width="w-48"
              />
            </div>
          );
        },
      },
  ];

  if (showCreateForm) {
    return (
      <CreateEditScheduleForm
        isOpen={true}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        schedule={editingSchedule || undefined}
      />
    );
  }

  return (
    <FilterPanel
      isOpen={isOpen}
      onClose={onClose}
      onApply={() => {}} // Not used for this panel
      onReset={() => {}} // Not used for this panel
      title="Scheduled Reports"
      className="md:w-[800px]"
    >
      <div className="space-y-4">
        {/* Header with Create button */}
        {canCreate && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleCreate} size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              + New Schedule
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No scheduled reports yet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a schedule to automatically send reports to recipients.
            </p>
            {canCreate && (
              <Button variant="primary" onClick={handleCreate}>
                Create Schedule
              </Button>
            )}
          </div>
        ) : (
          <SortableTable columns={columns} data={schedules} />
        )}
      </div>
    </FilterPanel>
  );
}

