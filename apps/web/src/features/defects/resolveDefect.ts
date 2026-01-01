import type { Defect } from './types';

/**
 * Resolves a defect from a URL parameter.
 * Supports multiple formats:
 * - UUID: Direct match on defect.id
 * - "def-{number}": Extract number and match by id (e.g., "def-1" matches id "def-1")
 * - "DEF-{number}": Match on defectCode (case-insensitive, flexible padding)
 * 
 * @param defects - Array of all defects to search
 * @param param - URL parameter value
 * @returns The matched defect or null
 */
export function resolveDefect(defects: Defect[], param: string): Defect | null {
  if (!param) return null;

  // 1. Try direct ID match first (most common case - handles UUIDs and "def-1" format)
  const directMatch = defects.find(d => d.id === param);
  if (directMatch) return directMatch;

  // 2. Try "def-{number}" format (e.g., "def-1" -> matches id "def-1")
  // This handles the mock data format where IDs are "def-1", "def-2", etc.
  const defNumberMatch = param.match(/^def-(\d+)$/i);
  if (defNumberMatch) {
    const number = defNumberMatch[1];
    // Try exact match (def-1 matches def-1)
    const exactMatch = defects.find(d => d.id === `def-${number}`);
    if (exactMatch) return exactMatch;
    
    // Also try with different padding (def-1 vs def-01) - though unlikely
    const paddedMatch = defects.find(d => {
      const idMatch = d.id.match(/^def-0*(\d+)$/i);
      return idMatch && idMatch[1] === number;
    });
    if (paddedMatch) return paddedMatch;
  }

  // 3. Try defectCode match (case-insensitive)
  // Match "DEF-0001", "DEF-000001", "def-0001", etc.
  const codeMatch = defects.find(d => 
    d.defectCode && d.defectCode.toLowerCase() === param.toLowerCase()
  );
  if (codeMatch) return codeMatch;

  // 4. Try flexible code match with number extraction
  // "DEF-1" or "DEF-0001" should match "DEF-0001"
  // "DEF-1" should match "DEF-000001" (6-digit format)
  const codeNumberMatch = param.match(/^DEF-(\d+)$/i);
  if (codeNumberMatch) {
    const codeNum = parseInt(codeNumberMatch[1], 10);
    
    // Try 4-digit format first (DEF-0001)
    const padded4 = `DEF-${String(codeNum).padStart(4, '0')}`;
    const match4 = defects.find(d => 
      d.defectCode && d.defectCode.toUpperCase() === padded4
    );
    if (match4) return match4;
    
    // Try 6-digit format (DEF-000001)
    const padded6 = `DEF-${String(codeNum).padStart(6, '0')}`;
    const match6 = defects.find(d => 
      d.defectCode && d.defectCode.toUpperCase() === padded6
    );
    if (match6) return match6;
    
    // Try exact numeric match (DEF-1 matches DEF-1)
    const exactCode = `DEF-${codeNum}`;
    const exactCodeMatch = defects.find(d => 
      d.defectCode && d.defectCode.toUpperCase() === exactCode
    );
    if (exactCodeMatch) return exactCodeMatch;
  }

  // Not found
  return null;
}
