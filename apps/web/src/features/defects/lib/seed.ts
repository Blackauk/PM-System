import { createDefect, getDefectSettings } from '../db/repository';
import type { Defect } from '../types';

// Seed data for development
export async function seedDefects(): Promise<void> {
  const settings = await getDefectSettings();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const seedData: Omit<Defect, 'id' | 'defectCode' | 'unsafeDoNotUse' | 'history'>[] = [
    // Overdue, High severity, Unsafe
    {
      title: 'Hydraulic leak detected on main cylinder',
      description: 'Significant hydraulic fluid leak from main cylinder. Safety concern.',
      severityModel: 'LMH',
      severity: 'High',
      status: 'Open',
      reopenedCount: 0,
      targetRectificationDate: yesterday.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Isolate equipment', required: true, completed: false },
        { id: '2', title: 'Replace cylinder seal', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: ['PUWER'],
      assetId: 'AST-000001',
      siteId: '1',
      siteName: 'Site A',
      createdAt: lastWeek.toISOString(),
      createdBy: 'user-2',
      createdByName: 'Sarah Johnson',
      updatedAt: lastWeek.toISOString(),
      updatedBy: 'user-2',
      updatedByName: 'Sarah Johnson',
      comments: [],
    },

    // Critical, Unsafe, From Inspection
    {
      title: 'Brake system failure - safety critical',
      description: 'Complete brake system failure. Equipment must not be used.',
      severityModel: 'MMC',
      severity: 'Critical',
      status: 'Acknowledged',
      reopenedCount: 0,
      targetRectificationDate: tomorrow.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Quarantine equipment', required: true, completed: true, completedAt: yesterday.toISOString(), completedBy: 'user-1' },
        { id: '2', title: 'Order brake pads', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: true,
      complianceTags: ['PUWER', 'SITE_RULE'],
      assetId: 'AST-000004',
      siteId: '3',
      siteName: 'Site C',
      inspectionId: 'INS-000005',
      assignedToId: 'user-1',
      assignedToName: 'John Smith',
      createdAt: yesterday.toISOString(),
      createdBy: 'user-4',
      createdByName: 'Emma Wilson',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-1',
      updatedByName: 'John Smith',
      comments: [
        {
          id: '1',
          at: yesterday.toISOString(),
          by: 'user-1',
          byName: 'John Smith',
          text: 'Equipment quarantined. Waiting for parts.',
        },
      ],
    },

    // Waiting Parts, High severity
    {
      title: 'Engine overheating during operation',
      description: 'Engine temperature rising above normal operating range',
      severityModel: 'LMH',
      severity: 'High',
      status: 'InProgress',
      reopenedCount: 0,
      targetRectificationDate: nextWeek.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Replace thermostat', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      assetId: 'AST-000006',
      siteId: '1',
      siteName: 'Site A',
      assignedToId: 'user-1',
      assignedToName: 'John Smith',
      createdAt: lastWeek.toISOString(),
      createdBy: 'user-8',
      createdByName: 'Rachel Green',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-1',
      updatedByName: 'John Smith',
      comments: [
        {
          id: '1',
          at: yesterday.toISOString(),
          by: 'user-1',
          byName: 'John Smith',
          text: 'Waiting for replacement thermostat to arrive.',
        },
      ],
    },

    // Low severity, In Progress
    {
      title: 'Minor electrical fault in control panel',
      description: 'Intermittent fault in control panel LED indicator',
      severityModel: 'LMH',
      severity: 'Low',
      status: 'InProgress',
      reopenedCount: 0,
      actions: [
        { id: '1', title: 'Check wiring connections', required: false, completed: true, completedAt: yesterday.toISOString(), completedBy: 'user-7' },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      assetId: 'AST-000005',
      siteId: '1',
      siteName: 'Site A',
      assignedToId: 'user-7',
      assignedToName: 'David Lee',
      createdAt: lastWeek.toISOString(),
      createdBy: 'user-7',
      createdByName: 'David Lee',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-7',
      updatedByName: 'David Lee',
      comments: [],
    },

    // Medium, Open, Unassigned
    {
      title: 'Worn tire tread below minimum',
      description: 'Tire tread depth below legal minimum. Requires replacement.',
      severityModel: 'LMH',
      severity: 'Medium',
      status: 'Open',
      reopenedCount: 0,
      targetRectificationDate: nextWeek.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Replace tire', required: false, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      assetId: 'AST-000002',
      siteId: '1',
      siteName: 'Site A',
      createdAt: yesterday.toISOString(),
      createdBy: 'user-1',
      createdByName: 'John Smith',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-1',
      updatedByName: 'John Smith',
      comments: [],
    },

    // Critical, Open, Unsafe
    {
      title: 'Safety guard missing on rotating parts',
      description: 'Safety guard removed from rotating parts. Immediate safety hazard.',
      severityModel: 'MMC',
      severity: 'Critical',
      status: 'Open',
      reopenedCount: 0,
      targetRectificationDate: yesterday.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Install safety guard', required: true, completed: false },
        { id: '2', title: 'Verify guard installation', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: true,
      complianceTags: ['PUWER', 'SITE_RULE'],
      assetId: 'AST-000007',
      siteId: '3',
      siteName: 'Site C',
      createdAt: yesterday.toISOString(),
      createdBy: 'user-6',
      createdByName: 'Lisa Anderson',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-6',
      updatedByName: 'Lisa Anderson',
      comments: [],
    },

    // Closed defect
    {
      title: 'Loose mounting bolts on generator',
      description: 'Mounting bolts found loose during inspection',
      severityModel: 'LMH',
      severity: 'Medium',
      status: 'Closed',
      reopenedCount: 0,
      actions: [
        { id: '1', title: 'Tighten mounting bolts', required: false, completed: true, completedAt: lastWeek.toISOString(), completedBy: 'user-7' },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      assetId: 'AST-000005',
      siteId: '1',
      siteName: 'Site A',
      assignedToId: 'user-7',
      assignedToName: 'David Lee',
      createdAt: new Date(lastWeek.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'user-2',
      createdByName: 'Sarah Johnson',
      updatedAt: lastWeek.toISOString(),
      updatedBy: 'user-7',
      updatedByName: 'David Lee',
      comments: [
        {
          id: '1',
          at: lastWeek.toISOString(),
          by: 'user-7',
          byName: 'David Lee',
          text: 'All bolts tightened to specification. Defect resolved.',
        },
      ],
    },

    // Reopened defect
    {
      title: 'Faulty pressure relief valve',
      description: 'Pressure relief valve not operating correctly',
      severityModel: 'LMH',
      severity: 'High',
      status: 'Open',
      reopenedCount: 1,
      targetRectificationDate: tomorrow.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Replace pressure relief valve', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: ['PUWER'],
      assetId: 'AST-000001',
      siteId: '1',
      siteName: 'Site A',
      createdAt: new Date(lastWeek.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'user-1',
      createdByName: 'John Smith',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-1',
      updatedByName: 'John Smith',
      comments: [
        {
          id: '1',
          at: yesterday.toISOString(),
          by: 'user-1',
          byName: 'John Smith',
          text: 'Issue reoccurred. Reopening defect.',
        },
      ],
    },

    // Deferred
    {
      title: 'Cosmetic damage to equipment housing',
      description: 'Minor cosmetic damage, no functional impact',
      severityModel: 'LMH',
      severity: 'Low',
      status: 'Deferred',
      reopenedCount: 0,
      actions: [],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      assetId: 'AST-000003',
      siteId: '2',
      siteName: 'Site B',
      createdAt: lastWeek.toISOString(),
      createdBy: 'user-5',
      createdByName: 'Tom Brown',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-5',
      updatedByName: 'Tom Brown',
      comments: [
        {
          id: '1',
          at: yesterday.toISOString(),
          by: 'user-5',
          byName: 'Tom Brown',
          text: 'Deferred until next scheduled maintenance window.',
        },
      ],
    },

    // Major severity (MMC model)
    {
      title: 'Structural crack in support frame',
      description: 'Crack detected in main support frame. Requires engineering assessment.',
      severityModel: 'MMC',
      severity: 'Major',
      status: 'Acknowledged',
      reopenedCount: 0,
      targetRectificationDate: nextWeek.toISOString().split('T')[0],
      actions: [
        { id: '1', title: 'Engage structural engineer', required: true, completed: true, completedAt: yesterday.toISOString(), completedBy: 'user-2' },
        { id: '2', title: 'Implement temporary support', required: true, completed: false },
      ],
      attachments: [],
      beforeAfterRequired: true,
      complianceTags: ['PUWER', 'LOLER'],
      assetId: 'AST-000003',
      siteId: '2',
      siteName: 'Site B',
      assignedToId: 'user-2',
      assignedToName: 'Sarah Johnson',
      createdAt: yesterday.toISOString(),
      createdBy: 'user-7',
      createdByName: 'David Lee',
      updatedAt: yesterday.toISOString(),
      updatedBy: 'user-2',
      updatedByName: 'Sarah Johnson',
      comments: [],
    },
  ];

  // Only seed if database is empty
  const existing = await getAllDefects();
  if (existing.length > 0) {
    console.log('Defects already seeded, skipping...');
    return;
  }

  for (const data of seedData) {
    await createDefect(data);
  }

  console.log(`Seeded ${seedData.length} defects`);
}

// Helper to get all defects (for seed check)
async function getAllDefects(): Promise<Defect[]> {
  const { getAllDefects } = await import('../db/repository');
  return getAllDefects();
}
