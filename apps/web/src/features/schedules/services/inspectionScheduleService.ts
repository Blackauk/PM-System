import type { InspectionSchedule } from '../types/inspectionSchedule';

// Mock data storage key
const STORAGE_KEY = 'inspection-schedules';

// Generate schedule ID
function generateScheduleId(): string {
  const schedules = getAllSchedules();
  const nextNumber = schedules.length + 1;
  return `SCH-INS-${String(nextNumber).padStart(5, '0')}`;
}

// Get all schedules from localStorage
export function getAllSchedules(): InspectionSchedule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Get schedule by ID
export function getScheduleById(id: string): InspectionSchedule | undefined {
  return getAllSchedules().find(s => s.id === id);
}

// Create schedule
export function createSchedule(data: Omit<InspectionSchedule, 'id' | 'createdAt' | 'updatedAt'>): InspectionSchedule {
  const schedules = getAllSchedules();
  const newSchedule: InspectionSchedule = {
    ...data,
    id: generateScheduleId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  schedules.push(newSchedule);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  return newSchedule;
}

// Update schedule
export function updateSchedule(id: string, data: Partial<InspectionSchedule>): InspectionSchedule {
  const schedules = getAllSchedules();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) throw new Error('Schedule not found');
  
  schedules[index] = {
    ...schedules[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  return schedules[index];
}

// Delete schedule
export function deleteSchedule(id: string): void {
  const schedules = getAllSchedules();
  const filtered = schedules.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Filter schedules
export interface InspectionScheduleFilter {
  search?: string;
  status?: InspectionSchedule['status'] | InspectionSchedule['status'][];
  category?: InspectionSchedule['category'] | InspectionSchedule['category'][];
  priority?: InspectionSchedule['priority'] | InspectionSchedule['priority'][];
  frequencyType?: InspectionSchedule['frequencyType'] | InspectionSchedule['frequencyType'][];
  siteId?: string | string[];
  scopeType?: InspectionSchedule['scopeType'] | InspectionSchedule['scopeType'][];
  assignedToId?: string | string[];
  nextDueDateFrom?: string;
  nextDueDateTo?: string;
  overdueOnly?: boolean;
}

export function getSchedules(filter?: InspectionScheduleFilter): InspectionSchedule[] {
  let schedules = getAllSchedules();

  if (!filter) return schedules;

  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    schedules = schedules.filter(s =>
      s.id.toLowerCase().includes(searchLower) ||
      s.name.toLowerCase().includes(searchLower) ||
      s.templateName?.toLowerCase().includes(searchLower) ||
      s.siteName?.toLowerCase().includes(searchLower)
    );
  }

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    schedules = schedules.filter(s => statuses.includes(s.status));
  }

  if (filter.category) {
    const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
    schedules = schedules.filter(s => categories.includes(s.category));
  }

  if (filter.priority) {
    const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
    schedules = schedules.filter(s => priorities.includes(s.priority));
  }

  if (filter.frequencyType) {
    const types = Array.isArray(filter.frequencyType) ? filter.frequencyType : [filter.frequencyType];
    schedules = schedules.filter(s => types.includes(s.frequencyType));
  }

  if (filter.siteId) {
    const sites = Array.isArray(filter.siteId) ? filter.siteId : [filter.siteId];
    schedules = schedules.filter(s => s.siteId && sites.includes(s.siteId));
  }

  if (filter.scopeType) {
    const types = Array.isArray(filter.scopeType) ? filter.scopeType : [filter.scopeType];
    schedules = schedules.filter(s => types.includes(s.scopeType));
  }

  if (filter.assignedToId) {
    const ids = Array.isArray(filter.assignedToId) ? filter.assignedToId : [filter.assignedToId];
    schedules = schedules.filter(s => ids.includes(s.assignment.id));
  }

  if (filter.nextDueDateFrom) {
    schedules = schedules.filter(s => {
      if (!s.nextDueDate) return false;
      return new Date(s.nextDueDate) >= new Date(filter.nextDueDateFrom!);
    });
  }

  if (filter.nextDueDateTo) {
    schedules = schedules.filter(s => {
      if (!s.nextDueDate) return false;
      return new Date(s.nextDueDate) <= new Date(filter.nextDueDateTo!);
    });
  }

  if (filter.overdueOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    schedules = schedules.filter(s => {
      if (!s.nextDueDate) return false;
      return new Date(s.nextDueDate) < today && s.status === 'Active';
    });
  }

  return schedules;
}


