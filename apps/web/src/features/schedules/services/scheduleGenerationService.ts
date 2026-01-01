/**
 * Schedule Generation Service
 * 
 * This service handles automatic generation of inspections from schedules.
 * 
 * Generation Logic:
 * - Runs on app load and when entering Inspections page
 * - For each active schedule, checks if nextDueDate <= dateNow + generateAheadDays
 * - Creates inspection instances if they don't already exist for that schedule + scheduledDate window
 * - Marks inspections as scheduledInstance=true and sets scheduleId and scheduledDate
 * - Sets inspection status to "Draft" (or "In Progress" only when started)
 * 
 * RollingRule behaviors:
 * - FixedInterval: nextDueDate always advances by rule regardless of completion
 * - NextAfterComplete: nextDueDate advances only when the scheduled inspection is completed/submitted
 * 
 * Overdue:
 * - If dateNow > nextDueDate + gracePeriodDays and no completed inspection exists for that due window,
 *   mark schedule as overdue (derived flag) and optionally mark generated inspection as overdue
 */

import { getAllSchedules, updateSchedule, getSchedules } from './inspectionScheduleService';
import { getAssets } from '../../assets/services';
import { getAllTemplates } from '../../inspections/db/repository';
import { mockUsers } from '../../reports/services/mockUsers';
import type { InspectionSchedule } from '../types/inspectionSchedule';
import type { Inspection } from '../../inspections/types';

interface GenerateOptions {
  siteId?: string;
  dateNow?: Date;
  scheduleIds?: string[]; // If provided, only generate for these schedules
}

/**
 * Calculate next due date based on schedule rules
 */
function calculateNextDueDate(
  schedule: InspectionSchedule,
  fromDate: Date = new Date()
): Date | null {
  if (schedule.frequencyType === 'Calendar' && schedule.calendarRule) {
    const { pattern, daysOfWeek, dayOfMonth, nthWeekday, timeOfDay } = schedule.calendarRule;
    const next = new Date(fromDate);

    if (pattern === 'Daily') {
      next.setDate(next.getDate() + 1);
    } else if (pattern === 'Weekly' && daysOfWeek && daysOfWeek.length > 0) {
      // Find next matching day of week
      const dayMap: Record<string, number> = {
        Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
      };
      const currentDay = next.getDay();
      const targetDays = daysOfWeek.map(d => dayMap[d] ?? 0).sort((a, b) => a - b);
      
      let daysToAdd = 0;
      for (const targetDay of targetDays) {
        if (targetDay > currentDay) {
          daysToAdd = targetDay - currentDay;
          break;
        }
      }
      if (daysToAdd === 0) {
        // Next week
        daysToAdd = 7 - currentDay + (targetDays[0] || 0);
      }
      next.setDate(next.getDate() + daysToAdd);
    } else if (pattern === 'Monthly') {
      if (nthWeekday) {
        // Find nth weekday of next month
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        const dayMap: Record<string, number> = {
          Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
        };
        const targetDay = dayMap[nthWeekday.weekday] ?? 1;
        while (next.getDay() !== targetDay) {
          next.setDate(next.getDate() + 1);
        }
        // Move to nth occurrence
        const nth = nthWeekday.nth === 5 ? -1 : nthWeekday.nth - 1; // 5 = last
        if (nth > 0) {
          next.setDate(next.getDate() + (nth * 7));
        } else if (nth === -1) {
          // Last occurrence: go to end of month and work backwards
          next.setMonth(next.getMonth() + 1);
          next.setDate(0); // Last day of current month
          while (next.getDay() !== targetDay) {
            next.setDate(next.getDate() - 1);
          }
        }
      } else if (dayOfMonth) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
    } else if (pattern === 'Yearly') {
      next.setFullYear(next.getFullYear() + 1);
    }

    // Set time if provided
    if (timeOfDay) {
      const [hours, minutes] = timeOfDay.split(':').map(Number);
      next.setHours(hours || 0, minutes || 0, 0, 0);
    }

    return next;
  }

  if (schedule.frequencyType === 'Usage' && schedule.usageRule) {
    // Usage-based: next due is calculated when asset meter crosses threshold
    // This is handled separately when meter readings are updated
    return null;
  }

  if (schedule.frequencyType === 'Event' && schedule.eventRule) {
    // Event-driven: next due is calculated when event occurs
    return null;
  }

  return null;
}

