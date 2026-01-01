import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Checkbox } from '../../../components/common/Checkbox';
import { SearchableMultiSelect } from '../../../components/common/SearchableMultiSelect';
import { Badge } from '../../../components/common/Badge';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { createInspection, getAllInspections } from '../db/repository';
import { getAllTemplates } from '../db/repository';
import { getAssets } from '../../assets/services';
import { mockSites } from '../../assets/services';
import { mockUsers } from '../../reports/services/mockUsers';
import type { Inspection, InspectionTemplate } from '../types';
import { AlertTriangle, Calendar, CheckCircle } from 'lucide-react';
import { formatDateUK } from '../../../lib/formatters';

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AssetSelectionMode = 'ALL' | 'ASSET_TYPE' | 'TAGS' | 'SELECTED';
type DateRangeMode = 'SINGLE' | 'RANGE';
type AssignmentMode = 'UNASSIGNED' | 'FIXED_USER' | 'ROTATE_TEAM';

interface PreviewItem {
  assetId: string;
  assetName: string;
  date: string;
  dateKey: string;
  isDuplicate: boolean;
  duplicateReason?: string;
}

export function BulkScheduleModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkScheduleModalProps) {
  const { user } = useAuth();

  // Step 1: Site selection
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  // Step 2: Asset selection
  const [assetSelectionMode, setAssetSelectionMode] = useState<AssetSelectionMode>('ALL');
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Step 3: Template
  const [templateId, setTemplateId] = useState('');

  // Step 4: Date range
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('SINGLE');
  const [singleDate, setSingleDate] = useState('');
  const [dateRangeFrom, setDateRangeFrom] = useState('');
  const [dateRangeTo, setDateRangeTo] = useState('');

  // Step 5: Assignment
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('UNASSIGNED');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [teamId, setTeamId] = useState('');

  // Preview
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load templates
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  
  useEffect(() => {
    async function loadTemplates() {
      try {
        const loaded = await getAllTemplates();
        setTemplates(loaded);
      } catch {
        setTemplates([]);
      }
    }
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  // Load assets based on selected sites
  const availableAssets = useMemo(() => {
    try {
      if (selectedSiteIds.length === 0) return [];
      const allAssets = getAssets({});
      return allAssets.filter((asset) => selectedSiteIds.includes(asset.siteId || ''));
    } catch {
      return [];
    }
  }, [selectedSiteIds]);

  // Get asset types from available assets
  const assetTypes = useMemo(() => {
    const types = new Map<string, { id: string; code: string }>();
    availableAssets.forEach((asset) => {
      if (asset.assetTypeId && asset.assetTypeCode) {
        types.set(asset.assetTypeId, { id: asset.assetTypeId, code: asset.assetTypeCode });
      }
    });
    return Array.from(types.values());
  }, [availableAssets]);

  // Get tags from available assets (stub - would need asset tags field)
  const availableTags = useMemo(() => {
    // In a real implementation, this would come from asset.tags
    return ['safety', 'critical', 'weekly', 'monthly', 'compliance'];
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSiteIds([]);
      setAssetSelectionMode('ALL');
      setSelectedAssetTypeId('');
      setSelectedTags([]);
      setSelectedAssetIds([]);
      setTemplateId('');
      setDateRangeMode('SINGLE');
      setSingleDate('');
      setDateRangeFrom('');
      setDateRangeTo('');
      setAssignmentMode('UNASSIGNED');
      setAssignedUserId('');
      setTeamId('');
      setPreviewItems([]);
      setShowPreview(false);
      setErrors({});
    } else {
      // Set default site if user has one
      if (user?.siteIds && user.siteIds.length > 0) {
        setSelectedSiteIds([user.siteIds[0]]);
      }
      // Set default date to today
      setSingleDate(new Date().toISOString().split('T')[0]);
      setDateRangeFrom(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, user]);

  // Generate preview
  const generatePreview = () => {
    const newErrors: Record<string, string> = {};

    if (selectedSiteIds.length === 0) {
      newErrors.sites = 'At least one site must be selected';
    }
    if (!templateId) {
      newErrors.template = 'Template is required';
    }
    if (dateRangeMode === 'SINGLE' && !singleDate) {
      newErrors.date = 'Date is required';
    }
    if (dateRangeMode === 'RANGE') {
      if (!dateRangeFrom) newErrors.dateFrom = 'Start date is required';
      if (!dateRangeTo) newErrors.dateTo = 'End date is required';
      if (dateRangeFrom && dateRangeTo && new Date(dateRangeFrom) > new Date(dateRangeTo)) {
        newErrors.dateRange = 'Start date must be before end date';
      }
    }

    // Asset selection validation
    if (assetSelectionMode === 'ASSET_TYPE' && !selectedAssetTypeId) {
      newErrors.assetType = 'Asset type must be selected';
    }
    if (assetSelectionMode === 'TAGS' && selectedTags.length === 0) {
      newErrors.tags = 'At least one tag must be selected';
    }
    if (assetSelectionMode === 'SELECTED' && selectedAssetIds.length === 0) {
      newErrors.assets = 'At least one asset must be selected';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    // Determine which assets to use
    let targetAssets = availableAssets;
    if (assetSelectionMode === 'ASSET_TYPE') {
      targetAssets = availableAssets.filter((a) => a.assetTypeId === selectedAssetTypeId);
    } else if (assetSelectionMode === 'TAGS') {
      // Stub: would filter by tags in real implementation
      targetAssets = availableAssets;
    } else if (assetSelectionMode === 'SELECTED') {
      targetAssets = availableAssets.filter((a) => selectedAssetIds.includes(a.id));
    }

    if (targetAssets.length === 0) {
      showToast('No assets match the selected criteria', 'error');
      return;
    }

    // Generate date list
    const dates: string[] = [];
    if (dateRangeMode === 'SINGLE') {
      dates.push(singleDate);
    } else {
      const from = new Date(dateRangeFrom);
      const to = new Date(dateRangeTo);
      const current = new Date(from);
      while (current <= to) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }

    // Generate preview items
    const items: PreviewItem[] = [];
    const existingInspections = getAllInspections();

    for (const asset of targetAssets) {
      for (const date of dates) {
        const dateKey = date;
        const recurrenceKey = `BULK-${asset.id}-${templateId}-${dateKey}`;

        // Check for duplicates
        const duplicate = existingInspections.find(
          (insp) =>
            insp.assetId === asset.id &&
            insp.templateId === templateId &&
            insp.inspectionDate === date &&
            insp.status !== 'Closed'
        );

        items.push({
          assetId: asset.id,
          assetName: `${asset.id} - ${asset.make} ${asset.model}`,
          date,
          dateKey,
          isDuplicate: !!duplicate,
          duplicateReason: duplicate
            ? `Existing ${duplicate.status} inspection on this date`
            : undefined,
        });
      }
    }

    setPreviewItems(items);
    setShowPreview(true);
  };

  const handleCreate = async () => {
    if (previewItems.length === 0) {
      showToast('No inspections to create', 'error');
      return;
    }

    const duplicates = previewItems.filter((item) => item.isDuplicate);
    if (duplicates.length > 0) {
      if (
        !confirm(
          `${duplicates.length} duplicate inspection${duplicates.length !== 1 ? 's' : ''} will be skipped. Continue?`
        )
      ) {
        return;
      }
    }

    setCreating(true);
    try {
      const template = templates.find((t) => t.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const itemsToCreate = previewItems.filter((item) => !item.isDuplicate);
      let created = 0;
      let skipped = 0;

      // Get team users for rotation
      let teamUsers: typeof mockUsers = [];
      if (assignmentMode === 'ROTATE_TEAM') {
        teamUsers = mockUsers.filter((u) =>
          selectedSiteIds.some((siteId) => u.siteIds?.includes(siteId))
        );
      }

      for (let i = 0; i < itemsToCreate.length; i++) {
        const item = itemsToCreate[i];
        const asset = availableAssets.find((a) => a.id === item.assetId);
        if (!asset) continue;

        // Determine assigned user
        let finalAssignedUserId: string | undefined;
        let finalAssignedUserName: string | undefined;

        if (assignmentMode === 'FIXED_USER') {
          finalAssignedUserId = assignedUserId || user?.id;
          const selectedUser = assignedUserId
            ? mockUsers.find((u) => u.id === assignedUserId)
            : user;
          finalAssignedUserName =
            selectedUser?.firstName && selectedUser?.lastName
              ? `${selectedUser.firstName} ${selectedUser.lastName}`
              : selectedUser?.email || 'Unknown';
        } else if (assignmentMode === 'ROTATE_TEAM' && teamUsers.length > 0) {
          const userIndex = i % teamUsers.length;
          const teamUser = teamUsers[userIndex];
          finalAssignedUserId = teamUser.id;
          finalAssignedUserName = `${teamUser.firstName} ${teamUser.lastName}`;
        }

        const inspectionDate = new Date(item.date);
        const plannedStartAt = new Date(item.date);
        plannedStartAt.setHours(9, 0, 0, 0); // Default to 9 AM

        try {
          await createInspection({
            templateId: template.id,
            templateName: template.name,
            templateVersion: template.version,
            inspectionType: template.inspectionType,
            result: 'Pending',
            status: 'Draft',
            assetId: asset.id,
            assetTypeCode: asset.assetTypeCode,
            assetMake: asset.make,
            assetModel: asset.model,
            siteId: asset.siteId,
            siteName: mockSites.find((s) => s.id === asset.siteId)?.name,
            sections: template.sections,
            items: template.items,
            answers: [],
            attachments: [],
            signatures: [],
            inspectionDate: item.date,
            plannedStartAt: plannedStartAt.toISOString(),
            inspectorId: finalAssignedUserId || user?.id || '',
            inspectorName: finalAssignedUserName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unassigned'),
            linkedDefectIds: [],
            createdAt: new Date().toISOString(),
            createdBy: user?.id || '',
            createdByName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
            updatedAt: new Date().toISOString(),
            updatedBy: user?.id || '',
            updatedByName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
            history: [],
            revisionNumber: 0,
            createdFrom: 'BULK',
            assignedToUserId: finalAssignedUserId,
            recurrenceKey: `BULK-${asset.id}-${template.id}-${item.dateKey}`,
            syncStatus: navigator.onLine ? 'synced' : 'pending',
          });
          created++;
        } catch (error: any) {
          console.error(`Failed to create inspection for ${item.assetId} on ${item.date}:`, error);
          skipped++;
        }
      }

      showToast(
        `Created ${created} inspection${created !== 1 ? 's' : ''}${skipped > 0 ? `, skipped ${skipped}` : ''}`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to create inspections', 'error');
    } finally {
      setCreating(false);
    }
  };

  const duplicateCount = previewItems.filter((item) => item.isDuplicate).length;
  const validCount = previewItems.filter((item) => !item.isDuplicate).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Schedule Inspections"
      size="large"
    >
      <div className="space-y-6">
        {!showPreview ? (
          <>
            {/* Step 1: Sites */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">1. Select Sites</h3>
              <SearchableMultiSelect
                label="Sites *"
                options={mockSites.map((s) => ({ value: s.id, label: s.name }))}
                selected={selectedSiteIds}
                onChange={setSelectedSiteIds}
                error={errors.sites}
              />
            </div>

            {/* Step 2: Assets */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900">2. Select Assets</h3>
              <Select
                label="Selection Mode"
                value={assetSelectionMode}
                onChange={(e) => setAssetSelectionMode(e.target.value as AssetSelectionMode)}
                options={[
                  { value: 'ALL', label: 'All Assets' },
                  { value: 'ASSET_TYPE', label: 'By Asset Type' },
                  { value: 'TAGS', label: 'By Tags' },
                  { value: 'SELECTED', label: 'Selected Assets' },
                ]}
              />

              {assetSelectionMode === 'ASSET_TYPE' && (
                <Select
                  label="Asset Type *"
                  value={selectedAssetTypeId}
                  onChange={(e) => setSelectedAssetTypeId(e.target.value)}
                  error={errors.assetType}
                  options={[
                    { value: '', label: 'Select asset type...' },
                    ...assetTypes.map((t) => ({ value: t.id, label: t.code })),
                  ]}
                />
              )}

              {assetSelectionMode === 'TAGS' && (
                <SearchableMultiSelect
                  label="Tags *"
                  options={availableTags.map((tag) => ({ value: tag, label: tag }))}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                  error={errors.tags}
                />
              )}

              {assetSelectionMode === 'SELECTED' && (
                <SearchableMultiSelect
                  label="Select Assets *"
                  options={availableAssets.map((a) => ({
                    value: a.id,
                    label: `${a.id} - ${a.make} ${a.model}`,
                  }))}
                  selected={selectedAssetIds}
                  onChange={setSelectedAssetIds}
                  error={errors.assets}
                />
              )}
            </div>

            {/* Step 3: Template */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900">3. Select Template</h3>
              <Select
                label="Template *"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                error={errors.template}
                options={[
                  { value: '', label: 'Select template...' },
                  ...templates.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>

            {/* Step 4: Date Range */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900">4. Select Date Range</h3>
              <Select
                label="Date Range Mode"
                value={dateRangeMode}
                onChange={(e) => setDateRangeMode(e.target.value as DateRangeMode)}
                options={[
                  { value: 'SINGLE', label: 'Single Date' },
                  { value: 'RANGE', label: 'Date Range' },
                ]}
              />

              {dateRangeMode === 'SINGLE' && (
                <Input
                  label="Date *"
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  error={errors.date}
                  required
                />
              )}

              {dateRangeMode === 'RANGE' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="From *"
                    type="date"
                    value={dateRangeFrom}
                    onChange={(e) => setDateRangeFrom(e.target.value)}
                    error={errors.dateFrom}
                    required
                  />
                  <Input
                    label="To *"
                    type="date"
                    value={dateRangeTo}
                    onChange={(e) => setDateRangeTo(e.target.value)}
                    error={errors.dateTo}
                    required
                  />
                </div>
              )}
              {errors.dateRange && (
                <p className="text-sm text-red-600">{errors.dateRange}</p>
              )}
            </div>

            {/* Step 5: Assignment */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900">5. Assignment</h3>
              <Select
                label="Assignment Mode"
                value={assignmentMode}
                onChange={(e) => setAssignmentMode(e.target.value as AssignmentMode)}
                options={[
                  { value: 'UNASSIGNED', label: 'Unassigned' },
                  { value: 'FIXED_USER', label: 'Fixed User' },
                  { value: 'ROTATE_TEAM', label: 'Rotate Team' },
                ]}
              />

              {assignmentMode === 'FIXED_USER' && (
                <Select
                  label="User"
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  options={[
                    { value: user?.id || '', label: `${user?.firstName} ${user?.lastName}` || user?.email || 'Current User' },
                    ...mockUsers
                      .filter((u) => selectedSiteIds.some((siteId) => u.siteIds?.includes(siteId)))
                      .filter((u) => u.id !== user?.id)
                      .map((u) => ({
                        value: u.id,
                        label: `${u.firstName} ${u.lastName}`,
                      })),
                  ]}
                />
              )}

              {assignmentMode === 'ROTATE_TEAM' && (
                <Input
                  label="Team ID (optional)"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="Enter team identifier"
                />
              )}
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
                  Back to Edit
                </Button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-gray-900">{validCount}</span>
                    <span className="text-gray-600">valid inspection{validCount !== 1 ? 's' : ''}</span>
                  </div>
                  {duplicateCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-amber-900">{duplicateCount}</span>
                      <span className="text-amber-700">duplicate{duplicateCount !== 1 ? 's' : ''} (will be skipped)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-600">
                      {previewItems.length} total inspection{previewItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Asset</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewItems.map((item, index) => (
                      <tr
                        key={`${item.assetId}-${item.date}-${index}`}
                        className={item.isDuplicate ? 'bg-amber-50' : 'bg-white'}
                      >
                        <td className="px-4 py-2 text-gray-900">{item.assetName}</td>
                        <td className="px-4 py-2 text-gray-600">{formatDateUK(item.date)}</td>
                        <td className="px-4 py-2 text-center">
                          {item.isDuplicate ? (
                            <Badge variant="warning" size="sm" title={item.duplicateReason}>
                              Duplicate
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">Ready</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          {!showPreview ? (
            <Button variant="primary" onClick={generatePreview} disabled={creating}>
              Generate Preview
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={creating}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={creating || validCount === 0}
              >
                {creating
                  ? 'Creating...'
                  : `Create ${validCount} Inspection${validCount !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

