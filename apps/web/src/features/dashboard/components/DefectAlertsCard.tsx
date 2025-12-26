import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { useDefects } from '../../defects/context/DefectsContext';
import { AlertTriangle } from 'lucide-react';
import type { Defect } from '../../defects/types';

export function DefectAlertsCard() {
  const navigate = useNavigate();
  const { defects, loading } = useDefects();

  // Calculate counts for qualifying defects
  const counts = useMemo(() => {
    const now = new Date();
    
    // Overdue: Open defects past due date
    const overdueCount = defects.filter((d) => {
      if (d.status === 'Closed') return false;
      if (d.status === 'Overdue') return true;
      if (d.targetRectificationDate) {
        return new Date(d.targetRectificationDate) < now;
      }
      return false;
    }).length;

    // Safety Critical: Open defects with Critical severity (MMC) or Critical/Major severity (MMC)
    // For LMH model, "Safety Critical" means High severity
    const safetyCriticalCount = defects.filter((d) => {
      if (d.status === 'Closed') return false;
      const isOpen = d.status === 'Open' || d.status === 'Acknowledged' || d.status === 'InProgress';
      if (!isOpen) return false;
      // For MMC model: Critical is safety critical
      if (d.severityModel === 'MMC') {
        return d.severity === 'Critical';
      }
      // For LMH model: High is safety critical
      return d.severity === 'High';
    }).length;

    // High Severity (Open): High in LMH, Major in MMC
    // Note: This can overlap with Safety Critical
    const highSeverityCount = defects.filter((d) => {
      if (d.status === 'Closed') return false;
      const isOpen = d.status === 'Open' || d.status === 'Acknowledged' || d.status === 'InProgress';
      if (!isOpen) return false;
      if (d.severityModel === 'MMC') {
        return d.severity === 'Major';
      }
      // For LMH, High is counted in safetyCritical, but we show it here too for clarity
      // The user requirements say "High Severity (Open)" so we include it
      return d.severity === 'High';
    }).length;

    // Failed Inspections with Open Defects (if inspectionId exists)
    const failedInspectionCount = defects.filter((d) => {
      if (d.status === 'Closed') return false;
      return !!d.inspectionId && 
             (d.status === 'Open' || d.status === 'Acknowledged' || d.status === 'InProgress');
    }).length;

    return {
      overdue: overdueCount,
      safetyCritical: safetyCriticalCount,
      high: highSeverityCount,
      failedInspections: failedInspectionCount,
    };
  }, [defects]);

  // Only show if at least one count > 0
  const shouldShow = counts.overdue > 0 || counts.safetyCritical > 0 || counts.high > 0 || counts.failedInspections > 0;

  // Don't render if loading or no qualifying defects
  if (loading || !shouldShow) {
    return null;
  }

  // Navigate to defects with combined filter (overdue OR high OR safety critical)
  const handleCardClick = () => {
    // Navigate to defects page with Open status filter
    // The page will show all open defects - user can apply additional filters
    navigate('/defects?status=Open');
  };

  // Navigate to overdue defects
  const handleOverdueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use query params as requested
    navigate('/defects?status=Open&overdue=true');
  };

  // Navigate to safety critical defects
  const handleSafetyCriticalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate with Critical (MMC) or High (LMH) severity filter
    // Use query params: status=open&severity=Critical&severity=High (multiple values)
    navigate('/defects?status=Open&severity=Critical&severity=High');
  };

  // Navigate to high severity defects
  const handleHighClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate with High (LMH) or Major (MMC) severity
    navigate('/defects?status=Open&severity=High&severity=Major');
  };

  // Navigate to failed inspection defects (defects with inspectionId)
  const handleFailedInspectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Set filter to show defects from inspections
    navigate('/defects?status=Open&fromInspection=true');
  };

  return (
    <Card onClick={handleCardClick} className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900">Defect Alerts</h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            View all
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {counts.overdue > 0 && (
            <button
              onClick={handleOverdueClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors"
            >
              <Badge variant="error" size="sm" className="font-bold min-w-[24px] flex justify-center">
                {counts.overdue}
              </Badge>
              <span className="text-sm font-medium text-red-700 whitespace-nowrap">Overdue</span>
            </button>
          )}

          {counts.safetyCritical > 0 && (
            <button
              onClick={handleSafetyCriticalClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors"
            >
              <Badge variant="error" size="sm" className="font-bold min-w-[24px] flex justify-center">
                {counts.safetyCritical}
              </Badge>
              <span className="text-sm font-medium text-red-700 whitespace-nowrap">Safety Critical</span>
            </button>
          )}

          {counts.high > 0 && (
            <button
              onClick={handleHighClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 hover:border-amber-300 transition-colors"
            >
              <Badge variant="warning" size="sm" className="font-bold min-w-[24px] flex justify-center">
                {counts.high}
              </Badge>
              <span className="text-sm font-medium text-amber-700 whitespace-nowrap">High</span>
            </button>
          )}

          {counts.failedInspections > 0 && (
            <button
              onClick={handleFailedInspectionClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors"
            >
              <Badge variant="error" size="sm" className="font-bold min-w-[24px] flex justify-center">
                {counts.failedInspections}
              </Badge>
              <span className="text-sm font-medium text-red-700 whitespace-nowrap">Failed Inspections</span>
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

