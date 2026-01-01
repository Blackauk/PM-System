import { getInspectionsDB } from './schema';
import type { InspectionSchedule, SchedulingEvent } from '../types/scheduling';

// Generate next schedule code (SCH-000001, SCH-000002, etc.)
export async function generateScheduleCode(): Promise<string> {
  const db = await getInspectionsDB();
  const counter = await db.get('scheduleCounters', 'schedule');
  
  if (!counter) {
    await db.put('scheduleCounters', 'schedule', {
      key: 'schedule',
      counter: 1,
    });
    return 'SCH-000001';
  }

  const nextCounter = counter.counter + 1;
  await db.put('scheduleCounters', 'schedule', {
    key: 'schedule',
    counter: nextCounter,
  });

  return `SCH-${nextCounter.toString().padStart(6, '0')}`;
}

// Schedule CRUD Operations
export async function createSchedule(
  schedule: Omit<InspectionSchedule, 'id' | 'scheduleCode'>
): Promise<InspectionSchedule> {
  const db = await getInspectionsDB();
  const scheduleCode = await generateScheduleCode();

  const newSchedule: InspectionSchedule = {
    ...schedule,
    id: crypto.randomUUID(),
    scheduleCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.add('schedules', newSchedule);
  return newSchedule;
}

export async function getScheduleById(id: string): Promise<InspectionSchedule | undefined> {
  const db = await getInspectionsDB();
  return db.get('schedules', id);
}

export async function getScheduleByCode(scheduleCode: string): Promise<InspectionSchedule | undefined> {
  const db = await getInspectionsDB();
  const index = db.transaction('schedules').store.index('by-scheduleCode');
  return index.get(scheduleCode);
}

export async function getAllSchedules(): Promise<InspectionSchedule[]> {
  const db = await getInspectionsDB();
  return db.getAll('schedules');
}

export async function getActiveSchedules(): Promise<InspectionSchedule[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('schedules').store.index('by-status');
  return index.getAll('ACTIVE');
}

export async function updateSchedule(
  id: string,
  updates: Partial<InspectionSchedule>
): Promise<InspectionSchedule> {
  const db = await getInspectionsDB();
  const existing = await db.get('schedules', id);
  if (!existing) {
    throw new Error(`Schedule ${id} not found`);
  }

  const updated: InspectionSchedule = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.put('schedules', updated);
  return updated;
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getInspectionsDB();
  await db.delete('schedules', id);
}

// Query schedules
export async function querySchedules(filter?: {
  siteId?: string;
  status?: 'ACTIVE' | 'PAUSED';
  templateId?: string;
}): Promise<InspectionSchedule[]> {
  const db = await getInspectionsDB();
  let schedules = await db.getAll('schedules');

  if (filter?.siteId) {
    schedules = schedules.filter((s) => s.siteId === filter.siteId);
  }

  if (filter?.status) {
    schedules = schedules.filter((s) => s.status === filter.status);
  }

  if (filter?.templateId) {
    schedules = schedules.filter((s) => s.templateId === filter.templateId);
  }

  return schedules;
}

// Scheduling Events CRUD
export async function createSchedulingEvent(
  event: Omit<SchedulingEvent, 'id'>
): Promise<SchedulingEvent> {
  const db = await getInspectionsDB();
  const newEvent: SchedulingEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await db.add('schedulingEvents', newEvent);
  return newEvent;
}

export async function getUnprocessedEvents(): Promise<SchedulingEvent[]> {
  const db = await getInspectionsDB();
  const allEvents = await db.getAll('schedulingEvents');
  return allEvents.filter((e) => !e.processedAt);
}

export async function markEventProcessed(id: string): Promise<void> {
  const db = await getInspectionsDB();
  const event = await db.get('schedulingEvents', id);
  if (event) {
    event.processedAt = new Date().toISOString();
    await db.put('schedulingEvents', event);
  }
}

export async function getEventsByType(
  type: SchedulingEvent['type'],
  unprocessedOnly = false
): Promise<SchedulingEvent[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('schedulingEvents').store.index('by-type');
  const events = await index.getAll(type);
  return unprocessedOnly ? events.filter((e) => !e.processedAt) : events;
}

export async function getEventsByAsset(assetId: string): Promise<SchedulingEvent[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('schedulingEvents').store.index('by-assetId');
  return index.getAll(assetId);
}


