import {
  getAllSchedules,
  getActiveSchedules,
  getUnprocessedEvents,
  markEventProcessed,
  updateSchedule,
} from '../db/schedulingRepository';
import {
  createInspection,
  getAllInspections,
  getInspectionById,
  updateInspection,
} from '../db/repository';
import { getTemplateById } from '../db/repository';
import { getCachedAsset } from '../db/cache';
import type {
  InspectionSchedule,
  SchedulingEvent,
  FrequencyMode,
} from '../types/scheduling';
import type { PerInspectionSchedule } from '../types/perInspectionSchedule';
import type { Inspection } from '../types';
import { mockUsers } from '../../reports/services/mockUsers';
import { mockSites } from '../../assets/services';

// Generate recurrence key for duplicate prevention
export function generateRecurrenceKey(
  scheduleId: string,
  assetId: string,
  templateId: string,
  dateKey: string // YYYY-MM-DD or similar
): string {
  return `${scheduleId}-${assetId}-${templateId}-${dateKey}`;
}

// Check if inspection already exists with this recurrence key
async function checkDuplicateInspection(
  recurrenceKey: string,
  scheduleId: string,
  assetId: string,
  templateId: string,
  windowHours: number
): Promise<boolean> {
  const inspections = await getAllInspections();
  const windowMs = windowHours * 60 * 60 * 1000;
  const now = Date.now();

  // Check for exact recurrence key match
  const exactMatch = inspections.find((i) => i.recurrenceKey === recurrenceKey);
  if (exactMatch) return true;

  // Check for duplicates within time window
  const recentInspections = inspections.filter((i) => {
    if (i.scheduleId !== scheduleId || i.assetId !== assetId || i.templateId !== templateId) {
      return false;
    }
    if (!i.createdAt) return false;
    const created = new Date(i.createdAt).getTime();
    return now - created < windowMs;
  });

  return recentInspections.length > 0;
}

// Get assets for a schedule based on scope
async function getAssetsForSchedule(schedule: InspectionSchedule): Promise<string[]> {
  // In a real implementation, this would query the assets database
  // For now, we'll use a mock approach
  const allAssets = await import('../../assets/services').then((m) => m.getAssets());
  
  switch (schedule.scope) {
    case 'ALL_ASSETS':
      return allAssets.map((a) => a.id);
    case 'ASSET_IDS':
      return schedule.assetIds || [];
    case 'ASSET_TYPE':
      return allAssets.filter((a) => a.assetTypeId === schedule.assetTypeId).map((a) => a.id);
    case 'TAGS':
      // Tag matching would require asset tags - stub for now
      return allAssets.map((a) => a.id);
    default:
      return [];
  }
}

// Calculate next run date for fixed-time schedule
function calculateNextRunDate(schedule: InspectionSchedule): string | undefined {
  if (schedule.frequencyMode !== 'FIXED_TIME' || !schedule.fixedTime) {
    return undefined;
  }

  const now = new Date();
  const startDate = new Date(schedule.fixedTime.startDate);
  const [hours, minutes] = schedule.fixedTime.timeOfDay.split(':').map(Number);

  // Calculate next occurrence based on interval
  let nextDate = new Date(startDate);
  nextDate.setHours(hours, minutes, 0, 0);

  while (nextDate <= now) {
    switch (schedule.fixedTime.intervalUnit) {
      case 'DAY':
        nextDate.setDate(nextDate.getDate() + schedule.fixedTime.intervalValue);
        break;
      case 'WEEK':
        nextDate.setDate(nextDate.getDate() + 7 * schedule.fixedTime.intervalValue);
        // Apply daysOfWeek if specified
        if (schedule.fixedTime.daysOfWeek && schedule.fixedTime.daysOfWeek.length > 0) {
          // Find next matching day of week
          const targetDays = schedule.fixedTime.daysOfWeek;
          let found = false;
          for (let i = 0; i < 14; i++) {
            const dayOfWeek = nextDate.getDay();
            if (targetDays.includes(dayOfWeek)) {
              found = true;
              break;
            }
            nextDate.setDate(nextDate.getDate() + 1);
          }
          if (!found) {
            // Fallback: use first target day
            const daysUntilNext = (targetDays[0] - nextDate.getDay() + 7) % 7;
            nextDate.setDate(nextDate.getDate() + (daysUntilNext || 7));
          }
        }
        break;
      case 'MONTH':
        nextDate.setMonth(nextDate.getMonth() + schedule.fixedTime.intervalValue);
        if (schedule.fixedTime.dayOfMonth) {
          nextDate.setDate(schedule.fixedTime.dayOfMonth);
        }
        break;
    }
  }

  return nextDate.toISOString();
}

