import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useOffline } from '../../../contexts/OfflineContext';
import { useTestMode } from '../../../contexts/TestModeContext';
import { useDefects } from '../context/DefectsContext';
import { Card } from '../../../components/common/Card';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SortableTable } from '../../../components/common/SortableTable';
import { ListPageTable } from '../../../components/common/ListPageTable';
import { FloatingFilterPanel, FilterSection } from '../../../components/common/FloatingFilterPanel';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { FilterButton } from '../../../components/common/FilterButton';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { CollapsibleCard } from '../../../components/common/CollapsibleCard';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { FilterChip } from '../../../components/common/FilterChip';
import { Modal } from '../../../components/common/Modal';
import { Select } from '../../../components/common/Select';
import { ChevronLeft, ChevronRight, AlertTriangle, X, CheckCircle, XCircle, TestTube, MoreVertical, ClipboardList, Clock, AlertCircle } from 'lucide-react';
import { StatCard } from '../../../components/common/StatCard';
import { WildcardGrid } from '../../../components/common/WildcardGrid';
import { canRaiseDefect } from '../lib/permissions';
import { mockSites } from '../../assets/services';
import { initialSeedDefects, getNextDefectCode, getRandomAsset, getRandomUser, getRandomSeverity } from '../lib/mockDefects';
import type { DefectFilter, DefectStatus, DefectSeverity, SeverityModel } from '../types';
import type { Defect } from '../types';

interface TestEvent {
  id: string;
  timestamp: string;
  message: string;
}

