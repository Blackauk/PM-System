import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Badge } from '../../../components/common/Badge';
import { SearchableMultiSelectAssetPicker } from '../../../components/common/SearchableMultiSelectAssetPicker';
import { useAuth } from '../../../contexts/AuthContext';
import { useInspections } from '../context/InspectionsContext';
import { getAssets } from '../../assets/services';
import { mockSites } from '../mockData';
import { showToast } from '../../../components/common/Toast';

export function StartInspectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templates, loadTemplates, createNewInspection } = useInspections();
  const assets = getAssets({});
  
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedAssetIds.length > 0) {
      const asset = assets.find((a) => a.id === selectedAssetIds[0]);
      if (asset) {
        setSelectedSiteId(asset.siteId);
      }
    }
  }, [selectedAssetIds, assets]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  
  // Prepare asset options for picker
  const assetOptions = assets.map((a) => ({
    id: a.id,
    label: `${a.assetTypeCode || ''} ${a.id} - ${a.make || ''} ${a.model || ''}`,
    typeCode: a.assetTypeCode,
    make: a.make,
    model: a.model,
    siteName: a.siteName,
  }));

  // Filter templates by asset type if asset selected
  const availableTemplates = selectedAssetIds.length > 0
    ? templates.filter((t) => {
        const asset = assets.find((a) => a.id === selectedAssetIds[0]);
        if (!asset) return true;
        // If template has assetTypeCode, filter by it
        if (t.assetTypeCode && asset.assetTypeCode) {
          return t.assetTypeCode === asset.assetTypeCode;
        }
        return true; // Show all if no asset type restriction
      })
    : templates;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!selectedTemplateId) {
      newErrors.templateId = 'Template is required';
    }
    if (selectedAssetIds.length === 0) {
      newErrors.assetId = 'Asset is required';
    }
    if (!inspectionDate) {
      newErrors.inspectionDate = 'Inspection date is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }
    
    if (!selectedTemplate || !user) return;
    
    try {
      const selectedAssetId = selectedAssetIds[0];
      const selectedAsset = assets.find((a) => a.id === selectedAssetId);
      const selectedSite = mockSites.find((s) => s.id === selectedSiteId);
      
      // Initialize declarations from template config
      const declarations = [];
      if (selectedTemplate.config?.requireOperativeSignature) {
        declarations.push({
          id: `decl-${Date.now()}-operative`,
          role: 'operative' as const,
          declarationText: 'I declare that the information provided in this inspection is accurate and complete.',
          signed: false,
        });
      }
      if (selectedTemplate.config?.requireSupervisorSignature) {
        declarations.push({
          id: `decl-${Date.now()}-supervisor`,
          role: 'supervisor' as const,
          declarationText: 'I have reviewed this inspection and confirm it meets the required standards.',
          signed: false,
        });
      }
      
      // Create inspection with status InProgress
      const inspection = await createNewInspection({
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateVersion: selectedTemplate.version,
        inspectionType: selectedTemplate.inspectionType,
        result: 'Pending',
        status: 'InProgress',
        assetId: selectedAssetId,
        assetTypeCode: selectedAsset?.assetTypeCode,
        assetMake: selectedAsset?.make,
        assetModel: selectedAsset?.model,
        siteId: selectedSiteId,
        siteName: selectedSite?.name,
        inspectorId: user.id,
        inspectorName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'Unknown',
        inspectorRole: user.role,
        inspectionDate: new Date(inspectionDate).toISOString(),
        startedAt: new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        sections: selectedTemplate.sections,
        items: selectedTemplate.items,
        answers: [], // Empty answers to start
        attachments: [],
        signatures: [],
        declarations: declarations.length > 0 ? declarations : undefined,
        history: [
          {
            id: `hist-${Date.now()}`,
            at: new Date().toISOString(),
            by: user.id,
            byName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'Unknown',
            byRole: user.role,
            type: 'status_change',
            summary: 'Inspection created from template',
            data: {
              templateId: selectedTemplate.id,
              templateName: selectedTemplate.name,
              templateVersion: selectedTemplate.version,
            },
          },
        ],
        revisionNumber: 1,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'Unknown',
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        updatedByName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'Unknown',
        linkedDefectIds: [],
      });
      
      showToast('Inspection started successfully', 'success');
      
      // Navigate to runner page
      navigate(`/inspections/run/${inspection.id}`);
    } catch (error) {
      console.error('Failed to create inspection:', error);
      showToast('Failed to start inspection', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Start Inspection"
        subtitle="Select asset and template to begin inspection"
      />

      <Card>
        <div className="p-6 space-y-6">
          {/* Asset Selection */}
          <div>
            <SearchableMultiSelectAssetPicker
              assets={assetOptions}
              selected={selectedAssetIds}
              onChange={(selected) => {
                setSelectedAssetIds(selected);
                if (errors.assetId) {
                  const newErrors = { ...errors };
                  delete newErrors.assetId;
                  setErrors(newErrors);
                }
              }}
              placeholder="Search and select asset..."
              label="Select Asset"
              error={errors.assetId}
              required
              allowMultiple={false} // Single select for starting inspection
            />
            {selectedAssetIds.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm">
                  <Badge variant="info">
                    {assets.find((a) => a.id === selectedAssetIds[0])?.assetTypeCode || ''}
                  </Badge>
                  <span className="font-medium">
                    {assets.find((a) => a.id === selectedAssetIds[0])?.make || ''}{' '}
                    {assets.find((a) => a.id === selectedAssetIds[0])?.model || ''}
                  </span>
                  <span className="text-gray-600 ml-2">
                    • {assets.find((a) => a.id === selectedAssetIds[0])?.siteName || ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div>
            <Select
              label="Select Inspection Template *"
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                if (errors.templateId) {
                  const newErrors = { ...errors };
                  delete newErrors.templateId;
                  setErrors(newErrors);
                }
              }}
              options={[
                { value: '', label: 'Select template...' },
                ...availableTemplates
                  .filter((t) => t.isActive)
                  .map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.inspectionType})`,
                  })),
              ]}
              error={errors.templateId}
            />
            {selectedTemplate && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{selectedTemplate.name}</div>
                  {selectedTemplate.description && (
                    <div className="text-gray-600 mt-1">{selectedTemplate.description}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {selectedTemplate.items.length} checklist items
                    {selectedTemplate.sections.length > 0 && ` • ${selectedTemplate.sections.length} sections`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Inspection Date *"
                type="date"
                value={inspectionDate}
                onChange={(e) => {
                  setInspectionDate(e.target.value);
                  if (errors.inspectionDate) {
                    const newErrors = { ...errors };
                    delete newErrors.inspectionDate;
                    setErrors(newErrors);
                  }
                }}
                error={errors.inspectionDate}
              />
            </div>
            <div>
              <Input
                label="Due Date (Optional)"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Inspector"
                value={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || ''}
                disabled
              />
            </div>
            <div>
              <Input
                label="Site"
                value={mockSites.find((s) => s.id === selectedSiteId)?.name || ''}
                disabled
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or context for this inspection..."
              style={{ scrollbarColor: '#cbd5e0 #f9fafb' }}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => navigate('/inspections')}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              Start Inspection
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
