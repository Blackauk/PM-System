import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useDefects } from '../context/DefectsContext';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Tabs } from '../../../components/common/Tabs';
import { Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/common/Table';
import { Input } from '../../../components/common/Input';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import {
  canEditDefect,
  canCloseDefect,
  canReopenDefect,
  validateCloseDefect,
} from '../lib/permissions';

export function DefectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentDefect,
    loading,
    loadDefect,
    updateDefectData,
    closeDefect,
    reopenDefect,
    addDefectComment,
  } = useDefects();

  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (id) {
      loadDefect(id);
    }
  }, [id, loadDefect]);

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-8 text-center text-gray-500">Loading defect...</div>
        </Card>
      </div>
    );
  }

  if (!currentDefect) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-8 text-center text-gray-500">Defect not found</div>
        </Card>
      </div>
    );
  }

  const defect = currentDefect;
  const canEdit = canEditDefect(user?.role);
  const canClose = canCloseDefect(user?.role);
  const canReopen = canReopenDefect(user?.role);

  const handleClose = async () => {
    if (!resolutionNotes.trim()) {
      alert('Resolution notes are required to close a defect.');
      return;
    }

    const validation = validateCloseDefect(defect);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    try {
      await closeDefect(defect.id, resolutionNotes, user!.id, `${user!.firstName} ${user!.lastName}`);
      setShowCloseForm(false);
      setResolutionNotes('');
      await loadDefect(defect.id);
    } catch (error: any) {
      alert(`Error closing defect: ${error.message}`);
    }
  };

  const handleReopen = async () => {
    if (!confirm('Are you sure you want to reopen this defect?')) {
      return;
    }

    try {
      await reopenDefect(defect.id, user!.id, `${user!.firstName} ${user!.lastName}`);
      await loadDefect(defect.id);
    } catch (error: any) {
      alert(`Error reopening defect: ${error.message}`);
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
      await loadDefect(defect.id);
    } catch (error: any) {
      alert(`Error adding comment: ${error.message}`);
    }
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Defect Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Defect Code</label>
                <div className="font-mono font-medium text-gray-900">{defect.defectCode}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <StatusBadge status={defect.status} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity Model</label>
                <div className="text-gray-900">{defect.severityModel}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <SeverityBadge severity={defect.severity} severityModel={defect.severityModel} />
              </div>

              {defect.unsafeDoNotUse && (
                <div className="md:col-span-2">
                  <Badge variant="error">⚠️ UNSAFE - DO NOT USE</Badge>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <div className="font-medium text-gray-900">{defect.title}</div>
              </div>

              {defect.description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <div className="text-gray-900 whitespace-pre-wrap">{defect.description}</div>
                </div>
              )}

              {defect.assetId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                  <button
                    onClick={() => navigate(`/assets/${defect.assetId}`)}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-mono"
                  >
                    {defect.assetId}
                  </button>
                </div>
              )}

              {defect.siteName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                  <div className="text-gray-900">{defect.siteName}</div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <div className="text-gray-900">{defect.assignedToName || 'Unassigned'}</div>
              </div>

              {defect.targetRectificationDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Rectification Date</label>
                  <div className={`text-gray-900 ${
                    new Date(defect.targetRectificationDate) < new Date() && defect.status !== 'Closed'
                      ? 'text-red-600 font-medium'
                      : ''
                  }`}>
                    {new Date(defect.targetRectificationDate).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Origin Panel - if created from PM Task */}
              {defect.inspectionId && defect.inspectionId.startsWith('pm-schedule-') && (
                <div className="md:col-span-2 mt-4 pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Origin</label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-gray-700">
                      <div className="font-medium mb-1">Created from PM Schedule</div>
                      <button
                        onClick={() => {
                          const scheduleId = defect.inspectionId?.replace('pm-schedule-', '');
                          if (scheduleId) navigate(`/pm-schedules/${scheduleId}`);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        View PM Schedule
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {defect.complianceTags.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {defect.complianceTags.map((tag) => (
                      <Badge key={tag} variant="info">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <div className="text-gray-900">{defect.createdByName}</div>
                <div className="text-xs text-gray-500">{new Date(defect.createdAt).toLocaleString()}</div>
              </div>

              {defect.reopenedCount > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reopened</label>
                  <div className="text-gray-900">{defect.reopenedCount} time(s)</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
            {defect.actions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Action</TableHeaderCell>
                    <TableHeaderCell>Required</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Completed</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {defect.actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>{action.title}</TableCell>
                      <TableCell>
                        {action.required ? (
                          <Badge variant="error" size="sm">Required</Badge>
                        ) : (
                          <span className="text-gray-400">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.completed ? (
                          <Badge variant="success" size="sm">Completed</Badge>
                        ) : (
                          <Badge variant="default" size="sm">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.completedAt ? (
                          <div className="text-sm">
                            <div>{new Date(action.completedAt).toLocaleDateString()}</div>
                            {action.completedByName && (
                              <div className="text-xs text-gray-500">by {action.completedByName}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">No actions defined</div>
            )}
          </div>
        </Card>
      ),
    },
    {
      id: 'comments',
      label: 'Comments',
      content: (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments</h3>
            
            {/* Add Comment */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Comment</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
              />
              <Button onClick={handleAddComment} className="mt-2" size="sm">
                Add Comment
              </Button>
            </div>

            {/* Comments List */}
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
      ),
    },
    {
      id: 'history',
      label: 'Activity Log',
      content: (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
            <div className="space-y-4">
              {defect.history.map((entry) => (
                <div key={entry.id} className="border-l-4 border-gray-300 pl-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{entry.byName}</span>
                      <Badge variant="info" size="sm">{entry.type}</Badge>
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
      ),
    },
  ];

  return (
    <div className="pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold font-mono text-gray-900">{defect.defectCode}</span>
                <StatusBadge status={defect.status} />
                <SeverityBadge severity={defect.severity} severityModel={defect.severityModel} />
                {defect.unsafeDoNotUse && (
                  <Badge variant="error">⚠️ UNSAFE - DO NOT USE</Badge>
                )}
              </div>
              <div className="text-lg text-gray-700 mb-1">{defect.title}</div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {defect.assetId && (
                  <div>
                    Asset:{' '}
                    <button
                      onClick={() => navigate(`/assets/${defect.assetId}`)}
                      className="text-blue-600 hover:text-blue-700 hover:underline font-mono"
                    >
                      {defect.assetId}
                    </button>
                  </div>
                )}
                {defect.siteName && <div>Site: {defect.siteName}</div>}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                Created by: {defect.createdByName} • {new Date(defect.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {defect.status === 'Closed' && canReopen && (
              <Button size="sm" variant="primary" onClick={handleReopen}>
                Reopen Defect
              </Button>
            )}
            {defect.status !== 'Closed' && canClose && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowCloseForm(!showCloseForm)}
              >
                Close Defect
              </Button>
            )}
          </div>

          {/* Close Form */}
          {showCloseForm && (
            <Card className="mt-4">
              <div className="p-4 space-y-4">
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
                <div className="flex gap-2">
                  <Button onClick={handleClose} disabled={!resolutionNotes.trim()}>
                    Close Defect
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCloseForm(false);
                    setResolutionNotes('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="p-6">
        <Tabs tabs={tabs} defaultTab="overview" />
      </div>
    </div>
  );
}
