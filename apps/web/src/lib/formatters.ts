/**
 * Formatting utilities for consistent display across the app
 */

export type OperationalStatus = 'InUse' | 'OutOfUse' | 'OffHirePending' | 'OffHired' | 'Quarantined' | 'Archived';

/**
 * Format operational status for display
 * Converts camelCase/PascalCase to readable format
 */
export function formatOperationalStatus(status: OperationalStatus): string {
  const statusMap: Record<OperationalStatus, string> = {
    InUse: 'In Use',
    OutOfUse: 'Out of Use',
    OffHirePending: 'Off Hire Pending',
    OffHired: 'Off Hired',
    Quarantined: 'Quarantined',
    Archived: 'Archived',
  };
  return statusMap[status] || status;
}

/**
 * Format lifecycle status for display
 */
export function formatLifecycleStatus(status: string): string {
  // Already formatted, but keeping for consistency
  return status;
}
