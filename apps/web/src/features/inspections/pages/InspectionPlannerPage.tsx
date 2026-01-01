import { useState, useEffect } from 'react';
import { InspectionPlanner } from '../components/InspectionPlanner';
import { getAllInspections } from '../db/repository';
import { useInspections } from '../context/InspectionsContext';
import type { Inspection } from '../types';

export function InspectionPlannerPage() {
  const { inspections: contextInspections, loadInspections } = useInspections();
  const [inspections, setInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => {
    // Use context inspections if available, otherwise load from repository
    if (contextInspections && contextInspections.length > 0) {
      setInspections(contextInspections);
    } else {
      const allInspections = getAllInspections();
      setInspections(allInspections);
    }
  }, [contextInspections]);

  const handleInspectionUpdate = (updated: Inspection) => {
    setInspections((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    loadInspections();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Inspection Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag and drop inspections to reschedule or reassign. View capacity and conflicts.
        </p>
      </div>
      <InspectionPlanner inspections={inspections} onInspectionUpdate={handleInspectionUpdate} />
    </div>
  );
}


