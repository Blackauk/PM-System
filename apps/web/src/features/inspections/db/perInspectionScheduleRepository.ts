import { getInspectionsDB } from './schema';
import type { PerInspectionSchedule } from '../types/perInspectionSchedule';

// CRUD Operations for Per-Inspection Schedules
export async function createPerInspectionSchedule(
  schedule: Omit<PerInspectionSchedule, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PerInspectionSchedule> {
  const db = await getInspectionsDB();

  const newSchedule: PerInspectionSchedule = {
    ...schedule,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generatedCount: 0,
  };

  await db.add('perInspectionSchedules', newSchedule);
  return newSchedule;
}

export async function getPerInspectionScheduleById(id: string): Promise<PerInspectionSchedule | undefined> {
  const db = await getInspectionsDB();
  return db.get('perInspectionSchedules', id);
}

export async function getScheduleByInspectionId(inspectionId: string): Promise<PerInspectionSchedule | undefined> {
  const db = await getInspectionsDB();
  const index = db.transaction('perInspectionSchedules').store.index('by-inspectionId');
  return index.get(inspectionId);
}

export async function getSchedulesByTemplateId(templateId: string): Promise<PerInspectionSchedule[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('perInspectionSchedules').store.index('by-templateId');
  return index.getAll(templateId);
}

export async function getSchedulesByAssetId(assetId: string): Promise<PerInspectionSchedule[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('perInspectionSchedules').store.index('by-assetId');
  return index.getAll(assetId);
}

export async function getActiveSchedules(): Promise<PerInspectionSchedule[]> {
  const db = await getInspectionsDB();
  const index = db.transaction('perInspectionSchedules').store.index('by-status');
  return index.getAll('Active');
}

export async function updatePerInspectionSchedule(
  id: string,
  updates: Partial<PerInspectionSchedule>
): Promise<PerInspectionSchedule> {
  const db = await getInspectionsDB();
  const existing = await db.get('perInspectionSchedules', id);
  if (!existing) {
    throw new Error(`Schedule ${id} not found`);
  }

  const updated: PerInspectionSchedule = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.put('perInspectionSchedules', updated);
  return updated;
}

export async function deletePerInspectionSchedule(id: string): Promise<void> {
  const db = await getInspectionsDB();
  await db.delete('perInspectionSchedules', id);
}


