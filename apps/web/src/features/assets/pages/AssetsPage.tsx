import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Upload, Building2, AlertTriangle, AlertCircle, Shield, Ban } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Checkbox } from '../../../components/common/Checkbox';
import { Select } from '../../../components/common/Select';
import { FloatingFilterPanel, FilterSection } from '../../../components/common/FloatingFilterPanel';
import { MultiSelectFilter } from '../../../components/common/MultiSelectFilter';
import { ListPageTable } from '../../../components/common/ListPageTable';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import { StatCard } from '../../../components/common/StatCard';
import { formatOperationalStatus } from '../../../lib/formatters';
import { getCountBadgeVariant } from '../../../lib/badges';
import { getAssets, getAssetTypes, mockSites, mockResponsibleTeams, bulkUpdateAssets } from '../services';
import { validateStatusCombination } from '../utils/statusValidation';
import { AddAssetFormModal } from '../components/AddAssetFormModal';
import { BulkAddAssetsModal } from '../components/BulkAddAssetsModal';
import { showToast } from '../../../components/common/Toast';
import type { OperationalStatus, LifecycleStatus, ComplianceRAG, Asset, AssetFilter } from '../types';

export function AssetsPage() {
  const navigate = useNavigate();
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const addAssetButtonRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AssetFilter>({ includeArchived: false });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddAssetDropdownOpen, setIsAddAssetDropdownOpen] = useState(false);
  const [isSingleFormOpen, setIsSingleFormOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [bulkOperationalStatus, setBulkOperationalStatus] = useState<OperationalStatus | ''>('');
  const [bulkLifecycleStatus, setBulkLifecycleStatus] = useState<LifecycleStatus | ''>('');

  const assetTypes = getAssetTypes();
  const [openIssuesOnly, setOpenIssuesOnly] = useState(false);
  const allAssets = useMemo(() => {
    const assets = getAssets({
      ...filters,
      search: search || undefined,
    });
    // Apply openIssuesOnly filter if set
    if (openIssuesOnly) {
      return assets.filter((asset) => (asset.openIssuesCount ?? 0) > 0);
    }
    return assets;
  }, [search, filters, openIssuesOnly]);

  const handleAddAssetSuccess = () => {
    // Force re-render by updating a dummy state or just rely on the fact that
    // getAssets will return the new assets since we're using the same mockAssets array
    // The component will re-render when filters/search change
    setSearch((prev) => prev); // Trigger re-render
  };

  const handleBulkUpdate = () => {
    if (selectedAssetIds.length === 0) return;

    const updates: Partial<Asset> = {};
    let hasUpdates = false;

    // Validate status combination if both are being changed
    if (bulkOperationalStatus && bulkLifecycleStatus) {
      const validation = validateStatusCombination(bulkOperationalStatus, bulkLifecycleStatus);
      if (!validation.isValid) {
        showToast(validation.message || 'Invalid status combination', 'error');
        return;
      }
      // Apply auto-correction if needed
      if (validation.autoCorrect) {
        if (validation.autoCorrect.operationalStatus) {
          updates.operationalStatus = validation.autoCorrect.operationalStatus;
          hasUpdates = true;
        }
        if (validation.autoCorrect.lifecycleStatus) {
          updates.lifecycleStatus = validation.autoCorrect.lifecycleStatus;
          hasUpdates = true;
        }
      } else {
        updates.operationalStatus = bulkOperationalStatus;
        updates.lifecycleStatus = bulkLifecycleStatus;
        hasUpdates = true;
      }
    } else if (bulkOperationalStatus) {
      updates.operationalStatus = bulkOperationalStatus;
      hasUpdates = true;
    } else if (bulkLifecycleStatus) {
      updates.lifecycleStatus = bulkLifecycleStatus;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      showToast('Please select a status to change', 'error');
      return;
    }

    try {
      const result = bulkUpdateAssets(selectedAssetIds, updates);
      
      if (result.errors.length > 0) {
        showToast(`Updated ${result.updated} assets. ${result.errors.length} failed.`, 'warning');
      } else {
        showToast(`Updated ${result.updated} assets`, 'success');
      }

      // Clear selection and reset form
      setSelectedAssetIds([]);
      setBulkOperationalStatus('');
      setBulkLifecycleStatus('');
      
      // Trigger re-render
      setSearch((prev) => prev);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update assets', 'error');
    }
  };

  const handleFilterChange = (groupId: string, value: string | string[] | undefined) => {
    setFilters((prev: AssetFilter) => {
      const newFilters = { ...prev };
      if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
        delete newFilters[groupId as keyof AssetFilter];
      } else {
        newFilters[groupId as keyof AssetFilter] = value as any;
      }
      return newFilters;
    });
  };

  const handleMultiSelectChange = (groupId: string, selected: string[]) => {
    handleFilterChange(groupId, selected.length > 0 ? selected : undefined);
  };

  const clearFilters = () => {
    setSearch('');
    setFilters({ includeArchived: false });
    setOpenIssuesOnly(false);
  };

  const getRAGBadge = (rag: ComplianceRAG) => {
    const variants = {
      Red: 'error' as const,
      Amber: 'warning' as const,
      Green: 'success' as const,
    };
    return <Badge variant={variants[rag]}>{rag}</Badge>;
  };

  const getStatusBadge = (status: OperationalStatus) => {
    const variants: Record<OperationalStatus, 'default' | 'success' | 'warning' | 'error'> = {
      InUse: 'success',
      OutOfUse: 'warning',
      OffHirePending: 'warning',
      OffHired: 'default',
      Quarantined: 'error',
      Archived: 'default',
    };
    return <Badge variant={variants[status]}>{formatOperationalStatus(status)}</Badge>;
  };

  // Note: getAssets already applies auto-archive logic, so allAssets already has effective status
  // But we need to ensure the table displays it correctly

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.siteId && (Array.isArray(filters.siteId) ? filters.siteId.length > 0 : true)) count++;
    if (filters.assetTypeId && (Array.isArray(filters.assetTypeId) ? filters.assetTypeId.length > 0 : true)) count++;
    if (filters.operationalStatus && (Array.isArray(filters.operationalStatus) ? filters.operationalStatus.length > 0 : true)) count++;
    if (filters.lifecycleStatus && (Array.isArray(filters.lifecycleStatus) ? filters.lifecycleStatus.length > 0 : true)) count++;
    if (filters.complianceRAG && (Array.isArray(filters.complianceRAG) ? filters.complianceRAG.length > 0 : true)) count++;
    if (filters.ownership && (Array.isArray(filters.ownership) ? filters.ownership.length > 0 : true)) count++;
    if (filters.responsibleTeam && (Array.isArray(filters.responsibleTeam) ? filters.responsibleTeam.length > 0 : true)) count++;
    if (filters.criticality && (Array.isArray(filters.criticality) ? filters.criticality.length > 0 : true)) count++;
    return count;
  }, [filters]);

  // Calculate KPI stats for wildcards (use base filters without search)
  const kpiStats = useMemo(() => {
    const baseAssets = getAssets({ ...filters, includeArchived: false });
    const totalAssets = baseAssets.length;
    const nonCompliantAssets = baseAssets.filter((a) => a.complianceRAG === 'Red' || a.complianceRAG === 'Amber').length;
    const redAssets = baseAssets.filter((a) => a.complianceRAG === 'Red').length;
    const amberAssets = baseAssets.filter((a) => a.complianceRAG === 'Amber').length;
    const assetsWithOpenIssues = baseAssets.filter((a) => (a.openIssuesCount ?? 0) > 0).length;
    const outOfServiceQuarantined = baseAssets.filter(
      (a) => a.operationalStatus === 'Quarantined' || a.operationalStatus === 'OutOfUse'
    ).length;

    return {
      totalAssets,
      nonCompliantAssets,
      redAssets,
      amberAssets,
      assetsWithOpenIssues,
      outOfServiceQuarantined,
    };
  }, [filters]);

  // Prepare filter options
  const siteOptions = useMemo(() => [
    ...mockSites.map((site) => ({ value: site.id, label: site.name })),
  ], []);

  const assetTypeOptions = useMemo(() => [
    ...assetTypes.map((type) => ({ value: type.id, label: `${type.code} - ${type.name}` })),
  ], [assetTypes]);

  const operationalStatusOptions = useMemo(() => [
    { value: 'InUse', label: 'In Use' },
    { value: 'OutOfUse', label: 'Out of Use' },
    { value: 'OffHirePending', label: 'Off Hire Pending' },
    { value: 'OffHired', label: 'Off Hired' },
    { value: 'Quarantined', label: 'Quarantined' },
    { value: 'Archived', label: 'Archived' },
  ], []);

  const lifecycleStatusOptions = useMemo(() => [
    { value: 'Active', label: 'Active' },
    { value: 'Decommissioned', label: 'Decommissioned' },
    { value: 'Disposed', label: 'Disposed' },
  ], []);

  const complianceRAGOptions = useMemo(() => [
    { value: 'Red', label: 'Red' },
    { value: 'Amber', label: 'Amber' },
    { value: 'Green', label: 'Green' },
  ], []);

  const ownershipOptions = useMemo(() => [
    { value: 'Owned', label: 'Owned' },
    { value: 'Hired', label: 'Hired' },
  ], []);

  const responsibleTeamOptions = useMemo(() => [
    ...mockResponsibleTeams.map((team) => ({ value: team, label: team })),
  ], []);

  const criticalityOptions = useMemo(() => [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
  ], []);

  // Get selected values as arrays
  const getSelectedArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  // Table columns
  const columns = [
    {
      key: 'assetTypeCode',
      label: 'Type',
      sortable: true,
      render: (_: any, row: Asset) => <Badge variant="info">{row.assetTypeCode}</Badge>,
    },
    {
      key: 'id',
      label: 'Asset ID',
      sortable: true,
      render: (value: string) => <span className="font-mono font-medium">{value}</span>,
    },
    {
      key: 'make',
      label: 'Make / Model',
      sortable: true,
      render: (_: any, row: Asset) => (
        <div>
          <div className="font-medium">{row.make} {row.model}</div>
          {row.manufacturer && row.manufacturer !== row.make && (
            <div className="text-xs text-gray-500">{row.manufacturer}</div>
          )}
        </div>
      ),
    },
    {
      key: 'siteName',
      label: 'Site',
      sortable: true,
    },
    {
      key: 'operationalStatus',
      label: 'Status',
      sortable: true,
      render: (_: any, row: Asset) => getStatusBadge(row.operationalStatus),
    },
    {
      key: 'complianceRAG',
      label: 'Compliance',
      sortable: true,
      render: (_: any, row: Asset) => getRAGBadge(row.complianceRAG),
    },
    {
      key: 'openChecksCount',
      label: 'Open Checks',
      sortable: true,
      align: 'center' as const,
      render: (_: any, row: Asset) => {
        const count = Number(row.openChecksCount ?? 0);
        return (
          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/assets/${row.id}?tab=checks&filter=due,overdue`);
              }}
              className="hover:opacity-80 transition-opacity"
              title={`${count} checks due/overdue`}
            >
              <Badge variant={getCountBadgeVariant(count)}>
                {count}
              </Badge>
            </button>
          </div>
        );
      },
    },
    {
      key: 'openIssuesCount',
      label: 'Open Issues',
      sortable: true,
      align: 'center' as const,
      render: (_: any, row: Asset) => {
        const count = Number(row.openIssuesCount ?? 0);
        return (
          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/assets/${row.id}?tab=defects&filter=open`);
              }}
              className="hover:opacity-80 transition-opacity"
              title={`${count} open issues`}
            >
              <Badge variant={getCountBadgeVariant(count)}>
                {count}
              </Badge>
            </button>
          </div>
        );
      },
    },
  ];



  // Handle wildcard clicks to filter
  const handleWildcardClick = (type: string) => {
    setOpenIssuesOnly(false); // Reset openIssuesOnly unless explicitly set
    if (type === 'total') {
      // Clear filters except includeArchived
      setFilters({ includeArchived: false });
      setSearch('');
      setOpenIssuesOnly(false);
    } else if (type === 'nonCompliant') {
      setFilters({ ...filters, complianceRAG: ['Red', 'Amber'], includeArchived: false });
    } else if (type === 'red') {
      setFilters({ ...filters, complianceRAG: 'Red', includeArchived: false });
    } else if (type === 'amber') {
      setFilters({ ...filters, complianceRAG: 'Amber', includeArchived: false });
    } else if (type === 'openIssues') {
      setOpenIssuesOnly(true);
      setFilters({ includeArchived: false });
    } else if (type === 'outOfService') {
      setFilters({ ...filters, operationalStatus: ['Quarantined', 'OutOfUse'], includeArchived: false });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPI Wildcards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Assets"
          value={kpiStats.totalAssets}
          icon={Building2}
          onClick={() => handleWildcardClick('total')}
          accentColor="blue"
          className={activeFilterCount === 0 && !search ? 'ring-2 ring-blue-500' : ''}
        />
        <StatCard
          title="Non-Compliant"
          value={kpiStats.nonCompliantAssets}
          subtitle="Amber + Red"
          icon={AlertTriangle}
          badgeVariant="warning"
          onClick={() => handleWildcardClick('nonCompliant')}
          accentColor="amber"
        />
        <StatCard
          title="Red (Critical)"
          value={kpiStats.redAssets}
          icon={AlertCircle}
          badgeVariant="error"
          onClick={() => handleWildcardClick('red')}
          accentColor="red"
        />
        <StatCard
          title="Amber (Due Soon)"
          value={kpiStats.amberAssets}
          icon={Shield}
          badgeVariant="warning"
          onClick={() => handleWildcardClick('amber')}
          accentColor="amber"
        />
        <StatCard
          title="Open Issues"
          value={kpiStats.assetsWithOpenIssues}
          subtitle="Assets with issues"
          icon={AlertTriangle}
          badgeVariant="error"
          onClick={() => handleWildcardClick('openIssues')}
          accentColor="red"
        />
        <StatCard
          title="Out of Service"
          value={kpiStats.outOfServiceQuarantined}
          subtitle="Quarantined/Out of Use"
          icon={Ban}
          badgeVariant="warning"
          onClick={() => handleWildcardClick('outOfService')}
          accentColor="gray"
        />
      </div>


      {/* Floating Filter Panel */}
      <FloatingFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        anchorRef={filterButtonRef}
      >
        <div className="space-y-4">
          {/* Site Filter */}
          <FilterSection title="Site">
            <MultiSelectFilter
              options={siteOptions}
              selected={getSelectedArray(filters.siteId)}
              onChange={(selected) => handleMultiSelectChange('siteId', selected)}
              searchable={true}
              placeholder="Search sites..."
            />
          </FilterSection>

          {/* Asset Type Filter */}
          <FilterSection title="Asset Type">
            <MultiSelectFilter
              options={assetTypeOptions}
              selected={getSelectedArray(filters.assetTypeId)}
              onChange={(selected) => handleMultiSelectChange('assetTypeId', selected)}
              searchable={true}
              placeholder="Search asset types..."
            />
          </FilterSection>

          {/* Operational Status Filter */}
          <FilterSection title="Operational Status">
            <MultiSelectFilter
              options={operationalStatusOptions}
              selected={getSelectedArray(filters.operationalStatus)}
              onChange={(selected) => handleMultiSelectChange('operationalStatus', selected)}
            />
          </FilterSection>

          {/* Lifecycle Status Filter */}
          <FilterSection title="Lifecycle Status">
            <MultiSelectFilter
              options={lifecycleStatusOptions}
              selected={getSelectedArray(filters.lifecycleStatus)}
              onChange={(selected) => handleMultiSelectChange('lifecycleStatus', selected)}
            />
          </FilterSection>

          {/* Compliance RAG Filter */}
          <FilterSection title="Compliance RAG">
            <MultiSelectFilter
              options={complianceRAGOptions}
              selected={getSelectedArray(filters.complianceRAG)}
              onChange={(selected) => handleMultiSelectChange('complianceRAG', selected)}
            />
          </FilterSection>

          {/* Ownership Filter */}
          <FilterSection title="Ownership">
            <MultiSelectFilter
              options={ownershipOptions}
              selected={getSelectedArray(filters.ownership)}
              onChange={(selected) => handleMultiSelectChange('ownership', selected)}
            />
          </FilterSection>

          {/* Responsible Team Filter */}
          <FilterSection title="Responsible Team">
            <MultiSelectFilter
              options={responsibleTeamOptions}
              selected={getSelectedArray(filters.responsibleTeam)}
              onChange={(selected) => handleMultiSelectChange('responsibleTeam', selected)}
              searchable={true}
              placeholder="Search teams..."
            />
          </FilterSection>

          {/* Criticality Filter */}
          <FilterSection title="Criticality">
            <MultiSelectFilter
              options={criticalityOptions}
              selected={getSelectedArray(filters.criticality)}
              onChange={(selected) => handleMultiSelectChange('criticality', selected)}
            />
          </FilterSection>

          {/* Include Archived Toggle */}
          <FilterSection title="Options">
            <Checkbox
              label="Include archived assets"
              checked={filters.includeArchived || false}
              onChange={(e) => setFilters((prev: AssetFilter) => ({ ...prev, includeArchived: e.target.checked }))}
            />
          </FilterSection>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </FloatingFilterPanel>

      {/* Bulk Actions Bar */}
      {selectedAssetIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900">
                Selected: {selectedAssetIds.length}
              </span>
              <div className="flex items-center gap-2">
                <div className="min-w-[200px]">
                  <Select
                    value={bulkOperationalStatus}
                    onChange={(e) => setBulkOperationalStatus(e.target.value as OperationalStatus | '')}
                    options={[
                      { value: '', label: 'Change Operational Status' },
                      { value: 'InUse', label: 'In Use' },
                      { value: 'OutOfUse', label: 'Out of Use' },
                      { value: 'OffHirePending', label: 'Off Hire Pending' },
                      { value: 'OffHired', label: 'Off Hired' },
                      { value: 'Quarantined', label: 'Quarantined' },
                      { value: 'Archived', label: 'Archived' },
                    ]}
                  />
                </div>
                <div className="min-w-[200px]">
                  <Select
                    value={bulkLifecycleStatus}
                    onChange={(e) => setBulkLifecycleStatus(e.target.value as LifecycleStatus | '')}
                    options={[
                      { value: '', label: 'Change Lifecycle Status' },
                      { value: 'Active', label: 'Active / On Site' },
                      { value: 'Expected', label: 'Expected / Not Yet On Site' },
                      { value: 'Decommissioned', label: 'Decommissioned' },
                      { value: 'Disposed', label: 'Disposed' },
                    ]}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleBulkUpdate}
                  disabled={!bulkOperationalStatus && !bulkLifecycleStatus}
                >
                  Apply
                </Button>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedAssetIds([]);
                setBulkOperationalStatus('');
                setBulkLifecycleStatus('');
              }}
              className="p-1 rounded hover:bg-blue-100 text-gray-600"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Results Table */}
      <ListPageTable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by Asset ID, client number, manufacturer, make, model, serial…"
        onFilterClick={() => setIsFilterOpen(!isFilterOpen)}
        activeFilterCount={activeFilterCount}
        columns={columns}
        data={allAssets}
        onRowClick={(row) => navigate(`/assets/${row.id}`)}
        selectable={true}
        selectedIds={selectedAssetIds}
        onSelectionChange={setSelectedAssetIds}
        getRowId={(row) => row.id}
        showingText={`Showing ${allAssets.length} asset${allAssets.length !== 1 ? 's' : ''}`}
        filterButtonRef={filterButtonRef}
        headerActions={
          <div className="relative" ref={addAssetButtonRef}>
            <Button
              onClick={() => setIsAddAssetDropdownOpen(!isAddAssetDropdownOpen)}
              size="sm"
            >
              + Add Asset
            </Button>
            <DropdownMenu
              isOpen={isAddAssetDropdownOpen}
              onClose={() => setIsAddAssetDropdownOpen(false)}
              anchorRef={addAssetButtonRef}
              items={[
                {
                  label: 'Add 1 Asset',
                  subtitle: 'Create a single asset using the form',
                  icon: Plus,
                  onClick: () => setIsSingleFormOpen(true),
                },
                {
                  label: 'Bulk Add',
                  subtitle: 'Upload a spreadsheet to add multiple assets',
                  icon: Upload,
                  onClick: () => setIsBulkAddOpen(true),
                },
              ]}
            />
          </div>
        }
        emptyMessage="No assets found matching your criteria"
      />

      {/* Modals */}
      <AddAssetFormModal
        isOpen={isSingleFormOpen}
        onClose={() => setIsSingleFormOpen(false)}
        onSuccess={handleAddAssetSuccess}
      />

      <BulkAddAssetsModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        onSuccess={handleAddAssetSuccess}
      />
    </div>
  );
}
