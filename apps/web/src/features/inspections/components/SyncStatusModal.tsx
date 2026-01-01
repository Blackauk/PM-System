import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { showToast } from '../../../components/common/Toast';
import { useOffline } from '../../../contexts/OfflineContext';
import { useInspections } from '../context/InspectionsContext';
import type { Inspection } from '../types';
import { RefreshCw, CheckCircle, AlertCircle, Clock, WifiOff } from 'lucide-react';
import { formatDateUK } from '../../../lib/formatters';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: Inspection | null;
}

export function SyncStatusModal({ isOpen, onClose, inspection }: SyncStatusModalProps) {
  const { isOnline } = useOffline();
  const { sync } = useInspections();

  if (!inspection) return null;

  const handleRetrySync = async () => {
    if (!isOnline) {
      showToast('Cannot sync while offline', 'error');
      return;
    }

    try {
      await sync();
      showToast('Sync initiated', 'success');
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to sync', 'error');
    }
  };

  const getStatusBadge = () => {
    if (!inspection.syncStatus || inspection.syncStatus === 'synced') {
      return (
        <Badge variant="success" size="sm" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Synced
        </Badge>
      );
    }
    if (inspection.syncStatus === 'pending') {
      return (
        <Badge variant="warning" size="sm" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending Sync
        </Badge>
      );
    }
    if (inspection.syncStatus === 'syncing') {
      return (
        <Badge variant="info" size="sm" className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Syncing...
        </Badge>
      );
    }
    return (
      <Badge variant="error" size="sm" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Sync Failed
      </Badge>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sync Status" size="small">
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Inspection</div>
          <div className="text-gray-900 font-mono">{inspection.inspectionCode}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Sync Status</div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {!isOnline && (
              <Badge variant="warning" size="sm" className="flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </Badge>
            )}
          </div>
        </div>

        {inspection.syncedAt && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Last Synced</div>
            <div className="text-gray-900">{formatDateUK(inspection.syncedAt)}</div>
            {inspection.syncedAt && (
              <div className="text-xs text-gray-500 mt-1">
                {new Date(inspection.syncedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            )}
          </div>
        )}

        {inspection.lastSyncAttempt && inspection.syncStatus === 'failed' && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Last Sync Attempt</div>
            <div className="text-gray-900">{formatDateUK(inspection.lastSyncAttempt)}</div>
          </div>
        )}

        {inspection.syncStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-sm text-amber-800">
              This inspection has changes that are waiting to be synced to the server.
            </div>
          </div>
        )}

        {inspection.syncStatus === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-sm text-red-800 mb-2">
              The last sync attempt failed. Please check your connection and try again.
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {(inspection.syncStatus === 'pending' || inspection.syncStatus === 'failed') && isOnline && (
            <Button variant="primary" onClick={handleRetrySync}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Sync
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}