// Generate inspections for fixed-time schedule
async function generateFixedTimeInspections(
  schedule: InspectionSchedule
): Promise<Inspection[]> {
  const generated: Inspection[] = [];
  const assets = await getAssetsForSchedule(schedule);
  const template = await getTemplateById(schedule.templateId);
  
  if (!template) {
    console.warn(`Template ${schedule.templateId} not found for schedule ${schedule.id}`);
    return generated;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  if (!schedule.fixedTime) return generated;

  const [hours, minutes] = schedule.fixedTime.timeOfDay.split(':').map(Number);

  // Generate for today and next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    checkDate.setHours(hours, minutes, 0, 0);

    // Check if this date matches the schedule
    let shouldGenerate = false;

    switch (schedule.fixedTime.intervalUnit) {
      case 'DAY':
        if (schedule.fixedTime.intervalValue === 1 || dayOffset % schedule.fixedTime.intervalValue === 0) {
          shouldGenerate = true;
        }
        break;
      case 'WEEK':
        if (schedule.fixedTime.daysOfWeek && schedule.fixedTime.daysOfWeek.includes(checkDate.getDay())) {
          // Check if this week matches the interval
          const weeksSinceStart = Math.floor(
            (checkDate.getTime() - new Date(schedule.fixedTime.startDate).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );
          if (weeksSinceStart % schedule.fixedTime.intervalValue === 0) {
            shouldGenerate = true;
          }
        }
        break;
      case 'MONTH':
        if (schedule.fixedTime.dayOfMonth === checkDate.getDate()) {
          shouldGenerate = true;
        }
        break;
    }

    if (!shouldGenerate) continue;

    // Generate for each asset
    for (const assetId of assets) {
      const dateKey = checkDate.toISOString().split('T')[0];
      const recurrenceKey = generateRecurrenceKey(schedule.id, assetId, schedule.templateId, dateKey);

      // Check for duplicates
      const isDuplicate = await checkDuplicateInspection(
        recurrenceKey,
        schedule.id,
        assetId,
        schedule.templateId,
        schedule.constraints.avoidDuplicatesWindowHours
      );

      if (isDuplicate) continue;

      // Check max open per asset per template
      const existingInspections = await getAllInspections();
      const openCount = existingInspections.filter(
        (i) =>
          i.assetId === assetId &&
          i.templateId === schedule.templateId &&
          i.status !== 'Closed' &&
          i.scheduleId === schedule.id
      ).length;

      if (openCount >= schedule.constraints.maxOpenPerAssetPerTemplate) {
        continue;
      }

      // Determine assigned user
      let assignedUserId = schedule.assignedUserId;
      let assignedUserName = schedule.assignedUserName;

      if (schedule.assignedToMode === 'ROTATE_TEAM' && schedule.teamId) {
        // Simple rotation: assign based on asset index
        const assetIndex = assets.indexOf(assetId);
        const teamUsers = mockUsers.filter((u) => u.siteIds?.includes(schedule.siteId));
        if (teamUsers.length > 0) {
          const user = teamUsers[assetIndex % teamUsers.length];
          assignedUserId = user.id;
          assignedUserName = `${user.firstName} ${user.lastName}`;
        }
      }

      // Calculate due date
      const dueDate = new Date(checkDate);
      dueDate.setDate(dueDate.getDate() + schedule.dueRules.dueOffsetDays);

      // Create inspection
      const inspection: Omit<Inspection, 'id' | 'inspectionCode'> = {
        templateId: schedule.templateId,
        templateName: template.name,
        templateVersion: template.version,
        inspectionType: schedule.inspectionType as any,
        result: 'Pending',
        status: 'Draft',
        assetId,
        siteId: schedule.siteId,
        siteName: schedule.siteName,
        sections: template.sections,
        items: template.items,
        answers: [],
        attachments: [],
        signatures: [],
        inspectionDate: checkDate.toISOString().split('T')[0],
        plannedStartAt: checkDate.toISOString(),
        dueAt: dueDate.toISOString(),
        inspectorId: assignedUserId || mockUsers[0]?.id || '',
        inspectorName: assignedUserName || mockUsers[0]?.firstName + ' ' + mockUsers[0]?.lastName || 'Unassigned',
        linkedDefectIds: [],
        createdAt: new Date().toISOString(),
        createdBy: schedule.createdBy,
        createdByName: schedule.createdByName,
        updatedAt: new Date().toISOString(),
        updatedBy: schedule.createdBy,
        updatedByName: schedule.createdByName,
        history: [],
        revisionNumber: 0,
        scheduleId: schedule.id,
        scheduleCode: schedule.scheduleCode,
        assignedToUserId: assignedUserId,
        createdFrom: 'SCHEDULE',
        recurrenceKey,
        syncStatus: navigator.onLine ? 'synced' : 'pending',
      };

      const created = await createInspection(inspection);
      generated.push(created);
    }
  }

  return generated;
}

// Generate inspections for rolling schedule (after completion)
export async function generateRollingInspections(
  completedInspection: Inspection
): Promise<Inspection | null> {
  if (!completedInspection.scheduleId || !completedInspection.completedAt) {
    return null;
  }

  const schedule = await import('../db/schedulingRepository').then((m) =>
    m.getScheduleById(completedInspection.scheduleId!)
  );

  if (!schedule || schedule.frequencyMode !== 'ROLLING_AFTER_COMPLETION' || !schedule.rolling) {
    return null;
  }

  if (schedule.status !== 'ACTIVE') {
    return null;
  }

  const template = await getTemplateById(schedule.templateId);
  if (!template) return null;

  const completedDate = new Date(completedInspection.completedAt);
  const nextDate = new Date(completedDate);

  switch (schedule.rolling.afterCompletionUnit) {
    case 'DAY':
      nextDate.setDate(nextDate.getDate() + schedule.rolling.afterCompletionValue);
      break;
    case 'WEEK':
      nextDate.setDate(nextDate.getDate() + 7 * schedule.rolling.afterCompletionValue);
      break;
    case 'MONTH':
      nextDate.setMonth(nextDate.getMonth() + schedule.rolling.afterCompletionValue);
      break;
  }

  const dateKey = nextDate.toISOString().split('T')[0];
  const recurrenceKey = generateRecurrenceKey(
    schedule.id,
    completedInspection.assetId,
    schedule.templateId,
    dateKey
  );

  // Check for duplicates
  const isDuplicate = await checkDuplicateInspection(
    recurrenceKey,
    schedule.id,
    completedInspection.assetId,
    schedule.templateId,
    schedule.constraints.avoidDuplicatesWindowHours
  );

  if (isDuplicate) return null;

  // Check max open
  const existingInspections = await getAllInspections();
  const openCount = existingInspections.filter(
    (i) =>
      i.assetId === completedInspection.assetId &&
      i.templateId === schedule.templateId &&
      i.status !== 'Closed' &&
      i.scheduleId === schedule.id
  ).length;

  if (openCount >= schedule.constraints.maxOpenPerAssetPerTemplate) {
    return null;
  }

  const dueDate = new Date(nextDate);
  dueDate.setDate(dueDate.getDate() + schedule.dueRules.dueOffsetDays);

  let assignedUserId = schedule.assignedUserId;
  let assignedUserName = schedule.assignedUserName;

  if (schedule.assignedToMode === 'ROTATE_TEAM' && schedule.teamId) {
    // Use same logic as fixed-time
    const teamUsers = mockUsers.filter((u) => u.siteIds?.includes(schedule.siteId));
    if (teamUsers.length > 0) {
      const user = teamUsers[0]; // Simple: use first team member
      assignedUserId = user.id;
      assignedUserName = `${user.firstName} ${user.lastName}`;
    }
  }

  const inspection: Omit<Inspection, 'id' | 'inspectionCode'> = {
    templateId: schedule.templateId,
    templateName: template.name,
    templateVersion: template.version,
    inspectionType: schedule.inspectionType as any,
    result: 'Pending',
    status: 'Draft',
    assetId: completedInspection.assetId,
    siteId: schedule.siteId,
    siteName: schedule.siteName,
    sections: template.sections,
    items: template.items,
    answers: [],
    attachments: [],
    signatures: [],
    inspectionDate: nextDate.toISOString().split('T')[0],
    plannedStartAt: nextDate.toISOString(),
    dueAt: dueDate.toISOString(),
    inspectorId: assignedUserId || completedInspection.inspectorId,
    inspectorName: assignedUserName || completedInspection.inspectorName,
    linkedDefectIds: [],
    createdAt: new Date().toISOString(),
    createdBy: schedule.createdBy,
    createdByName: schedule.createdByName,
    updatedAt: new Date().toISOString(),
    updatedBy: schedule.createdBy,
    updatedByName: schedule.createdByName,
    history: [],
    revisionNumber: 0,
    scheduleId: schedule.id,
    scheduleCode: schedule.scheduleCode,
    assignedToUserId: assignedUserId,
    createdFrom: 'SCHEDULE',
    recurrenceKey,
    syncStatus: navigator.onLine ? 'synced' : 'pending',
  };

  return await createInspection(inspection);
}

// Generate inspections for event-driven schedule
async function generateEventDrivenInspections(
  schedule: InspectionSchedule,
  event: SchedulingEvent
): Promise<Inspection | null> {
  if (schedule.frequencyMode !== 'EVENT_DRIVEN' || !schedule.eventDriven) {
    return null;
  }

  if (!schedule.eventDriven.triggers.includes(event.type)) {
    return null;
  }

  if (schedule.status !== 'ACTIVE') {
    return null;
  }

  // Check if event matches schedule scope
  if (event.assetId) {
    const assets = await getAssetsForSchedule(schedule);
    if (!assets.includes(event.assetId)) {
      return null;
    }
  }

  const template = await getTemplateById(schedule.templateId);
  if (!template) return null;

  const assetId = event.assetId || schedule.assetIds?.[0];
  if (!assetId) return null;

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const recurrenceKey = generateRecurrenceKey(schedule.id, assetId, schedule.templateId, dateKey);

  // Check for duplicates
  const isDuplicate = await checkDuplicateInspection(
    recurrenceKey,
    schedule.id,
    assetId,
    schedule.templateId,
    schedule.constraints.avoidDuplicatesWindowHours
  );

  if (isDuplicate) return null;

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + schedule.dueRules.dueOffsetDays);

  let assignedUserId = schedule.assignedUserId;
  let assignedUserName = schedule.assignedUserName;

  if (schedule.assignedToMode === 'ROTATE_TEAM' && schedule.teamId) {
    const teamUsers = mockUsers.filter((u) => u.siteIds?.includes(schedule.siteId));
    if (teamUsers.length > 0) {
      const user = teamUsers[0];
      assignedUserId = user.id;
      assignedUserName = `${user.firstName} ${user.lastName}`;
    }
  }

  const inspection: Omit<Inspection, 'id' | 'inspectionCode'> = {
    templateId: schedule.templateId,
    templateName: template.name,
    templateVersion: template.version,
    inspectionType: schedule.inspectionType as any,
    result: 'Pending',
    status: 'Draft',
    assetId,
    siteId: schedule.siteId || event.siteId,
    siteName: schedule.siteName,
    sections: template.sections,
    items: template.items,
    answers: [],
    attachments: [],
    signatures: [],
    inspectionDate: now.toISOString().split('T')[0],
    plannedStartAt: now.toISOString(),
    dueAt: dueDate.toISOString(),
    inspectorId: assignedUserId || mockUsers[0]?.id || '',
    inspectorName: assignedUserName || mockUsers[0]?.firstName + ' ' + mockUsers[0]?.lastName || 'Unassigned',
    linkedDefectIds: [],
    createdAt: new Date().toISOString(),
    createdBy: schedule.createdBy,
    createdByName: schedule.createdByName,
    updatedAt: new Date().toISOString(),
    updatedBy: schedule.createdBy,
    updatedByName: schedule.createdByName,
    history: [],
    revisionNumber: 0,
    scheduleId: schedule.id,
    scheduleCode: schedule.scheduleCode,
    assignedToUserId: assignedUserId,
    createdFrom: 'EVENT',
    recurrenceKey,
    syncStatus: navigator.onLine ? 'synced' : 'pending',
  };

  return await createInspection(inspection);
}

