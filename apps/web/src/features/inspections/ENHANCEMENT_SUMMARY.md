# Inspection Module Enhancement Summary

## Overview
This document summarizes the enhancements made to the Inspections module to support template-driven checklist configuration, validation rules, signatures, and approval workflows.

## ✅ Completed Enhancements

### 1. Type System Enhancements
- **Enhanced InspectionTemplate type** with `InspectionTemplateConfig`:
  - Approval workflows (supervisor/manager approval)
  - Signature requirements (operative/supervisor)
  - Defect creation settings
  - Applicability settings (asset types, sites, locations)
  
- **Enhanced ChecklistItem type**:
  - New item types: `YesNo`, `Checkbox`, `Numeric`, `Text`, `Dropdown`
  - Validation rules: `minValue`, `maxValue`, `dropdownOptions`
  - Failure requirements: `failRequiresComment`, `photoRequiredOnFail`
  - Defect creation: `allowDefectCreation`
  - Guidance text: `guidanceText`
  
- **Enhanced Inspection type**:
  - Added `declarations` array for template-driven declarations
  - Added `approvalStatus`, `approvalComment` for approval workflow
  - Enhanced `history` with field-level changes tracking
  - Added role tracking (`inspectorRole`, `supervisorRole`, `managerRole`)

- **Enhanced InspectionSignature type**:
  - Added `signatureImage` for drawn signatures
  - Added `declarationText` and `signedByRole`

- **Enhanced InspectionHistoryEntry type**:
  - Added `byRole` and `fieldChanges` for comprehensive audit trail

### 2. Template Creation/Editing
- **CreateTemplatePage.tsx**:
  - Added template configuration section (approval workflows, signatures, defect creation)
  - Enhanced checklist item editor with all new item types
  - Added dropdown options editor for Dropdown type items
  - Added guidance text field for checklist items
  - Added defect creation toggle per item
  - Updated inspection type selector with new types (Safety, Statutory, Operational, Handover, Custom)
  
- **Template Configuration UI**:
  - Checkboxes for supervisor/manager approval requirements
  - Signature requirements (operative/supervisor)
  - Global defect creation setting (can be overridden per item)

### 3. Inspection Creation
- **StartInspectionPage.tsx**:
  - Updated to initialize declarations from template config
  - Added initial audit trail entry
  - Added role tracking for inspector

## 🚧 In Progress / Remaining Work

### 4. Inspection Execution (InspectionRunnerPage.tsx)
**Status**: Needs enhancement to enforce template rules

**Required Enhancements**:
- [ ] Enforce mandatory items (block submission if incomplete)
- [ ] Enforce comment requirements on failed items
- [ ] Enforce photo requirements on failed items
- [ ] Show guidance text for each checklist item
- [ ] Support all new item types (YesNo, Checkbox, Numeric, Text, Dropdown)
- [ ] Validate numeric inputs against min/max values
- [ ] Show progress indicator (e.g., "14 / 20 items complete")
- [ ] Prompt defect creation when item fails and `allowDefectCreation` is enabled
- [ ] Lock inspection when status is "Submitted" or "Approved"
- [ ] Reopen inspection when status is "Changes Requested"

### 5. Signature Capture
**Status**: Component exists but needs integration

**Required Enhancements**:
- [ ] Integrate SignatureCapture component for operative signature
- [ ] Integrate SignatureCapture component for supervisor signature
- [ ] Support touch/mouse signature drawing
- [ ] Save signature as base64 image
- [ ] Link signatures to declarations
- [ ] Show signature requirements based on template config

### 6. Approval Workflow
**Status**: Not yet implemented

**Required Enhancements**:
- [ ] Add approval UI for supervisors/managers
- [ ] Support "Approve", "Request Changes", "Reject" actions
- [ ] Require mandatory comment for reject/changes
- [ ] Update approval status and approvalComment fields
- [ ] Add approval signature if required
- [ ] Update audit trail with approval actions
- [ ] Respect role permissions (Supervisor can approve, Manager can override)

### 7. Audit Trail
**Status**: Partially implemented (history array exists)

**Required Enhancements**:
- [ ] Track all field-level changes (before → after)
- [ ] Track status transitions
- [ ] Track signature events
- [ ] Make audit trail immutable and read-only
- [ ] Add audit trail view component
- [ ] Export audit trail

### 8. Attachments & Evidence
**Status**: Basic structure exists

**Required Enhancements**:
- [ ] Add inspection-level attachments section
- [ ] Support photos, PDFs, documents
- [ ] Track file metadata (name, type, size, uploader, date)
- [ ] Link attachments to specific checklist items (optional)
- [ ] Display attachments in inspection view

### 9. Status Flow & Locking
**Status**: Partially implemented

**Required Enhancements**:
- [ ] Lock editing when status is "Submitted"
- [ ] Lock editing when status is "Approved"
- [ ] Reopen editing when status is "Changes Requested"
- [ ] Highlight rejected items when reopened
- [ ] Prevent editing when status is "Closed"
- [ ] Show appropriate buttons based on status and permissions

### 10. Exports
**Status**: Not yet implemented

**Required Enhancements**:
- [ ] PDF export with checklist items and responses
- [ ] Embed photos in PDF
- [ ] Include signatures in PDF
- [ ] Include dates and inspection ID
- [ ] CSV export for data analysis
- [ ] Export audit trail

### 11. Offline Support
**Status**: Basic structure exists

**Required Enhancements**:
- [ ] Ensure checklist responses save locally
- [ ] Auto-sync when connection restored
- [ ] Prevent conflicting edits
- [ ] Handle signature capture offline

## Implementation Notes

### Template Config Defaults
When creating a template, if `config` is not provided, it should default to:
```typescript
{
  requireSupervisorApproval: false,
  requireManagerApproval: false,
  requireSignatures: false,
  requireOperativeSignature: false,
  requireSupervisorSignature: false,
  allowDefectCreation: true,
  applicableAssetTypes: [],
  applicableSiteIds: [],
  applicableLocationIds: [],
}
```

### Checklist Item Numbering
Item numbers should be auto-generated based on section and order (e.g., "1.1", "1.2", "2.1"). This should be calculated when the inspection is created from the template.

### Validation Rules
- Mandatory items must be completed before submission
- Failed items with `failRequiresComment: true` must have a comment
- Failed items with `photoRequiredOnFail: true` must have at least one photo
- Numeric items must be within min/max range if specified
- Dropdown items must select from template-defined options

### Permissions
- **Operative/Fitter**: Can complete inspections, cannot approve
- **Supervisor**: Can review, request changes, approve (if permitted)
- **Manager/Admin**: Full access, can override approvals (with mandatory reason), can reopen inspections

## Next Steps

1. **Priority 1**: Enhance InspectionRunnerPage to enforce all template rules
2. **Priority 2**: Integrate signature capture for operative and supervisor
3. **Priority 3**: Implement approval workflow UI
4. **Priority 4**: Add comprehensive audit trail tracking
5. **Priority 5**: Add PDF/CSV export functionality

## Testing Checklist

- [ ] Create template with all item types
- [ ] Create template with approval requirements
- [ ] Create template with signature requirements
- [ ] Create inspection from template
- [ ] Complete inspection with all item types
- [ ] Verify mandatory item enforcement
- [ ] Verify comment/photo requirements on failures
- [ ] Verify signature capture works
- [ ] Verify approval workflow
- [ ] Verify audit trail captures all changes
- [ ] Verify status locking works correctly
- [ ] Verify exports include all required data