/**
 * Generate a recurrence key for duplicate prevention
 */
function generateRecurrenceKey(
  schedule: InspectionSchedule,
  assetId: string,
  scheduledDate: Date
): string {
  const dateKey = scheduledDate.toISOString().split('T')[0];
  return `${schedule.id}-${assetId}-${schedule.templateId}-${dateKey}`;
}

/**
 * Check if an inspection already exists for this schedule + asset + date
 */
async function checkDuplicateInspection(
  schedule: InspectionSchedule,
  assetId: string,
  scheduledDate: Date
): Promise<boolean> {
  const recurrenceKey = generateRecurrenceKey(schedule, assetId, scheduledDate);
  // TODO: Query inspections by recurrenceKey
  // For now, return false (no duplicate check)
  return false;
}

/**
 * Get assets that match the schedule scope
 */
function getScopedAssets(schedule: InspectionSchedule): string[] {
  if (schedule.scopeType === 'Assets') {
    return schedule.scopeAssetIds;
  }
  if (schedule.scopeType === 'Site' && schedule.siteId) {
    const assets = getAssets({ siteId: schedule.siteId });
    return assets.map(a => a.id);
  }
  if (schedule.scopeType === 'Location' && schedule.locationIds) {
    // TODO: Filter assets by location
    const assets = getAssets({ siteId: schedule.siteId });
    return assets.map(a => a.id);
  }
  if (schedule.scopeType === 'AssetGroup' && schedule.scopeAssetGroupId) {
    // TODO: Get assets by group
    return [];
  }
  return [];
}

/**
 * Generate inspections for a single schedule
 */
