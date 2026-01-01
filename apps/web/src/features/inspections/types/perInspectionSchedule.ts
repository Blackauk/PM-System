// Per-Inspection Schedule Rule (simpler than bulk schedules)
// This is for scheduling a single inspection/template/asset combination

export type ScheduleFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom';

export type EndCondition = 'Never' | 'EndByDate' | 'EndAfterOccurrences';

export interface PerInspectionSchedule {
  id: string;
  inspectionId?: string; // If set, applies to this specific inspection instance
  templateId: string; // Required: which template to use
  assetId?: string; // If set, applies to this asset; if not, applies to all assets using this template
  siteId: string;
  
  // Frequency
  frequency: ScheduleFrequency;
  startDate: string; // ISO date
  
  // Pattern (varies by frequency)
  pattern: {
    // For Weekly: days of week (0-6, Sunday-Saturday)
    daysOfWeek?: number[];
    // For Monthly: day of month (1-31) or "first Monday", "last Friday", etc.
    dayOfMonth?: number;
    dayOfWeekInMonth?: 'first' | 'second' | 'third' | 'fourth' | 'last'; // e.g., "first Monday"
    // For Custom: interval in days
    intervalDays?: number;
  };
  
  // Time window
  timeOfDay?: string; // HH:mm format, optional
  dueByEndOfDay?: boolean; // If true, due by end of day instead of specific time
  
  // Assignment
  assignedToUserId?: string;
  assignedToTeamId?: string;
  
  // End condition
  endCondition: EndCondition;
  endDate?: string; // If endCondition is 'EndByDate'
  maxOccurrences?: number; // If endCondition is 'EndAfterOccurrences'
  
  // Rolling generation
  rollingWindow: {
    enabled: boolean;
    generateNextN: number; // Generate next N occurrences (e.g., 4 weeks, 3 months)
    windowUnit: 'weeks' | 'months';
  };
  
  // Skip/Reschedule logic
  skipMissed: boolean; // If true, skip missed inspections; if false, mark overdue and still generate next
  
  // Status
  status: 'Active' | 'Paused';
  
  // Tracking
  lastGeneratedAt?: string;
  nextRunAt?: string;
  generatedCount?: number; // How many inspections have been generated from this schedule
  
  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}


