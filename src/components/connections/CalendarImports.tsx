import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../context/ProfilesContext';
import { Calendar, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import DeleteCalendarConfirmModal from './DeleteCalendarConfirmModal';

interface CalendarImport {
  id: string;
  calendar_name: string;
  calendar_url: string;
  profile_id: string;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  last_synced_at: string | null;
  error_message: string | null;
  is_active: boolean;
  created_at: string;
}

interface CalendarImportsProps {
  onAddClick: () => void;
}

export default function CalendarImports({ onAddClick }: CalendarImportsProps) {
  const { profiles } = useProfiles();
  const [calendarImports, setCalendarImports] = useState<CalendarImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCalendarImports();
  }, []);

  const loadCalendarImports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('calendar_imports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalendarImports(data || []);
    } catch (error) {
      console.error('Error loading calendar imports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (importId: string) => {
    setSyncingIds(prev => new Set(prev).add(importId));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-external-calendar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ calendar_import_id: importId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync calendar');
      }

      await loadCalendarImports();
    } catch (error) {
      console.error('Error syncing calendar:', error);
      alert('Failed to sync calendar. Please try again.');
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(importId);
        return newSet;
      });
    }
  };

  const handleDelete = (importId: string, calendarName: string) => {
    setCalendarToDelete({ id: importId, name: calendarName });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!calendarToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('calendar_imports')
        .delete()
        .eq('id', calendarToDelete.id);

      if (error) throw error;

      await loadCalendarImports();
      setDeleteModalOpen(false);
      setCalendarToDelete(null);
    } catch (error) {
      console.error('Error deleting calendar import:', error);
      alert('Failed to delete calendar import. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getProfileName = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile?.name || 'Unknown Profile';
  };

  const formatLastSync = (lastSyncedAt: string | null) => {
    if (!lastSyncedAt) return 'Never';

    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = (status: string, isSyncing: boolean) => {
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }

    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Calendar Imports</h2>
        </div>
        <div className="text-center py-8 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Calendar Imports</h2>
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Calendar
        </button>
      </div>

      {calendarImports.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No calendar imports yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Import calendars from Google, Apple, or any ICS feed to sync events automatically
          </p>
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Calendar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {calendarImports.map((calendarImport) => {
            const isSyncing = syncingIds.has(calendarImport.id);

            return (
              <div
                key={calendarImport.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">
                        {calendarImport.calendar_name}
                      </h3>
                      {getStatusIcon(calendarImport.sync_status, isSyncing)}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Profile:</span> {getProfileName(calendarImport.profile_id)}
                      </p>
                      <p>
                        <span className="font-medium">Last Sync:</span> {formatLastSync(calendarImport.last_synced_at)}
                      </p>
                      {calendarImport.error_message && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-red-700 text-xs">{calendarImport.error_message}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleSync(calendarImport.id)}
                      disabled={isSyncing}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Sync Now"
                    >
                      <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(calendarImport.id, calendarImport.calendar_name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Calendars automatically sync every 2 hours. You can also manually sync at any time.
            </p>
          </div>
        </div>
      )}

      <DeleteCalendarConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCalendarToDelete(null);
        }}
        onConfirm={confirmDelete}
        calendarName={calendarToDelete?.name || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}
