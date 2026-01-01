/**
 * API layer for defects - provides a clean interface for fetching defect data
 * This ensures consistency and allows the detail page to fetch independently
 */
import { getAllDefects } from './db/repository';
import { findDefectByCode } from './selectors';
import type { Defect } from './types';

/**
 * Get all defects
 */
export async function getAllDefectsFromAPI(): Promise<Defect[]> {
  try {
    return await getAllDefects();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to load defects');
  }
}

/**
 * Find a defect by its code
 * Supports flexible code formats: "DEF-0001", "DEF0001", "def-0001"
 * @param code - The defect code to find
 * @returns The matched defect or null
 */
export async function getDefectByCode(code: string): Promise<Defect | null> {
  try {
    const allDefects = await getAllDefectsFromAPI();
    return findDefectByCode(allDefects, code);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to load defects');
  }
}
