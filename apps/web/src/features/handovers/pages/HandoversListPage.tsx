import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { ListPageTable } from '../../../components/common/ListPageTable';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { FilterSection } from '../../../components/common/FilterSection';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { FilterButton } from '../../../components/common/FilterButton';
import { StatCard } from '../../../components/common/StatCard';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { Tabs } from '../../../components/common/Tabs';
import { ClipboardList, FileText, Clock, AlertCircle, CheckCircle, XCircle, Plus, Eye, Edit, Send, CheckCircle2, XCircle as XCircleIcon, MoreVertical, Printer, History } from 'lucide-react';
import {
  getFitterHandovers,
  getHandoverStats,
  getMasterHandovers,
  submitFitterHandover,
  approveFitterHandover,
  requestChanges,
  getAuditLog,
} from '../services';
import { mockSites } from '../../assets/services';
import { showToast } from '../../../components/common/Toast';
import { CreateHandoverModal } from '../components/CreateHandoverModal';
import { CreateMasterModal } from '../components/CreateMasterModal';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import type { FitterHandover, HandoverFilter, ShiftType, FitterHandoverStatus, MasterHandover } from '../types';

export function HandoversListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('my-handovers');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HandoverFilter>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempFilters, setTempFilters] = useState<HandoverFilter>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render when handovers change
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, React.RefObject<HTMLElement>>>({});
  const [selectedHandoverIds, setSelectedHandoverIds] = useState<string[]>([]);

  // Role-based permissions
  const canCreate = ['Fitter', 'Supervisor', 'Admin'].includes(user?.role || '');
  const canApprove = ['Supervisor', 'Admin'].includes(user?.role || '');
  const canCreateMaster = ['Supervisor', 'Admin'].includes(user?.role || '');
  const canViewMasters = ['Supervisor', 'Manager', 'Admin'].includes(user?.role || '');

  // Check if we should open create modal from navigation state
  useEffect(() => {
    const state = location.state as { openCreateModal?: boolean } | null;
    if (state?.openCreateModal && canCreate) {
      setIsCreateModalOpen(true);
      // Clear the openCreateModal flag to prevent reopening on re-render
      const newState = { ...state };
      delete newState.openCreateModal;
      navigate(location.pathname, { replace: true, state: newState });
    }
  }, [location.state, canCreate, navigate, location.pathname]);

  // Get filtered handovers based on active tab
  const handovers = useMemo(() => {
    let tabFilters = { ...filters };

    if (activeTab === 'my-handovers' && user?.id) {
      // My Handovers: only show handovers for current user
      tabFilters.fitterUserId = user.id;
    } else if (activeTab === 'pending-review') {
      // Pending Review: only show submitted handovers
      tabFilters.status = 'Submitted';
    }

    return getFitterHandovers(tabFilters, search);
  }, [filters, search, activeTab, user?.id, refreshKey]);

  // Get stats for wildcards - calculate from displayed handovers to ensure they stay in sync
  const stats = useMemo(() => {
    const all = handovers; // Use the displayed handovers
    const masters = getMasterHandovers();

    return {
      total: all.length,
      drafts: all.filter(h => h.status === 'Draft').length,
      submitted: all.filter(h => h.status === 'Submitted').length,
      changesRequested: all.filter(h => h.status === 'ChangesRequested').length,
      approved: all.filter(h => h.status === 'Approved').length,
      masters: masters.length,
    };
  }, [handovers]);

  // Get master handovers for Master Handovers tab
  const masterHandovers = useMemo(() => {
    if (activeTab !== 'master-handovers') return [];
    
    const masterFilters: { siteId?: string; dateFrom?: string; dateTo?: string } = {};
    if (filters.siteId) {
      masterFilters.siteId = Array.isArray(filters.siteId) ? filters.siteId[0] : filters.siteId;
    }
    if (filters.dateFrom) masterFilters.dateFrom = filters.dateFrom;
    if (filters.dateTo) masterFilters.dateTo = filters.dateTo;

    let masters = getMasterHandovers(masterFilters);
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      masters = masters.filter(m =>
        m.id.toLowerCase().includes(searchLower) ||
        m.siteName.toLowerCase().includes(searchLower) ||
        m.supervisorName.toLowerCase().includes(searchLower)
      );
    }

    return masters;
  }, [activeTab, filters, search]);

  // Active filter count (excluding tab-specific filters)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.siteId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.shiftType) count++;
    if (filters.status && activeTab !== 'pending-review') count++; // Don't count status filter if it's tab-specific
    if (filters.hasAttachments !== undefined) count++;
    // Don't count fitterUserId if it's from "My Handovers" tab
    if (filters.fitterUserId && activeTab !== 'my-handovers') count++;
    return count;
  }, [filters, activeTab]);

  const handleFilterChange = (key: keyof HandoverFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearch('');
  };

  const handleSubmit = (id: string) => {
    const result = submitFitterHandover(id);
    if (result) {
      showToast('Handover submitted successfully', 'success');
      setRefreshKey(prev => prev + 1); // Force stats recalculation
    } else {
      showToast('Failed to submit handover', 'error');
    }
  };

  const handleApprove = (id: string) => {
    if (!user) return;
    const result = approveFitterHandover(id, user.id, `${user.firstName} ${user.lastName}`);
    if (result) {
      showToast('Handover approved', 'success');
      setRefreshKey(prev => prev + 1); // Force stats recalculation
    } else {
      showToast('Failed to approve handover', 'error');
    }
  };

  const handleRequestChanges = (id: string, notes: string) => {
    if (!user) return;
    const result = requestChanges(id, user.id, `${user.firstName} ${user.lastName}`, notes);
    if (result) {
      showToast('Changes requested', 'success');
      setRefreshKey(prev => prev + 1); // Force stats recalculation
    } else {
      showToast('Failed to request changes', 'error');
    }
  };

  // Bulk action handlers
  const handleBulkPrint = () => {
    if (selectedHandoverIds.length === 0) return;
    // For now, open each in a new window and print
    // In a real app, this would generate a combined PDF
    selectedHandoverIds.forEach((id, index) => {
      setTimeout(() => {
        window.open(`/handovers/${id}`, '_blank');
        setTimeout(() => {
          window.print();
        }, 1000);
        if (index === selectedHandoverIds.length - 1) {
          showToast(`Printing ${selectedHandoverIds.length} handover(s)`, 'info');
        }
      }, index * 500);
    });
  };

  const handleBulkSubmit = () => {
    if (selectedHandoverIds.length === 0) return;
    const selectedHandovers = handovers.filter(h => selectedHandoverIds.includes(h.id));
    
    // Check if all selected are Draft status and user owns them
    const canSubmitAll = selectedHandovers.every(h => 
      h.status === 'Draft' && h.fitterUserId === user?.id
    );
    
    if (!canSubmitAll) {
      showToast('All selected handovers must be Draft status and owned by you', 'error');
      return;
    }

    let successCount = 0;
    selectedHandoverIds.forEach(id => {
      const result = submitFitterHandover(id);
      if (result) successCount++;
    });

    if (successCount > 0) {
      showToast(`Submitted ${successCount} handover(s)`, 'success');
      setSelectedHandoverIds([]);
      setRefreshKey(prev => prev + 1);
    } else {
      showToast('Failed to submit handovers', 'error');
    }
  };

  const handleBulkApprove = () => {
    if (selectedHandoverIds.length === 0 || !user) return;
    const selectedHandovers = handovers.filter(h => selectedHandoverIds.includes(h.id));
    
    // Check if all selected are Submitted status
    const canApproveAll = selectedHandovers.every(h => h.status === 'Submitted');
    
    if (!canApproveAll) {
      showToast('All selected handovers must be Submitted status', 'error');
      return;
    }

    let successCount = 0;
    selectedHandoverIds.forEach(id => {
      const result = approveFitterHandover(id, user.id, `${user.firstName} ${user.lastName}`);
      if (result) successCount++;
    });

    if (successCount > 0) {
      showToast(`Approved ${successCount} handover(s)`, 'success');
      setSelectedHandoverIds([]);
      setRefreshKey(prev => prev + 1);
    } else {
      showToast('Failed to approve handovers', 'error');
    }
  };

  const handleBulkRequestChanges = () => {
    if (selectedHandoverIds.length === 0 || !user) return;
    const selectedHandovers = handovers.filter(h => selectedHandoverIds.includes(h.id));
    
    // Check if all selected are Submitted status
    const canRequestChangesAll = selectedHandovers.every(h => h.status === 'Submitted');
    
    if (!canRequestChangesAll) {
      showToast('All selected handovers must be Submitted status', 'error');
      return;
    }

    const notes = prompt('Enter notes for requested changes (applies to all selected):');
    if (!notes || !notes.trim()) {
      return;
    }

    let successCount = 0;
    selectedHandovers.forEach(h => {
      const result = requestChanges(h.id, user.id, `${user.firstName} ${user.lastName}`, notes);
      if (result) successCount++;
    });

    if (successCount > 0) {
      showToast(`Requested changes for ${successCount} handover(s)`, 'success');
      setSelectedHandoverIds([]);
      setRefreshKey(prev => prev + 1);
    } else {
      showToast('Failed to request changes', 'error');
    }
  };

  // Get bulk action availability
  const getBulkActions = () => {
    if (selectedHandoverIds.length === 0) return [];
    
    const selectedHandovers = handovers.filter(h => selectedHandoverIds.includes(h.id));
    const actions = [];

    // Always available: Print
    actions.push({
      label: `Print (${selectedHandoverIds.length})`,
      icon: Printer,
      onClick: handleBulkPrint,
      available: true,
    });

    // Check if all are Draft/ChangesRequested and user owns them
    const allDraftOrChangesRequested = selectedHandovers.every(h => 
      (h.status === 'Draft' || h.status === 'ChangesRequested') && h.fitterUserId === user?.id
    );
    if (allDraftOrChangesRequested && canCreate) {
      actions.push({
        label: `Submit (${selectedHandoverIds.length})`,
        icon: Send,
        onClick: handleBulkSubmit,
        available: true,
      });
    }

    // Check if all are Submitted
    const allSubmitted = selectedHandovers.every(h => h.status === 'Submitted');
    if (allSubmitted && canApprove) {
      actions.push({
        label: `Approve (${selectedHandoverIds.length})`,
        icon: CheckCircle2,
        onClick: handleBulkApprove,
        available: true,
      });
      actions.push({
        label: `Request Changes (${selectedHandoverIds.length})`,
        icon: XCircleIcon,
        onClick: handleBulkRequestChanges,
        available: true,
      });
    }

    return actions;
  };

  const getStatusBadge = (status: FitterHandoverStatus) => {
    const variants: Record<FitterHandoverStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
      Draft: 'default',
      Submitted: 'info',
      ChangesRequested: 'warning',
      Approved: 'success',
      IncludedInMaster: 'default',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  // Master Handover columns
  const masterColumns = [
    {
      key: 'id',
      label: 'Master ID',
      sortable: true,
      render: (value: string) => <span className="font-mono font-medium">{value}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'shiftType',
      label: 'Shift',
      sortable: true,
      render: (_: any, row: MasterHandover) => (
        <div>
          <div className="text-sm font-medium">{row.shiftType}</div>
          <div className="text-xs text-gray-500">{row.shiftPattern}</div>
        </div>
      ),
    },
    {
      key: 'siteName',
      label: 'Site',
      sortable: true,
    },
    {
      key: 'supervisorName',
      label: 'Supervisor',
      sortable: true,
    },
    {
      key: 'includedHandoverIds',
      label: 'No. of Fitters',
      sortable: false,
      render: (_: any, row: MasterHandover) => row.includedHandoverIds.length,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: MasterHandover) => {
        const variants: Record<MasterHandover['status'], 'default' | 'success' | 'warning' | 'error' | 'info'> = {
          Draft: 'default',
          SubmittedToManagement: 'info',
          Acknowledged: 'success',
        };
        return <Badge variant={variants[row.status]}>{row.status}</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: MasterHandover) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/handovers/master/${row.id}`);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      ),
    },
  ];

  // Individual Handover columns
  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Handover ID',
      sortable: true,
      render: (value: string) => <span className="font-mono font-medium">{value}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'shiftType',
      label: 'Shift',
      sortable: true,
      render: (_: any, row: FitterHandover) => (
        <div>
          <div className="text-sm font-medium">{row.shiftType}</div>
          <div className="text-xs text-gray-500">{row.shiftPattern}</div>
        </div>
      ),
    },
    {
      key: 'siteName',
      label: 'Site',
      sortable: true,
    },
    {
      key: 'fitterName',
      label: 'Fitter',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: FitterHandover) => getStatusBadge(row.status),
    },
    {
      key: 'locations',
      label: 'Locations',
      sortable: false,
      render: (_: any, row: FitterHandover) => (
        <div className="text-sm text-gray-600 max-w-[200px] truncate">
          {row.locations.join(', ')}
        </div>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: FitterHandover) => {
        const isOwner = row.fitterUserId === user?.id;
        const canEdit = isOwner && (row.status === 'Draft' || row.status === 'ChangesRequested');
        const canSubmit = isOwner && row.status === 'Draft';
        const canApproveThis = canApprove && row.status === 'Submitted';
        const canRequestChanges = canApprove && row.status === 'Submitted';
        const canIncludeInMaster = canCreateMaster && row.status === 'Approved';

        // Get or create ref for this row's menu button
        if (!menuRefs.current[row.id]) {
          menuRefs.current[row.id] = React.createRef<HTMLElement>();
        }
        const menuRef = menuRefs.current[row.id];


        // Build menu items - all actions go into the kebab menu
        const menuItems = [];
        
        // Always available: View
        menuItems.push({
          label: 'View',
          icon: Eye,
          onClick: () => navigate(`/handovers/${row.id}`),
        });

        // Draft / Changes Requested (owner / permitted roles)
        if (canEdit) {
          menuItems.push({
            label: 'Edit',
            icon: Edit,
            onClick: () => {
              setEditingId(row.id);
              setIsCreateModalOpen(true);
            },
          });
        }

        if (canSubmit) {
          menuItems.push({
            label: 'Submit',
            icon: Send,
            onClick: () => handleSubmit(row.id),
          });
        }

        // Submitted (Supervisor/Manager roles)
        if (canApproveThis) {
          menuItems.push({
            label: 'Approve',
            icon: CheckCircle2,
            onClick: () => handleApprove(row.id),
          });
        }

        if (canRequestChanges) {
          menuItems.push({
            label: 'Request Changes',
            icon: XCircleIcon,
            onClick: () => {
              const notes = prompt('Enter notes for requested changes:');
              if (notes) {
                handleRequestChanges(row.id, notes);
              }
            },
          });
        }

        // Always available: Print
        menuItems.push({
          label: 'Print Handover',
          icon: Printer,
          onClick: () => {
            navigate(`/handovers/${row.id}`);
            setTimeout(() => {
              window.print();
            }, 500);
          },
        });

        // View History (if audit log exists)
        const auditLog = getAuditLog(row.id);
        if (auditLog.length > 0) {
          menuItems.push({
            label: 'View History',
            icon: History,
            onClick: () => navigate(`/handovers/${row.id}`),
          });
        }

        return (
          <div className="flex items-center justify-end">
            <div className="relative">
              <button
                ref={menuRef as any}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === row.id ? null : row.id);
                }}
                className="p-1.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Actions menu"
              >
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
              {menuRef && (
                <DropdownMenu
                  isOpen={openMenuId === row.id}
                  onClose={() => setOpenMenuId(null)}
                  anchorRef={menuRef as React.RefObject<HTMLElement>}
                  items={menuItems}
                  width="w-48"
                />
              )}
            </div>
          </div>
        );
      },
    },
  ], [user?.id, canApprove, canCreateMaster, openMenuId, navigate, setEditingId, setIsCreateModalOpen, handleSubmit, handleApprove, handleRequestChanges]);

  // Build tabs array based on role
  const tabs = useMemo(() => {
    const tabList: Array<{ id: string; label: string; content: React.ReactNode }> = [];

    // My Handovers - visible to all who can create handovers
    if (canCreate) {
      tabList.push({
        id: 'my-handovers',
        label: 'My Handovers',
        content: (
          <ListPageTable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by handover ID, fitter, site, location, keywords…"
            onFilterClick={() => {
              setTempFilters(filters);
              setShowFilterPanel(true);
            }}
            activeFilterCount={activeFilterCount}
            filterButtonRef={filterButtonRef}
            columns={columns}
            data={handovers}
            onRowClick={(row) => navigate(`/handovers/${row.id}`)}
            selectable={true}
            selectedIds={selectedHandoverIds}
            onSelectionChange={setSelectedHandoverIds}
            getRowId={(row) => row.id}
            showingText={`Showing ${handovers.length} handover${handovers.length !== 1 ? 's' : ''}`}
            headerActions={
              canCreate ? (
                <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Handover
                </Button>
              ) : undefined
            }
            emptyMessage="No handovers found matching your criteria"
          />
        ),
      });
    }

    // Pending Review - visible to supervisors
    if (canApprove) {
      tabList.push({
        id: 'pending-review',
        label: 'Pending Review',
        content: (
          <ListPageTable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by handover ID, fitter, site, location, keywords…"
            onFilterClick={() => {
              setTempFilters(filters);
              setShowFilterPanel(true);
            }}
            activeFilterCount={activeFilterCount}
            filterButtonRef={filterButtonRef}
            columns={columns}
            data={handovers}
            onRowClick={(row) => navigate(`/handovers/${row.id}`)}
            selectable={true}
            selectedIds={selectedHandoverIds}
            onSelectionChange={setSelectedHandoverIds}
            getRowId={(row) => row.id}
            showingText={`Showing ${handovers.length} handover${handovers.length !== 1 ? 's' : ''} awaiting review`}
            headerActions={
              canCreate ? (
                <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Handover
                </Button>
              ) : undefined
            }
            emptyMessage="No handovers pending review"
          />
        ),
      });
    }

    // Master Handovers - visible to supervisors and management
    if (canViewMasters) {
      tabList.push({
        id: 'master-handovers',
        label: 'Master Handovers',
        content: (
          <div className="space-y-4">
            {canCreateMaster && (
              <div className="flex justify-end">
                <Button onClick={() => setIsMasterModalOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Master Handover
                </Button>
              </div>
            )}
            <ListPageTable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by master ID, site, supervisor…"
              onFilterClick={() => {
              setTempFilters(filters);
              setShowFilterPanel(true);
            }}
              activeFilterCount={activeFilterCount}
              filterButtonRef={filterButtonRef}
              columns={masterColumns}
              data={masterHandovers}
              onRowClick={(row) => navigate(`/handovers/master/${row.id}`)}
              showingText={`Showing ${masterHandovers.length} master handover${masterHandovers.length !== 1 ? 's' : ''}`}
              emptyMessage="No master handovers found"
            />
          </div>
        ),
      });
    }

    return tabList;
  }, [search, handovers, masterHandovers, activeFilterCount, canCreate, canApprove, canViewMasters, canCreateMaster, columns, masterColumns, navigate, filterButtonRef]);

  // Default tab based on role
  const defaultTabId = useMemo(() => {
    if (canCreate) return 'my-handovers';
    if (canApprove) return 'pending-review';
    if (canViewMasters) return 'master-handovers';
    return 'my-handovers';
  }, [canCreate, canApprove, canViewMasters]);

  // Ensure activeTab is valid for current role
  useEffect(() => {
    const availableTabIds = tabs.map(t => t.id);
    if (!availableTabIds.includes(activeTab)) {
      setActiveTab(defaultTabId);
    }
  }, [activeTab, tabs, defaultTabId]);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedHandoverIds([]);
  }, [activeTab]);

  return (
    <div className="p-6 space-y-6">
      {/* Wildcards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Handovers"
          value={stats.total}
          icon={ClipboardList}
          accentColor="blue"
        />
        <StatCard
          title="Drafts"
          value={stats.drafts}
          icon={FileText}
          accentColor="gray"
        />
        <StatCard
          title="Submitted"
          value={stats.submitted}
          icon={Clock}
          accentColor="blue"
        />
        <StatCard
          title="Changes Requested"
          value={stats.changesRequested}
          icon={AlertCircle}
          accentColor="amber"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          accentColor="green"
        />
        <StatCard
          title="Masters"
          value={stats.masters}
          icon={XCircle}
          accentColor="gray"
        />
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <Tabs
          tabs={tabs}
          value={activeTab}
          onTabChange={setActiveTab}
          defaultTab={defaultTabId}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedHandoverIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedHandoverIds.length} selected
                </span>
                <button
                  onClick={() => setSelectedHandoverIds([])}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getBulkActions().map((action, idx) => (
                  <Button
                    key={idx}
                    onClick={action.onClick}
                    size="sm"
                    variant="outline"
                    className="bg-white"
                  >
                    <action.icon className="w-4 h-4 mr-1.5" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
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
          const emptyFilters: HandoverFilter = {};
          setTempFilters(emptyFilters);
          setFilters(emptyFilters);
        }}
        title="Handover Filters"
      >
        <div className="space-y-4">
          <FilterSection title="Site">
            <MultiSelectFilter
              options={mockSites.map(site => ({ value: site.id, label: site.name }))}
              selected={Array.isArray(tempFilters.siteId) ? tempFilters.siteId : tempFilters.siteId ? [tempFilters.siteId] : []}
              onChange={(selected) => setTempFilters(prev => ({ ...prev, siteId: selected.length === 1 ? selected[0] : selected.length > 0 ? selected : undefined }))}
              searchable={true}
              placeholder="Search sites..."
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

          <FilterSection title="Shift Type">
            <Select
              value={tempFilters.shiftType || ''}
              onChange={(e) => setTempFilters(prev => ({ ...prev, shiftType: e.target.value as ShiftType || undefined }))}
              options={[
                { value: '', label: 'All Shifts' },
                { value: 'Days', label: 'Days' },
                { value: 'Nights', label: 'Nights' },
              ]}
            />
          </FilterSection>

          <FilterSection title="Status">
            <MultiSelectFilter
              options={[
                { value: 'Draft', label: 'Draft' },
                { value: 'Submitted', label: 'Submitted' },
                { value: 'ChangesRequested', label: 'Changes Requested' },
                { value: 'Approved', label: 'Approved' },
                { value: 'IncludedInMaster', label: 'Included in Master' },
              ]}
              selected={Array.isArray(tempFilters.status) ? tempFilters.status : tempFilters.status ? [tempFilters.status] : []}
              onChange={(selected) => setTempFilters(prev => ({ ...prev, status: selected.length === 1 ? selected[0] : selected.length > 0 ? selected : undefined }))}
              placeholder="Select statuses..."
            />
          </FilterSection>

          <FilterSection title="Has Attachments">
            <Select
              value={tempFilters.hasAttachments === undefined ? '' : tempFilters.hasAttachments ? 'yes' : 'no'}
              onChange={(e) => setTempFilters(prev => ({ ...prev, hasAttachments: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : undefined }))}
              options={[
                { value: '', label: 'All' },
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </FilterSection>
        </div>
      </FilterPanel>

      {/* Create Handover Modal */}
      <CreateHandoverModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingId(undefined);
        }}
        editId={editingId}
        onSuccess={() => {
          setEditingId(undefined);
          setRefreshKey(prev => prev + 1); // Force stats recalculation
        }}
      />

      {/* Create Master Modal */}
      {canCreateMaster && (
        <CreateMasterModal
          isOpen={isMasterModalOpen}
          onClose={() => setIsMasterModalOpen(false)}
          onSuccess={() => {
            setRefreshKey(prev => prev + 1); // Force stats recalculation
          }}
        />
      )}

    </div>
  );
}

