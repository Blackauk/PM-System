import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card } from '../../../components/common/Card';
import { CollapsibleCard } from '../../../components/common/CollapsibleCard';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Textarea } from '../../../components/common/Textarea';
import { Checkbox } from '../../../components/common/Checkbox';
import { Badge } from '../../../components/common/Badge';
import { SearchableMultiSelectAssetPicker } from '../../../components/common/SearchableMultiSelectAssetPicker';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { SearchableMultiSelect } from '../../../components/common/SearchableMultiSelect';
import { SlideOver } from '../../../components/common/SlideOver';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useInspections } from '../../inspections/context/InspectionsContext';
import { getAssets, mockSites } from '../../assets/services';
import { mockUsers } from '../../reports/services/mockUsers';
import { getScheduleById, createSchedule, updateSchedule } from '../services/inspectionScheduleService';
import type { InspectionSchedule, CalendarPattern, RollingRule } from '../types/inspectionSchedule';
import { formatDateUK } from '../../../lib/formatters';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { FileText } from 'lucide-react';

function AuditInfo({ scheduleId }: { scheduleId: string }) {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) return <div className="text-sm text-gray-500">Schedule not found</div>;
  
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-gray-500">Created</div>
        <div className="font-medium">
          {formatDateUK(schedule.createdAt || '')}
        </div>
        <div className="text-gray-500">
          by {schedule.createdByName}
        </div>
      </div>
      <div>
        <div className="text-gray-500">Last Updated</div>
        <div className="font-medium">
          {formatDateUK(schedule.updatedAt || '')}
        </div>
      </div>
      {schedule.lastGeneratedAt && (
        <div>
          <div className="text-gray-500">Last Generated</div>
          <div className="font-medium">
            {formatDateUK(schedule.lastGeneratedAt)}
          </div>
        </div>
      )}
      {schedule.nextDueDate && (
        <div>
          <div className="text-gray-500">Next Due</div>
          <div className="font-medium">
            {formatDateUK(schedule.nextDueDate)}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateEditInspectionSchedulePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { templates = [], loadTemplates } = useInspections();
  const isEditing = !!id;

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Form state - Basics
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [category, setCategory] = useState<InspectionSchedule['category']>('Operational');
  const [priority, setPriority] = useState<InspectionSchedule['priority']>('Normal');
  const [status, setStatus] = useState<InspectionSchedule['status']>('Active');

  // Scope
  const [scopeType, setScopeType] = useState<InspectionSchedule['scopeType']>('Assets');
  const [scopeAssetIds, setScopeAssetIds] = useState<string[]>([]);
  const [scopeAssetGroupId, setScopeAssetGroupId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [includeNewAssets, setIncludeNewAssets] = useState(false);

  // Frequency
  const [frequencyType, setFrequencyType] = useState<InspectionSchedule['frequencyType']>('Calendar');
  const [calendarPattern, setCalendarPattern] = useState<CalendarPattern>('Weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [nthWeekday, setNthWeekday] = useState<{ nth: 1 | 2 | 3 | 4 | 5; weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' } | null>(null);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [usageIntervalHours, setUsageIntervalHours] = useState(250);
  const [eventTrigger, setEventTrigger] = useState<'WorkOrderClosed' | 'DefectClosed'>('WorkOrderClosed');

  // Timing
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [generateAheadDays, setGenerateAheadDays] = useState(7);
  const [rollingRule, setRollingRule] = useState<RollingRule>('FixedInterval');
  const [gracePeriodDays, setGracePeriodDays] = useState(7);

  // Assignment
  const [assignmentType, setAssignmentType] = useState<'User' | 'Role' | 'Team'>('User');
  const [assignmentId, setAssignmentId] = useState('');
  const [assignmentName, setAssignmentName] = useState('');

  // Notifications
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [beforeDueHours, setBeforeDueHours] = useState<number | null>(24);
  const [notifyOnOverdue, setNotifyOnOverdue] = useState(true);
  const [escalation, setEscalation] = useState<('Supervisor' | 'Manager')[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  // Collapse/expand state for sections
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    scope: true,
    frequency: true,
    timing: false,
    assignment: false,
  });
  
  // Audit panel state
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  
  // Check if user can view audit (Admin or Manager)
  const canViewAudit = user?.role === 'Admin' || user?.role === 'Manager';

  // Load schedule if editing
  useEffect(() => {
    if (isEditing && id) {
      const schedule = getScheduleById(id);
      if (schedule) {
        setName(schedule.name);
        setTemplateId(schedule.templateId);
        setCategory(schedule.category);
        setPriority(schedule.priority);
        setStatus(schedule.status);
        setScopeType(schedule.scopeType);
        setScopeAssetIds(schedule.scopeAssetIds);
        setScopeAssetGroupId(schedule.scopeAssetGroupId || '');
        setSiteId(schedule.siteId || '');
        setLocationIds(schedule.locationIds || []);
        setIncludeNewAssets(schedule.includeNewAssets);
        setFrequencyType(schedule.frequencyType);
        if (schedule.calendarRule) {
          setCalendarPattern(schedule.calendarRule.pattern);
          setDaysOfWeek(schedule.calendarRule.daysOfWeek || []);
          setDayOfMonth(schedule.calendarRule.dayOfMonth || 1);
          setNthWeekday(schedule.calendarRule.nthWeekday || null);
          setTimeOfDay(schedule.calendarRule.timeOfDay || '09:00');
        }
        if (schedule.usageRule) {
          setUsageIntervalHours(schedule.usageRule.intervalHours);
        }
        if (schedule.eventRule) {
          setEventTrigger(schedule.eventRule.trigger);
        }
        setStartDate(schedule.startDate);
        setGenerateAheadDays(schedule.generateAheadDays);
        setRollingRule(schedule.rollingRule);
        setGracePeriodDays(schedule.gracePeriodDays);
        setAssignmentType(schedule.assignment.type);
        setAssignmentId(schedule.assignment.id);
        setAssignmentName(schedule.assignment.name);
        setNotifyOnCreate(schedule.notifications.onCreate);
        setBeforeDueHours(schedule.notifications.beforeDueHours);
        setNotifyOnOverdue(schedule.notifications.onOverdue);
        setEscalation(schedule.notifications.escalation);
      }
    }
  }, [isEditing, id]);

  // Update assignment name when type/id changes
  useEffect(() => {
    if (assignmentType === 'User' && assignmentId) {
      const user = mockUsers.find(u => u.id === assignmentId);
      setAssignmentName(user ? `${user.firstName} ${user.lastName}` : '');
    } else if (assignmentType === 'Role' && assignmentId) {
      setAssignmentName(assignmentId);
    } else if (assignmentType === 'Team' && assignmentId) {
      setAssignmentName(assignmentId);
    } else {
      setAssignmentName('');
    }
  }, [assignmentType, assignmentId]);

  const availableAssets = useMemo(() => {
    try {
      const assets = getAssets({ siteId: siteId || undefined });
      return Array.isArray(assets) ? assets : [];
    } catch (error) {
      console.error('Error loading assets:', error);
      return [];
    }
  }, [siteId]);

  // Auto-expand sections with errors
  useEffect(() => {
    const hasBasicsError = errors.name || errors.templateId;
    const hasScopeError = errors.scope || errors.siteId;
    const hasFrequencyError = errors.daysOfWeek || errors.monthly;
    const hasTimingError = errors.startDate;
    
    setExpandedSections(prev => ({
      ...prev,
      basics: prev.basics || !!hasBasicsError,
      scope: prev.scope || !!hasScopeError,
      frequency: prev.frequency || !!hasFrequencyError,
      timing: prev.timing || !!hasTimingError,
    }));
  }, [errors]);
  
  // Scroll to first error on validation
  const scrollToFirstError = () => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      const errorElement = document.querySelector(`[data-error-field="${firstErrorKey}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!templateId) newErrors.templateId = 'Template is required';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (scopeType === 'Assets' && scopeAssetIds.length === 0) {
      newErrors.scope = 'At least one asset must be selected';
    }
    if (scopeType === 'Site' && !siteId) {
      newErrors.siteId = 'Site is required';
    }
    if (frequencyType === 'Calendar' && calendarPattern === 'Weekly' && daysOfWeek.length === 0) {
      newErrors.daysOfWeek = 'At least one day of week must be selected';
    }
    if (frequencyType === 'Calendar' && calendarPattern === 'Monthly' && !dayOfMonth && !nthWeekday) {
      newErrors.monthly = 'Day of month or nth weekday must be specified';
    }
    setErrors(newErrors);
    
    // Auto-expand sections with errors and scroll
    if (Object.keys(newErrors).length > 0) {
      setTimeout(scrollToFirstError, 100);
    }
    
    return Object.keys(newErrors).length === 0;
  };
  
  // Generate summary chips
  const getSummaryChips = () => {
    const chips: Array<{ label: string; value: string }> = [];
    
    if (templateId) {
      const template = (templates || []).find(t => t.id === templateId);
      if (template) {
        chips.push({ label: 'Template', value: template.name });
      }
    }
    
    if (scopeType) {
      let scopeValue = scopeType;
      if (scopeType === 'Assets' && scopeAssetIds.length > 0) {
        scopeValue = `${scopeType} (${scopeAssetIds.length})`;
      } else if (scopeType === 'Site' && siteId) {
        const site = mockSites.find(s => s.id === siteId);
        scopeValue = site ? `Site: ${site.name}` : scopeType;
      }
      chips.push({ label: 'Scope', value: scopeValue });
    }
    
    if (frequencyType) {
      let freqValue = frequencyType;
      if (frequencyType === 'Calendar' && calendarPattern) {
        freqValue = `${calendarPattern} ${frequencyType}`;
      }
      chips.push({ label: 'Frequency', value: freqValue });
    }
    
    chips.push({ label: 'Status', value: status });
    
    return chips;
  };

  const handleSave = async (activate: boolean = false) => {
    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      const scheduleData: Omit<InspectionSchedule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName' | 'lastGeneratedAt' | 'nextDueDate'> = {
        name,
        templateId,
        templateName: templates.find(t => t.id === templateId)?.name,
        category,
        priority,
        status: activate ? 'Active' : status,
        scopeType,
        scopeAssetIds,
        scopeAssetGroupId: scopeAssetGroupId || undefined,
        siteId: siteId || undefined,
        siteName: mockSites.find(s => s.id === siteId)?.name,
        locationIds: locationIds.length > 0 ? locationIds : undefined,
        includeNewAssets,
        frequencyType,
        calendarRule: frequencyType === 'Calendar' ? {
          pattern: calendarPattern,
          daysOfWeek: calendarPattern === 'Weekly' ? daysOfWeek : undefined,
          dayOfMonth: calendarPattern === 'Monthly' && !nthWeekday ? dayOfMonth : undefined,
          nthWeekday: nthWeekday || undefined,
          timeOfDay,
        } : undefined,
        usageRule: frequencyType === 'Usage' ? {
          intervalHours: usageIntervalHours,
        } : undefined,
        eventRule: frequencyType === 'Event' ? {
          trigger: eventTrigger,
        } : undefined,
        startDate,
        generateAheadDays,
        rollingRule,
        gracePeriodDays,
        assignment: {
          type: assignmentType,
          id: assignmentId,
          name: assignmentName,
        },
        notifications: {
          onCreate: notifyOnCreate,
          beforeDueHours,
          onOverdue: notifyOnOverdue,
          escalation,
        },
        createdBy: user.id,
        createdByName: `${user.firstName} ${user.lastName}`,
      };

      if (isEditing && id) {
        updateSchedule(id, scheduleData);
        showToast('Schedule updated successfully', 'success');
      } else {
        createSchedule(scheduleData);
        showToast('Schedule created successfully', 'success');
      }

      navigate('/schedules?tab=inspections');
    } catch (error: any) {
      showToast(error.message || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === templateId);
  const summaryChips = getSummaryChips();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {isEditing ? 'Edit Inspection Schedule' : 'Create Inspection Schedule'}
                </h1>
                {summaryChips.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {summaryChips.map((chip, idx) => (
                      <Badge key={idx} variant="info" className="text-xs">
                        <span className="font-medium">{chip.label}:</span> {chip.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {canViewAudit && isEditing && id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAuditOpen(true)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Audit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 max-w-7xl mx-auto">
              <Button
                variant="outline"
                onClick={() => navigate('/schedules?tab=inspections')}
                className="w-full sm:w-auto order-3 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="w-full sm:w-auto order-2 sm:order-2"
              >
                Save as Draft
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full sm:w-auto order-1 sm:order-3"
              >
                {saving ? 'Saving...' : 'Save & Activate'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 pb-4">
          <div className="max-w-7xl mx-auto">
            {/* 2-Column Grid Layout for Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Basics */}
              <CollapsibleCard
              title="Basics"
              defaultExpanded={expandedSections.basics}
              onToggle={(expanded) => setExpandedSections(prev => ({ ...prev, basics: expanded }))}
              storageKey="schedule-basics"
              actions={
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={status === 'Active'}
                    onChange={(checked) => setStatus(checked ? 'Active' : 'Paused')}
                  />
                  <span className="text-sm text-gray-600">Active</span>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Schedule Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    placeholder="e.g., Weekly MEWP Safety Inspection"
                    data-error-field="name"
                  />
                  <Select
                    label="Template / Checklist *"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    error={errors.templateId}
                    data-error-field="templateId"
                    options={[
                      { value: '', label: 'Select template...' },
                      ...(templates || []).filter(t => t.isActive).map(t => ({
                        value: t.id,
                        label: `${t.name} (${t.inspectionType})`,
                      })),
                    ]}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    label="Category *"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InspectionSchedule['category'])}
                    options={[
                      { value: 'Statutory', label: 'Statutory' },
                      { value: 'Safety', label: 'Safety' },
                      { value: 'Operational', label: 'Operational' },
                    ]}
                  />
                  <Select
                    label="Priority *"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as InspectionSchedule['priority'])}
                    options={[
                      { value: 'Critical', label: 'Critical' },
                      { value: 'High', label: 'High' },
                      { value: 'Normal', label: 'Normal' },
                    ]}
                  />
                </div>
              </div>
            </CollapsibleCard>

            {/* Scope */}
            <CollapsibleCard
              title="Scope"
              defaultExpanded={expandedSections.scope}
              onToggle={(expanded) => setExpandedSections(prev => ({ ...prev, scope: expanded }))}
              storageKey="schedule-scope"
            >
              <div className="space-y-3">
                <Select
                  label="Scope Type *"
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value as InspectionSchedule['scopeType'])}
                  options={[
                    { value: 'Assets', label: 'Assets' },
                    { value: 'AssetGroup', label: 'Asset Group' },
                    { value: 'Site', label: 'Site' },
                    { value: 'Location', label: 'Location' },
                  ]}
                />
                {scopeType === 'Assets' && (
                  <>
                    <Select
                      label="Site (optional, for filtering)"
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      options={[
                        { value: '', label: 'All sites' },
                        ...mockSites.map(s => ({ value: s.id, label: s.name })),
                      ]}
                    />
                    <SearchableMultiSelectAssetPicker
                      assets={(availableAssets || []).map((asset) => ({
                        id: asset.id,
                        label: `${asset.assetTypeCode || ''} ${asset.id} - ${asset.make || ''} ${asset.model || ''}`,
                        typeCode: asset.assetTypeCode,
                        make: asset.make,
                        model: asset.model,
                        siteName: asset.siteName,
                      }))}
                      selected={scopeAssetIds}
                      onChange={setScopeAssetIds}
                      placeholder="Search and select assets..."
                      label="Select Assets *"
                      error={errors.scope}
                      allowMultiple={true}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeNewAssets}
                        onChange={setIncludeNewAssets}
                      />
                      <span className="text-sm text-gray-700">Include new assets added to site</span>
                    </div>
                  </>
                )}
                {scopeType === 'Site' && (
                  <Select
                    label="Site *"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    error={errors.siteId}
                    data-error-field="siteId"
                    options={[
                      { value: '', label: 'Select site...' },
                      ...mockSites.map(s => ({ value: s.id, label: s.name })),
                    ]}
                  />
                )}
              </div>
              </CollapsibleCard>

              {/* Frequency/Trigger */}
              <CollapsibleCard
              title="Frequency / Trigger"
              defaultExpanded={expandedSections.frequency}
              onToggle={(expanded) => setExpandedSections(prev => ({ ...prev, frequency: expanded }))}
              storageKey="schedule-frequency"
            >
              <div className="space-y-3">
              <Select
                label="Frequency Type *"
                value={frequencyType}
                onChange={(e) => setFrequencyType(e.target.value as InspectionSchedule['frequencyType'])}
                options={[
                  { value: 'Calendar', label: 'Calendar' },
                  { value: 'Usage', label: 'Usage' },
                  { value: 'Event', label: 'Event' },
                ]}
              />
              {frequencyType === 'Calendar' && (
                <>
                  <Select
                    label="Pattern *"
                    value={calendarPattern}
                    onChange={(e) => setCalendarPattern(e.target.value as CalendarPattern)}
                    options={[
                      { value: 'Daily', label: 'Daily' },
                      { value: 'Weekly', label: 'Weekly' },
                      { value: 'Monthly', label: 'Monthly' },
                      { value: 'Yearly', label: 'Yearly' },
                    ]}
                  />
                  {calendarPattern === 'Weekly' && (
                    <div data-error-field="daysOfWeek">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Days of Week *
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Select All Checkbox */}
                        <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
                          <Checkbox
                            checked={daysOfWeek.length === 7}
                            onChange={(checked) => {
                              if (checked) {
                                setDaysOfWeek(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
                              } else {
                                setDaysOfWeek([]);
                              }
                            }}
                            aria-label="Select all days"
                          />
                          <span className="text-sm text-gray-700 whitespace-nowrap">Select all</span>
                        </div>
                        
                        {/* Day Pills */}
                        {[
                          { value: 'Mon', label: 'Mon' },
                          { value: 'Tue', label: 'Tue' },
                          { value: 'Wed', label: 'Wed' },
                          { value: 'Thu', label: 'Thu' },
                          { value: 'Fri', label: 'Fri' },
                          { value: 'Sat', label: 'Sat' },
                          { value: 'Sun', label: 'Sun' },
                        ].map((day) => {
                          const isSelected = daysOfWeek.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setDaysOfWeek(daysOfWeek.filter(d => d !== day.value));
                                } else {
                                  setDaysOfWeek([...daysOfWeek, day.value]);
                                }
                              }}
                              className={`
                                flex-1 min-w-[3rem] px-3 py-2 rounded-md text-sm font-medium transition-colors
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                ${isSelected
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }
                              `}
                              aria-pressed={isSelected}
                              aria-label={`${day.label} ${isSelected ? 'selected' : 'not selected'}`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      {errors.daysOfWeek && (
                        <p className="mt-2 text-sm text-red-600">{errors.daysOfWeek}</p>
                      )}
                    </div>
                  )}
                  {calendarPattern === 'Monthly' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Day of Month
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={dayOfMonth}
                          onChange={(e) => {
                            setDayOfMonth(parseInt(e.target.value) || 1);
                            setNthWeekday(null);
                          }}
                        />
                      </div>
                      <div className="text-sm text-gray-600">OR</div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nth Weekday (e.g., First Monday)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={nthWeekday?.nth?.toString() || ''}
                            onChange={(e) => {
                              const nth = parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5;
                              setNthWeekday(nth && nthWeekday?.weekday ? { nth, weekday: nthWeekday.weekday } : null);
                              setDayOfMonth(0);
                            }}
                            options={[
                              { value: '', label: 'Select...' },
                              { value: '1', label: 'First' },
                              { value: '2', label: 'Second' },
                              { value: '3', label: 'Third' },
                              { value: '4', label: 'Fourth' },
                              { value: '5', label: 'Last' },
                            ]}
                          />
                          <Select
                            value={nthWeekday?.weekday || ''}
                            onChange={(e) => {
                              const weekday = e.target.value as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
                              setNthWeekday(nthWeekday?.nth ? { nth: nthWeekday.nth, weekday } : null);
                              setDayOfMonth(0);
                            }}
                            options={[
                              { value: '', label: 'Select...' },
                              { value: 'Mon', label: 'Monday' },
                              { value: 'Tue', label: 'Tuesday' },
                              { value: 'Wed', label: 'Wednesday' },
                              { value: 'Thu', label: 'Thursday' },
                              { value: 'Fri', label: 'Friday' },
                              { value: 'Sat', label: 'Saturday' },
                              { value: 'Sun', label: 'Sunday' },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Input
                    label="Time of Day (HH:mm)"
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </>
              )}
              {frequencyType === 'Usage' && (
                <Input
                  label="Interval Hours *"
                  type="number"
                  value={usageIntervalHours}
                  onChange={(e) => setUsageIntervalHours(parseInt(e.target.value) || 0)}
                />
              )}
              {frequencyType === 'Event' && (
                <Select
                  label="Trigger *"
                  value={eventTrigger}
                  onChange={(e) => setEventTrigger(e.target.value as 'WorkOrderClosed' | 'DefectClosed')}
                  options={[
                    { value: 'WorkOrderClosed', label: 'Work Order Closed' },
                    { value: 'DefectClosed', label: 'Defect Closed' },
                  ]}
                />
              )}
              </div>
              </CollapsibleCard>

              {/* Timing Rules */}
              <CollapsibleCard
                title="Timing Rules"
                defaultExpanded={expandedSections.timing}
                onToggle={(expanded) => setExpandedSections(prev => ({ ...prev, timing: expanded }))}
                storageKey="schedule-timing"
              >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Start Date *"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  error={errors.startDate}
                  data-error-field="startDate"
                />
                <Input
                  label="Generate Ahead (days)"
                  type="number"
                  min="0"
                  max="30"
                  value={generateAheadDays}
                  onChange={(e) => setGenerateAheadDays(parseInt(e.target.value) || 0)}
                  helpText="Generate inspections this many days in advance"
                />
                <Select
                  label="Rolling Rule *"
                  value={rollingRule}
                  onChange={(e) => setRollingRule(e.target.value as RollingRule)}
                  options={[
                    { value: 'FixedInterval', label: 'Fixed Interval (advance regardless of completion)' },
                    { value: 'NextAfterComplete', label: 'Next After Complete (advance only when completed)' },
                  ]}
                />
                <Input
                  label="Grace Period (days)"
                  type="number"
                  min="0"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(parseInt(e.target.value) || 0)}
                  helpText="Days after due date before marking as overdue"
                />
              </div>
              </CollapsibleCard>
            </div>

            {/* Assignment + Notifications - Full Width */}
            <div className="mt-4">
              <CollapsibleCard
                title="Assignment & Notifications"
                defaultExpanded={expandedSections.assignment}
                onToggle={(expanded) => setExpandedSections(prev => ({ ...prev, assignment: expanded }))}
                storageKey="schedule-assignment"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Assignment Type + Assigned User + Notifications */}
                  <div className="space-y-3">
                    <Select
                      label="Assignment Type"
                      value={assignmentType}
                      onChange={(e) => {
                        setAssignmentType(e.target.value as 'User' | 'Role' | 'Team');
                        setAssignmentId('');
                      }}
                      options={[
                        { value: 'User', label: 'User' },
                        { value: 'Role', label: 'Role' },
                        { value: 'Team', label: 'Team' },
                      ]}
                    />
                    {assignmentType === 'User' && (
                      <Select
                        label="Assigned User"
                        value={assignmentId}
                        onChange={(e) => setAssignmentId(e.target.value)}
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...mockUsers.map(u => ({
                            value: u.id,
                            label: `${u.firstName} ${u.lastName} (${u.email})`,
                          })),
                        ]}
                      />
                    )}
                    {assignmentType === 'Role' && (
                      <Select
                        label="Assigned Role"
                        value={assignmentId}
                        onChange={(e) => setAssignmentId(e.target.value)}
                        options={[
                          { value: '', label: 'Select role...' },
                          { value: 'Supervisor', label: 'Supervisor' },
                          { value: 'Manager', label: 'Manager' },
                          { value: 'Fitter', label: 'Fitter' },
                        ]}
                      />
                    )}
                    {assignmentType === 'Team' && (
                      <Select
                        label="Assigned Team"
                        value={assignmentId}
                        onChange={(e) => setAssignmentId(e.target.value)}
                        options={[
                          { value: '', label: 'Select team...' },
                          { value: 'Team1', label: 'Team 1' },
                          { value: 'Team2', label: 'Team 2' },
                        ]}
                      />
                    )}
                    {/* Notifications - inline on one line */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notifications
                      </label>
                      <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-3 cursor-pointer" htmlFor="notify-on-create">
                          <Checkbox
                            id="notify-on-create"
                            checked={notifyOnCreate}
                            onChange={setNotifyOnCreate}
                            className="w-4 h-4 flex-shrink-0"
                            aria-label="Notify when inspection is created"
                          />
                          <span className="text-sm text-gray-700 leading-tight">Notify when inspection is created</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer" htmlFor="notify-on-overdue">
                          <Checkbox
                            id="notify-on-overdue"
                            checked={notifyOnOverdue}
                            onChange={setNotifyOnOverdue}
                            className="w-4 h-4 flex-shrink-0"
                            aria-label="Notify when overdue"
                          />
                          <span className="text-sm text-gray-700 leading-tight">Notify when overdue</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Notify Before Due + Escalation */}
                  <div className="space-y-3">
                    <Input
                      label="Notify Before Due (hours)"
                      type="number"
                      value={beforeDueHours || ''}
                      onChange={(e) => setBeforeDueHours(e.target.value ? parseInt(e.target.value) : null)}
                      helpText="Leave empty to disable"
                    />
                    <SearchableMultiSelect
                      label="Escalation"
                      options={[
                        { value: 'Supervisor', label: 'Supervisor' },
                        { value: 'Manager', label: 'Manager' },
                      ]}
                      selected={escalation}
                      onChange={(selected) => {
                        setEscalation(selected as ('Supervisor' | 'Manager')[]);
                      }}
                      placeholder="Select escalation recipients..."
                    />
                  </div>
                </div>
              </CollapsibleCard>
            </div>
          </div>
        </div>

        {/* Audit Slide-Over */}
        {canViewAudit && (
          <SlideOver
            isOpen={isAuditOpen}
            onClose={() => setIsAuditOpen(false)}
            title="Audit Information"
            width="md"
          >
            {isEditing && id ? (
              <AuditInfo scheduleId={id} />
            ) : (
              <div className="text-sm text-gray-500">
                Audit information will appear after creation.
              </div>
            )}
          </SlideOver>
        )}
      </div>
    </ErrorBoundary>
  );
}

