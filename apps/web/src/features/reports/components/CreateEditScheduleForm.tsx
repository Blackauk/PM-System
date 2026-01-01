import { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../components/common/Button';
import { ScheduleFormPanel } from './ScheduleFormPanel';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Checkbox } from '../../../components/common/Checkbox';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createSchedule,
  updateSchedule,
} from '../services/scheduledReportsService';
import type {
  ScheduledReport,
  CreateScheduleData,
  ReportView,
  ReportModule,
  ScheduleFrequency,
  DeliveryFormat,
  DateRangeRule,
  Recipient,
} from '../types/scheduledReportsV2';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { mockUsers } from '../services/mockUsers';

const TIMEZONES = [
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

const REPORT_VIEWS: ReportView[] = [
  'Overview',
  'Assets',
  'Work Orders',
  'Inspections',
  'Defects',
  'Compliance',
];

// Available modules per view
const MODULES_BY_VIEW: Record<ReportView, ReportModule[]> = {
  Overview: ['KPIs', 'Charts', 'Tables'],
  Assets: ['KPIs', 'Charts', 'Tables'],
  'Work Orders': ['KPIs', 'Charts', 'Tables'],
  Inspections: ['KPIs', 'Charts', 'Tables'],
  Defects: ['KPIs', 'Charts', 'Tables'],
  Compliance: ['KPIs', 'Charts', 'Tables'],
};

interface CreateEditScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule?: ScheduledReport;
}

