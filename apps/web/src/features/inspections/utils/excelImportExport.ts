// Excel import/export utilities for inspection templates

export interface ExcelRow {
  SectionName: string;
  ItemText: string;
  ItemType: string;
  Required?: string | boolean;
  Critical?: string | boolean; // Backward compatibility
  SafetyCritical?: string | boolean;
  PhotoOnFail?: string | boolean;
  FailRequiresComment?: string | boolean;
  HelpText?: string;
  PhotoRequired?: string | boolean; // For Photo type items
  SignatureRequired?: string | boolean; // For Signature type items
  Unit?: string;
  Min?: string | number;
  Max?: string | number;
  Options?: string;
  SortOrder?: string | number;
}

export interface ExcelMeta {
  TemplateName?: string;
  InspectionType?: string;
  Frequency?: string;
}

export interface ImportResult {
  sections: Array<{ id: string; title: string; order: number }>;
  items: Array<{
    id: string;
    sectionId: string;
    question: string;
    type: 'PassFail' | 'PassFailNA' | 'YesNo' | 'Number' | 'Text' | 'Date' | 'Time' | 'Photo' | 'Signature';
    required: boolean;
    safetyCritical: boolean;
    critical?: boolean; // Backward compatibility
    order: number;
    photoRequiredOnFail: boolean;
    failRequiresComment?: boolean;
    unit?: string;
    minValue?: number;
    maxValue?: number;
  }>;
  warnings: Array<{ row: number; message: string }>;
  errors: Array<{ row: number; message: string }>;
}

// Normalize boolean values
function normalizeBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === 'y' || lower === '1';
  }
  return false;
}

// Normalize ItemType
function normalizeItemType(value: string): 'PassFail' | 'PassFailNA' | 'YesNo' | 'Numeric' | 'Text' | 'Date' | 'Time' | 'Photo' | 'Signature' | null {
  const normalized = value.trim().toUpperCase().replace(/[\/_]/g, '');
  if (normalized.includes('PASSFAILNA') || normalized.includes('PASSFAILN/A') || normalized.includes('PASSFAILN-A')) {
    return 'PassFailNA';
  }
  if (normalized.includes('PASSFAIL') || normalized.includes('PASS/FAIL')) {
    return 'PassFail';
  }
  if (normalized.includes('YESNO') || normalized.includes('YES/NO') || normalized.includes('BOOLEAN')) {
    return 'YesNo';
  }
  if (normalized.includes('NUMBER') || normalized.includes('NUM') || normalized.includes('NUMERIC')) {
    return 'Numeric';
  }
  if (normalized.includes('TEXT') || normalized.includes('STRING')) {
    return 'Text';
  }
  if (normalized.includes('DATE')) {
    return 'Date';
  }
  if (normalized.includes('TIME')) {
    return 'Time';
  }
  if (normalized.includes('PHOTO') || normalized.includes('IMAGE') || normalized.includes('EVIDENCE')) {
    return 'Photo';
  }
  if (normalized.includes('SIGNATURE') || normalized.includes('SIGN')) {
    return 'Signature';
  }
  // Handle DROPDOWN as Text for now (since our type system doesn't support it yet)
  if (normalized.includes('DROPDOWN') || normalized.includes('SELECT')) {
    return 'Text';
  }
  return null;
}

