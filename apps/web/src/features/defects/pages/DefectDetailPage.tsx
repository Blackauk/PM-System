import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useDefects } from '../context/DefectsContext';
import { getDefectByCode, getAllDefectsFromAPI } from '../api';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Select } from '../../../components/common/Select';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { DropdownMenu } from '../../../components/common/DropdownMenu';
import {
  ArrowLeft,
  Edit,
  MoreVertical,
  Trash2,
  Copy,
  FileText,
  Camera,
  Upload,
  Clock,
  User,
  Calendar,
  MapPin,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  canEditDefect,
  canCloseDefect,
  canReopenDefect,
  validateCloseDefect,
} from '../lib/permissions';
import { showToast } from '../../../components/common/Toast';
import type { DropdownMenuItem } from '../../../components/common/DropdownMenu';
import type { Defect } from '../types';

export function DefectDetailPage() {
  const { defectCode } = useParams<{ defectCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    updateDefectData,
    closeDefect,
    reopenDefect,
    addDefectComment,
    deleteDefectData,
  } = useDefects();

  // Local state for defect data (independent from context)
  const [loading, setLoading] = useState(true);
  const [defect, setDefect] = useState<Defect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ param: string; totalDefects: number; sampleCodes: string[] } | null>(null);

  // UI state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [newComment, setNewComment] = useState('');
  const moreMenuRef = useRef<HTMLButtonElement>(null);

  // Fetch defect on mount and when defectCode changes
  useEffect(() => {
    let alive = true;

    async function fetchDefect() {
      if (!defectCode) {
        if (import.meta.env.DEV) {
          console.warn('[DefectDetail] defectCode param is undefined');
        }
        setLoading(false);
        return;
      }

      console.log('[DefectDetail] defectCode param:', defectCode);
      setLoading(true);
      setError(null);
      setDefect(null);

      try {
        // Load all defects for debug info
        const allDefects = await getAllDefectsFromAPI();
        
        // Debug info (DEV only)
        if (import.meta.env.DEV && alive) {
          const sampleCodes = allDefects.slice(0, 3).map(d => d.defectCode);
          setDebugInfo({
            param: defectCode,
            totalDefects: allDefects.length,
            sampleCodes,
          });
          console.log('[DefectDetail] Total defects:', allDefects.length);
          console.log('[DefectDetail] Sample codes:', sampleCodes);
        }

        // Find defect by code
        const loadedDefect = await getDefectByCode(defectCode);
        console.log('[DefectDetail] loaded defect:', loadedDefect);

        if (!alive) return;

        setDefect(loadedDefect);
      } catch (err: any) {
        if (!alive) return;
        setError(err.message ?? 'Failed to load defect');
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    fetchDefect();

    return () => {
      alive = false;
    };
  }, [defectCode]);

  // Refresh defect data (used after mutations)
  const refreshDefect = async () => {
    if (!defectCode) return;

    try {
      const loadedDefect = await getDefectByCode(defectCode);
      setDefect(loadedDefect);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to refresh defect');
    }
  };

  // Show skeleton while loading (NEVER "not found" during loading)
  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-8 space-y-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state with retry
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-8 text-center space-y-4">
            <div className="text-red-600 mb-4">{error}</div>
            <div className="flex gap-2 justify-center">
              <Button variant="primary" onClick={refreshDefect}>
                Retry
              </Button>
              <Button variant="outline" onClick={() => navigate('/defects')}>
                Back to Defects List
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show "not found" only after fetch completes and defect is null
  if (!defect) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-8 text-center space-y-4">
            <div className="text-gray-500">Defect not found</div>
            <Button variant="outline" onClick={() => navigate('/defects')}>
              Back to Defects List
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const canEdit = canEditDefect(user?.role);
  const canClose = canCloseDefect(user?.role);
  const canReopen = canReopenDefect(user?.role);

  const isOverdue =
    defect.targetRectificationDate &&
    new Date(defect.targetRectificationDate) < new Date() &&
    defect.status !== 'Closed';

  const handleClose = async () => {
    if (!resolutionNotes.trim()) {
      showToast('Resolution notes are required to close a defect.', 'error');
      return;
    }

    const validation = validateCloseDefect(defect);
    if (!validation.valid) {
      showToast(validation.errors.join('\n'), 'error');
      return;
    }

    try {
      await closeDefect(defect.id, resolutionNotes, user!.id, `${user!.firstName} ${user!.lastName}`);
      setShowCloseModal(false);
      setResolutionNotes('');
      await refreshDefect();
      showToast('Defect closed successfully', 'success');
    } catch (error: any) {
      showToast(`Error closing defect: ${error.message}`, 'error');
    }
  };

  const handleReopen = async () => {
    if (!confirm('Are you sure you want to reopen this defect?')) {
      return;
    }

    try {
      await reopenDefect(defect.id, user!.id, `${user!.firstName} ${user!.lastName}`);
      await refreshDefect();
      showToast('Defect reopened successfully', 'success');
    } catch (error: any) {
      showToast(`Error reopening defect: ${error.message}`, 'error');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) {
      showToast('You do not have permission to change defect status', 'error');
      return;
    }

    try {
      await updateDefectData(defect.id, {
        status: newStatus as any,
        updatedBy: user!.id,
        updatedByName: `${user!.firstName} ${user!.lastName}`,
      });
      await refreshDefect();
      showToast('Status updated successfully', 'success');
    } catch (error: any) {
      showToast(`Error updating status: ${error.message}`, 'error');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      return;
    }

    try {
      await addDefectComment(defect.id, {
        at: new Date().toISOString(),
        by: user!.id,
        byName: `${user!.firstName} ${user!.lastName}`,
        text: newComment,
      });
      setNewComment('');
      await refreshDefect();
      showToast('Comment added successfully', 'success');
    } catch (error: any) {
      showToast(`Error adding comment: ${error.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this defect? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDefectData(defect.id);
      showToast('Defect deleted successfully', 'success');
      navigate('/defects');
    } catch (error: any) {
      showToast(`Error deleting defect: ${error.message}`, 'error');
    }
  };

  const handleDuplicate = () => {
    // Navigate to create form with pre-filled data
    navigate('/defects/new', {
      state: {
        duplicateFrom: defect.id,
      },
    });
  };

  const moreMenuItems: DropdownMenuItem[] = [
    {
      label: 'Duplicate',
      icon: Copy,
      onClick: handleDuplicate,
    },
    {
      label: 'Export PDF',
      icon: FileText,
      onClick: () => {
        showToast('PDF export feature coming soon', 'info');
      },
    },
  ];

  if (canEdit) {
    moreMenuItems.push({
      label: 'Delete',
      icon: Trash2,
      onClick: handleDelete,
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Debug Panel (DEV only) */}
      {import.meta.env.DEV && debugInfo && (
        <Card>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">🔍 Debug Info</h3>
            <div className="text-xs text-blue-800 space-y-1 font-mono">
              <div>Param defectCode: <span className="font-bold">{debugInfo.param}</span></div>
              <div>Total defects loaded: {debugInfo.totalDefects}</div>
              <div>First 3 codes: {debugInfo.sampleCodes.join(', ')}</div>
              <div className="mt-2 text-blue-600">
                {defect ? `✅ Resolved to: ${defect.defectCode}` : '❌ Not found'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="outline" onClick={() => navigate('/defects')} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Defects
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {defect.defectCode} — {defect.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/defects/${defect.defectCode}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          {defect.status === 'Closed' && canReopen && (
            <Button variant="primary" size="sm" onClick={handleReopen}>
              Reopen
            </Button>
          )}
          {defect.status !== 'Closed' && canClose && (
            <Button variant="primary" size="sm" onClick={() => setShowCloseModal(true)}>
              Close Defect
            </Button>
          )}
          {defect.status !== 'Closed' && canEdit && (
            <Select
              value={defect.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="min-w-[140px]"
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'Acknowledged', label: 'Acknowledged' },
                { value: 'InProgress', label: 'In Progress' },
                { value: 'Deferred', label: 'Deferred' },
              ]}
            />
          )}
          <div className="relative">
            <button
              ref={moreMenuRef as any}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 flex items-center justify-center"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <DropdownMenu
              isOpen={showMoreMenu}
              onClose={() => setShowMoreMenu(false)}
              anchorRef={moreMenuRef as any}
              items={moreMenuItems}
              width="w-48"
            />
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={defect.status} />
        <SeverityBadge severity={defect.severity} severityModel={defect.severityModel} />
        {defect.unsafeDoNotUse && (
          <Badge variant="error" className="bg-red-600 text-white">
            <AlertTriangle className="w-4 h-4 mr-1 inline" />
            UNSAFE - DO NOT USE
          </Badge>
        )}
        {isOverdue && (
          <Badge variant="error">Overdue</Badge>
        )}
      </div>

      {/* Unsafe Banner */}
      {defect.unsafeDoNotUse && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">DO NOT USE - UNSAFE DEFECT</h3>
              <p className="text-sm text-red-700">
                This defect has been marked as unsafe. Do not use the associated asset until this defect is resolved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details Card - 2 Column Grid */}
      <Card>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <div className="text-gray-700 bg-white border border-gray-200 rounded-lg p-4 whitespace-pre-wrap">
                  {defect.description || 'No description provided'}
                </div>
              </div>

              {/* Location */}
              {(defect.siteName || defect.locationId) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </h3>
                  <div className="text-gray-700">
                    {defect.siteName && <div>{defect.siteName}</div>}
                    {defect.locationId && (
                      <div className="text-sm text-gray-600">{defect.locationId}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes / Comments */}
              {defect.comments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                  <div className="space-y-2">
                    {defect.comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{comment.byName}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap">{comment.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Asset */}
              {defect.assetId && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Asset</h3>
                  <button
                    onClick={() => navigate(`/assets/${defect.assetId}`)}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-mono text-lg font-medium flex items-center gap-2"
                  >
                    {defect.assetId}
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Assigned To */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Assigned To
                </h3>
                <div className="text-gray-700">{defect.assignedToName || 'Unassigned'}</div>
              </div>

              {/* Created Date */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Created
                </h3>
                <div className="text-gray-700">
                  <div>{new Date(defect.createdAt).toLocaleDateString()}</div>
                  <div className="text-sm text-gray-600">by {defect.createdByName}</div>
                </div>
              </div>

              {/* Target Date */}
              {defect.targetRectificationDate && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Target Rectification Date
                  </h3>
                  <div className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                    {new Date(defect.targetRectificationDate).toLocaleDateString()}
                    {isOverdue && <span className="ml-2 text-red-600">(Overdue)</span>}
                  </div>
                </div>
              )}

              {/* Compliance Tags */}
              {defect.complianceTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Compliance Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {defect.complianceTags.map((tag) => (
                      <Badge key={tag} variant="info">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Evidence / Attachments */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Photos & Evidence</h3>
            {canEdit && defect.status !== 'Closed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => showToast('Photo upload feature coming soon', 'info')}
              >
                <Upload className="w-4 h-4 mr-2" />
                Add Photo
              </Button>
            )}
          </div>
          {defect.attachments && defect.attachments.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {defect.attachments.map((attachment) => (
                <div key={attachment.id} className="relative group">
                  {attachment.type === 'photo' ? (
                    <div className="relative">
                      <img
                        src={attachment.uri}
                        alt={attachment.filename}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(attachment.uri, '_blank')}
                      />
                      {attachment.label && (
                        <Badge
                          variant={attachment.label === 'before' ? 'info' : attachment.label === 'after' ? 'success' : 'default'}
                          className="absolute top-2 left-2"
                          size="sm"
                        >
                          {attachment.label}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-32 border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 truncate">{attachment.filename}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(attachment.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No photos or evidence uploaded yet</p>
            </div>
          )}
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          <div className="space-y-4">
            {defect.history.map((entry) => (
              <div key={entry.id} className="border-l-4 border-gray-300 pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{entry.byName}</span>
                    <Badge variant="info" size="sm">
                      {entry.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-700">{entry.summary}</div>
              </div>
            ))}
            {defect.history.length === 0 && (
              <div className="text-center py-8 text-gray-500">No activity log entries</div>
            )}
          </div>
        </div>
      </Card>

      {/* Comments Section */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments</h3>
          {canEdit && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Comment</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
              />
              <Button onClick={handleAddComment} className="mt-2" size="sm" disabled={!newComment.trim()}>
                Add Comment
              </Button>
            </div>
          )}
          <div className="space-y-4">
            {defect.comments.map((comment) => (
              <div key={comment.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{comment.byName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</div>
              </div>
            ))}
            {defect.comments.length === 0 && (
              <div className="text-center py-8 text-gray-500">No comments yet</div>
            )}
          </div>
        </div>
      </Card>

      {/* Related Work Order */}
      {defect.workOrderId && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Work Order</h3>
            <button
              onClick={() => navigate(`/work-orders/${defect.workOrderId}`)}
              className="text-blue-600 hover:text-blue-700 hover:underline font-mono flex items-center gap-2"
            >
              {defect.workOrderId}
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Close Defect</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Notes <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter resolution notes..."
                    required
                  />
                  {defect.beforeAfterRequired && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ⚠️ Before and after photos are required for this defect.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowCloseModal(false);
                    setResolutionNotes('');
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleClose} disabled={!resolutionNotes.trim()}>
                    Close Defect
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