export function CreateEditScheduleForm({
  isOpen,
  onClose,
  onSuccess,
  schedule,
}: CreateEditScheduleFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [reportView, setReportView] = useState<ReportView>('Overview');
  const [modules, setModules] = useState<ReportModule[] | 'All'>('All');
  const [dateRangeRule, setDateRangeRule] = useState<DateRangeRule>('Last 7 days');
  const [customDateRange, setCustomDateRange] = useState<{
    days?: number;
    startDate?: string;
    endDate?: string;
  }>({});
  const [frequencyType, setFrequencyType] = useState<ScheduleFrequency>('Weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [timezone, setTimezone] = useState('Europe/London');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState<string[]>(['']);
  const [format, setFormat] = useState<DeliveryFormat>('CSV');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [includeAttachments, setIncludeAttachments] = useState({
    csv: true,
    pdf: false,
    inlineSummary: true,
  });

  // Available modules for selected view
  const availableModules = useMemo(
    () => MODULES_BY_VIEW[reportView] || [],
    [reportView]
  );

  // User options
  const userOptions = useMemo(() => {
    return mockUsers.map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName} (${u.email})`,
    }));
  }, []);

  // Reset form when modal opens/closes or schedule changes
  useEffect(() => {
    if (isOpen) {
      if (schedule) {
        // Edit mode
        setName(schedule.name);
        setReportView(schedule.reportView);
        setModules(schedule.modules);
        setDateRangeRule(schedule.dateRangeRule);
        setCustomDateRange(schedule.customDateRange || {});
        setFrequencyType(schedule.frequencyType);
        setDayOfWeek(schedule.dayOfWeek ?? 1);
        setDayOfMonth(schedule.dayOfMonth ?? 1);
        setTimeOfDay(schedule.timeOfDay);
        setTimezone(schedule.timezone);
        setSelectedUserIds(
          schedule.recipients.filter((r) => r.type === 'user').map((r) => r.userId!).filter(Boolean)
        );
        setExternalEmails(
          schedule.recipients.filter((r) => r.type === 'external').map((r) => r.email)
        );
        if (externalEmails.length === 0) setExternalEmails(['']);
        setFormat(schedule.format);
        setSubjectTemplate(schedule.subjectTemplate);
        setMessage(schedule.message || '');
        setIncludeAttachments(schedule.includeAttachments);
      } else {
        // Create mode - reset to defaults
        setName('');
        setReportView('Overview');
        setModules('All');
        setDateRangeRule('Last 7 days');
        setCustomDateRange({});
        setFrequencyType('Weekly');
        setDayOfWeek(1);
        setDayOfMonth(1);
        setTimeOfDay('09:00');
        setTimezone('Europe/London');
        setSelectedUserIds([]);
        setExternalEmails(['']);
        setFormat('CSV');
        setSubjectTemplate('');
        setMessage('');
        setIncludeAttachments({ csv: true, pdf: false, inlineSummary: true });
      }
      setError(null);
    }
  }, [isOpen, schedule]);

  // Update subject template when reportView or dateRangeRule changes
  useEffect(() => {
    if (!schedule && name && reportView && dateRangeRule) {
      const defaultSubject = `CoreCheck Report — ${reportView} — ${dateRangeRule}`;
      if (!subjectTemplate || subjectTemplate === schedule?.subjectTemplate) {
        setSubjectTemplate(defaultSubject);
      }
    }
  }, [reportView, dateRangeRule, schedule]);

  // Handle external email input
  const handleExternalEmailChange = (index: number, value: string) => {
    const newEmails = [...externalEmails];
    newEmails[index] = value;
    setExternalEmails(newEmails);
  };

  const handleAddExternalEmail = () => {
    setExternalEmails([...externalEmails, '']);
  };

  const handleRemoveExternalEmail = (index: number) => {
    if (externalEmails.length > 1) {
      setExternalEmails(externalEmails.filter((_, i) => i !== index));
    }
  };

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!name.trim()) errors.push('Schedule name is required');
    if (selectedUserIds.length === 0 && externalEmails.filter((e) => e.trim()).length === 0) {
      errors.push('At least one recipient is required');
    }
    if (modules !== 'All' && (!Array.isArray(modules) || modules.length === 0)) {
      errors.push('At least one module must be selected');
    }

    // Validate external emails
    const validExternalEmails = externalEmails.filter((e) => e.trim());
    for (const email of validExternalEmails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email address: ${email}`);
      }
    }

    // Validate time
    if (!timeOfDay || !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(timeOfDay)) {
      errors.push('Valid time is required (HH:mm format)');
    }

    return errors;
  }, [name, selectedUserIds, externalEmails, modules, timeOfDay]);

  const isValid = validationErrors.length === 0;

  // Handle submit
  const handleSubmit = async () => {
    if (!isValid || !user) {
      setError(validationErrors.join(', '));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validExternalEmails = externalEmails.filter((e) => e.trim());

      const recipients: Recipient[] = [
        ...selectedUserIds.map((userId) => {
          const user = mockUsers.find((u) => u.id === userId);
          return {
            type: 'user' as const,
            userId,
            email: user?.email || '',
            name: user ? `${user.firstName} ${user.lastName}` : undefined,
          };
        }),
        ...validExternalEmails.map((email) => ({
          type: 'external' as const,
          email,
        })),
      ];

      const scheduleData: CreateScheduleData = {
        name: name.trim(),
        reportView,
        modules,
        dateRangeRule,
        customDateRange: dateRangeRule === 'Custom' ? customDateRange : undefined,
        frequencyType,
        dayOfWeek: frequencyType === 'Weekly' ? dayOfWeek : undefined,
        dayOfMonth: frequencyType === 'Monthly' ? dayOfMonth : undefined,
        timeOfDay,
        timezone,
        recipients,
        format,
        subjectTemplate: subjectTemplate.trim() || `CoreCheck Report — ${reportView} — ${dateRangeRule}`,
        message: message.trim() || undefined,
        includeAttachments,
      };

      if (schedule) {
        await updateSchedule(schedule.id, scheduleData);
        showToast('Schedule updated successfully', 'success');
      } else {
        await createSchedule(scheduleData, user.id);
        showToast('Schedule created successfully', 'success');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      setError(err.message || 'Failed to save schedule');
      showToast(err.message || 'Failed to save schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (module: ReportModule) => {
    if (modules === 'All') {
      setModules([module]);
    } else if (Array.isArray(modules)) {
      if (modules.includes(module)) {
        const newModules = modules.filter((m) => m !== module);
        setModules(newModules.length === 0 ? availableModules : newModules);
      } else {
        setModules([...modules, module]);
      }
    }
  };

  const handleSelectAllModules = () => {
    setModules('All');
  };

  return (
    <ScheduleFormPanel
      isOpen={isOpen}
      onClose={onClose}
      title={schedule ? 'Edit Schedule' : 'New Scheduled Report'}
      footer={
        <div className="flex items-center gap-2 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : schedule ? (
              'Update Schedule'
            ) : (
              'Create Schedule'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Schedule Name */}
        <Input
          label="Schedule Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Weekly Compliance Summary"
        />

        {/* Report View */}
        <Select
          label="Report View *"
          value={reportView}
          onChange={(e) => setReportView(e.target.value as ReportView)}
          options={REPORT_VIEWS.map((view) => ({ value: view, label: view }))}
        />

        {/* Date Range Rule */}
        <Select
          label="Date Range *"
          value={dateRangeRule}
          onChange={(e) => setDateRangeRule(e.target.value as DateRangeRule)}
          options={[
            { value: 'Last 7 days', label: 'Last 7 days' },
            { value: 'Last 14 days', label: 'Last 14 days' },
            { value: 'Last 30 days', label: 'Last 30 days' },
            { value: 'Previous week', label: 'Previous week' },
            { value: 'Previous month', label: 'Previous month' },
            { value: 'Custom', label: 'Custom rolling window' },
          ]}
        />

        {/* Custom Date Range */}
        {dateRangeRule === 'Custom' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Days"
              type="number"
              value={customDateRange.days?.toString() || ''}
              onChange={(e) =>
                setCustomDateRange({ ...customDateRange, days: Number(e.target.value) })
              }
              placeholder="e.g., 7"
            />
          </div>
        )}

        {/* Modules Included */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modules Included *
          </label>
          <div className="space-y-2 border border-gray-200 rounded-md p-3">
            <Checkbox
              label="All modules"
              checked={modules === 'All'}
              onChange={handleSelectAllModules}
            />
            {availableModules.map((module) => (
              <Checkbox
                key={module}
                label={module}
                checked={modules === 'All' || (Array.isArray(modules) && modules.includes(module))}
                onChange={() => handleModuleToggle(module)}
                disabled={modules === 'All'}
              />
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Frequency *"
            value={frequencyType}
            onChange={(e) => setFrequencyType(e.target.value as ScheduleFrequency)}
            options={[
              { value: 'Daily', label: 'Daily' },
              { value: 'Weekly', label: 'Weekly' },
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Custom', label: 'Custom' },
            ]}
          />
          <Input
            label="Time *"
            type="time"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
          />
        </div>

        {/* Day of Week (Weekly) */}
        {frequencyType === 'Weekly' && (
          <Select
            label="Day of Week *"
            value={dayOfWeek.toString()}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            options={[
              { value: '0', label: 'Sunday' },
              { value: '1', label: 'Monday' },
              { value: '2', label: 'Tuesday' },
              { value: '3', label: 'Wednesday' },
              { value: '4', label: 'Thursday' },
              { value: '5', label: 'Friday' },
              { value: '6', label: 'Saturday' },
            ]}
          />
        )}

        {/* Day of Month (Monthly) */}
        {frequencyType === 'Monthly' && (
          <Select
            label="Day of Month *"
            value={dayOfMonth.toString()}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            options={Array.from({ length: 31 }, (_, i) => ({
              value: (i + 1).toString(),
              label: (i + 1).toString(),
            }))}
          />
        )}

        {/* Timezone */}
        <Select
          label="Timezone *"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          options={TIMEZONES}
        />

        {/* Delivery Format */}
        <Select
          label="Delivery Format *"
          value={format}
          onChange={(e) => setFormat(e.target.value as DeliveryFormat)}
          options={[
            { value: 'CSV', label: 'CSV' },
            { value: 'PDF', label: 'PDF (Coming soon)' },
            { value: 'Image', label: 'Image snapshot (Coming soon)' },
          ]}
        />

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipients *
          </label>
          <MultiSelectFilter
            options={userOptions}
            selected={selectedUserIds}
            onChange={setSelectedUserIds}
            searchable
            placeholder="Search users..."
          />

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              External Emails
            </label>
            {externalEmails.map((email, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => handleExternalEmailChange(index, e.target.value)}
                  placeholder="email@example.com"
                />
                {externalEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExternalEmail(index)}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddExternalEmail}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add external email
            </button>
          </div>
        </div>

        {/* Subject Template */}
        <Input
          label="Subject Template *"
          value={subjectTemplate}
          onChange={(e) => setSubjectTemplate(e.target.value)}
          placeholder="CoreCheck Report — {ReportView} — {DateRange}"
        />

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message to include in email..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Include Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Include Attachments
          </label>
          <div className="space-y-2 border border-gray-200 rounded-md p-3">
            <Checkbox
              label="Attach CSV"
              checked={includeAttachments.csv}
              onChange={(e) =>
                setIncludeAttachments({ ...includeAttachments, csv: e.target.checked })
              }
            />
            <Checkbox
              label="Attach PDF"
              checked={includeAttachments.pdf}
              onChange={(e) =>
                setIncludeAttachments({ ...includeAttachments, pdf: e.target.checked })
              }
            />
            <Checkbox
              label="Inline summary in email body"
              checked={includeAttachments.inlineSummary}
              onChange={(e) =>
                setIncludeAttachments({ ...includeAttachments, inlineSummary: e.target.checked })
              }
            />
          </div>
        </div>
      </div>
    </ScheduleFormPanel>
  );
}