// Parse Excel data
export function parseExcelData(rows: ExcelRow[]): ImportResult {
  const sections: Map<string, { id: string; title: string; order: number }> = new Map();
  const items: ImportResult['items'] = [];
  const warnings: ImportResult['warnings'] = [];
  const errors: ImportResult['errors'] = [];

  let sectionOrder = 0;
  const sectionOrderMap = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because Excel rows are 1-indexed and we skip header

    // Skip blank rows
    if (!row.SectionName && !row.ItemText) {
      return;
    }

    // Validate required fields
    if (!row.SectionName || !row.SectionName.trim()) {
      errors.push({ row: rowNum, message: 'SectionName is required' });
      return;
    }

    if (!row.ItemText || !row.ItemText.trim()) {
      errors.push({ row: rowNum, message: 'ItemText is required' });
      return;
    }

    if (!row.ItemType || !row.ItemType.trim()) {
      errors.push({ row: rowNum, message: 'ItemType is required' });
      return;
    }

    // Normalize ItemType
    const itemType = normalizeItemType(row.ItemType);
    if (!itemType) {
      errors.push({ row: rowNum, message: `Invalid ItemType: ${row.ItemType}. Must be one of: PassFail, PassFailNA, YesNo, Numeric, Text, Date, Time, Photo, Signature` });
      return;
    }

    // Normalize Safety Critical (prefer SafetyCritical, fallback to Critical for backward compatibility)
    const safetyCritical = normalizeBoolean(row.SafetyCritical ?? row.Critical);

    // Get or create section
    const sectionName = row.SectionName.trim();
    let sectionId: string;
    if (sections.has(sectionName)) {
      sectionId = sections.get(sectionName)!.id;
    } else {
      sectionId = `section-${Date.now()}-${sectionOrder}`;
      sectionOrderMap.set(sectionName, sectionOrder);
      sections.set(sectionName, {
        id: sectionId,
        title: sectionName,
        order: sectionOrder++,
      });
    }

    // Validate type-specific fields
    if (itemType === 'Numeric') {
      if (row.Min && isNaN(Number(row.Min))) {
        warnings.push({ row: rowNum, message: 'Min value is not numeric, ignoring' });
      }
      if (row.Max && isNaN(Number(row.Max))) {
        warnings.push({ row: rowNum, message: 'Max value is not numeric, ignoring' });
      }
    }

    if (itemType === 'Text' && (row.Unit || row.Min || row.Max)) {
      warnings.push({ row: rowNum, message: 'Unit/Min/Max are ignored for Text type' });
    }

    if ((itemType === 'PassFail' || itemType === 'PassFailNA' || itemType === 'YesNo' || itemType === 'Date' || itemType === 'Time' || itemType === 'Photo' || itemType === 'Signature') && (row.Unit || row.Min || row.Max)) {
      warnings.push({ row: rowNum, message: `Unit/Min/Max are ignored for ${itemType} type` });
    }

    // PhotoRequired is only relevant for Photo type
    if (itemType !== 'Photo' && row.PhotoRequired) {
      warnings.push({ row: rowNum, message: 'PhotoRequired is only applicable to Photo type items' });
    }

    // SignatureRequired is only relevant for Signature type
    if (itemType !== 'Signature' && row.SignatureRequired) {
      warnings.push({ row: rowNum, message: 'SignatureRequired is only applicable to Signature type items' });
    }

    // Create item
    const sortOrder = row.SortOrder ? Number(row.SortOrder) : items.filter(i => i.sectionId === sectionId).length;
    
    const item: ImportResult['items'][0] = {
      id: `item-${Date.now()}-${index}`,
      sectionId,
      question: row.ItemText.trim(),
      type: itemType,
      required: normalizeBoolean(row.Required),
      safetyCritical: safetyCritical,
      critical: safetyCritical, // Backward compatibility
      order: sortOrder,
      photoRequiredOnFail: safetyCritical ? true : normalizeBoolean(row.PhotoOnFail), // Auto-enable if safety critical
      failRequiresComment: safetyCritical ? true : normalizeBoolean(row.FailRequiresComment), // Auto-enable if safety critical
    };

    // For Photo type, check PhotoRequired
    if (itemType === 'Photo' && row.PhotoRequired !== undefined) {
      // PhotoRequired is handled via the required field, but we can use it as a hint
      // The actual required flag is already set above
    }

    // For Signature type, check SignatureRequired
    if (itemType === 'Signature' && row.SignatureRequired !== undefined) {
      // SignatureRequired is handled via the required field, but we can use it as a hint
      // The actual required flag is already set above
    }

    // Add type-specific fields
    if (itemType === 'Numeric') {
      if (row.Unit) item.unit = row.Unit.trim();
      if (row.Min && !isNaN(Number(row.Min))) {
        item.minValue = Number(row.Min);
      }
      if (row.Max && !isNaN(Number(row.Max))) {
        item.maxValue = Number(row.Max);
      }
    }

    items.push(item);
  });

  // Sort items by section order, then by item order
  const sortedItems = items.sort((a, b) => {
    const aSection = Array.from(sections.values()).find(s => s.id === a.sectionId);
    const bSection = Array.from(sections.values()).find(s => s.id === b.sectionId);
    const aSectionOrder = aSection?.order ?? 0;
    const bSectionOrder = bSection?.order ?? 0;
    if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
    return a.order - b.order;
  });

  return {
    sections: Array.from(sections.values()).sort((a, b) => a.order - b.order),
    items: sortedItems,
    warnings,
    errors,
  };
}

// Generate Excel template data
export function generateExcelTemplate(): ExcelRow[] {
  return [
    {
      SectionName: 'All Item Types',
      ItemText: 'Emergency stop working?',
      ItemType: 'YesNo',
      Required: true,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 1,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Hydraulic leak check',
      ItemType: 'PassFail',
      Required: true,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 2,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Daily checks complete',
      ItemType: 'PassFailNA',
      Required: true,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 3,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Hours reading',
      ItemType: 'Numeric',
      Required: true,
      Unit: 'hours',
      Min: 0,
      Max: 10000,
      SortOrder: 4,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Inspector notes',
      ItemType: 'Text',
      Required: false,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 5,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Inspection date',
      ItemType: 'Date',
      Required: true,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 6,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Inspection time',
      ItemType: 'Time',
      Required: true,
      SafetyCritical: false,
      PhotoOnFail: false,
      SortOrder: 7,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Upload photo of serial plate',
      ItemType: 'Photo',
      Required: true,
      SafetyCritical: false,
      PhotoRequired: true,
      PhotoOnFail: false,
      SortOrder: 8,
    },
    {
      SectionName: 'All Item Types',
      ItemText: 'Inspector signature',
      ItemType: 'Signature',
      Required: true,
      SafetyCritical: false,
      SignatureRequired: true,
      PhotoOnFail: false,
      SortOrder: 9,
    },
  ];
}

