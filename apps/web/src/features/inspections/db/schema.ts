import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Inspection, InspectionTemplate, InspectionSettings } from '../types';
import type { InspectionSchedule, SchedulingEvent } from '../types/scheduling';
import type { PerInspectionSchedule } from '../types/perInspectionSchedule';

export interface InspectionsDB extends DBSchema {
  inspections: {
    key: string; // id (UUID)
    value: Inspection;
    indexes: {
      'by-inspectionCode': string;
      'by-status': string;
      'by-result': string;
      'by-assetId': string;
      'by-siteId': string;
      'by-inspectorId': string;
      'by-inspectionDate': string;
      'by-dueDate': string;
    };
  };
  templates: {
    key: string; // id (UUID)
    value: InspectionTemplate;
    indexes: {
      'by-inspectionType': string;
      'by-assetTypeId': string;
      'by-siteId': string;
      'by-name': string;
    };
  };
  counters: {
    key: string; // 'inspection'
    value: {
      key: string;
      counter: number;
    };
  };
  settings: {
    key: string; // 'inspection'
    value: {
      key: string;
      settings: InspectionSettings;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'createInspection' | 'updateInspection' | 'submitInspection' | 'approveInspection' | 'closeInspection' | 'uploadPhoto' | 'createDefect';
      inspectionId: string;
      data: unknown;
      retries: number;
      createdAt: number;
    };
  };
  // Cache stores for offline support
  assetCache: {
    key: string; // assetId
    value: {
      id: string;
      name: string;
      siteId?: string;
      siteName?: string;
      locationId?: string;
      locationName?: string;
      assetTypeId?: string;
      assetTypeCode?: string;
      cachedAt: string;
    };
  };
  userCache: {
    key: string; // userId
    value: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      cachedAt: string;
    };
  };
  // Scheduling stores
  schedules: {
    key: string; // id (UUID)
    value: InspectionSchedule;
    indexes: {
      'by-scheduleCode': string;
      'by-siteId': string;
      'by-status': string;
      'by-templateId': string;
      'by-nextRunAt': string;
    };
  };
  schedulingEvents: {
    key: string; // id (UUID)
    value: SchedulingEvent;
    indexes: {
      'by-type': string;
      'by-assetId': string;
      'by-siteId': string;
      'by-createdAt': string;
      'by-processedAt': string;
    };
  };
  scheduleCounters: {
    key: string; // 'schedule'
    value: {
      key: string;
      counter: number;
    };
  };
  // Per-inspection schedules (simpler rules for individual inspections)
  perInspectionSchedules: {
    key: string; // id (UUID)
    value: PerInspectionSchedule;
    indexes: {
      'by-inspectionId': string;
      'by-templateId': string;
      'by-assetId': string;
      'by-siteId': string;
      'by-status': string;
      'by-nextRunAt': string;
    };
  };
}

let db: IDBPDatabase<InspectionsDB> | null = null;

