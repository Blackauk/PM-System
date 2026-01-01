import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Checkbox } from '../../../components/common/Checkbox';
import { SearchableMultiSelect } from '../../../components/common/SearchableMultiSelect';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createPerInspectionSchedule,
  updatePerInspectionSchedule,
  getScheduleByInspectionId,
  deletePerInspectionSchedule,
} from '../db/perInspectionScheduleRepository';
import { mockUsers } from '../../reports/services/mockUsers';
import type { PerInspectionSchedule, ScheduleFrequency, EndCondition } from '../types/perInspectionSchedule';
import type { Inspection } from '../types';

interface InspectionScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inspection: Inspection;
}

export function InspectionScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  inspection,
}: InspectionScheduleModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [existingSchedule, setExistingSchedule] = useState<PerInspectionSchedule | null>(null);

  // Form state
  const [frequency, setFrequency] = useState<ScheduleFrequency>('Weekly');
  const [startDate, setStartDate] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeekInMonth, setDayOfWeekInMonth] = useState<'first' | 'second' | 'third' | 'fourth' | 'last' | undefined>(undefined);
  const [intervalDays, setIntervalDays] = useState(7);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [dueByEndOfDay, setDueByEndOfDay] = useState(true);
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [endCondition, setEndCondition] = useState<EndCondition>('Never');
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState(12);
  const [rollingWindowEnabled, setRollingWindowEnabled] = useState(true);
  const [generateNextN, setGenerateNextN] = useState(4);
  const [windowUnit, setWindowUnit] = useState<'weeks' | 'months'>('weeks');
  const [skipMissed, setSkipMissed] = useState(false);
  const [status, setStatus] = useState<'Active' | 'Paused'>('Active');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing schedule
  useEffect(() => {
    if (isOpen && inspection) {
      loadExistingSchedule();
    }
  }, [isOpen, inspection]);

  const loadExistingSchedule = async () => {
    try {
      const schedule = await getScheduleByInspectionId(inspection.id);
      if (schedule) {
        setExistingSchedule(schedule);
        setFrequency(schedule.frequency);
        setStartDate(schedule.startDate);
        setDaysOfWeek(schedule.pattern.daysOfWeek || []);
        setDayOfMonth(schedule.pattern.dayOfMonth || 1);
        setDayOfWeekInMonth(schedule.pattern.dayOfWeekInMonth);
        setIntervalDays(schedule.pattern.intervalDays || 7);
        setTimeOfDay(schedule.timeOfDay || '');
        setDueByEndOfDay(schedule.dueByEndOfDay ?? true);
        setAssignedToUserId(schedule.assignedToUserId || '');
        setEndCondition(schedule.endCondition);
        setEndDate(schedule.endDate || '');
        setMaxOccurrences(schedule.maxOccurrences || 12);
        setRollingWindowEnabled(schedule.rollingWindow.enabled);
        setGenerateNextN(schedule.rollingWindow.generateNextN);
        setWindowUnit(schedule.rollingWindow.windowUnit);
        setSkipMissed(schedule.skipMissed);
        setStatus(schedule.status);
      } else {
        // Reset to defaults
        setExistingSchedule(null);
        setFrequency('Weekly');
        setStartDate(new Date().toISOString().split('T')[0]);
        setDaysOfWeek([]);
        setDayOfMonth(1);
        setDayOfWeekInMonth(undefined);
        setIntervalDays(7);
        setTimeOfDay('');
        setDueByEndOfDay(true);
        setAssignedToUserId(inspection.inspectorId || '');
        setEndCondition('Never');
        setEndDate('');
        setMaxOccurrences(12);
        setRollingWindowEnabled(true);
        setGenerateNextN(4);
        setWindowUnit('weeks');
        setSkipMissed(false);
        setStatus('Active');
      }
    } catch (error: any) {
      console.error('Failed to load schedule:', error);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (frequency === 'Weekly' && daysOfWeek.length === 0) {
      newErrors.daysOfWeek = 'At least one day of week must be selected';
    }

    if (frequency === 'Monthly' && !dayOfMonth && !dayOfWeekInMonth) {
      newErrors.dayOfMonth = 'Day of month or day of week in month must be specified';
    }

    if (frequency === 'Custom' && (!intervalDays || intervalDays < 1)) {
      newErrors.intervalDays = 'Interval must be at least 1 day';
    }

    if (endCondition === 'EndByDate' && !endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (endCondition === 'EndAfterOccurrences' && (!maxOccurrences || maxOccurrences < 1)) {
      newErrors.maxOccurrences = 'Max occurrences must be at least 1';
    }

    if (rollingWindowEnabled && (!generateNextN || generateNextN < 1)) {
      newErrors.generateNextN = 'Generate next N must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setLoading(true);
    try {
      const scheduleData: Omit<PerInspectionSchedule, 'id' | 'createdAt' | 'updatedAt' | 'generatedCount'> = {
        inspectionId: inspection.id,
        templateId: inspection.templateId,
        assetId: inspection.assetId,
        siteId: inspection.siteId || '',
        frequency,
        startDate,
        pattern: {
          ...(frequency === 'Weekly' && { daysOfWeek }),
          ...(frequency === 'Monthly' && {
            dayOfMonth: dayOfWeekInMonth ? undefined : dayOfMonth,
            dayOfWeekInMonth,
          }),
          ...(frequency === 'Custom' && { intervalDays }),
        },
        timeOfDay: dueByEndOfDay ? undefined : timeOfDay,
        dueByEndOfDay,
        assignedToUserId: assignedToUserId || undefined,
        endCondition,
        endDate: endCondition === 'EndByDate' ? endDate : undefined,
        maxOccurrences: endCondition === 'EndAfterOccurrences' ? maxOccurrences : undefined,
        rollingWindow: {
          enabled: rollingWindowEnabled,
          generateNextN,
          windowUnit,
        },
        skipMissed,
        status,
        createdBy: existingSchedule?.createdBy || user?.id || '',
        createdByName: existingSchedule?.createdByName || `${user?.firstName} ${user?.lastName}` || 'Unknown',
      };

      if (existingSchedule) {
        await updatePerInspectionSchedule(existingSchedule.id, scheduleData);
        showToast('Schedule updated successfully', 'success');
      } else {
        await createPerInspectionSchedule(scheduleData);
        showToast('Schedule created successfully', 'success');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to save schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSchedule) return;
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await deletePerInspectionSchedule(existingSchedule.id);
      showToast('Schedule deleted successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete schedule', 'error');
    }
  };

  const dayOptions = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];

  const formatScheduleSummary = (): string => {
    if (frequency === 'Weekly' && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek.map((d) => dayOptions[d].label.substring(0, 3)).join(', ');
      return `Weekly (${dayNames})`;
    }
    if (frequency === 'Monthly') {
      if (dayOfWeekInMonth) {
        return `Monthly (${dayOfWeekInMonth} ${dayOptions[daysOfWeek[0] || 1].label})`;
      }
      return `Monthly (Day ${dayOfMonth})`;
    }
    if (frequency === 'Custom') {
      return `Every ${intervalDays} days`;
    }
    return frequency;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingSchedule ? 'Edit Schedule' : 'Set Schedule'}
      size="medium"
    >
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Schedule Summary Preview */}
        {existingSchedule && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-900">Current Schedule</div>
            <div className="text-sm text-blue-700 mt-1">{formatScheduleSummary()}</div>
          </div>
        )}

        {/* Frequency */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Frequency</h3>
          <Select
            label="Frequency *"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
            options={[
              { value: 'Daily', label: 'Daily' },
              { value: 'Weekly', label: 'Weekly' },
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Yearly', label: 'Yearly' },
              { value: 'Custom', label: 'Custom' },
            ]}
          />
        </div>

        {/* Start Date */}
        <div className="space-y-3">
          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            error={errors.startDate}
            required
          />
        </div>

        {/* Pattern based on frequency */}
        {frequency === 'Weekly' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Days of Week</h3>
            <SearchableMultiSelect
              label="Select Days *"
              options={dayOptions}
              selected={daysOfWeek.map(String)}
              onChange={(selected) => setDaysOfWeek(selected.map(Number))}
              error={errors.daysOfWeek}
            />
          </div>
        )}

        {frequency === 'Monthly' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Day Pattern</h3>
            <div className="space-y-2">
              <Select
                label="Pattern Type"
                value={dayOfWeekInMonth ? 'dayOfWeek' : 'dayOfMonth'}
                onChange={(e) => {
                  if (e.target.value === 'dayOfWeek') {
                    setDayOfWeekInMonth('first');
                    setDaysOfWeek([1]); // Default to Monday
                  } else {
                    setDayOfWeekInMonth(undefined);
                    setDayOfMonth(1);
                  }
                }}
                options={[
                  { value: 'dayOfMonth', label: 'Specific Day (e.g., Day 15)' },
                  { value: 'dayOfWeek', label: 'Day of Week (e.g., First Monday)' },
                ]}
              />
              {dayOfWeekInMonth ? (
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Which"
                    value={dayOfWeekInMonth}
                    onChange={(e) => setDayOfWeekInMonth(e.target.value as any)}
                    options={[
                      { value: 'first', label: 'First' },
                      { value: 'second', label: 'Second' },
                      { value: 'third', label: 'Third' },
                      { value: 'fourth', label: 'Fourth' },
                      { value: 'last', label: 'Last' },
                    ]}
                  />
                  <Select
                    label="Day of Week"
                    value={String(daysOfWeek[0] || 1)}
                    onChange={(e) => setDaysOfWeek([Number(e.target.value)])}
                    options={dayOptions}
                  />
                </div>
              ) : (
                <Input
                  label="Day of Month *"
                  type="number"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                  min={1}
                  max={31}
                  error={errors.dayOfMonth}
                />
              )}
            </div>
          </div>
        )}

        {frequency === 'Custom' && (
          <div className="space-y-3">
            <Input
              label="Interval (days) *"
              type="number"
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
              min={1}
              error={errors.intervalDays}
              required
            />
          </div>
        )}

        {/* Time Window */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Time Window</h3>
          <Checkbox
            label="Due by end of day"
            checked={dueByEndOfDay}
            onChange={(e) => setDueByEndOfDay(e.target.checked)}
          />
          {!dueByEndOfDay && (
            <Input
              label="Time of Day"
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
            />
          )}
        </div>

        {/* Assignment */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Assignment</h3>
          <Select
            label="Assigned To (optional)"
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            options={[
              { value: '', label: 'Use default inspector' },
              ...mockUsers
                .filter((u) => u.siteIds?.includes(inspection.siteId || ''))
                .map((u) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                })),
            ]}
          />
        </div>

        {/* End Condition */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">End Condition</h3>
          <Select
            label="End Condition"
            value={endCondition}
            onChange={(e) => setEndCondition(e.target.value as EndCondition)}
            options={[
              { value: 'Never', label: 'Never' },
              { value: 'EndByDate', label: 'End by Date' },
              { value: 'EndAfterOccurrences', label: 'End after X occurrences' },
            ]}
          />
          {endCondition === 'EndByDate' && (
            <Input
              label="End Date *"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={errors.endDate}
              required
            />
          )}
          {endCondition === 'EndAfterOccurrences' && (
            <Input
              label="Max Occurrences *"
              type="number"
              value={maxOccurrences}
              onChange={(e) => setMaxOccurrences(parseInt(e.target.value) || 1)}
              min={1}
              error={errors.maxOccurrences}
              required
            />
          )}
        </div>

        {/* Rolling Window */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Rolling Generation</h3>
          <Checkbox
            label="Enable rolling window"
            checked={rollingWindowEnabled}
            onChange={(e) => setRollingWindowEnabled(e.target.checked)}
          />
          {rollingWindowEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Generate Next N"
                type="number"
                value={generateNextN}
                onChange={(e) => setGenerateNextN(parseInt(e.target.value) || 1)}
                min={1}
                error={errors.generateNextN}
              />
              <Select
                label="Window Unit"
                value={windowUnit}
                onChange={(e) => setWindowUnit(e.target.value as 'weeks' | 'months')}
                options={[
                  { value: 'weeks', label: 'Weeks' },
                  { value: 'months', label: 'Months' },
                ]}
              />
            </div>
          )}
        </div>

        {/* Skip/Reschedule Logic */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Skip/Reschedule Logic</h3>
          <Checkbox
            label="Skip missed inspections (don't mark overdue)"
            checked={skipMissed}
            onChange={(e) => setSkipMissed(e.target.checked)}
          />
        </div>

        {/* Status */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Status</h3>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Active' | 'Paused')}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Paused', label: 'Paused' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t">
        <div>
          {existingSchedule && (
            <Button variant="outline" onClick={handleDelete} disabled={loading}>
              Delete Schedule
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : existingSchedule ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


