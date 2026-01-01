import type { UserRole } from '@ppm/shared';

// Inspection Types
export type InspectionType = 
  | 'Safety'
  | 'Statutory'
  | 'Operational'
  | 'Handover'
  | 'Custom'
  | 'PlantAcceptance' // Legacy
  | 'Daily' // Legacy
  | 'Weekly' // Legacy
  | 'Monthly' // Legacy
  | 'PreUse' // Legacy
  | 'TimeBased'; // Legacy

// Inspection Status
export type InspectionStatus = 
  | 'Draft'
  | 'InProgress'
  | 'Submitted'
  | 'ChangesRequested'
  | 'Approved'
  | 'Closed';

// Inspection Result
export type InspectionResult = 'Pass' | 'Fail' | 'Pending';

// Checklist Item Types
export type ChecklistItemType = 
  | 'YesNo' 
  | 'PassFail' 
  | 'Checkbox'
  | 'Numeric' 
  | 'Text' 
  | 'Dropdown'
  | 'Date' 
  | 'Time' 
  | 'Photo' 
  | 'Signature'
  | 'PassFailNA'; // Legacy

// Checklist Item Result
export type ChecklistItemResult = 'Pass' | 'Fail' | 'NA' | null;

// Attachment Types
export type AttachmentType = 'photo' | 'video' | 'document';

// Signature Methods
export type SignatureMethod = 'typed' | 'checkbox' | 'drawn';

// Template Version
export interface TemplateVersion {
  version: string; // v1, v2, etc.
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

// Checklist Section
export interface ChecklistSection {
  id: string;
  title: string;
  order: number;
}

// Checklist Item
export interface ChecklistItem {
  id: string;
  sectionId?: string; // Optional section grouping
  itemNumber?: string; // Auto-generated item number (e.g., "1.1", "2.3")
  question: string;
  type: ChecklistItemType;
  required: boolean;
  safetyCritical?: boolean; // If true, failure fails entire inspection (safety-critical risk)
  // Backward compatibility: support both critical and safetyCritical
  critical?: boolean; // Deprecated: use safetyCritical instead
  order: number;
  
  // Validation rules
  unit?: string; // For Numeric type
  minValue?: number; // For Numeric type
  maxValue?: number; // For Numeric type
  dropdownOptions?: string[]; // For Dropdown type - template-defined options
  
  // Failure requirements
  photoRequiredOnFail: boolean;
  failRequiresComment: boolean; // Auto-enabled when safetyCritical is true
  
  // Defect creation
  allowDefectCreation: boolean; // If true, can create defect on failure
  defaultSeverity?: 'Low' | 'Medium' | 'High' | 'Critical' | 'Minor' | 'Major'; // For defect creation
  complianceTag?: 'PUWER' | 'LOLER' | 'SITE_RULE' | string; // For defect creation
  
  // Guidance/help text
  guidanceText?: string; // Default guidance/help text shown to operative
}

// Checklist Item Answer (inspection instance)
export interface ChecklistItemAnswer {
  id: string;
  checklistItemId: string;
  result: ChecklistItemResult; // Pass/Fail/NA/null - for PassFail, YesNo types
  numericValue?: number; // For Numeric type
  textValue?: string; // For Text type
  dateValue?: string; // ISO date string for Date type
  timeValue?: string; // HH:mm format for Time type
  booleanValue?: boolean; // For YesNo, Checkbox types
  dropdownValue?: string; // For Dropdown type - selected option
  signatureData?: string; // Base64 image data for Signature type
  signatureName?: string; // Signer name for Signature type
  signatureTimestamp?: string; // ISO timestamp for Signature type
  comment?: string; // Item-level comment
  photoUri?: string; // If photo was captured (single photo for PassFail items)
  photoUris?: string[]; // Multiple photos for Photo type items and item-level photos
  unit?: string; // For Numeric items - selected unit
  linkedDefectId?: string; // If defect was created from this item
}

// Inspection Template Configuration
export interface InspectionTemplateConfig {
  // Approval workflows
  requireSupervisorApproval: boolean;
  requireManagerApproval: boolean;
  
  // Signatures
  requireSignatures: boolean;
  requireOperativeSignature: boolean;
  requireSupervisorSignature: boolean;
  requireManagerSignature?: boolean; // Manager/Superintendent signature
  