async function generateInspectionsForSchedule(
  schedule: InspectionSchedule,
  dateNow: Date
): Promise<number> {
  try {
    if (schedule.status !== 'Active') return 0;
    if (schedule.frequencyType === 'Event') return 0; // Event-driven handled separately

    const generateUntil = new Date(dateNow);
    generateUntil.setDate(generateUntil.getDate() + schedule.generateAheadDays);

    // Check if we need to generate
    if (!schedule.nextDueDate) {
      // Calculate initial nextDueDate from startDate
      try {
        const startDate = new Date(schedule.startDate);
        const nextDue = calculateNextDueDate(schedule, startDate);
        if (nextDue) {
          updateSchedule(schedule.id, { nextDueDate: nextDue.toISOString() });
        }
      } catch (err) {
        console.error(`Error calculating next due date for schedule ${schedule.id}:`, err);
      }
      return 0;
    }

    const nextDueDate = new Date(schedule.nextDueDate);
    if (nextDueDate > generateUntil) return 0; // Not time to generate yet

    let templates;
    try {
      templates = await getAllTemplates();
    } catch (err) {
      console.error(`Error loading templates for schedule ${schedule.id}:`, err);
      return 0;
    }
    
    if (!templates || templates.length === 0) {
      return 0;
    }
    
    const template = templates.find(t => t.id === schedule.templateId);
    if (!template) {
      console.warn(`Template ${schedule.templateId} not found for schedule ${schedule.id}`);
      return 0;
    }

    const scopedAssets = getScopedAssets(schedule);
    if (scopedAssets.length === 0) return 0;

    let generatedCount = 0;
    const scheduledDate = new Date(nextDueDate);

    for (const assetId of scopedAssets) {
      // Check for duplicate
      const isDuplicate = await checkDuplicateInspection(schedule, assetId, scheduledDate);
      if (isDuplicate) continue;

      // Get asset
      const assets = getAssets({});
      const asset = assets.find(a => a.id === assetId);
      if (!asset) continue;

      // Determine assigned user
      let assignedUserId = schedule.assignment.id;
      let assignedUserName = schedule.assignment.name;
      if (schedule.assignment.type === 'Role') {
        // Find first user with this role
        const user = mockUsers.find(u => u.role === schedule.assignment.id);
        if (user) {
          assignedUserId = user.id;
          assignedUserName = `${user.firstName} ${user.lastName}`;
        }
      }

      // Create inspection
      try {
        const inspection: Omit<Inspection, 'id' | 'inspectionCode'> = {
          templateId: schedule.templateId,
          templateName: template.name,
          templateVersion: template.version || '1.0',
          inspectionType: template.inspectionType,
          result: 'N/A',
          status: 'Draft',
          assetId,
          assetTypeCode: asset.assetTypeCode,
          assetMake: asset.make,
          assetModel: asset.model,
          siteId: asset.siteId,
          siteName: asset.siteName,
          inspectorId: assignedUserId || '',
          inspectorName: assignedUserName || 'Unassigned',
          inspectionDate: scheduledDate.toISOString().split('T')[0],
          dueDate: scheduledDate.toISOString().split('T')[0],
          sections: template.sections || [],
          items: template.items || [],
          answers: [],
          attachments: [],
          signatures: [],
          linkedDefectIds: [],
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          createdByName: 'System',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          updatedByName: 'System',
          // Scheduling fields
          scheduleId: schedule.id,
          scheduleCode: schedule.id,
          plannedStartAt: scheduledDate.toISOString(),
          dueAt: scheduledDate.toISOString(),
          assignedToUserId: assignedUserId,
          createdFrom: 'SCHEDULE',
          recurrenceKey: generateRecurrenceKey(schedule, assetId, scheduledDate),
          // Note: history and revisionNumber are added by repository.createInspection
        };

        // Create inspection via repository
        const { createInspection } = await import('../../inspections/db/repository');
        await createInspection(inspection);
        generatedCount++;
      } catch (error) {
        console.error(`Failed to generate inspection for schedule ${schedule.id}, asset ${assetId}:`, error);
      }
    }

    // Update schedule's nextDueDate and lastGeneratedAt
    if (generatedCount > 0 || schedule.rollingRule === 'FixedInterval') {
      try {
        const nextDue = calculateNextDueDate(schedule, scheduledDate);
        if (nextDue) {
          updateSchedule(schedule.id, {
            nextDueDate: nextDue.toISOString(),
            lastGeneratedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error(`Error updating schedule ${schedule.id}:`, err);
      }
    }

    return generatedCount;
  } catch (error) {
    console.error(`Error generating inspections for schedule ${schedule.id}:`, error);
    return 0;
  }
}

/**
 * Generate scheduled inspections for all active schedules
 */
export async function generateScheduledInspections(options: GenerateOptions = {}): Promise<number> {
  try {
    const dateNow = options.dateNow || new Date();
    let schedules: InspectionSchedule[];
    
    try {
      if (options.scheduleIds) {
        const allSchedules = getAllSchedules();
        schedules = allSchedules.filter(s => options.scheduleIds!.includes(s.id) && s.status === 'Active');
      } else {
        schedules = getSchedules({ status: 'Active' });
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
      return 0;
    }
    
    if (!schedules || schedules.length === 0) {
      return 0;
    }

    if (options.siteId) {
      schedules = schedules.filter(s => s.siteId === options.siteId);
    }

    let totalGenerated = 0;

    for (const schedule of schedules) {
      try {
        const count = await generateInspectionsForSchedule(schedule, dateNow);
        totalGenerated += count;
      } catch (error) {
        console.error(`Error generating inspections for schedule ${schedule.id}:`, error);
      }
    }

    return totalGenerated;
  } catch (error) {
    console.error('Error in generateScheduledInspections:', error);
    return 0;
  }
}

/**
 * Advance schedule's nextDueDate after inspection completion
 * Used when rollingRule = NextAfterComplete
 */
export function advanceScheduleAfterCompletion(
  scheduleId: string,
  completionDate: Date
): void {
  try {
    const schedule = getAllSchedules().find(s => s.id === scheduleId);
    if (!schedule || schedule.rollingRule !== 'NextAfterComplete') return;

    const nextDue = calculateNextDueDate(schedule, completionDate);
    if (nextDue) {
      updateSchedule(scheduleId, {
        nextDueDate: nextDue.toISOString(),
        lastGeneratedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(`Error advancing schedule ${scheduleId}:`, error);
  }
}
