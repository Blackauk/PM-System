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
  createSchedule,
  updateSchedule,
  getScheduleById,
} from '../db/schedulingRepository';
import { getAllTemplates } from '../db/repository';
import { getAssets } from '../../assets/services';
import { mockSites } from '../../assets/services';
import { mockUsers } from '../../reports/services/mockUsers';
import type { InspectionSchedule, ScheduleScope, FrequencyMode, AssignedToMode } from '../types/scheduling';
import type { InspectionTemplate } from '../types';

interface CreateEditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule?: InspectionSchedule;
}

export function CreateEditScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  schedule,
}: CreateEditScheduleModalProps) {
  const { user } = useAuth();
  const isEditing = !!schedule;

  // Form state
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [scope, setScope] = useState<ScheduleScope>('ALL_ASSETS');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetTypeId, setAssetTypeId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [inspectionType, setInspectionType] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Statutory' | 'Custom'>('Daily');
  const [assignedToMode, setAssignedToMode] = useState<AssignedToMode>('UNASSIGNED');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>('FIXED_TIME');

  // Fixed time fields
  const [startDate, setStartDate] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [intervalValue, setIntervalValue] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [timezone, setTimezone] = useState('Europe/London');

  // Rolling fields
  const [afterCompletionUnit, setAfterCompletionUnit] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [afterCompletionValue, setAfterCompletionValue] = useState(7);

  // Usage-based fields
  const [meterType, setMeterType] = useState<'HOURS' | 'KM' | 'CYCLES'>('HOURS');
  const [thresholdValue, setThresholdValue] = useState(250);

  // Event-driven fields
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);

  // Due rules
  const [dueOffsetDays, setDueOffsetDays] = useState(0);
  const [overdueAfterDays, setOverdueAfterDays] = useState(7);

  // Constraints
  const [avoidDuplicatesWindowHours, setAvoidDuplicatesWindowHours] = useState(12);
  const [maxOpenPerAssetPerTemplate, setMaxOpenPerAssetPerTemplate] = useState(1);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load templates and assets
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  
  useEffect(() => {
    async function loadTemplates() {
      try {
        const loaded = await getAllTemplates();
        setTemplates(loaded);
      } catch {
        setTemplates([]);
      }
    }
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const assets = useMemo(() => {
    try {
      return getAssets({ siteId });
    } catch {
      return [];
    }
  }, [siteId]);

  const assetTypes = useMemo(() => {
    const types = new Map<string, { id: string; code: string }>();
    assets.forEach((asset) => {
      if (asset.assetTypeId && asset.assetTypeCode) {
        types.set(asset.assetTypeId, { id: asset.assetTypeId, code: asset.assetTypeCode });
      }
    });
    return Array.from(types.values());
  }, [assets]);

  // Initialize form from schedule
  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setSiteId(schedule.siteId);
      setScope(schedule.scope);
      setSelectedAssetIds(schedule.assetIds || []);
      setAssetTypeId(schedule.assetTypeId || '');
      setTags(schedule.tags || []);
      setTemplateId(schedule.templateId);
      setInspectionType(schedule.inspectionType);
      setAssignedToMode(schedule.assignedToMode);
      setAssignedUserId(schedule.assignedUserId || '');
      setTeamId(schedule.teamId || '');
      setFrequencyMode(schedule.frequencyMode);

      if (schedule.fixedTime) {
        setStartDate(schedule.fixedTime.startDate);
        setIntervalUnit(schedule.fixedTime.intervalUnit);
        setIntervalValue(schedule.fixedTime.intervalValue);
        setDaysOfWeek(schedule.fixedTime.daysOfWeek || []);
        setDayOfMonth(schedule.fixedTime.dayOfMonth || 1);
        setTimeOfDay(schedule.fixedTime.timeOfDay);
        setTimezone(schedule.fixedTime.timezone);
      }

      if (schedule.rolling) {
        setAfterCompletionUnit(schedule.rolling.afterCompletionUnit);
        setAfterCompletionValue(schedule.rolling.afterCompletionValue);
      }

      if (schedule.usageBased) {
        setMeterType(schedule.usageBased.meterType);
        setThresholdValue(schedule.usageBased.thresholdValue);
      }

      if (schedule.eventDriven) {
        setSelectedTriggers(schedule.eventDriven.triggers);
      }

      setDueOffsetDays(schedule.dueRules.dueOffsetDays);
      setOverdueAfterDays(schedule.dueRules.overdueAfterDays);
      setAvoidDuplicatesWindowHours(schedule.constraints.avoidDuplicatesWindowHours);
      setMaxOpenPerAssetPerTemplate(schedule.constraints.maxOpenPerAssetPerTemplate);
    } else {
      // Reset form
      setName('');
      setSiteId(user?.siteIds?.[0] || '');
      setScope('ALL_ASSETS');
      setSelectedAssetIds([]);
      setAssetTypeId('');
      setTags([]);
      setTemplateId('');
      setInspectionType('Daily');
      setAssignedToMode('UNASSIGNED');
      setAssignedUserId('');
      setTeamId('');
      setFrequencyMode('FIXED_TIME');
      setStartDate(new Date().toISOString().split('T')[0]);
      setIntervalUnit('DAY');
      setIntervalValue(1);
      setDaysOfWeek([]);
      setDayOfMonth(1);
      setTimeOfDay('09:00');
      setTimezone('Europe/London');
      setAfterCompletionUnit('DAY');
      setAfterCompletionValue(7);
      setMeterType('HOURS');
      setThresholdValue(250);
      setSelectedTriggers([]);
      setDueOffsetDays(0);
      setOverdueAfterDays(7);
      setAvoidDuplicatesWindowHours(12);
      setMaxOpenPerAssetPerTemplate(1);
    }
    setErrors({});
  }, [schedule, isOpen, user]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!siteId) newErrors.siteId = 'Site is required';
    if (!templateId) newErrors.templateId = 'Template is required';

    if (scope === 'ASSET_IDS' && selectedAssetIds.length === 0) {
      newErrors.scope = 'At least one asset must be selected';
    }
    if (scope === 'ASSET_TYPE' && !assetTypeId) {
      newErrors.scope = 'Asset type must be selected';
    }

    if (frequencyMode === 'FIXED_TIME') {
      if (!startDate) newErrors.startDate = 'Start date is required';
      if (!timeOfDay) newErrors.timeOfDay = 'Time is required';
    }

    if (frequencyMode === 'ROLLING_AFTER_COMPLETION') {
      if (afterCompletionValue <= 0) {
        newErrors.afterCompletionValue = 'Value must be greater than 0';
      }
    }

    if (frequencyMode === 'USAGE_BASED') {
      if (thresholdValue <= 0) {
        newErrors.thresholdValue = 'Threshold must be greater than 0';
      }
    }

    if (frequencyMode === 'EVENT_DRIVEN') {
      if (selectedTriggers.length === 0) {
        newErrors.triggers = 'At least one trigger must be selected';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setSaving(true);
    try {
      const scheduleData: Omit<InspectionSchedule, 'id' | 'scheduleCode' | 'createdAt' | 'updatedAt'> = {
        name,
        siteId,
        siteName: mockSites.find((s) => s.id === siteId)?.name,
        scope,
        assetIds: scope === 'ASSET_IDS' ? selectedAssetIds : undefined,
        assetTypeId: scope === 'ASSET_TYPE' ? assetTypeId : undefined,
        assetTypeCode: scope === 'ASSET_TYPE' ? assetTypes.find((t) => t.id === assetTypeId)?.code : undefined,
        tags: scope === 'TAGS' ? tags : undefined,
        templateId,
        templateName: templates.find((t) => t.id === templateId)?.name,
        inspectionType,
        assignedToMode,
        assignedUserId: assignedToMode === 'FIXED_USER' ? assignedUserId : undefined,
        assignedUserName: assignedToMode === 'FIXED_USER' ? mockUsers.find((u) => u.id === assignedUserId)?.firstName + ' ' + mockUsers.find((u) => u.id === assignedUserId)?.lastName : undefined,
        teamId: assignedToMode === 'ROTATE_TEAM' ? teamId : undefined,
        teamName: assignedToMode === 'ROTATE_TEAM' ? 'Team' : undefined,
        frequencyMode,
        fixedTime: frequencyMode === 'FIXED_TIME' ? {
          startDate,
          intervalUnit,
          intervalValue,
          daysOfWeek: intervalUnit === 'WEEK' ? daysOfWeek : undefined,
          dayOfMonth: intervalUnit === 'MONTH' ? dayOfMonth : undefined,
          timeOfDay,
          timezone,
        } : undefined,
        rolling: frequencyMode === 'ROLLING_AFTER_COMPLETION' ? {
          afterCompletionUnit,
          afterCompletionValue,
        } : undefined,
        usageBased: frequencyMode === 'USAGE_BASED' ? {
          meterType,
          thresholdValue,
        } : undefined,
        eventDriven: frequencyMode === 'EVENT_DRIVEN' ? {
          triggers: selectedTriggers as any,
        } : undefined,
        dueRules: {
          dueOffsetDays,
          overdueAfterDays,
        },
        constraints: {
          avoidDuplicatesWindowHours,
          maxOpenPerAssetPerTemplate,
        },
        status: 'ACTIVE',
        createdBy: schedule?.createdBy || user?.id || '',
        createdByName: schedule?.createdByName || `${user?.firstName} ${user?.lastName}` || '',
      };

      if (isEditing && schedule) {
        await updateSchedule(schedule.id, scheduleData);
        showToast('Schedule updated successfully', 'success');
      } else {
        await createSchedule(scheduleData);
        showToast('Schedule created successfully', 'success');
      }

      onSuccess();
    } catch (error: any) {
      showToast(error.message || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
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

  const triggerOptions = [
    { value: 'DEFECT_MARKED_UNSAFE', label: 'Defect Marked Unsafe' },
    { value: 'DEFECT_REOPENED', label: 'Defect Reopened' },
    { value: 'ASSET_STATUS_CHANGED', label: 'Asset Status Changed' },
    { value: 'COMPLIANCE_EXPIRING', label: 'Compliance Expiring' },
    { value: 'PM_OVERDUE', label: 'PM Overdue' },
    { value: 'INSPECTION_FAILED', label: 'Inspection Failed' },
    { value: 'MANUAL_TRIGGER', label: 'Manual Trigger' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Schedule' : 'Create Schedule'}
      size="large"
    >
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          
          <Input
            label="Schedule Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
          />

          <Select
            label="Site *"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            error={errors.siteId}
            required
            options={[
              { value: '', label: 'Select site...' },
              ...mockSites.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />

          <Select
            label="Template *"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            error={errors.templateId}
            required
            options={[
              { value: '', label: 'Select template...' },
              ...templates.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />

          <Select
            label="Inspection Type"
            value={inspectionType}
            onChange={(e) => setInspectionType(e.target.value as any)}
            options={[
              { value: 'Daily', label: 'Daily' },
              { value: 'Weekly', label: 'Weekly' },
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Statutory', label: 'Statutory' },
              { value: 'Custom', label: 'Custom' },
            ]}
          />
        </div>

        {/* Scope */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Scope</h3>
          
          <Select
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as ScheduleScope)}
            options={[
              { value: 'ALL_ASSETS', label: 'All Assets' },
              { value: 'ASSET_IDS', label: 'Selected Assets' },
              { value: 'ASSET_TYPE', label: 'Asset Type' },
              { value: 'TAGS', label: 'Tags' },
            ]}
          />

          {scope === 'ASSET_IDS' && (
            <SearchableMultiSelect
              label="Select Assets"
              options={assets.map((a) => ({ value: a.id, label: `${a.id} - ${a.make} ${a.model}` }))}
              selected={selectedAssetIds}
              onChange={setSelectedAssetIds}
              error={errors.scope}
            />
          )}

          {scope === 'ASSET_TYPE' && (
            <Select
              label="Asset Type"
              value={assetTypeId}
              onChange={(e) => setAssetTypeId(e.target.value)}
              error={errors.scope}
              options={[
                { value: '', label: 'Select asset type...' },
                ...assetTypes.map((t) => ({ value: t.id, label: t.code })),
              ]}
            />
          )}

          {scope === 'TAGS' && (
            <Input
              label="Tags (comma-separated)"
              value={tags.join(', ')}
              onChange={(e) => setTags(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              placeholder="e.g., safety, critical, weekly"
            />
          )}
        </div>

        {/* Assignment */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Assignment</h3>
          
          <Select
            label="Assigned To"
            value={assignedToMode}
            onChange={(e) => setAssignedToMode(e.target.value as AssignedToMode)}
            options={[
              { value: 'UNASSIGNED', label: 'Unassigned' },
              { value: 'FIXED_USER', label: 'Fixed User' },
              { value: 'ROTATE_TEAM', label: 'Rotate Team' },
            ]}
          />

          {assignedToMode === 'FIXED_USER' && (
            <Select
              label="User"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              options={[
                { value: '', label: 'Select user...' },
                ...mockUsers.filter((u) => u.siteIds?.includes(siteId)).map((u) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                })),
              ]}
            />
          )}

          {assignedToMode === 'ROTATE_TEAM' && (
            <Input
              label="Team ID"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Enter team identifier"
            />
          )}
        </div>

        {/* Frequency */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Frequency</h3>
          
          <Select
            label="Frequency Mode"
            value={frequencyMode}
            onChange={(e) => setFrequencyMode(e.target.value as FrequencyMode)}
            options={[
              { value: 'FIXED_TIME', label: 'Fixed Time' },
              { value: 'ROLLING_AFTER_COMPLETION', label: 'Rolling After Completion' },
              { value: 'USAGE_BASED', label: 'Usage Based' },
              { value: 'EVENT_DRIVEN', label: 'Event Driven' },
            ]}
          />

          {frequencyMode === 'FIXED_TIME' && (
            <div className="space-y-3">
              <Input
                label="Start Date *"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                error={errors.startDate}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Interval Value"
                  type="number"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(parseInt(e.target.value) || 1)}
                  min={1}
                />
                <Select
                  label="Interval Unit"
                  value={intervalUnit}
                  onChange={(e) => setIntervalUnit(e.target.value as any)}
                  options={[
                    { value: 'DAY', label: 'Days' },
                    { value: 'WEEK', label: 'Weeks' },
                    { value: 'MONTH', label: 'Months' },
                  ]}
                />
              </div>
              {intervalUnit === 'WEEK' && (
                <SearchableMultiSelect
                  label="Days of Week"
                  options={dayOptions}
                  selected={daysOfWeek.map(String)}
                  onChange={(selected) => setDaysOfWeek(selected.map(Number))}
                />
              )}
              {intervalUnit === 'MONTH' && (
                <Input
                  label="Day of Month"
                  type="number"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                  min={1}
                  max={31}
                />
              )}
              <Input
                label="Time of Day *"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                error={errors.timeOfDay}
                required
              />
              <Input
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/London"
              />
            </div>
          )}

          {frequencyMode === 'ROLLING_AFTER_COMPLETION' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="After Completion Value *"
                type="number"
                value={afterCompletionValue}
                onChange={(e) => setAfterCompletionValue(parseInt(e.target.value) || 0)}
                error={errors.afterCompletionValue}
                min={1}
                required
              />
              <Select
                label="After Completion Unit *"
                value={afterCompletionUnit}
                onChange={(e) => setAfterCompletionUnit(e.target.value as any)}
                options={[
                  { value: 'DAY', label: 'Days' },
                  { value: 'WEEK', label: 'Weeks' },
                  { value: 'MONTH', label: 'Months' },
                ]}
              />
            </div>
          )}

          {frequencyMode === 'USAGE_BASED' && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Meter Type"
                value={meterType}
                onChange={(e) => setMeterType(e.target.value as any)}
                options={[
                  { value: 'HOURS', label: 'Hours' },
                  { value: 'KM', label: 'Kilometers' },
                  { value: 'CYCLES', label: 'Cycles' },
                ]}
              />
              <Input
                label="Threshold Value *"
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(parseInt(e.target.value) || 0)}
                error={errors.thresholdValue}
                min={1}
                required
              />
            </div>
          )}

          {frequencyMode === 'EVENT_DRIVEN' && (
            <SearchableMultiSelect
              label="Triggers *"
              options={triggerOptions}
              selected={selectedTriggers}
              onChange={setSelectedTriggers}
              error={errors.triggers}
            />
          )}
        </div>

        {/* Due Rules */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Due Rules</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Offset (days)"
              type="number"
              value={dueOffsetDays}
              onChange={(e) => setDueOffsetDays(parseInt(e.target.value) || 0)}
              min={0}
            />
            <Input
              label="Overdue After (days)"
              type="number"
              value={overdueAfterDays}
              onChange={(e) => setOverdueAfterDays(parseInt(e.target.value) || 0)}
              min={1}
            />
          </div>
        </div>

        {/* Constraints */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-900">Constraints</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Avoid Duplicates Window (hours)"
              type="number"
              value={avoidDuplicatesWindowHours}
              onChange={(e) => setAvoidDuplicatesWindowHours(parseInt(e.target.value) || 0)}
              min={0}
            />
            <Input
              label="Max Open Per Asset Per Template"
              type="number"
              value={maxOpenPerAssetPerTemplate}
              onChange={(e) => setMaxOpenPerAssetPerTemplate(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Schedule' : 'Create Schedule'}
        </Button>
      </div>
    </Modal>
  );
}