export async function initInspectionsDB(): Promise<IDBPDatabase<InspectionsDB>> {
  if (db) return db;

  db = await openDB<InspectionsDB>('ppm-inspections', 3, {
    upgrade(database) {
      // Inspections store
      if (!database.objectStoreNames.contains('inspections')) {
        const inspectionStore = database.createObjectStore('inspections', { keyPath: 'id' });
        inspectionStore.createIndex('by-inspectionCode', 'inspectionCode', { unique: true });
        inspectionStore.createIndex('by-status', 'status');
        inspectionStore.createIndex('by-result', 'result');
        inspectionStore.createIndex('by-assetId', 'assetId');
        inspectionStore.createIndex('by-siteId', 'siteId');
        inspectionStore.createIndex('by-inspectorId', 'inspectorId');
        inspectionStore.createIndex('by-inspectionDate', 'inspectionDate');
        inspectionStore.createIndex('by-dueDate', 'dueDate');
      }

      // Templates store
      if (!database.objectStoreNames.contains('templates')) {
        const templateStore = database.createObjectStore('templates', { keyPath: 'id' });
        templateStore.createIndex('by-inspectionType', 'inspectionType');
        templateStore.createIndex('by-assetTypeId', 'assetTypeId');
        templateStore.createIndex('by-siteId', 'siteId');
        templateStore.createIndex('by-name', 'name');
      }

      // Counters store
      if (!database.objectStoreNames.contains('counters')) {
        database.createObjectStore('counters', { keyPath: 'key' });
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      // Sync queue store
      if (!database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'id' });
      }

      // Asset cache store (for offline support)
      if (!database.objectStoreNames.contains('assetCache')) {
        const assetCacheStore = database.createObjectStore('assetCache', { keyPath: 'id' });
        assetCacheStore.createIndex('by-siteId', 'siteId');
      }

      // User cache store (for offline support)
      if (!database.objectStoreNames.contains('userCache')) {
        database.createObjectStore('userCache', { keyPath: 'id' });
      }

      // Schedules store
      if (!database.objectStoreNames.contains('schedules')) {
        const scheduleStore = database.createObjectStore('schedules', { keyPath: 'id' });
        scheduleStore.createIndex('by-scheduleCode', 'scheduleCode', { unique: true });
        scheduleStore.createIndex('by-siteId', 'siteId');
        scheduleStore.createIndex('by-status', 'status');
        scheduleStore.createIndex('by-templateId', 'templateId');
        scheduleStore.createIndex('by-nextRunAt', 'nextRunAt');
      }

      // Scheduling events store
      if (!database.objectStoreNames.contains('schedulingEvents')) {
        const eventStore = database.createObjectStore('schedulingEvents', { keyPath: 'id' });
        eventStore.createIndex('by-type', 'type');
        eventStore.createIndex('by-assetId', 'assetId');
        eventStore.createIndex('by-siteId', 'siteId');
        eventStore.createIndex('by-createdAt', 'createdAt');
        eventStore.createIndex('by-processedAt', 'processedAt');
      }

      // Schedule counters store
      if (!database.objectStoreNames.contains('scheduleCounters')) {
        database.createObjectStore('scheduleCounters', { keyPath: 'key' });
      }

      // Per-inspection schedules store
      if (!database.objectStoreNames.contains('perInspectionSchedules')) {
        const perScheduleStore = database.createObjectStore('perInspectionSchedules', { keyPath: 'id' });
        perScheduleStore.createIndex('by-inspectionId', 'inspectionId');
        perScheduleStore.createIndex('by-templateId', 'templateId');
        perScheduleStore.createIndex('by-assetId', 'assetId');
        perScheduleStore.createIndex('by-siteId', 'siteId');
        perScheduleStore.createIndex('by-status', 'status');
        perScheduleStore.createIndex('by-nextRunAt', 'nextRunAt');
      }
    },
  });

  // Initialize schedule counter if not exists
  const scheduleCounter = await db.get('scheduleCounters', 'schedule');
  if (!scheduleCounter) {
    await db.put('scheduleCounters', 'schedule', {
      key: 'schedule',
      counter: 0,
    });
  }

  // Initialize default settings if not exists
  const settings = await db.get('settings', 'inspection');
  if (!settings) {
    await db.put('settings', 'inspection', {
      key: 'inspection',
      settings: {
        requireCommentOnFail: true,
        requirePhotoOnFail: true,
        requireDefectOnFail: true,
        enableApprovals: true,
        enableSignatures: true,
        checklistItemSeverityDefaults: true,
        conflictResolution: 'last-write-wins',
      },
    });
  }

  // Initialize counter if not exists
  const counter = await db.get('counters', 'inspection');
  if (!counter) {
    await db.put('counters', 'inspection', {
      key: 'inspection',
      counter: 0,
    });
  }

  return db;
}

export async function getInspectionsDB(): Promise<IDBPDatabase<InspectionsDB>> {
  if (!db) {
    return await initInspectionsDB();
  }
  return db;
}
