import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, AlertTriangle, Clock, MoreVertical } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { getAllInspections, updateInspection } from '../db/repository';
import { mockUsers } from '../../reports/services/mockUsers';
import { formatDateUK } from '../../../lib/formatters';
import type { Inspection } from '../types';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';
type InspectorGroup = {
  id: string;
  name: string;
  userId?: string;
  capacity: number; // Max inspections per day
};

interface InspectionCard {
  inspection: Inspection;
  dateKey: string;
  inspectorId: string;
}

interface PlannerProps {
  inspections: Inspection[];
  onInspectionUpdate?: (inspection: Inspection) => void;
}

export function InspectionPlanner({ inspections, onInspectionUpdate }: PlannerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedInspection, setDraggedInspection] = useState<Inspection | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ dateKey: string; inspectorId: string } | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});

  // Get inspectors (users who can inspect)
  const inspectors: InspectorGroup[] = useMemo(() => {
    const inspectorUsers = mockUsers.filter(
      (u) => ['Admin', 'Manager', 'Supervisor', 'Fitter'].includes(u.role || '')
    );
    return [
      { id: 'unassigned', name: 'Unassigned', capacity: 999 },
      ...inspectorUsers.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        userId: u.id,
        capacity: 8, // Default capacity
      })),
    ];
  }, []);

  // Get date range based on view mode
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);

    if (viewMode === 'day') {
      dates.push(new Date(start));
    } else if (viewMode === 'week') {
      // Get week start (Monday)
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      const weekStart = new Date(start.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        dates.push(date);
      }
    } else {
      // Month view - show first 4 weeks
      const firstDay = new Date(start.getFullYear(), start.getMonth(), 1);
      const dayOfWeek = firstDay.getDay();
      const diff = firstDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monthStart = new Date(firstDay.setDate(diff));
      monthStart.setHours(0, 0, 0, 0);

      for (let i = 0; i < 28; i++) {
        const date = new Date(monthStart);
        date.setDate(date.getDate() + i);
        dates.push(date);
      }
    }

    return dates;
  }, [currentDate, viewMode]);

  // Group inspections by date and inspector
  const inspectionsByDateAndInspector = useMemo(() => {
    const grouped: Record<string, Record<string, Inspection[]>> = {};

    inspections
      .filter((insp) => insp.status !== 'Closed' && (insp.plannedStartAt || insp.inspectionDate))
      .forEach((insp) => {
        const date = insp.plannedStartAt
          ? new Date(insp.plannedStartAt)
          : new Date(insp.inspectionDate);
        const dateKey = date.toISOString().split('T')[0];
        const inspectorId = insp.assignedToUserId || insp.inspectorId || 'unassigned';

        if (!grouped[dateKey]) {
          grouped[dateKey] = {};
        }
        if (!grouped[dateKey][inspectorId]) {
          grouped[dateKey][inspectorId] = [];
        }
        grouped[dateKey][inspectorId].push(insp);
      });

    return grouped;
  }, [inspections]);

  // Check for conflicts (same inspector, overlapping times)
  const checkConflict = useCallback(
    (inspection: Inspection, targetDate: string, targetInspectorId: string): string | null => {
      const targetDateObj = new Date(targetDate);
      const targetInspections = inspectionsByDateAndInspector[targetDate]?.[targetInspectorId] || [];

      // Check if inspector is at capacity
      const inspector = inspectors.find((i) => i.id === targetInspectorId);
      if (inspector && targetInspections.length >= inspector.capacity) {
        return `Inspector at capacity (${inspector.capacity} inspections)`;
      }

      // Check for time overlaps (if plannedStartAt exists)
      if (inspection.plannedStartAt) {
        const inspectionTime = new Date(inspection.plannedStartAt);
        const inspectionHour = inspectionTime.getHours();

        for (const existing of targetInspections) {
          if (existing.id === inspection.id) continue;
          if (existing.plannedStartAt) {
            const existingTime = new Date(existing.plannedStartAt);
            const existingHour = existingTime.getHours();
            // Consider overlap if within 2 hours (simple check)
            if (Math.abs(inspectionHour - existingHour) < 2) {
              return 'Time conflict with existing inspection';
            }
          }
        }
      }

      return null;
    },
    [inspectionsByDateAndInspector, inspectors]
  );

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, inspection: Inspection) => {
    setDraggedInspection(inspection);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', inspection.id);
  };

  // Handle drag over
  const handleDragOver = useCallback(
    (e: React.DragEvent, dateKey: string, inspectorId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (draggedInspection) {
        const conflict = checkConflict(draggedInspection, dateKey, inspectorId);
        if (!conflict) {
          setDragOverTarget({ dateKey, inspectorId });
        }
      }
    },
    [draggedInspection, checkConflict]
  );

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  // Handle drop
  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDate: string, targetInspectorId: string) => {
      e.preventDefault();
      setDragOverTarget(null);

      if (!draggedInspection) return;

      const conflict = checkConflict(draggedInspection, targetDate, targetInspectorId);
      if (conflict) {
        showToast(conflict, 'error');
        setDraggedInspection(null);
        return;
      }

      try {
        const targetDateObj = new Date(targetDate);
        const inspector = inspectors.find((i) => i.id === targetInspectorId);
        const inspectorName =
          targetInspectorId === 'unassigned'
            ? 'Unassigned'
            : inspector?.name || 'Unknown';

        // Update inspection
        const updated = await updateInspection(draggedInspection.id, {
          inspectionDate: targetDate,
          plannedStartAt: targetDateObj.toISOString(),
          assignedToUserId: targetInspectorId === 'unassigned' ? undefined : targetInspectorId,
          inspectorId: targetInspectorId === 'unassigned' ? draggedInspection.inspectorId : targetInspectorId,
          inspectorName,
          updatedBy: user?.id || '',
          updatedByName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
        });

        showToast('Inspection rescheduled', 'success');
        if (onInspectionUpdate) {
          onInspectionUpdate(updated);
        }
      } catch (error: any) {
        showToast(error.message || 'Failed to reschedule inspection', 'error');
      } finally {
        setDraggedInspection(null);
      }
    },
    [draggedInspection, checkConflict, inspectors, user, onInspectionUpdate]
  );

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format date header
  const formatDateHeader = (date: Date): string => {
    if (viewMode === 'day') {
      return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Get inspections for a specific date and inspector
  const getInspectionsForSlot = (dateKey: string, inspectorId: string): Inspection[] => {
    return inspectionsByDateAndInspector[dateKey]?.[inspectorId] || [];
  };

  // Get status color for inspection
  const getStatusColor = (inspection: Inspection): string => {
    if (inspection.status === 'Submitted' || inspection.status === 'Approved') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (inspection.status === 'InProgress') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (inspection.dueAt && new Date(inspection.dueAt) < new Date() && inspection.status !== 'Closed') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold text-gray-900">
            {viewMode === 'day'
              ? formatDateHeader(dateRange[0])
              : viewMode === 'week'
              ? `Week of ${formatDateHeader(dateRange[0])}`
              : currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'day' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header Row - Dates */}
          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(150px, 1fr))` }}>
            <div className="p-3 font-semibold text-gray-700 border-r border-gray-200 bg-gray-50">
              <Users className="w-4 h-4 inline mr-2" />
              Inspector
            </div>
            {dateRange.map((date) => {
              const dateKey = date.toISOString().split('T')[0];
              const isToday = dateKey === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={dateKey}
                  className={`p-3 text-center font-semibold text-gray-700 border-r border-gray-200 ${
                    isToday ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-xs">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                  <div className={`text-sm ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inspector Rows */}
          {inspectors.map((inspector) => (
            <div
              key={inspector.id}
              className="grid border-b border-gray-200"
              style={{ gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(150px, 1fr))` }}
            >
              {/* Inspector Column */}
              <div className="p-3 border-r border-gray-200 bg-gray-50">
                <div className="font-medium text-gray-900">{inspector.name}</div>
                {inspector.capacity < 999 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Capacity: {inspector.capacity}/day
                  </div>
                )}
              </div>

              {/* Date Columns */}
              {dateRange.map((date) => {
                const dateKey = date.toISOString().split('T')[0];
                const slotInspections = getInspectionsForSlot(dateKey, inspector.id);
                const isOverCapacity = inspector.capacity < 999 && slotInspections.length >= inspector.capacity;
                const isDragOver =
                  dragOverTarget?.dateKey === dateKey && dragOverTarget?.inspectorId === inspector.id;
                const capacityUsed = slotInspections.length;
                const capacityRemaining = inspector.capacity < 999 ? inspector.capacity - capacityUsed : null;

                return (
                  <div
                    key={`${inspector.id}-${dateKey}`}
                    className={`p-2 min-h-[120px] border-r border-gray-200 ${
                      isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''
                    } ${isOverCapacity ? 'bg-red-50' : ''}`}
                    onDragOver={(e) => handleDragOver(e, dateKey, inspector.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateKey, inspector.id)}
                  >
                    {inspector.capacity < 999 && (
                      <div className={`text-xs mb-1 flex items-center justify-between ${
                        isOverCapacity ? 'text-red-600' : capacityRemaining !== null && capacityRemaining <= 2 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {isOverCapacity ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            <span>At capacity ({capacityUsed}/{inspector.capacity})</span>
                          </>
                        ) : (
                          <span>{capacityUsed}/{inspector.capacity}</span>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      {slotInspections.map((inspection) => (
                        <div
                          key={inspection.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, inspection)}
                          onClick={() => setSelectedInspection(inspection)}
                          className={`text-xs p-2 rounded cursor-move hover:shadow-md transition-shadow ${getStatusColor(
                            inspection
                          )}`}
                          title={`${inspection.inspectionCode} - ${inspection.templateName}`}
                        >
                          <div className="font-medium truncate">{inspection.inspectionCode}</div>
                          <div className="text-xs opacity-75 truncate">{inspection.templateName}</div>
                          {inspection.assetId && (
                            <div className="text-xs opacity-60 truncate mt-0.5">
                              {inspection.assetId}
                            </div>
                          )}
                          {inspection.plannedStartAt && (
                            <div className="text-xs opacity-60 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(inspection.plannedStartAt).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                      {slotInspections.length === 0 && !isDragOver && (
                        <div className="text-xs text-gray-400 text-center py-4">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Inspection Detail Modal */}
      {selectedInspection && (
        <Modal
          isOpen={!!selectedInspection}
          onClose={() => setSelectedInspection(null)}
          title={`Inspection ${selectedInspection.inspectionCode}`}
          size="medium"
        >
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700">Template</div>
              <div className="text-gray-900">{selectedInspection.templateName}</div>
            </div>
            {selectedInspection.assetId && (
              <div>
                <div className="text-sm font-medium text-gray-700">Asset</div>
                <div className="text-gray-900">{selectedInspection.assetId}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700">Planned Date</div>
              <div className="text-gray-900">
                {selectedInspection.plannedStartAt
                  ? formatDateUK(selectedInspection.plannedStartAt)
                  : formatDateUK(selectedInspection.inspectionDate)}
              </div>
            </div>
            {selectedInspection.dueAt && (
              <div>
                <div className="text-sm font-medium text-gray-700">Due Date</div>
                <div className="text-gray-900">{formatDateUK(selectedInspection.dueAt)}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700">Assigned To</div>
              <div className="text-gray-900">{selectedInspection.inspectorName || 'Unassigned'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Status</div>
              <Badge
                variant={
                  selectedInspection.status === 'Submitted' || selectedInspection.status === 'Approved'
                    ? 'success'
                    : selectedInspection.status === 'InProgress'
                    ? 'info'
                    : 'warning'
                }
              >
                {selectedInspection.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                variant="primary"
                onClick={() => {
                  navigate(`/inspections/run/${selectedInspection.id}`);
                  setSelectedInspection(null);
                }}
              >
                Open / Start
              </Button>
              <Button variant="outline" onClick={() => setSelectedInspection(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