  // Signature roles (multi-select)
  signatureRoles?: ('operative' | 'supervisor' | 'manager')[]; // Default: Technician/Fitter, Supervisor, Manager/Superintendent
  
  // Defect creation
  allowDefectCreation: boolean; // Global setting - can be overridden per item
  
  // Evidence defaults
  allowPhotoUploads?: boolean; // Default: true
  allowFileUpload?: boolean; // Default: true
  notesRequired?: boolean; // Default: false
  
  // Compliance tags (template-level)
  safetyCritical?: boolean;
  statutory?: boolean;
  complianceTags?: ('LOLER' | 'PUWER' | 'Lifting' | 'Pressure' | 'Electrical' | 'Fire' | string)[]; // Multi-select
  
  // Applicability
  applicableAssetTypes?: string[]; // Optional: specific asset types
  applicableSiteIds?: string[]; // Optional: site-specific
  applicableLocationIds?: string[]; // Optional: location-specific
}

// Inspection Template
export interface InspectionTemplate {
  id: string;
  name: string;
  description?: string;
  inspectionType: InspectionType;
  assetTypeId?: string; // Optional: specific asset type (legacy - use config.applicableAssetTypes)
  assetTypeCode?: string; // For display
  siteId?: string; // Optional: site-specific variant (legacy - use config.applicableSiteIds)
  siteName?: string; // For display
  version: string; // Current version
  versions: TemplateVersion[]; // Version history
  sections: ChecklistSection[];
  items: ChecklistItem[];
  config: InspectionTemplateConfig; // Template-level configuration
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// Inspection Attachment
export interface InspectionAttachment {
  id: string;
  type: AttachmentType;
  filename: string;
  fileType?: string; // MIME type (e.g., 'image/jpeg', 'application/pdf')
  uri: string; // Blob URL or file path
  size?: number; // File size in bytes
  createdAt: string;
  createdBy: string;
  createdByName?: string; // Uploader name
  description?: string; // Optional description/notes
  linkedToItemId?: string; // Optional: link to specific checklist item
}

// Inspection Signature
export interface InspectionSignature {
  id: string;
  role: 'inspector' | 'operative' | 'supervisor' | 'manager';
  method: SignatureMethod;
  signature: string; // Typed name, checkbox confirmation, or drawn signature data (base64 image)
  signatureImage?: string; // Base64 image data for drawn signatures
  signedAt: string;
  signedBy: string;
  signedByName: string;
  signedByRole?: string; // User role at time of signing
  declarationText?: string; // Declaration text that was signed
}

// Inspection History Entry (Audit Trail)
export interface InspectionHistoryEntry {
  id: string;
  at: string;
  by: string;
  byName: string;
  byRole?: string; // User role at time of action
  type: 'status_change' | 'edit' | 'revision' | 'approval' | 'reopen' | 'close' | 'signature' | 'field_change' | 'comment' | 'attachment';
  summary: string;
  data?: Record<string, unknown>; // Additional context
  fieldChanges?: Array<{
    field: string;
    before: any;
    after: any;
  }>; // Field-level changes for audit trail
}

// Main Inspection Entity
export interface Inspection {
  // Identity
  id: string; // Internal UUID
  inspectionCode: string; // Auto-generated INSP-000001, immutable

  // Template Reference
  templateId: string;
  templateName: string;
  templateVersion: string; // Version used at time of inspection

  // Type & Classification
  inspectionType: InspectionType;
  result: InspectionResult;
  status: InspectionStatus;

  // Linkages
  assetId: string; // Primary (required if no locationId)
  assetTypeCode?: string;
  assetMake?: string;
  assetModel?: string;
  locationId?: string; // Secondary (optional, but at least one of assetId/locationId required)
  locationName?: string;
  siteId?: string;
  siteName?: string;

  // Checklist
  sections: ChecklistSection[];
  items: ChecklistItem[]; // Template items at time of inspection
  answers: ChecklistItemAnswer[]; // Inspector's answers

  // Evidence
  attachments: InspectionAttachment[];
  signatures: InspectionSignature[];
  declarations?: InspectionDeclaration[]; // Template-driven declarations

  // Timing
  inspectionDate: string; // Scheduled/planned date
  startedAt?: string;
  completedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  closedAt?: string;
  dueDate?: string; // For scheduling

