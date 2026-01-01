import { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Checkbox } from '../../../components/common/Checkbox';
import { Select } from '../../../components/common/Select';
import { Textarea } from '../../../components/common/Textarea';
import { useAuth } from '../../../contexts/AuthContext';
import { mockSites } from '../../assets/services';
import { getFitterHandovers, createMasterHandover, getFitterHandoverById, getMasterHandovers } from '../services';
import { showToast } from '../../../components/common/Toast';
import type { FitterHandover, ShiftType, Personnel, MaterialItem, MasterHandoverSection } from '../types';

interface CreateMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const shiftPatterns = ['5-2', '7D3O', '7N4O', '4-4', '6-3'];

export function CreateMasterModal({ isOpen, onClose, onSuccess }: CreateMasterModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    shiftType: 'Days' as ShiftType,
    shiftPattern: '5-2',
    compiledSummary: '',
  });

  const [selectedHandoverIds, setSelectedHandoverIds] = useState<string[]>([]);
  const [availableHandovers, setAvailableHandovers] = useState<FitterHandover[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        siteId: user?.siteIds?.[0] || '',
        date: new Date().toISOString().split('T')[0],
        shiftType: 'Days',
        shiftPattern: '5-2',
        compiledSummary: '',
      });
      setSelectedHandoverIds([]);
      setIsCompiling(false);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && formData.siteId && formData.date && formData.shiftType && formData.shiftPattern) {
      // Get approved handovers for this site/date/shift/shiftPattern
      // Exclude handovers already linked to a Master Handover
      const allApproved = getFitterHandovers({
        siteId: formData.siteId,
        dateFrom: formData.date,
        dateTo: formData.date,
        shiftType: formData.shiftType,
        status: 'Approved',
      });

      // Filter by shift pattern and exclude already-linked handovers
      const masters = getMasterHandovers();
      const linkedHandoverIds = new Set(
        masters.flatMap(m => m.includedHandoverIds)
      );

      const filtered = allApproved.filter(h => {
        // Match shift pattern
        if (h.shiftPattern !== formData.shiftPattern) return false;
        // Exclude already linked
        if (linkedHandoverIds.has(h.id)) return false;
        return true;
      });

      setAvailableHandovers(filtered);
      // Default: all checked
      setSelectedHandoverIds(filtered.map(h => h.id));
    } else {
      setAvailableHandovers([]);
      setSelectedHandoverIds([]);
    }
  }, [isOpen, formData.siteId, formData.date, formData.shiftType, formData.shiftPattern]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleHandover = (id: string) => {
    setSelectedHandoverIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedHandoverIds.length === availableHandovers.length) {
      setSelectedHandoverIds([]);
    } else {
      setSelectedHandoverIds(availableHandovers.map(h => h.id));
    }
  };

  const handleCompile = () => {
    if (selectedHandoverIds.length === 0) {
      showToast('Please select at least one approved handover', 'error');
      return;
    }

    setIsCompiling(true);

    // Use setTimeout to allow UI to update before compilation
    setTimeout(() => {
      try {
        // Compile summary from selected handovers
        const handovers = selectedHandoverIds
          .map(id => getFitterHandoverById(id))
          .filter(Boolean) as FitterHandover[];

        // Aggregate content with de-duplication
        const site = mockSites.find(s => s.id === formData.siteId);
        const compiledSections = compileHandoverSummary(
          handovers,
          site?.name || formData.siteId,
          formData.date,
          formData.shiftType,
          formData.shiftPattern,
          selectedHandoverIds
        );
        
        handleFieldChange('compiledSummary', compiledSections);
        
        // Auto-scroll to summary section
        setTimeout(() => {
          const summaryElement = document.getElementById('compiled-summary-textarea');
          summaryElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        showToast(`${selectedHandoverIds.length} handover${selectedHandoverIds.length > 1 ? 's' : ''} compiled into Master Summary`, 'success');
      } catch (error) {
        console.error('Error compiling summary:', error);
        showToast('Error compiling summary. Please try again.', 'error');
      } finally {
        setIsCompiling(false);
      }
    }, 100);
  };

  const handleSubmit = () => {
    if (!formData.siteId || !formData.date) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (selectedHandoverIds.length === 0) {
      showToast('Please select at least one approved handover', 'error');
      return;
    }

    if (!user) {
      showToast('User not found', 'error');
      return;
    }

    const site = mockSites.find(s => s.id === formData.siteId);
    if (!site) {
      showToast('Selected site not found', 'error');
      return;
    }

    // Aggregate personnel and create sections
    const aggregatedPersonnel = aggregatePersonnel(selectedHandoverIds);
    const initialSections = createInitialSections(selectedHandoverIds);
    
    const master = createMasterHandover({
      siteId: formData.siteId,
      siteName: site.name,
      date: formData.date,
      shiftType: formData.shiftType,
      shiftPattern: formData.shiftPattern,
      supervisorUserId: user.id,
      supervisorName: `${user.firstName} ${user.lastName}`,
      includedHandoverIds: selectedHandoverIds,
      compiledSummary: formData.compiledSummary || 'Compiled master handover',
      personnel: aggregatedPersonnel,
      sections: initialSections,
      overarchingComments: '',
      status: 'Draft',
      distributionLog: [],
    });

    showToast('Master handover created successfully', 'success');
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Master Handover"
      size="xl"
    >
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Site"
            value={formData.siteId}
            onChange={(e) => handleFieldChange('siteId', e.target.value)}
            options={[
              { value: '', label: 'Select site...' },
              ...mockSites.map(site => ({ value: site.id, label: site.name })),
            ]}
          />
          <Input
            type="date"
            label="Date"
            value={formData.date}
            onChange={(e) => handleFieldChange('date', e.target.value)}
          />
          <Select
            label="Shift Type"
            value={formData.shiftType}
            onChange={(e) => handleFieldChange('shiftType', e.target.value as ShiftType)}
            options={[
              { value: 'Days', label: 'Days' },
              { value: 'Nights', label: 'Nights' },
            ]}
          />
          <Select
            label="Shift Pattern"
            value={formData.shiftPattern}
            onChange={(e) => handleFieldChange('shiftPattern', e.target.value)}
            options={shiftPatterns.map(pattern => ({ value: pattern, label: pattern }))}
          />
        </div>

        {/* Select Approved Handovers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Select Approved Handovers
              {availableHandovers.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({selectedHandoverIds.length} of {availableHandovers.length} selected)
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              {availableHandovers.length > 0 && (
                <Button 
                  onClick={handleSelectAll} 
                  size="sm" 
                  variant="outline"
                >
                  {selectedHandoverIds.length === availableHandovers.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              <Button 
                onClick={handleCompile} 
                size="sm" 
                variant="outline" 
                disabled={selectedHandoverIds.length === 0 || isCompiling}
              >
                {isCompiling ? 'Compiling...' : 'Compile Summary'}
              </Button>
            </div>
          </div>
          {availableHandovers.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center border border-gray-200 rounded bg-gray-50">
              {formData.siteId && formData.date && formData.shiftType && formData.shiftPattern ? (
                <p>No approved handovers found for the selected site, date, shift type, and shift pattern that are not already linked to a Master Handover.</p>
              ) : (
                <p>Please select Site, Date, Shift Type, and Shift Pattern to view available approved handovers.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-4 bg-white">
              {availableHandovers.map(handover => {
                const isSelected = selectedHandoverIds.includes(handover.id);
                return (
                  <label
                    key={handover.id}
                    className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-500 hover:bg-blue-100'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleHandover(handover.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{handover.id}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {handover.fitterName} • {handover.shiftType} • {handover.locations.join(', ')}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Compiled Summary */}
        <div id="compiled-summary-section">
          <Textarea
            id="compiled-summary-textarea"
            label="Compiled Summary"
            value={formData.compiledSummary}
            onChange={(e) => handleFieldChange('compiledSummary', e.target.value)}
            placeholder="Compiled summary will appear here after clicking 'Compile Summary', or enter manually..."
            rows={12}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedHandoverIds.length === 0}>
            Create Master Handover
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Helper function to compile handover summary with de-duplication and section grouping
function compileHandoverSummary(
  handovers: FitterHandover[],
  siteName: string,
  date: string,
  shiftType: ShiftType,
  shiftPattern: string,
  handoverIds: string[]
): string {
  if (handovers.length === 0) return '';

  const sections: {
    safety: string[];
    plantEquipment: string[];
    defects: string[];
    workCompleted: string[];
    outstandingActions: string[];
  } = {
    safety: [],
    plantEquipment: [],
    defects: [],
    workCompleted: [],
    outstandingActions: [],
  };

  // Track seen content for de-duplication
  const seenContent = new Set<string>();

  handovers.forEach(handover => {
    // Safety / Critical - extract from shift comments if they contain safety keywords
    if (handover.shiftComments && handover.shiftComments.trim()) {
      const comment = handover.shiftComments.trim();
      const lowerComment = comment.toLowerCase();
      // Check for safety-related keywords
      if (lowerComment.includes('safety') || lowerComment.includes('incident') || 
          lowerComment.includes('accident') || lowerComment.includes('injury') ||
          lowerComment.includes('hazard') || lowerComment.includes('critical')) {
        const normalized = comment.toLowerCase();
        if (!seenContent.has(normalized)) {
          seenContent.add(normalized);
          sections.safety.push(`- ${comment}`);
        }
      }
    }

    // Plant / Equipment status (from tasks with asset references)
    if (handover.tasksCompleted) {
      handover.tasksCompleted
        .filter(task => task.assetReference)
        .forEach(task => {
          const equipmentText = `${task.assetReference}: ${task.description}${task.location ? ` (${task.location})` : ''}`;
          const normalized = equipmentText.toLowerCase();
          if (!seenContent.has(normalized)) {
            seenContent.add(normalized);
            sections.plantEquipment.push(`- ${equipmentText}`);
          }
        });
    }

    // Works / Progress (completed tasks)
    if (handover.tasksCompleted && handover.tasksCompleted.length > 0) {
      handover.tasksCompleted.forEach(task => {
        const taskText = `${task.description}${task.location ? ` (${task.location})` : ''}${task.assetReference ? ` - Asset: ${task.assetReference}` : ''}`;
        const normalized = taskText.toLowerCase();
        if (!seenContent.has(normalized)) {
          seenContent.add(normalized);
          sections.workCompleted.push(`- ${taskText}`);
        }
      });
    }

    // Issues / Defects / Work Orders (tasks requiring follow-up)
    if (handover.tasksCompleted) {
      handover.tasksCompleted
        .filter(task => task.requiresFollowUp)
        .forEach(task => {
          const defectText = `${task.description}${task.location ? ` (${task.location})` : ''}${task.assetReference ? ` - Asset: ${task.assetReference}` : ''}`;
          const normalized = defectText.toLowerCase();
          if (!seenContent.has(normalized)) {
            seenContent.add(normalized);
            sections.defects.push(`- ${defectText}`);
          }
        });
    }

    // Actions for Next Shift (outstanding actions)
    if (handover.nextShiftNotes && handover.nextShiftNotes.trim()) {
      const normalized = handover.nextShiftNotes.trim().toLowerCase();
      if (!seenContent.has(normalized)) {
        seenContent.add(normalized);
        sections.outstandingActions.push(`- ${handover.nextShiftNotes.trim()}`);
      }
    }
  });

  // Build compiled summary in the requested format
  const dateFormatted = new Date(date).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  
  let compiled = `MASTER HANDOVER SUMMARY\n`;
  compiled += `Site: ${siteName} | Date: ${dateFormatted} | Shift: ${shiftType} | Pattern: ${shiftPattern}\n`;
  compiled += `Included handovers: ${handoverIds.join(', ')}\n\n`;

  // 1) Safety / Critical
  if (sections.safety.length > 0) {
    compiled += `1) Safety / Critical\n`;
    sections.safety.forEach(item => compiled += `${item}\n`);
    compiled += '\n';
  }

  // 2) Plant / Equipment
  if (sections.plantEquipment.length > 0) {
    compiled += `2) Plant / Equipment\n`;
    sections.plantEquipment.forEach(item => compiled += `${item}\n`);
    compiled += '\n';
  }

  // 3) Works / Progress
  if (sections.workCompleted.length > 0) {
    compiled += `3) Works / Progress\n`;
    sections.workCompleted.forEach(item => compiled += `${item}\n`);
    compiled += '\n';
  }

  // 4) Issues / Defects / Work Orders
  if (sections.defects.length > 0) {
    compiled += `4) Issues / Defects / Work Orders\n`;
    sections.defects.forEach(item => compiled += `${item}\n`);
    compiled += '\n';
  }

  // 5) Actions for Next Shift
  if (sections.outstandingActions.length > 0) {
    compiled += `5) Actions for Next Shift\n`;
    sections.outstandingActions.forEach(item => compiled += `${item}\n`);
    compiled += '\n';
  }

  // If no content, add a note
  if (compiled === `MASTER HANDOVER SUMMARY\nSite: ${siteName} | Date: ${dateFormatted} | Shift: ${shiftType} | Pattern: ${shiftPattern}\nIncluded handovers: ${handoverIds.join(', ')}\n\n`) {
    compiled += 'No content to compile from selected handovers.\n';
  }

  return compiled.trim();
}

// Helper function to aggregate personnel from selected handovers
function aggregatePersonnel(handoverIds: string[]): Personnel[] {
  const personnelMap = new Map<string, Personnel>();
  
  handoverIds.forEach(id => {
    const handover = getFitterHandoverById(id);
    if (handover && handover.personnel) {
      handover.personnel.forEach(p => {
        const key = `${p.name}-${p.occupation}`;
        if (!personnelMap.has(key)) {
          personnelMap.set(key, { ...p });
        }
      });
    }
  });

  return Array.from(personnelMap.values());
}

// Helper function to create initial sections from selected handovers
function createInitialSections(handoverIds: string[]): MasterHandoverSection[] {
  const locationMap = new Map<string, MasterHandoverSection>();

  handoverIds.forEach(id => {
    const handover = getFitterHandoverById(id);
    if (!handover) return;

    handover.locations.forEach(location => {
      if (!locationMap.has(location)) {
        locationMap.set(location, {
          id: `section-${location.toLowerCase().replace(/\s+/g, '-')}`,
          name: location,
          tasks: [],
          issues: [],
          notes: '',
          materialsUsed: [],
          materialsRequired: [],
        });
      }

      const section = locationMap.get(location)!;

      // Add tasks
      if (handover.tasksCompleted) {
        handover.tasksCompleted
          .filter(task => !task.location || task.location === location)
          .forEach(task => {
            const taskText = `${task.description}${task.assetReference ? ` (${task.assetReference})` : ''}`;
            if (!section.tasks.includes(taskText)) {
              section.tasks.push(taskText);
            }
          });
      }

      // Add issues (tasks requiring follow-up)
      if (handover.tasksCompleted) {
        handover.tasksCompleted
          .filter(task => task.requiresFollowUp && (!task.location || task.location === location))
          .forEach(task => {
            const issueText = `${task.description}${task.assetReference ? ` (${task.assetReference})` : ''}`;
            if (!section.issues.includes(issueText)) {
              section.issues.push(issueText);
            }
          });
      }

      // Add materials
      if (handover.materialsUsed) {
        handover.materialsUsed.forEach(m => {
          const existing = section.materialsUsed.find(ex => ex.item === m.item);
          if (!existing) {
            section.materialsUsed.push({ ...m });
          }
        });
      }

      if (handover.materialsRequired) {
        handover.materialsRequired.forEach(m => {
          const existing = section.materialsRequired.find(ex => ex.item === m.item);
          if (!existing) {
            section.materialsRequired.push({ ...m });
          }
        });
      }
    });
  });

  return Array.from(locationMap.values());
}