export function DefectsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, syncStatus } = useOffline();
  const { testModeEnabled } = useTestMode();
  const {
    defects: contextDefects,
    summary: contextSummary,
    syncQueueCount,
    loading: contextLoading,
    loadDefects,
    sync,
    updateDefectData,
  } = useDefects();

  // Local state for defects (for testing)
  const [localDefects, setLocalDefects] = useState<Defect[]>(() => {
    const saved = localStorage.getItem('defects-local-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [...initialSeedDefects];
      }
    }
    return [...initialSeedDefects];
  });

  // Use local defects if available, otherwise fall back to context
  const defects = localDefects.length > 0 ? localDefects : contextDefects;
  const loading = contextLoading && localDefects.length === 0;

  // Save local defects to localStorage
  useEffect(() => {
    if (localDefects.length > 0) {
      localStorage.setItem('defects-local-state', JSON.stringify(localDefects));
    }
  }, [localDefects]);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DefectFilter>(() => {
    const saved = localStorage.getItem('defects-filters');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeWildcard, setActiveWildcard] = useState<string | null>(() => {
    const saved = localStorage.getItem('defects-active-wildcard');
    return saved || null;
  });
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempFilters, setTempFilters] = useState<DefectFilter>(filters);
  
  // Test panel state
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [testEvents, setTestEvents] = useState<TestEvent[]>([]);
  
  // Defect Alerts sidebar state
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(() => {
    const saved = localStorage.getItem('defect-alerts-collapsed');
    return saved === 'true';
  });
  const [alertsPanelWidth, setAlertsPanelWidth] = useState(() => {
    const saved = localStorage.getItem('defect-alerts-width');
    return saved ? Number(saved) : 360;
  });
  
  const handleToggleAlerts = () => {
    const newState = !isAlertsCollapsed;
    setIsAlertsCollapsed(newState);
    localStorage.setItem('defect-alerts-collapsed', String(newState));
  };

  useEffect(() => {
    if (localDefects.length === 0) {
      loadDefects();
    }
  }, [loadDefects, localDefects.length]);

  // Calculate dynamic summary from local defects
  const summary = useMemo(() => {
    const now = new Date();
    return {
      total: defects.length,
      open: defects.filter(d => d.status === 'Open' || d.status === 'InProgress' || d.status === 'Acknowledged').length,
      overdue: defects.filter(d => {
        if (d.status === 'Closed') return false;
        if (d.status === 'Overdue') return true;
        if (d.targetRectificationDate) {
          return new Date(d.targetRectificationDate) < now;
        }
        return false;
      }).length,
      unsafe: defects.filter(d => d.unsafeDoNotUse && d.status !== 'Closed').length,
    };
  }, [defects]);

  const filteredDefects = useMemo(() => {
    let filtered = [...defects];

    // Apply wildcard filters first
    if (activeWildcard === 'total') {
      // Clear status filters - show all
    } else if (activeWildcard === 'open') {
      filtered = filtered.filter((d) => d.status === 'Open' || d.status === 'InProgress' || d.status === 'Acknowledged');
    } else if (activeWildcard === 'overdue') {
      const now = new Date();
      filtered = filtered.filter((d) => {
        if (d.status === 'Closed') return false;
        if (d.status === 'Overdue') return true;
        if (d.targetRectificationDate) {
          return new Date(d.targetRectificationDate) < now;
        }
        return false;
      });
    } else if (activeWildcard === 'unsafe') {
      filtered = filtered.filter((d) => d.unsafeDoNotUse && d.status !== 'Closed');
    }

    // Apply regular filters
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      filtered = filtered.filter((d) => statuses.includes(d.status));
    }
    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      filtered = filtered.filter((d) => severities.includes(d.severity));
    }
    if (filters.siteId) {
      const sites = Array.isArray(filters.siteId) ? filters.siteId : [filters.siteId];
      filtered = filtered.filter((d) => sites.includes(d.siteId || ''));
    }
    if (filters.unsafe !== undefined) {
      filtered = filtered.filter((d) => d.unsafeDoNotUse === filters.unsafe);
    }
    if (filters.assignedToId) {
      filtered = filtered.filter((d) => d.assignedToId === filters.assignedToId);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter((d) => {
        const date = d.targetRectificationDate ? new Date(d.targetRectificationDate) : null;
        return date && date >= new Date(filters.dateFrom!);
      });
    }
    if (filters.dateTo) {
      filtered = filtered.filter((d) => {
        const date = d.targetRectificationDate ? new Date(d.targetRectificationDate) : null;
        return date && date <= new Date(filters.dateTo!);
      });
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.defectCode.toLowerCase().includes(searchLower) ||
          (d.title || '').toLowerCase().includes(searchLower) ||
          (d.description || '').toLowerCase().includes(searchLower) ||
          (d.assetId || '').toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [defects, search, filters, activeWildcard]);

  const handleFilterChange = (key: keyof DefectFilter, value: string | string[] | boolean | undefined) => {
    setFilters((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      localStorage.setItem('defects-filters', JSON.stringify(updated));
      return updated;
    });
  };

  const handleWildcardClick = (wildcard: string) => {
    if (activeWildcard === wildcard) {
      setActiveWildcard(null);
      localStorage.removeItem('defects-active-wildcard');
    } else {
      setActiveWildcard(wildcard);
      localStorage.setItem('defects-active-wildcard', wildcard);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        count += filters.status.length > 0 ? 1 : 0;
      } else {
        count++;
      }
    }
    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        count += filters.severity.length > 0 ? 1 : 0;
      } else {
        count++;
      }
    }
    if (filters.siteId) {
      if (Array.isArray(filters.siteId)) {
        count += filters.siteId.length > 0 ? 1 : 0;
      } else {
        count++;
      }
    }
    if (filters.unsafe !== undefined) count++;
    if (filters.assignedToId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  // Defect Alerts
  const defectAlerts = useMemo(() => {
    const alerts: Array<{ type: string; title: string; detail: string; icon: React.ReactNode; onClick: () => void }> = [];
    const now = new Date();

    // Unsafe Asset Alert
    const unsafeDefects = defects.filter(d => d.unsafeDoNotUse && d.status !== 'Closed');
    if (unsafeDefects.length > 0) {
      alerts.push({
        type: 'unsafe',
        title: 'Unsafe Assets',
        detail: `${unsafeDefects.length} open unsafe defect${unsafeDefects.length !== 1 ? 's' : ''}`,
        icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
        onClick: () => {
          setActiveWildcard('unsafe');
          handleWildcardClick('unsafe');
        },
      });
    }

    // Overdue Defect Alert
    const overdueDefects = defects.filter(d => {
      if (d.status === 'Closed') return false;
      if (d.status === 'Overdue') return true;
      if (d.targetRectificationDate) {
        return new Date(d.targetRectificationDate) < now;
      }
      return false;
    });
    if (overdueDefects.length > 0) {
      alerts.push({
        type: 'overdue',
        title: 'Overdue Defects',
        detail: `${overdueDefects.length} defect${overdueDefects.length !== 1 ? 's' : ''} past target date`,
        icon: <XCircle className="w-5 h-5 text-red-600" />,
        onClick: () => {
          setActiveWildcard('overdue');
          handleWildcardClick('overdue');
        },
      });
    }

    // Multiple Defects on Same Asset
    const assetDefectCounts = new Map<string, number>();
    defects.filter(d => d.status !== 'Closed' && d.assetId).forEach(d => {
      const count = assetDefectCounts.get(d.assetId!) || 0;
      assetDefectCounts.set(d.assetId!, count + 1);
    });
    const multiDefectAssets = Array.from(assetDefectCounts.entries()).filter(([_, count]) => count >= 2);
    if (multiDefectAssets.length > 0) {
      alerts.push({
        type: 'multi-asset',
        title: 'Multiple Defects on Assets',
        detail: `${multiDefectAssets.length} asset${multiDefectAssets.length !== 1 ? 's' : ''} with 2+ open defects`,
        icon: <AlertTriangle className="w-5 h-5 text-orange-600" />,
        onClick: () => {
          // Filter by first asset with multiple defects
          const assetId = multiDefectAssets[0][0];
          handleFilterChange('assetId', assetId);
        },
      });
    }

    // High Severity Open Defects
    const highSeverityOpen = defects.filter(d => 
      (d.severity === 'High' || d.severity === 'Critical' || d.severity === 'Major') && 
      d.status !== 'Closed'
    );
    if (highSeverityOpen.length > 0) {
      alerts.push({
        type: 'high-severity',
        title: 'High Severity Open',
        detail: `${highSeverityOpen.length} open high severity defect${highSeverityOpen.length !== 1 ? 's' : ''}`,
        icon: <AlertTriangle className="w-5 h-5 text-orange-600" />,
        onClick: () => {
          handleFilterChange('severity', ['High', 'Critical', 'Major']);
        },
      });
    }

    return alerts;
  }, [defects]);

  // Test Panel Functions
  const addTestEvent = (message: string) => {
    const event: TestEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      message,
    };
    setTestEvents(prev => [event, ...prev].slice(0, 10));
  };

  const handleResetData = () => {
    setLocalDefects([...initialSeedDefects]);
    addTestEvent('Reset data to original 10 seeded defects');
  };

  const handleCreateRandomDefect = () => {
    const newCode = getNextDefectCode(localDefects);
    const randomAsset = getRandomAsset();
    const randomUser = getRandomUser();
    const randomSeverity = getRandomSeverity();
    const now = new Date();
    const targetDate = new Date(now.getTime() + (Math.random() * 14 + 1) * 24 * 60 * 60 * 1000);

    const newDefect: Defect = {
      id: crypto.randomUUID(),
      defectCode: newCode,
      title: `Random defect ${newCode}`,
      description: `Auto-generated test defect with ${randomSeverity} severity`,
      status: 'Open',
      severityModel: 'LMH',
      severity: randomSeverity,
      unsafeDoNotUse: randomSeverity === 'High',
      assetId: randomAsset,
      assignedToId: randomUser.id,
      assignedToName: randomUser.name,
      createdAt: now.toISOString(),
      targetRectificationDate: targetDate.toISOString().split('T')[0],
      updatedAt: now.toISOString(),
      createdBy: 'user-1',
      createdByName: 'Test User',
      updatedBy: 'user-1',
      updatedByName: 'Test User',
      siteId: '1',
      siteName: 'Site A',
      reopenedCount: 0,
      actions: [],
      attachments: [],
      beforeAfterRequired: false,
      complianceTags: [],
      history: [],
      comments: [],
    };

    setLocalDefects(prev => [...prev, newDefect]);
    addTestEvent(`Created ${newCode}`);
  };

  const handleMarkRandomOverdue = () => {
    const openDefects = localDefects.filter(d => d.status === 'Open' || d.status === 'InProgress');
    if (openDefects.length === 0) {
      addTestEvent('No open defects to mark overdue');
      return;
    }
    const randomDefect = openDefects[Math.floor(Math.random() * openDefects.length)];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    setLocalDefects(prev => prev.map(d => 
      d.id === randomDefect.id 
        ? { ...d, status: 'Overdue' as DefectStatus, targetRectificationDate: yesterday.toISOString().split('T')[0], updatedAt: new Date().toISOString() }
        : d
    ));
    addTestEvent(`Marked ${randomDefect.defectCode} as overdue`);
  };

  const handleToggleUnsafe = () => {
    const openDefects = localDefects.filter(d => (d.status === 'Open' || d.status === 'InProgress') && !d.unsafeDoNotUse);
    if (openDefects.length === 0) {
      addTestEvent('No safe open defects to toggle');
      return;
    }
    const randomDefect = openDefects[Math.floor(Math.random() * openDefects.length)];

    setLocalDefects(prev => prev.map(d => 
      d.id === randomDefect.id 
        ? { ...d, unsafeDoNotUse: !d.unsafeDoNotUse, updatedAt: new Date().toISOString() }
        : d
    ));
    addTestEvent(`${randomDefect.unsafeDoNotUse ? 'Removed unsafe flag from' : 'Marked'} ${randomDefect.defectCode}`);
  };

  const handleCloseRandomDefect = () => {
    const openDefects = localDefects.filter(d => d.status === 'Open' || d.status === 'InProgress');
    if (openDefects.length === 0) {
      addTestEvent('No open defects to close');
      return;
    }
    const randomDefect = openDefects[Math.floor(Math.random() * openDefects.length)];
    const now = new Date();

    setLocalDefects(prev => prev.map(d => 
      d.id === randomDefect.id 
        ? { ...d, status: 'Closed' as DefectStatus, updatedAt: now.toISOString() }
        : d
    ));
    addTestEvent(`Closed ${randomDefect.defectCode}`);
  };

  const handleSimulateUnsafe = () => {
    const openDefects = localDefects.filter(d => d.status === 'Open' || d.status === 'InProgress' && !d.unsafeDoNotUse);
    if (openDefects.length === 0) {
      addTestEvent('No open defects to mark unsafe');
      return;
    }
    const randomDefect = openDefects[Math.floor(Math.random() * openDefects.length)];

    setLocalDefects(prev => prev.map(d => 
      d.id === randomDefect.id 
        ? { ...d, unsafeDoNotUse: true, updatedAt: new Date().toISOString() }
        : d
    ));
    addTestEvent(`Marked ${randomDefect.defectCode} as UNSAFE / DO NOT USE`);
  };

  const handleCloseDefect = async (defectId: string) => {
    const defect = localDefects.find(d => d.id === defectId);
    if (!defect || defect.status === 'Closed') return;

    setLocalDefects(prev => prev.map(d => 
      d.id === defectId 
        ? { ...d, status: 'Closed' as DefectStatus, updatedAt: new Date().toISOString() }
        : d
    ));
    addTestEvent(`Closed ${defect.defectCode}`);
  };

  const handleToggleUnsafeDefect = (defectId: string) => {
    const defect = localDefects.find(d => d.id === defectId);
    if (!defect) return;

    setLocalDefects(prev => prev.map(d => 
      d.id === defectId 
        ? { ...d, unsafeDoNotUse: !d.unsafeDoNotUse, updatedAt: new Date().toISOString() }
        : d
    ));
    addTestEvent(`${defect.unsafeDoNotUse ? 'Removed unsafe flag from' : 'Marked'} ${defect.defectCode}`);
  };

  const canCreate = canRaiseDefect(user?.role);

  const columns = useMemo(() => [
    {
      key: 'defectCode',
      label: 'Defect Code',
      sortable: true,
      render: (_: any, row: Defect) => (
        <span className="font-mono font-medium">{row.defectCode || row.id}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (_: any, row: Defect) => (
        <div>
          <div className="font-medium text-gray-900">{row.title || 'Untitled'}</div>
          {row.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: Defect) => <StatusBadge status={row.status} />,
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (_: any, row: Defect) => (
        <SeverityBadge severity={row.severity} severityModel={row.severityModel} />
      ),
    },
    {
      key: 'unsafe',
      label: 'Unsafe',
      sortable: true,
      render: (_: any, row: Defect) => (
        row.unsafeDoNotUse ? (
          <Badge variant="error" size="sm" className="font-bold">DO NOT USE</Badge>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      ),
    },
    {
      key: 'assetId',
      label: 'Asset',
      sortable: true,
      render: (_: any, row: Defect) => (
        row.assetId ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/assets/${row.assetId}`);
            }}
            className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-mono"
          >
            {row.assetId}
          </button>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )
      ),
    },
    {
      key: 'assignedToName',
      label: 'Assigned To',
      sortable: true,
      render: (_: any, row: Defect) => (
        row.assignedToName || <span className="text-gray-400 text-sm">Unassigned</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (_: any, row: Defect) => (
        <div className="text-sm">{new Date(row.createdAt).toLocaleDateString()}</div>
      ),
    },
    {
      key: 'targetRectificationDate',
      label: 'Target Date',
      sortable: true,
      render: (_: any, row: Defect) => {
        const isOverdue = row.targetRectificationDate && 
          new Date(row.targetRectificationDate) < new Date() && 
          row.status !== 'Closed';
        return row.targetRectificationDate ? (
          <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
            {new Date(row.targetRectificationDate).toLocaleDateString()}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: Defect) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/defects/${row.id}`);
            }}
            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
            title="View"
          >
            View
          </button>
          {row.status !== 'Closed' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseDefect(row.id);
                }}
                className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                title="Close"
              >
                Close
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleUnsafeDefect(row.id);
                }}
                className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded"
                title="Toggle Unsafe"
              >
                {row.unsafeDoNotUse ? 'Safe' : 'Unsafe'}
              </button>
            </>
          )}
        </div>
      ),
    },
  ], [navigate]);

  const hasActiveFilters = activeFilterCount > 0 || activeWildcard !== null;

  return (
    <div className="p-6 space-y-6">
      {/* Command Bar - Status badges only */}
      <div className="flex items-center justify-end gap-2">
        {!isOnline && (
          <Badge variant="warning" size="sm">
            Offline ({syncQueueCount} pending)
          </Badge>
        )}
        {isOnline && syncQueueCount > 0 && (
          <Badge variant="info" size="sm" onClick={sync} className="cursor-pointer">
            {syncQueueCount} pending sync
          </Badge>
        )}
      </div>

      {/* Summary Cards (Wildcards) - Full Width */}
      <WildcardGrid columns={4}>
        <StatCard
          title="Total Defects"
          value={summary.total}
          icon={ClipboardList}
          onClick={() => handleWildcardClick('total')}
          accentColor="blue"
          className={activeWildcard === 'total' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
        <StatCard
          title="Open"
          value={summary.open}
          icon={Clock}
          onClick={() => handleWildcardClick('open')}
          accentColor="blue"
          className={activeWildcard === 'open' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
        <StatCard
          title="Overdue"
          value={summary.overdue}
          icon={AlertCircle}
          onClick={() => handleWildcardClick('overdue')}
          accentColor="red"
          className={activeWildcard === 'overdue' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
        <StatCard
          title="Unsafe / Do Not Use"
          value={summary.unsafe}
          icon={AlertTriangle}
          onClick={() => handleWildcardClick('unsafe')}
          accentColor="red"
          className={activeWildcard === 'unsafe' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        />
      </WildcardGrid>

      {/* Logic Flow Test Panel */}
      {testModeEnabled && (
        <CollapsibleCard
          title={
            <div className="flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              <span>Logic Flow Test Panel</span>
            </div>
          }
          defaultExpanded={false}
        >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Button size="sm" variant="outline" onClick={handleResetData}>
              Reset Data
            </Button>
            <Button size="sm" variant="outline" onClick={handleCreateRandomDefect}>
              Create Random
            </Button>
            <Button size="sm" variant="outline" onClick={handleMarkRandomOverdue}>
              Mark Overdue
            </Button>
            <Button size="sm" variant="outline" onClick={handleToggleUnsafe}>
              Toggle Unsafe
            </Button>
            <Button size="sm" variant="outline" onClick={handleCloseRandomDefect}>
              Close Random
            </Button>
            <Button size="sm" variant="outline" onClick={handleSimulateUnsafe}>
              Simulate Unsafe
            </Button>
          </div>
          <div className="border-t pt-2">
            <div className="text-xs font-medium text-gray-700 mb-2">Event Log (Last 10):</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {testEvents.length === 0 ? (
                <div className="text-xs text-gray-500">No events yet</div>
              ) : (
                testEvents.map(event => (
                  <div key={event.id} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">{event.timestamp}</span>
                    <span>{event.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CollapsibleCard>
      )}


      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilterPanel}
        onClose={() => {
          setShowFilterPanel(false);
          setTempFilters(filters); // Reset temp filters on close
        }}
        onApply={() => {
          setFilters(tempFilters);
          setShowFilterPanel(false);
        }}
        onReset={() => {
          const emptyFilters: DefectFilter = {};
          setTempFilters(emptyFilters);
          setFilters(emptyFilters);
          setActiveWildcard(null);
          localStorage.removeItem('defects-filters');
          localStorage.removeItem('defects-active-wildcard');
        }}
        title="Defect Filters"
      >
        <div className="space-y-4">
          <FilterSection title="Status">
            <MultiSelectFilter
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'Acknowledged', label: 'Acknowledged' },
                { value: 'InProgress', label: 'In Progress' },
                { value: 'Overdue', label: 'Overdue' },
                { value: 'Deferred', label: 'Deferred' },
                { value: 'Closed', label: 'Closed' },
              ]}
              selected={Array.isArray(tempFilters.status) ? tempFilters.status : tempFilters.status ? [tempFilters.status] : []}
              onChange={(selected) => setTempFilters(prev => ({ ...prev, status: selected.length === 1 ? selected[0] : selected.length > 0 ? selected : undefined }))}
              placeholder="Select statuses..."
            />
          </FilterSection>
          
          <FilterSection title="Severity">
            <MultiSelectFilter
              options={[
                { value: 'Low', label: 'Low' },
                { value: 'Medium', label: 'Medium' },
                { value: 'High', label: 'High' },
                { value: 'Critical', label: 'Critical' },
                { value: 'Minor', label: 'Minor' },
                { value: 'Major', label: 'Major' },
              ]}
              selected={Array.isArray(tempFilters.severity) ? tempFilters.severity : tempFilters.severity ? [tempFilters.severity] : []}
              onChange={(selected) => setTempFilters(prev => ({ ...prev, severity: selected.length === 1 ? selected[0] : selected.length > 0 ? selected : undefined }))}
              placeholder="Select severities..."
            />
          </FilterSection>
          
          <FilterSection title="Site">
            <MultiSelectFilter
              options={mockSites.map((site) => ({ value: site.id, label: site.name }))}
              selected={Array.isArray(tempFilters.siteId) ? tempFilters.siteId : tempFilters.siteId ? [tempFilters.siteId] : []}
              onChange={(selected) => setTempFilters(prev => ({ ...prev, siteId: selected.length === 1 ? selected[0] : selected.length > 0 ? selected : undefined }))}
              placeholder="Select sites..."
            />
          </FilterSection>
          
          <FilterSection title="Unsafe / Do Not Use">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tempFilters.unsafe === true}
                onChange={(e) => setTempFilters(prev => ({ ...prev, unsafe: e.target.checked ? true : undefined }))}
                className="rounded"
              />
              <span className="text-sm">Show unsafe defects only</span>
            </label>
          </FilterSection>
          
          <FilterSection title="Assigned To">
            <Select
              value={tempFilters.assignedToId || ''}
              onChange={(e) => setTempFilters(prev => ({ ...prev, assignedToId: e.target.value || undefined }))}
              options={[
                { value: '', label: 'All Users' },
                { value: 'user-1', label: 'John Smith' },
                { value: 'user-2', label: 'Sarah Johnson' },
                { value: 'user-3', label: 'David Lee' },
                { value: 'user-4', label: 'Mike Davis' },
                { value: 'user-5', label: 'Emma Wilson' },
                { value: 'user-6', label: 'Lisa Anderson' },
              ]}
            />
          </FilterSection>
          
          <FilterSection title="Date Range">
            <div className="space-y-2">
              <Input
                type="date"
                label="From"
                value={tempFilters.dateFrom || ''}
                onChange={(e) => setTempFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
              />
              <Input
                type="date"
                label="To"
                value={tempFilters.dateTo || ''}
                onChange={(e) => setTempFilters(prev => ({ ...prev, dateTo: e.target.value || undefined }))}
              />
            </div>
          </FilterSection>
        </div>
      </FilterPanel>

      {/* Main Content with Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {loading ? (
            <Card>
              <div className="p-6 text-center py-8 text-gray-500">Loading defects...</div>
            </Card>
          ) : (
            <ListPageTable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by defect code, title, asset, assigned to…"
              onFilterClick={() => setShowFilterPanel(true)}
              activeFilterCount={activeFilterCount}
              filterButtonRef={filterButtonRef}
              columns={columns}
              data={filteredDefects}
              onRowClick={(row) => navigate(`/defects/${row.id}`)}
              showingText={`Showing ${filteredDefects.length} defect${filteredDefects.length !== 1 ? 's' : ''}`}
              emptyMessage="No defects found matching your criteria"
            />
          )}
        </div>

        {/* Right Column - Alerts */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Defect Alerts</h2>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  {defectAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={alert.onClick}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        {alert.icon}
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{alert.title}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{alert.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {defectAlerts.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500">No alerts</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Floating Filter Panel (for Sort) */}
      <FloatingFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        anchorRef={filterButtonRef}
      >
        <div className="space-y-4">
          <FilterSection title="Status">
            <MultiSelectFilter
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'Acknowledged', label: 'Acknowledged' },
                { value: 'InProgress', label: 'In Progress' },
                { value: 'Overdue', label: 'Overdue' },
                { value: 'Deferred', label: 'Deferred' },
                { value: 'Closed', label: 'Closed' },
              ]}
              selected={Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : []}
              onChange={(selected) => handleFilterChange('status', selected.length === 1 ? selected[0] : selected)}
              placeholder="Select statuses..."
            />
          </FilterSection>
          
          <FilterSection title="Severity">
            <MultiSelectFilter
              options={[
                { value: 'Low', label: 'Low' },
                { value: 'Medium', label: 'Medium' },
                { value: 'High', label: 'High' },
                { value: 'Critical', label: 'Critical' },
                { value: 'Minor', label: 'Minor' },
                { value: 'Major', label: 'Major' },
              ]}
              selected={Array.isArray(filters.severity) ? filters.severity : filters.severity ? [filters.severity] : []}
              onChange={(selected) => handleFilterChange('severity', selected.length === 1 ? selected[0] : selected)}
              placeholder="Select severities..."
            />
          </FilterSection>
          
          <FilterSection title="Site">
            <MultiSelectFilter
              options={mockSites.map((site) => ({ value: site.id, label: site.name }))}
              selected={Array.isArray(filters.siteId) ? filters.siteId : filters.siteId ? [filters.siteId] : []}
              onChange={(selected) => handleFilterChange('siteId', selected.length === 1 ? selected[0] : selected)}
              placeholder="Select sites..."
            />
          </FilterSection>
          
          <FilterSection title="Unsafe / Do Not Use">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.unsafe === true}
                onChange={(e) => handleFilterChange('unsafe', e.target.checked ? true : undefined)}
                className="rounded"
              />
              <span className="text-sm">Show unsafe defects only</span>
            </label>
          </FilterSection>
          
          <FilterSection title="Assigned To">
            <MultiSelectFilter
              options={[
                { value: 'user-1', label: 'John Smith' },
                { value: 'user-2', label: 'Sarah Johnson' },
                { value: 'user-3', label: 'David Lee' },
                { value: 'user-4', label: 'Mike Davis' },
                { value: 'user-5', label: 'Emma Wilson' },
                { value: 'user-6', label: 'Lisa Anderson' },
              ]}
              selected={filters.assignedToId ? [filters.assignedToId] : []}
              onChange={(selected) => handleFilterChange('assignedToId', selected.length === 1 ? selected[0] : undefined)}
              placeholder="Select assignee..."
            />
          </FilterSection>
          
          <FilterSection title="Date Range">
            <div className="space-y-2">
              <Input
                type="date"
                label="From"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
              />
              <Input
                type="date"
                label="To"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
              />
            </div>
          </FilterSection>
          
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({});
                setActiveWildcard(null);
                localStorage.removeItem('defects-filters');
                localStorage.removeItem('defects-active-wildcard');
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      </FloatingFilterPanel>
    </div>
  );
}
