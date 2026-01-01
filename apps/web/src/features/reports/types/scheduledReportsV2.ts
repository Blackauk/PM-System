// Phase 2: Scheduled Reports and Email Deliveries types

export type ReportView = 'Overview' | 'Assets' | 'Work Orders' | 'Inspections' | 'Defects' | 'Compliance';

export type ReportModule = 
  | 'KPIs'
  | 'Charts'
  | 'Tables'
  | 'Inspections'
  | 'Defects'
  | 'WorkOrders'
  | 'Assets'
  | 'Compliance';

export type ScheduleFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Custom';

export type DeliveryFormat = 'CSV' | 'PDF' | 'Image';

export type ScheduleStatus = 'Active' | 'Paused';

export type DeliveryStatus = 'Sent' | 'Failed' | 'Partial';

export type DateRangeRule = 
  | 'Last 7 days'
  | 'Last 14 days'
  | 'Last 30 days'
  | 'Previous week'
  | 'Previous month'
  | 'Custom';

export interface Recipient {
  type: 'user' | 'external';
  userId?: string;
  email: string;
  name?: string;
}

export interface ScheduledReport {
  id: string;
  orgId?: string;
  siteId?: string;
  name: string;
  reportView: ReportView;
  modules: ReportModule[] | 'All';
  dateRangeRule: DateRangeRule;
  customDateRange?: {
    days?: number;
    startDate?: string;
    endDate?: string;
  };
  frequencyType: ScheduleFrequency;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  timeOfDay: string; // HH:mm format
  timezone: string; // e.g., "Europe/London", "UTC"
  recipients: Recipient[];
  format: DeliveryFormat;
  subjectTemplate: string;
  message?: string;
  includeAttachments: {
    csv: boolean;
    pdf: boolean;
    inlineSummary: boolean;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastSentAt?: string;
  nextSendAt: string;
}

export interface DeliveryLog {
  id: string;
  scheduledReportId: string;
  sentAt: string;
  status: DeliveryStatus;
  recipients: Recipient[];
  format: DeliveryFormat;
  error?: string;
  payloadRef?: string; // Optional reference to generated report
  createdAt: string;
}

export interface CreateScheduleData {
  name: string;
  reportView: ReportView;
  modules: ReportModule[] | 'All';
  dateRangeRule: DateRangeRule;
  customDateRange?: {
    days?: number;
    startDate?: string;
    endDate?: string;
  };
  frequencyType: ScheduleFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  recipients: Recipient[];
  format: DeliveryFormat;
  subjectTemplate: string;
  message?: string;
  includeAttachments: {
    csv: boolean;
    pdf: boolean;
    inlineSummary: boolean;
  };
}

export interface UpdateScheduleData extends Partial<CreateScheduleData> {
  isActive?: boolean;
}


