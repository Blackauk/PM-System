import type { Defect } from './types';

/**
 * Normalizes a defect code to standard format
 * - "DEF0001" -> "DEF-0001"
 * - "def-0001" -> "DEF-0001"
 * - "DEF-0001" -> "DEF-0001"
 */
function normalizeDefectCode(code: string): string {
  if (!code) return '';
  
  // Remove spaces and convert to uppercase
  let normalized = code.trim().toUpperCase();
  
  // If missing hyphen, add it after "DEF" (DEF0001 -> DEF-0001)
  if (normalized.startsWith('DEF') && !normalized.includes('-')) {
    normalized = normalized.replace(/^DEF(\d+)/, 'DEF-$1');
  }
  
  return normalized;
}

/**
 * Find a defect by its code
 * Supports flexible code formats: "DEF-0001", "DEF0001", "def-0001"
 * 
 * @param defects - Array of defects to search
 * @param code - The defect code to find (can be in various formats)
 * @returns The matched defect or null
 */
export function findDefectByCode(defects: Defect[], code: string): Defect | null {
  if (!code || !defects || defects.length === 0) return null;
  
  const normalizedCode = normalizeDefectCode(code);
  if (!normalizedCode) return null;
  
  // Try exact match first (case-insensitive)
  const exactMatch = defects.find(d => 
    d.defectCode && normalizeDefectCode(d.defectCode) === normalizedCode
  );
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match on original code
  const caseInsensitiveMatch = defects.find(d => 
    d.defectCode && d.defectCode.toUpperCase() === normalizedCode
  );
  if (caseInsensitiveMatch) return caseInsensitiveMatch;
  
  return null;
}


