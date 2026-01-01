// Inspection Scheduling Types

export type ScheduleScope = 'ALL_ASSETS' | 'ASSET_IDS' | 'ASSET_TYPE' | 'TAGS';

export type AssignedToMode = 'FIXED_USER' | 'ROTATE_TEAM' | 'UNASSIGNED';

export type FrequencyMode = 'FIXED_TIME' | 'ROLLING_AFTER_COMPLETION' | 'USAGE_BASED' | 'EVENT_DRIVEN';

export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH';

export type AfterCompletionUnit = 'DAY' | 'WEEK' | 'MONTH';

export type MeterType = 'HOURS' | 'KM' | 'CYCLES';

export type ScheduleStatus = 'ACTIVE' | 'PAUSED';

export type SchedulingEventType =
  | 'DEFECT_MARKED_UNSAFE'
  | 'DEFECT_REOPENED'
  | 'ASSET_STATUS_CHANGED'
  | 'COMPLIANCE_EXPIRING'
  | 'PM_OVERDUE'
  | 'INSPECTION_FAILED'
  | 'MANUAL_TRIGGER';

export type InspectionCreatedFrom = 'MANUAL' | 'SCHEDULE' | 'BULK' | 'EVENT';

// Fixed Time Schedule Configuration
export interface FixedTimeSchedule {
  startDate: string; // ISO date
  intervalUnit: IntervalUnit;
  intervalValue: number; // e.g., 1, 2
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  timeOfDay: string; // HH:mm
  timezone: string; // e.g., "Europe/London"
}

// Rolling Schedule Configuration
export interface RollingSchedule {
  afterCompletionUnit: AfterCompletionUnit;
  afterCompletionValue: number; // e.g., 7 days after completion
}

// Usage-Based Schedule Configuration
export interface UsageBasedSchedule {
  meterType: MeterType;
  thresholdValue: number; // e.g., 250 hours
  meterSource?: string; // e.g., "asset.runningHours"
}

// Event-Driven Schedule Configuration
export interface EventDrivenSchedule {
  triggers: SchedulingEventType[];
}

// Due Rules
export interface DueRules {
  dueOffsetDays: number; // e.g., due = scheduled + 0, or +2
  overdueAfterDays: number; // for overdue flag
}

// Schedule Constraints
export interface ScheduleConstraints {
  avoidDuplicatesWindowHours: number; // e.g., don't generate duplicates within 12h
  maxOpenPerAssetPerTemplate: number; // e.g., 1
}

// Inspection Schedule (the "rule")
export interface InspectionSchedule {
  id: string; // SCH-000001
  scheduleCode: string; // Auto-generated SCH-000001
  name: string;
  siteId: string;
  siteName?: string;
  scope: ScheduleScope;
  assetIds?: string[]; // For ASSET_IDS scope
  assetTypeId?: string; // For ASSET_TYPE scope
  assetTypeCode?: string;
  tags?: string[]; // For TAGS scope
  templateId: string;
  templateName?: string;
  inspectionType: 'Daily' | 'Weekly' | 'Monthly' | 'Statutory' | 'Custom';
  assignedToMode: AssignedToMode;
  assignedUserId?: string;
  assignedUserName?: string;
  teamId?: string;
  teamName?: string;
  frequencyMode: FrequencyMode;
  fixedTime?: FixedTimeSchedule;
  rolling?: RollingSchedule;
  usageBased?: UsageBasedSchedule;
  eventDriven?: EventDrivenSchedule;
  dueRules: DueRules;
  constraints: ScheduleConstraints;
  status: ScheduleStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
  lastRunAt?: string; // Last time scheduler ran for this schedule
  nextRunAt?: string; // Next scheduled run time
}

// Scheduling Event
export interface SchedulingEvent {
  id: string;
  type: SchedulingEventType;
  assetId?: string;
  siteId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  processedAt?: string; // When event was processed
}

// Extended Inspection fields for scheduling
export interface InspectionSchedulingFields {
  scheduleId?: string; // Link to generated schedule
  scheduleCode?: string; // For display
  plannedStartAt?: string; // Scheduled datetime (ISO)
  dueAt?: string; // Calculated due date
  assignedToUserId?: string; // May differ from inspectorId if reassigned
  createdFrom: InspectionCreatedFrom;
  assetMeterAtCreation?: number; // For usage-based tracking
  recurrenceKey?: string; // For duplicate prevention: `${scheduleId}-${assetId}-${templateId}-${dateKey}`
}


