import { useState, useEffect } from 'react';
import { FilterPanel } from '../../../components/common/FilterPanel';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SortableTable } from '../../../components/common/SortableTable';
import { Select } from '../../../components/common/Select';
import { showToast } from '../../../components/common/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { getDeliveries, resendDelivery } from '../services/scheduledReportsService';
import { getSchedules } from '../services/scheduledReportsService';
import type { DeliveryLog, ScheduledReport } from '../types/scheduledReportsV2';
import { Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDateUK } from '../../../lib/formatters';

interface EmailDeliveriesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailDeliveriesSidebar({ isOpen, onClose }: EmailDeliveriesSidebarProps) {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [schedules, setSchedules] = useState<Record<string, ScheduledReport>>({});
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<'30d' | '90d'>('30d');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Check permissions
  const canResend = user?.role === 'Admin' || user?.role === 'Manager';

  // Load deliveries and schedules
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, range]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deliveriesData, schedulesData] = await Promise.all([
        getDeliveries(range),
        getSchedules(),
      ]);

      setDeliveries(deliveriesData);
      
      // Create a map of schedule IDs to schedule objects
      const scheduleMap: Record<string, ScheduledReport> = {};
      schedulesData.forEach((schedule) => {
        scheduleMap[schedule.id] = schedule;
      });
      setSchedules(scheduleMap);
    } catch (error: any) {
      showToast(error.message || 'Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (delivery: DeliveryLog) => {
    setResendingId(delivery.id);
    try {
      await resendDelivery(delivery.id);
      showToast('Delivery resent successfully', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to resend delivery', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // Format recipients display
  const formatRecipients = (delivery: DeliveryLog): string => {
    const count = delivery.recipients.length;
    return `${count} recipient${count !== 1 ? 's' : ''}`;
  };

  // Get schedule name
  const getScheduleName = (delivery: DeliveryLog): string => {
    const schedule = schedules[delivery.scheduledReportId];
    return schedule?.name || 'Unknown Schedule';
  };

  // Table columns
  const columns = [
    {
      key: 'sentAt',
      label: 'Sent At',
      sortable: true,
      render: (_: any, row: DeliveryLog) => (
        <span className="text-sm font-medium text-gray-900">
          {formatDateUK(row.sentAt)}
        </span>
      ),
    },
    {
      key: 'scheduleName',
      label: 'Schedule Name',
      sortable: false,
      render: (_: any, row: DeliveryLog) => (
        <span className="text-sm text-gray-600">{getScheduleName(row)}</span>
      ),
    },
    {
      key: 'recipients',
      label: 'Recipients',
      sortable: false,
      render: (_: any, row: DeliveryLog) => (
        <span className="text-sm text-gray-600">{formatRecipients(row)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, row: DeliveryLog) => {
        const variant =
          row.status === 'Sent'
            ? 'success'
            : row.status === 'Failed'
            ? 'error'
            : 'warning';
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      key: 'format',
      label: 'Format',
      sortable: true,
      render: (_: any, row: DeliveryLog) => (
        <Badge variant="default">{row.format}</Badge>
      ),
    },
    {
      key: 'error',
      label: 'Error',
      sortable: false,
      render: (_: any, row: DeliveryLog) =>
        row.error ? (
          <div className="flex items-start gap-1 max-w-xs">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-600 truncate" title={row.error}>
              {row.error}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_: any, row: DeliveryLog) =>
        canResend ? (
          <button
            onClick={() => handleResend(row)}
            disabled={resendingId === row.id}
            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="Resend"
          >
            <RefreshCw
              className={`w-4 h-4 ${resendingId === row.id ? 'animate-spin' : ''}`}
            />
          </button>
        ) : null,
    },
  ];

  return (
    <FilterPanel
      isOpen={isOpen}
      onClose={onClose}
      onApply={() => {}} // Not used
      onReset={() => {}} // Not used
      title="Email Deliveries"
      className="md:w-[900px]"
    >
      <div className="space-y-4">
        {/* Header with Range Filter */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Delivery History</h3>
            <p className="text-xs text-gray-500 mt-1">
              View email delivery logs and status
            </p>
          </div>
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value as '30d' | '90d')}
            options={[
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ]}
            className="w-40"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No deliveries yet
            </h3>
            <p className="text-sm text-gray-500">
              Create your first scheduled report to see delivery logs here.
            </p>
          </div>
        ) : (
          <SortableTable columns={columns} data={deliveries} />
        )}
      </div>
    </FilterPanel>
  );
}