// Main scheduler function - runs all active schedules
export async function runScheduler(): Promise<{
  generated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generated = 0;

  try {
    const activeSchedules = await getActiveSchedules();

    for (const schedule of activeSchedules) {
      try {
        if (schedule.frequencyMode === 'FIXED_TIME') {
          const inspections = await generateFixedTimeInspections(schedule);
          generated += inspections.length;

          // Update next run date
          const nextRunAt = calculateNextRunDate(schedule);
          if (nextRunAt) {
            await updateSchedule(schedule.id, {
              lastRunAt: new Date().toISOString(),
              nextRunAt,
            });
          }
        }
        // ROLLING and USAGE_BASED are handled when inspections complete
        // EVENT_DRIVEN is handled when events are created
      } catch (error: any) {
        errors.push(`Schedule ${schedule.scheduleCode}: ${error.message}`);
        console.error(`Error processing schedule ${schedule.scheduleCode}:`, error);
      }
    }

    // Process unprocessed events
    const unprocessedEvents = await getUnprocessedEvents();
    const eventDrivenSchedules = activeSchedules.filter((s) => s.frequencyMode === 'EVENT_DRIVEN');

    for (const event of unprocessedEvents) {
      for (const schedule of eventDrivenSchedules) {
        try {
          const inspection = await generateEventDrivenInspections(schedule, event);
          if (inspection) {
            generated++;
            await markEventProcessed(event.id);
          }
        } catch (error: any) {
          errors.push(`Event ${event.id}: ${error.message}`);
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
    }

    // Process per-inspection schedules
    try {
      const { getActiveSchedules: getActivePerSchedules, updatePerInspectionSchedule: updatePerSchedule } = await import('../db/perInspectionScheduleRepository');
      const activePerSchedules = await getActivePerSchedules();

      for (const perSchedule of activePerSchedules) {
        try {
          const generatedCount = await generatePerInspectionScheduleInstances(perSchedule);
          generated += generatedCount;

          // Update last generated timestamp
          if (generatedCount > 0) {
            await updatePerSchedule(perSchedule.id, {
              lastGeneratedAt: new Date().toISOString(),
            });
          }
        } catch (error: any) {
          errors.push(`Per-inspection schedule ${perSchedule.id}: ${error.message}`);
          console.error(`Error processing per-inspection schedule ${perSchedule.id}:`, error);
        }
      }
    } catch (error: any) {
      errors.push(`Per-inspection scheduler error: ${error.message}`);
      console.error('Per-inspection scheduler error:', error);
    }
  } catch (error: any) {
    errors.push(`Scheduler error: ${error.message}`);
    console.error('Scheduler error:', error);
  }

  return { generated, errors };
}

// Generate inspections from per-inspection schedule
async function generatePerInspectionScheduleInstances(
  schedule: PerInspectionSchedule
): Promise<number> {
  if (schedule.status !== 'Active') return 0;

  const template = await getTemplateById(schedule.templateId);
  if (!template) {
    console.warn(`Template ${schedule.templateId} not found for per-inspection schedule ${schedule.id}`);
    return 0;
  }

  const startDate = new Date(schedule.startDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check end conditions
  if (schedule.endCondition === 'EndByDate' && schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (today > endDate) return 0;
  }

  if (schedule.endCondition === 'EndAfterOccurrences' && schedule.maxOccurrences) {
    if ((schedule.generatedCount || 0) >= schedule.maxOccurrences) return 0;
  }

  // Calculate rolling window
  const windowEnd = new Date(today);
  if (schedule.rollingWindow.enabled) {
    if (schedule.rollingWindow.windowUnit === 'weeks') {
      windowEnd.setDate(windowEnd.getDate() + 7 * schedule.rollingWindow.generateNextN);
    } else {
      windowEnd.setMonth(windowEnd.getMonth() + schedule.rollingWindow.generateNextN);
    }
  } else {
    // Default: generate next 4 weeks
    windowEnd.setDate(windowEnd.getDate() + 28);
  }

  const dates: Date[] = [];
  const current = new Date(Math.max(startDate.getTime(), today.getTime()));

  // Generate dates based on frequency (simplified - would need more complex logic for monthly patterns)
  while (current <= windowEnd && dates.length < 100) {
    let shouldInclude = false;

    switch (schedule.frequency) {
      case 'Daily':
        shouldInclude = true;
        current.setDate(current.getDate() + 1);
        break;
      case 'Weekly':
        if (schedule.pattern.daysOfWeek && schedule.pattern.daysOfWeek.includes(current.getDay())) {
          shouldInclude = true;
        }
        current.setDate(current.getDate() + 1);
        break;
      case 'Monthly':
        if (schedule.pattern.dayOfMonth && current.getDate() === schedule.pattern.dayOfMonth) {
          shouldInclude = true;
          current.setMonth(current.getMonth() + 1);
        } else {
          current.setDate(current.getDate() + 1);
        }
        break;
      case 'Quarterly':
        if (current.getDate() === schedule.pattern.dayOfMonth && [0, 3, 6, 9].includes(current.getMonth())) {
          shouldInclude = true;
          current.setMonth(current.getMonth() + 3);
        } else {
          current.setDate(current.getDate() + 1);
        }
        break;
      case 'Yearly':
        if (
          current.getDate() === schedule.pattern.dayOfMonth &&
          current.getMonth() === startDate.getMonth()
        ) {
          shouldInclude = true;
          current.setFullYear(current.getFullYear() + 1);
        } else {
          current.setDate(current.getDate() + 1);
        }
        break;
      case 'Custom':
        if (schedule.pattern.intervalDays) {
          const daysSinceStart = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceStart % schedule.pattern.intervalDays === 0) {
            shouldInclude = true;
          }
          current.setDate(current.getDate() + 1);
        }
        break;
    }

    if (shouldInclude && current <= windowEnd) {
      dates.push(new Date(current));
    }
  }

  // Generate inspections for each date
  let generated = 0;

  for (const date of dates) {
    const dateKey = date.toISOString().split('T')[0];
    const recurrenceKey = `PER-${schedule.id}-${schedule.templateId}-${schedule.assetId || 'all'}-${dateKey}`;

    // Check for duplicates
    const existingInspections = await getAllInspections();
    const duplicate = existingInspections.find(
      (i) =>
        i.templateId === schedule.templateId &&
        i.assetId === schedule.assetId &&
        i.inspectionDate === dateKey &&
        i.status !== 'Closed'
    );

    if (duplicate) continue;

    // Check end conditions again
    if (schedule.endCondition === 'EndAfterOccurrences' && schedule.maxOccurrences) {
      if ((schedule.generatedCount || 0) + generated >= schedule.maxOccurrences) break;
    }

    // Determine assigned user
    let assignedUserId = schedule.assignedToUserId;
    let assignedUserName: string | undefined;

    if (assignedUserId) {
      const user = mockUsers.find((u) => u.id === assignedUserId);
      assignedUserName = user ? `${user.firstName} ${user.lastName}` : undefined;
    }

    // Calculate due date/time
    const dueDate = new Date(date);
    if (schedule.timeOfDay && !schedule.dueByEndOfDay) {
      const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
      dueDate.setHours(hours, minutes, 0, 0);
    } else {
      dueDate.setHours(23, 59, 59, 999); // End of day
    }

    const plannedStartAt = new Date(date);
    if (schedule.timeOfDay && !schedule.dueByEndOfDay) {
      const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
      plannedStartAt.setHours(hours, minutes, 0, 0);
    } else {
      plannedStartAt.setHours(9, 0, 0, 0); // Default 9 AM
    }

    try {
      await createInspection({
        templateId: schedule.templateId,
        templateName: template.name,
        templateVersion: template.version,
        inspectionType: template.inspectionType,
        result: 'Pending',
        status: 'Draft',
        assetId: schedule.assetId,
        siteId: schedule.siteId,
        siteName: mockSites.find((s) => s.id === schedule.siteId)?.name,
        sections: template.sections,
        items: template.items,
        answers: [],
        attachments: [],
        signatures: [],
        inspectionDate: dateKey,
        plannedStartAt: plannedStartAt.toISOString(),
        dueAt: dueDate.toISOString(),
        inspectorId: assignedUserId || mockUsers[0]?.id || '',
        inspectorName: assignedUserName || mockUsers[0]?.firstName + ' ' + mockUsers[0]?.lastName || 'Unassigned',
        linkedDefectIds: [],
        createdAt: new Date().toISOString(),
        createdBy: schedule.createdBy,
        createdByName: schedule.createdByName,
        updatedAt: new Date().toISOString(),
        updatedBy: schedule.createdBy,
        updatedByName: schedule.createdByName,
        history: [],
        revisionNumber: 0,
        scheduleId: schedule.id,
        createdFrom: 'SCHEDULE',
        recurrenceKey,
        syncStatus: navigator.onLine ? 'synced' : 'pending',
      });

      generated++;
    } catch (error: any) {
      console.error(`Failed to create inspection for schedule ${schedule.id} on ${dateKey}:`, error);
    }
  }

  return generated;
}

// Run scheduler for a specific schedule
export async function runScheduleNow(scheduleId: string): Promise<{
  generated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let generated = 0;

  const schedule = await import('../db/schedulingRepository').then((m) =>
    m.getScheduleById(scheduleId)
  );

  if (!schedule) {
    return { generated: 0, errors: ['Schedule not found'] };
  }

  try {
    if (schedule.frequencyMode === 'FIXED_TIME') {
      const inspections = await generateFixedTimeInspections(schedule);
      generated += inspections.length;

      const nextRunAt = calculateNextRunDate(schedule);
      if (nextRunAt) {
        await updateSchedule(schedule.id, {
          lastRunAt: new Date().toISOString(),
          nextRunAt,
        });
      }
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  return { generated, errors };
}

