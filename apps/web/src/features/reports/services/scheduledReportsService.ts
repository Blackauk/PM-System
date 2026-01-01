// Phase 2: Scheduled Reports API service (mocked implementation)

import type {
  ScheduledReport,
  DeliveryLog,
  CreateScheduleData,
  UpdateScheduleData,
} from '../types/scheduledReportsV2';

const SCHEDULES_STORAGE_KEY = 'scheduled-reports-v2';
const DELIVERIES_STORAGE_KEY = 'email-deliveries-v2';

// Helper to get all schedules from storage
function getAllSchedulesFromStorage(): ScheduledReport[] {
  try {
    const stored = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading schedules:', error);
    return [];
  }
}

// Helper to save schedules to storage
function saveSchedulesToStorage(schedules: ScheduledReport[]): void {
  try {
    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
  } catch (error) {
    console.error('Error saving schedules:', error);
    throw new Error('Failed to save schedules');
  }
}

// Helper to get all deliveries from storage
function getAllDeliveriesFromStorage(): DeliveryLog[] {
  try {
    const stored = localStorage.getItem(DELIVERIES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading deliveries:', error);
    return [];
  }
}

// Helper to save deliveries to storage
function saveDeliveriesToStorage(deliveries: DeliveryLog[]): void {
  try {
    localStorage.setItem(DELIVERIES_STORAGE_KEY, JSON.stringify(deliveries));
  } catch (error) {
    console.error('Error saving deliveries:', error);
    throw new Error('Failed to save deliveries');
  }
}

// Calculate next send date based on frequency
function calculateNextSendDate(
  frequencyType: ScheduledReport['frequencyType'],
  timeOfDay: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  lastSentAt?: string
): string {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  
  const startDate = lastSentAt ? new Date(lastSentAt) : now;
  const nextSend = new Date(startDate);
  
  nextSend.setHours(hours, minutes, 0, 0);
  
  if (nextSend <= now) {
    switch (frequencyType) {
      case 'Daily':
        nextSend.setDate(nextSend.getDate() + 1);
        break;
      case 'Weekly':
        if (dayOfWeek !== undefined) {
          const daysUntilNext = (dayOfWeek - nextSend.getDay() + 7) % 7;
          nextSend.setDate(nextSend.getDate() + (daysUntilNext || 7));
        } else {
          nextSend.setDate(nextSend.getDate() + 7);
        }
        break;
      case 'Monthly':
        if (dayOfMonth !== undefined) {
          nextSend.setDate(dayOfMonth);
          nextSend.setMonth(nextSend.getMonth() + 1);
          if (nextSend.getDate() !== dayOfMonth) {
            nextSend.setDate(0);
          }
        } else {
          nextSend.setMonth(nextSend.getMonth() + 1);
        }
        break;
      case 'Custom':
        // For custom, default to next day (can be enhanced with cron parsing)
        nextSend.setDate(nextSend.getDate() + 1);
        break;
    }
  }
  
  return nextSend.toISOString();
}

// GET /api/reports/schedules
export function getSchedules(): Promise<ScheduledReport[]> {
  return Promise.resolve(getAllSchedulesFromStorage());
}

// POST /api/reports/schedules
export function createSchedule(
  data: CreateScheduleData,
  createdBy: string
): Promise<ScheduledReport> {
  const schedules = getAllSchedulesFromStorage();
  
  const nextSendAt = calculateNextSendDate(
    data.frequencyType,
    data.timeOfDay,
    data.dayOfWeek,
    data.dayOfMonth
  );
  
  const newSchedule: ScheduledReport = {
    id: crypto.randomUUID(),
    orgId: undefined, // Can be set from user context
    siteId: undefined, // Can be set from user context
    ...data,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextSendAt,
    createdBy,
  };
  
  schedules.push(newSchedule);
  saveSchedulesToStorage(schedules);
  
  return Promise.resolve(newSchedule);
}

// PUT /api/reports/schedules/:id
export function updateSchedule(
  id: string,
  data: UpdateScheduleData
): Promise<ScheduledReport> {
  const schedules = getAllSchedulesFromStorage();
  const index = schedules.findIndex((s) => s.id === id);
  
  if (index === -1) {
    return Promise.reject(new Error('Schedule not found'));
  }
  
  const existing = schedules[index];
  const updated: ScheduledReport = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  
  // Recalculate next send date if timing changed
  if (
    data.frequencyType !== undefined ||
    data.timeOfDay !== undefined ||
    data.dayOfWeek !== undefined ||
    data.dayOfMonth !== undefined
  ) {
    updated.nextSendAt = calculateNextSendDate(
      updated.frequencyType,
      updated.timeOfDay,
      updated.dayOfWeek,
      updated.dayOfMonth,
      updated.lastSentAt
    );
  }
  
  schedules[index] = updated;
  saveSchedulesToStorage(schedules);
  
  return Promise.resolve(updated);
}

// POST /api/reports/schedules/:id/send-now
export function sendScheduleNow(id: string): Promise<DeliveryLog> {
  const schedules = getAllSchedulesFromStorage();
  const schedule = schedules.find((s) => s.id === id);
  
  if (!schedule) {
    return Promise.reject(new Error('Schedule not found'));
  }
  
  // Create delivery log entry
  const delivery: DeliveryLog = {
    id: crypto.randomUUID(),
    scheduledReportId: id,
    sentAt: new Date().toISOString(),
    status: 'Sent', // In real implementation, this would be async and might be 'Pending'
    recipients: schedule.recipients,
    format: schedule.format,
    createdAt: new Date().toISOString(),
  };
  
  // Save delivery log
  const deliveries = getAllDeliveriesFromStorage();
  deliveries.unshift(delivery); // Add to beginning
  saveDeliveriesToStorage(deliveries);
  
  // Update schedule's lastSentAt and nextSendAt
  schedule.lastSentAt = delivery.sentAt;
  schedule.nextSendAt = calculateNextSendDate(
    schedule.frequencyType,
    schedule.timeOfDay,
    schedule.dayOfWeek,
    schedule.dayOfMonth,
    schedule.lastSentAt
  );
  schedule.updatedAt = new Date().toISOString();
  saveSchedulesToStorage(schedules);
  
  return Promise.resolve(delivery);
}

// PATCH /api/reports/schedules/:id/pause
export function toggleScheduleActive(id: string): Promise<ScheduledReport> {
  const schedules = getAllSchedulesFromStorage();
  const schedule = schedules.find((s) => s.id === id);
  
  if (!schedule) {
    return Promise.reject(new Error('Schedule not found'));
  }
  
  schedule.isActive = !schedule.isActive;
  schedule.updatedAt = new Date().toISOString();
  saveSchedulesToStorage(schedules);
  
  return Promise.resolve(schedule);
}

// DELETE /api/reports/schedules/:id
export function deleteSchedule(id: string): Promise<void> {
  const schedules = getAllSchedulesFromStorage();
  const filtered = schedules.filter((s) => s.id !== id);
  
  if (filtered.length === schedules.length) {
    return Promise.reject(new Error('Schedule not found'));
  }
  
  saveSchedulesToStorage(filtered);
  return Promise.resolve();
}

// GET /api/reports/deliveries?range=30d
export function getDeliveries(range: '30d' | '90d' = '30d'): Promise<DeliveryLog[]> {
  const deliveries = getAllDeliveriesFromStorage();
  const now = new Date();
  const daysAgo = range === '30d' ? 30 : 90;
  const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  const filtered = deliveries.filter((d) => new Date(d.sentAt) >= cutoffDate);
  
  return Promise.resolve(filtered);
}

// POST /api/reports/deliveries/:id/resend
export function resendDelivery(id: string): Promise<DeliveryLog> {
  const deliveries = getAllDeliveriesFromStorage();
  const delivery = deliveries.find((d) => d.id === id);
  
  if (!delivery) {
    return Promise.reject(new Error('Delivery not found'));
  }
  
  // Create a new delivery log entry
  const newDelivery: DeliveryLog = {
    ...delivery,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    status: 'Sent',
    createdAt: new Date().toISOString(),
  };
  
  deliveries.unshift(newDelivery);
  saveDeliveriesToStorage(deliveries);
  
  return Promise.resolve(newDelivery);
}