  // Assignment
  inspectorId: string;
  inspectorName: string;
  inspectorRole?: string; // User role at time of creation
  supervisorId?: string; // Reviewer
  supervisorName?: string;
  supervisorRole?: string; // Supervisor role
  managerId?: string; // Manager approver (if required)
  managerName?: string;
  managerRole?: string; // Manager role
  
  // Approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  approvalComment?: string; // Comment from supervisor/manager
  approvalRequestedAt?: string;
  approvalRequestedBy?: string;

  // Linked Entities
  linkedDefectIds: string[]; // Auto-created defects
  linkedWorkOrderId?: string; // Future-ready

  // Asset Runtime (if applicable)
  assetRuntimeHours?: number;
  assetRuntimeMiles?: number;

  // Audit
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  history: InspectionHistoryEntry[];

  // Revision tracking
  revisionNumber: number;
  parentInspectionId?: string; // If this is a revision

  // Offline sync status
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  syncedAt?: string; // When last successfully synced
  lastSyncAttempt?: string; // Last sync attempt timestamp

  // Scheduling fields
  scheduleId?: string; // Link to generated schedule
  scheduleCode?: string; // For display
  plannedStartAt?: string; // Scheduled datetime (ISO)
  dueAt?: string; // Calculated due date
  assignedToUserId?: string; // May differ from inspectorId if reassigned
  createdFrom?: 'MANUAL' | 'SCHEDULE' | 'BULK' | 'EVENT';
  assetMeterAtCreation?: number; // For usage-based tracking
  recurrenceKey?: string; // For duplicate prevention
}

// Inspection Filter
export interface InspectionFilter {
  search?: string;
  status?: InspectionStatus | InspectionStatus[];
  result?: InspectionResult | InspectionResult[];
  inspectionType?: InspectionType | InspectionType[];
  siteId?: string | string[];
  locationId?: string | string[];
  assetId?: string;
  templateId?: string | string[];
  inspectorId?: string | string[];
  supervisorId?: string | string[];
  showDueSoon?: boolean;
  showOverdue?: boolean;
  showFailed?: boolean;
  showMyInspections?: boolean;
  showDrafts?: boolean;
  hasDefects?: boolean;
  isCompliance?: boolean;
  dateFrom?: string;
  dateTo?: string;
  completedDateFrom?: string;
  completedDateTo?: string;
  scheduledDateFrom?: string;
  scheduledDateTo?: string;
}

// Inspection Settings (Global settings - template config overrides these)
export interface InspectionSettings {
  requireCommentOnFail: boolean;
  requirePhotoOnFail: boolean;
  requireDefectOnFail: boolean;
  enableApprovals: boolean;
  enableSignatures: boolean;
  checklistItemSeverityDefaults: boolean;
  conflictResolution: 'last-write-wins' | 'flag-for-review';
}

// Declaration text for signatures
export interface InspectionDeclaration {
  id: string;
  role: 'operative' | 'supervisor' | 'manager';
  declarationText: string; // Template-defined declaration text
  signed: boolean;
  signatureId?: string; // Reference to InspectionSignature
}

// Inspection Summary Stats
export interface InspectionSummary {
  total: number;
  completedThisWeek: number;
  overdue: number;
  failed: number;
  openDefectsFromInspections: number;
  complianceInspections: number; // PUWER/LOLER
}

// ============================================================================
// CHECKLIST LIBRARY (Reusable item lists)
// ============================================================================

export interface Checklist {
  id: string;
  name: string;
  description?: string;
  category?: string;
  items: ChecklistItem[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// ============================================================================
// CHECK SHEET TEMPLATE (Templates used to create inspections)
// ============================================================================

export interface CheckSheetTemplate {
  id: string;
  name: string;
  description?: string;
  category: string; // e.g., "MEWP Weekly", "Compressor Weekly", "Crane Pre-Start"
  assetTypeIds?: string[]; // Optional: applies to specific asset types
  assetTypeCodes?: string[]; // For display
  version: string; // v1, v2, etc.
  versions: TemplateVersion[];
  sections: ChecklistSection[];
  items: ChecklistItem[]; // Can reference checklist library OR custom questions
  checklistIds?: string[]; // Optional: references to Checklist library
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// ============================================================================
// INSPECTION RECORD (Actual inspection instance created from template)
// ============================================================================

// Alias for clarity - Inspection is the record
export type InspectionRecord = Inspection;
