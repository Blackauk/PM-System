/**
 * Seed data for Inspection Schedules
 * Creates sample schedules for testing and demonstration
 */

import { createSchedule } from './inspectionScheduleService';
import { mockUsers } from '../../reports/services/mockUsers';
import { mockSites } from '../../assets/services';
import { getAssets } from '../../assets/services';
import { getAllTemplates } from '../../inspections/db/repository';

export async function seedInspectionSchedules(): Promise<void> {
  try {
    // Check if schedules already exist
    const { getAllSchedules } = await import('./inspectionScheduleService');
    const existing = getAllSchedules();
    if (existing.length > 0) {
      console.log('Inspection schedules already seeded');
      return;
    }

    const templates = await getAllTemplates();
    const assets = getAssets({});
    const sites = mockSites;
    const users = mockUsers;

    if (templates.length === 0 || assets.length === 0) {
      console.warn('Cannot seed schedules: missing templates or assets');
      return;
    }

    const template1 = templates[0];
    const template2 = templates[1] || templates[0];
    const site1 = sites[0];
    const user1 = users.find(u => u.role === 'Supervisor') || users[0];
    const asset1 = assets[0];
    const asset2 = assets[1] || assets[0];

    // Schedule 1: Weekly MEWP Safety Inspection
    createSchedule({
    name: 'Weekly MEWP Safety Inspection',
    templateId: template1.id,
    templateName: template1.name,
    category: 'Safety',
    priority: 'High',
    status: 'Active',
    scopeType: 'Assets',
    scopeAssetIds: [asset1.id],
    siteId: site1.id,
    siteName: site1.name,
    includeNewAssets: false,
    frequencyType: 'Calendar',
    calendarRule: {
      pattern: 'Weekly',
      daysOfWeek: ['Mon'],
      timeOfDay: '08:00',
    },
    startDate: new Date().toISOString().split('T')[0],
    generateAheadDays: 7,
    rollingRule: 'FixedInterval',
    gracePeriodDays: 7,
    assignment: {
      type: 'User',
      id: user1.id,
      name: `${user1.firstName} ${user1.lastName}`,
    },
    notifications: {
      onCreate: true,
      beforeDueHours: 24,
      onOverdue: true,
      escalation: ['Supervisor'],
    },
      createdBy: user1.id,
      createdByName: `${user1.firstName} ${user1.lastName}`,
    });

    // Schedule 2: Monthly Statutory Compliance Check
    createSchedule({
    name: 'Monthly Statutory Compliance Check',
    templateId: template2.id,
    templateName: template2.name,
    category: 'Statutory',
    priority: 'Critical',
    status: 'Active',
    scopeType: 'Site',
    scopeAssetIds: [],
    siteId: site1.id,
    siteName: site1.name,
    includeNewAssets: true,
    frequencyType: 'Calendar',
    calendarRule: {
      pattern: 'Monthly',
      dayOfMonth: 1,
      timeOfDay: '09:00',
    },
    startDate: new Date().toISOString().split('T')[0],
    generateAheadDays: 14,
    rollingRule: 'FixedInterval',
    gracePeriodDays: 3,
    assignment: {
      type: 'Role',
      id: 'Supervisor',
      name: 'Supervisor',
    },
    notifications: {
      onCreate: true,
      beforeDueHours: 48,
      onOverdue: true,
      escalation: ['Manager'],
    },
      createdBy: user1.id,
      createdByName: `${user1.firstName} ${user1.lastName}`,
    });

    // Schedule 3: Daily Operational Check
    createSchedule({
    name: 'Daily Operational Check',
    templateId: template1.id,
    templateName: template1.name,
    category: 'Operational',
    priority: 'Normal',
    status: 'Active',
    scopeType: 'Assets',
    scopeAssetIds: asset2 ? [asset2.id] : [asset1.id],
    siteId: site1.id,
    siteName: site1.name,
    includeNewAssets: false,
    frequencyType: 'Calendar',
    calendarRule: {
      pattern: 'Daily',
      timeOfDay: '06:00',
    },
    startDate: new Date().toISOString().split('T')[0],
    generateAheadDays: 3,
    rollingRule: 'NextAfterComplete',
    gracePeriodDays: 1,
    assignment: {
      type: 'User',
      id: user1.id,
      name: `${user1.firstName} ${user1.lastName}`,
    },
    notifications: {
      onCreate: false,
      beforeDueHours: null,
      onOverdue: true,
      escalation: [],
    },
      createdBy: user1.id,
      createdByName: `${user1.firstName} ${user1.lastName}`,
    });

    // Schedule 4: Usage-Based Inspection (250 hours)
    createSchedule({
    name: 'Usage-Based Inspection (250 hours)',
    templateId: template1.id,
    templateName: template1.name,
    category: 'Operational',
    priority: 'Normal',
    status: 'Active',
    scopeType: 'Assets',
    scopeAssetIds: [asset1.id],
    siteId: site1.id,
    siteName: site1.name,
    includeNewAssets: false,
    frequencyType: 'Usage',
    usageRule: {
      intervalHours: 250,
    },
    startDate: new Date().toISOString().split('T')[0],
    generateAheadDays: 0,
    rollingRule: 'NextAfterComplete',
    gracePeriodDays: 7,
    assignment: {
      type: 'User',
      id: user1.id,
      name: `${user1.firstName} ${user1.lastName}`,
    },
    notifications: {
      onCreate: true,
      beforeDueHours: null,
      onOverdue: true,
      escalation: ['Supervisor'],
    },
      createdBy: user1.id,
      createdByName: `${user1.firstName} ${user1.lastName}`,
    });

    // Schedule 5: Paused Schedule (for testing)
    createSchedule({
    name: 'Paused Test Schedule',
    templateId: template1.id,
    templateName: template1.name,
    category: 'Operational',
    priority: 'Normal',
    status: 'Paused',
    scopeType: 'Assets',
    scopeAssetIds: [asset1.id],
    siteId: site1.id,
    siteName: site1.name,
    includeNewAssets: false,
    frequencyType: 'Calendar',
    calendarRule: {
      pattern: 'Weekly',
      daysOfWeek: ['Fri'],
      timeOfDay: '17:00',
    },
    startDate: new Date().toISOString().split('T')[0],
    generateAheadDays: 7,
    rollingRule: 'FixedInterval',
    gracePeriodDays: 7,
    assignment: {
      type: 'User',
      id: user1.id,
      name: `${user1.firstName} ${user1.lastName}`,
    },
    notifications: {
      onCreate: false,
      beforeDueHours: null,
      onOverdue: false,
      escalation: [],
    },
      createdBy: user1.id,
      createdByName: `${user1.firstName} ${user1.lastName}`,
    });

    console.log('Seeded 5 inspection schedules');
  } catch (error) {
    console.error('Error seeding inspection schedules:', error);
    // Don't throw - seeding is non-critical
  }
}

