// Unified Inspection Schedule Types for Schedules Module

export type InspectionScheduleCategory = 'Statutory' | 'Safety' | 'Operational';
export type InspectionSchedulePriority = 'Critical' | 'High' | 'Normal';
export type InspectionScheduleStatus = 'Active' | 'Paused';
export type InspectionScheduleScopeType = 'Assets' | 'AssetGroup' | 'Site' | 'Location';
export type InspectionScheduleFrequencyType = 'Calendar' | 'Usage' | 'Event';
export type CalendarPattern = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type RollingRule = 'NextAfterComplete' | 'FixedInterval';
export type AssignmentType = 'User' | 'Role' | 'Team';

export interface CalendarRule {
  pattern: CalendarPattern;
  daysOfWeek?: string[]; // e.g. ["Mon","Wed"]
  dayOfMonth?: number; // 1-31
  nthWeekday?: { nth: 1 | 2 | 3 | 4 | 5; weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' }; // for "first Monday"
  timeOfDay?: string; // "06:00"
}

export interface UsageRule {
  intervalHours: number;
}

export interface EventRule {
  trigger: 'WorkOrderClosed' | 'DefectClosed';
}

export interface InspectionScheduleAssignment {
  type: AssignmentType;
  id: string;
  name: string;
}

export interface InspectionScheduleNotifications {
  onCreate: boolean;
  beforeDueHours: number | null;
  onOverdue: boolean;
  escalation: ('Supervisor' | 'Manager')[];
}

export interface InspectionSchedule {
  id: string; // SCH-INS-00001 style
  name: string;
  templateId: string;
  templateName?: string;
  category: InspectionScheduleCategory;
  priority: InspectionSchedulePriority;
  status: InspectionScheduleStatus;
  scopeType: InspectionScheduleScopeType;
  scopeAssetIds: string[]; // if Assets
  scopeAssetGroupId?: string;
  siteId?: string;
  siteName?: string;
  locationIds?: string[];
  includeNewAssets: boolean;
  frequencyType: InspectionScheduleFrequencyType;
  calendarRule?: CalendarRule;
  usageRule?: UsageRule;
  eventRule?: EventRule;
  startDate: string; // ISO date
  nextDueDate?: string; // ISO date
  generateAheadDays: number; // default 0-7
  rollingRule: RollingRule;
  gracePeriodDays: number;
  assignment: InspectionScheduleAssignment;
  notifications: InspectionScheduleNotifications;
  lastGeneratedAt?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}


