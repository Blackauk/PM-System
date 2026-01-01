import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { Tabs } from '../../../components/common/Tabs';
import { PMSchedulesListPage } from '../../pm-schedules/pages/PMSchedulesListPage';
import { InspectionSchedulesListPage } from './InspectionSchedulesListPage';

export function UnifiedSchedulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pm';

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const tabs = useMemo(() => [
    {
      id: 'pm',
      label: 'PM Schedules',
      content: (
        <ErrorBoundary>
          <PMSchedulesListPage />
        </ErrorBoundary>
      ),
    },
    {
      id: 'inspections',
      label: 'Inspection Schedules',
      content: (
        <ErrorBoundary>
          <InspectionSchedulesListPage />
        </ErrorBoundary>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        tabs={tabs}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

